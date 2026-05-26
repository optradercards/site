"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// /[slug]/manage/admin/reconcile
//
// CSV-driven inventory reconciliation. Upload any spreadsheet that lists
// "what you own" — Shiny collection, manyaspots export, a hand-typed list,
// whatever — and the page compares each row against your owned OP Trader
// inventory (ecom.inventory_lots, excluding consignment).
//
// Buckets by (card, grading_service, grade); ungraded collapses the grade
// dimension. Status per bucket: matched_equal / qty_mismatch / csv_only /
// op_trader_only / no_catalog_match. Per-row "Create lot" seeds a purchase
// + lot from the CSV's purchase_price for csv_only rows.
// ---------------------------------------------------------------------------

type CsvRow = {
  external_id: string | null;
  shiny_product_id: string | null;
  card_product_id: string | null;
  card_number: string | null;
  set_name: string | null;
  card_name: string | null;
  grading_service: string;
  grade: string | null;
  quantity: number;
  purchase_cents: number | null;
  purchase_currency: string | null;
  group_name: string | null;
};

type Lot = {
  id: string;
  card_product_id: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_remaining: number;
  acquisition_source: string;
  acquisition_cost_cents: number | null;
  acquisition_currency: string;
};

type ProductInfo = {
  id: string;
  name: string | null;
  card_number: string | null;
  image_url: string | null;
  set_name: string | null;
};

type Status =
  | "matched_equal"
  | "qty_mismatch"
  | "csv_only"
  | "op_trader_only"
  | "no_catalog_match";

type Bucket = {
  key: string;
  card_product_id: string | null;
  csv_card_name: string | null;
  csv_card_number: string | null;
  csv_set_name: string | null;
  grading_service: string;
  grade: string | null;
  csv_qty: number;
  op_qty: number;
  csv_cost_cents: number | null;
  csv_currency: string | null;
  csv_group_name: string | null;
  csv_rows: CsvRow[];
  lots: Lot[];
  product: ProductInfo | null;
  status: Status;
};

const STATUS_ORDER: Record<Status, number> = {
  qty_mismatch: 0,
  csv_only: 1,
  op_trader_only: 2,
  no_catalog_match: 3,
  matched_equal: 4,
};

const TEMPLATE = [
  [
    "external_id",
    "shiny_product_id",
    "card_product_id",
    "card_number",
    "set_name",
    "card_name",
    "grading_service",
    "grade",
    "quantity",
    "purchase_price",
    "purchase_currency",
  ],
  [
    "",
    "",
    "",
    "OP01-001",
    "Romance Dawn",
    "Monkey.D.Luffy (Alternate Art)",
    "ungraded",
    "nm",
    "1",
    "100.00",
    "AUD",
  ],
];

function downloadTemplate() {
  const csv = Papa.unparse(TEMPLATE);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "inventory-reconcile-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseDollarsToCents(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function emptyStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseCsv(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows: CsvRow[] = results.data.map((r) => ({
            external_id: emptyStr(r.external_id),
            shiny_product_id: emptyStr(r.shiny_product_id),
            card_product_id: emptyStr(r.card_product_id),
            card_number: emptyStr(r.card_number),
            set_name: emptyStr(r.set_name),
            card_name: emptyStr(r.card_name),
            grading_service: (emptyStr(r.grading_service) ?? "ungraded").toLowerCase(),
            grade: emptyStr(r.grade),
            quantity: Number(r.quantity) || 0,
            purchase_cents: parseDollarsToCents(r.purchase_price),
            purchase_currency: emptyStr(r.purchase_currency),
            group_name: emptyStr(r.group_name),
          }));
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}

function gradeLabel(service: string, grade: string | null): string {
  if (service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

function bucketKey(
  cardId: string | null,
  service: string,
  grade: string | null,
  fallback: string,
): string {
  const cid = cardId ?? `__nocat__${fallback}`;
  if (service === "ungraded") return `${cid}|ungraded`;
  return `${cid}|${service}|${grade ?? ""}`;
}

function statusBadge(status: Status) {
  const map: Record<Status, { label: string; cls: string }> = {
    matched_equal: {
      label: "Matched",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    qty_mismatch: {
      label: "Qty mismatch",
      cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    },
    csv_only: {
      label: "CSV only",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    op_trader_only: {
      label: "OP Trader only",
      cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    },
    no_catalog_match: {
      label: "No catalog",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

export default function InventoryReconcilePage() {
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lots, setLots] = useState<Lot[] | null>(null);
  const [products, setProducts] = useState<Map<string, ProductInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creatingKey, setCreatingKey] = useState<string | null>(null);
  const [batchCreating, setBatchCreating] = useState<boolean>(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpanded = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  type FilterKey = "all" | Status;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const loadLots = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .schema("ecom")
      .from("inventory_lots")
      .select(
        "id, card_product_id, grading_service, grade, quantity_remaining, acquisition_source, acquisition_cost_cents, acquisition_currency",
      )
      .eq("account_id", activeAccountId)
      .gt("quantity_remaining", 0);
    if (err) {
      setError(`inventory_lots: ${err.message}`);
      setLoading(false);
      return;
    }
    const all = (data ?? []) as Lot[];
    setLots(
      all.filter(
        (l) => l.acquisition_source !== "consignment" && l.card_product_id,
      ),
    );
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    void loadLots();
  }, [loadLots]);

  // Resolve catalog matches for every CSV row.
  const resolveCatalog = useCallback(
    async (rows: CsvRow[]): Promise<Map<number, ProductInfo>> => {
      const map = new Map<number, ProductInfo>();
      if (rows.length === 0) return map;

      // (0) Resolve via cards.product_sources when a Shiny product id was
      // included in the CSV — this is the exact mapping (Shiny id → our
      // UUID) and side-steps name fuzzy matching for variant disambiguation.
      const shinyIds = Array.from(
        new Set(
          rows.map((r) => r.shiny_product_id).filter((x): x is string => !!x),
        ),
      );
      const shinyToOurs = new Map<string, string>();
      if (shinyIds.length > 0) {
        const { data: srcRows } = await supabase
          .schema("cards")
          .from("product_sources")
          .select("product_id, source_id")
          .eq("source_provider", "shiny")
          .in("source_id", shinyIds);
        for (const r of (srcRows ?? []) as {
          product_id: string;
          source_id: string;
        }[]) {
          shinyToOurs.set(r.source_id, r.product_id);
        }
      }

      const directIds = Array.from(
        new Set([
          ...rows
            .map((r) => r.card_product_id)
            .filter((x): x is string => !!x),
          ...Array.from(shinyToOurs.values()),
        ]),
      );
      const directMap = new Map<string, ProductInfo>();
      if (directIds.length > 0) {
        const { data } = await supabase
          .schema("cards")
          .from("products")
          .select("id, name, image_url, card_number, sets!inner(name)")
          .in("id", directIds);
        type Row = {
          id: string;
          name: string | null;
          card_number: string | null;
          image_url: string | null;
          sets: { name: string | null } | Array<{ name: string | null }> | null;
        };
        for (const p of (data ?? []) as unknown as Row[]) {
          const set = Array.isArray(p.sets) ? p.sets[0] : p.sets;
          directMap.set(p.id, {
            id: p.id,
            name: p.name,
            card_number: p.card_number,
            image_url: p.image_url,
            set_name: set?.name ?? null,
          });
        }
      }

      const numbersNeeded = Array.from(
        new Set(
          rows
            .filter((r) => !r.card_product_id && r.card_number)
            .map((r) => r.card_number as string),
        ),
      );
      const byNumber = new Map<string, ProductInfo[]>();
      if (numbersNeeded.length > 0) {
        const { data } = await supabase
          .schema("cards")
          .from("products")
          .select("id, name, image_url, card_number, sets!inner(name)")
          .in("card_number", numbersNeeded);
        type Row = {
          id: string;
          name: string | null;
          card_number: string | null;
          image_url: string | null;
          sets: { name: string | null } | Array<{ name: string | null }> | null;
        };
        for (const p of (data ?? []) as unknown as Row[]) {
          const set = Array.isArray(p.sets) ? p.sets[0] : p.sets;
          const arr = byNumber.get(p.card_number!) ?? [];
          arr.push({
            id: p.id,
            name: p.name,
            card_number: p.card_number,
            image_url: p.image_url,
            set_name: set?.name ?? null,
          });
          byNumber.set(p.card_number!, arr);
        }
      }

      rows.forEach((r, i) => {
        if (r.shiny_product_id) {
          const ourId = shinyToOurs.get(r.shiny_product_id);
          if (ourId) {
            const hit = directMap.get(ourId);
            if (hit) {
              map.set(i, hit);
              return;
            }
          }
        }
        if (r.card_product_id) {
          const hit = directMap.get(r.card_product_id);
          if (hit) map.set(i, hit);
          return;
        }
        if (!r.card_number) return;
        const arr = byNumber.get(r.card_number) ?? [];
        const desiredSet = (r.set_name ?? "").toLowerCase().trim();
        const desiredName = (r.card_name ?? "").toLowerCase().trim();
        let candidates = desiredSet
          ? arr.filter(
              (x) => (x.set_name ?? "").toLowerCase().trim() === desiredSet,
            )
          : arr.slice();
        if (candidates.length === 0 && arr.length === 1) candidates = arr.slice();
        let hit: ProductInfo | undefined;
        if (candidates.length === 1) hit = candidates[0];
        else if (candidates.length > 1 && desiredName) {
          hit =
            candidates.find((x) => (x.name ?? "").toLowerCase() === desiredName) ??
            candidates.find((x) => (x.name ?? "").toLowerCase().includes(desiredName)) ??
            candidates.find((x) => desiredName.includes((x.name ?? "").toLowerCase()));
        }
        if (hit) map.set(i, hit);
      });

      return map;
    },
    [supabase],
  );

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const rows = await parseCsv(file);
      const catalog = await resolveCatalog(rows);
      // Stamp the resolved card_product_id back onto each row so the
      // downstream resolveRow (in the buckets memo) doesn't need to
      // redo the shiny → our-UUID lookup.
      const stamped = rows.map((r, i) => {
        if (r.card_product_id) return r;
        const hit = catalog.get(i);
        return hit ? { ...r, card_product_id: hit.id } : r;
      });
      setCsvRows(stamped);
      const lotCardIds = Array.from(
        new Set(
          (lots ?? [])
            .map((l) => l.card_product_id)
            .filter((x): x is string => !!x),
        ),
      );
      const knownIds = new Set(Array.from(catalog.values()).map((p) => p.id));
      const lotsToFetch = lotCardIds.filter((id) => !knownIds.has(id));
      const lotProductMap = new Map<string, ProductInfo>();
      if (lotsToFetch.length > 0) {
        const { data } = await supabase
          .schema("cards")
          .from("products")
          .select("id, name, image_url, card_number, sets!inner(name)")
          .in("id", lotsToFetch);
        type Row = {
          id: string;
          name: string | null;
          card_number: string | null;
          image_url: string | null;
          sets: { name: string | null } | Array<{ name: string | null }> | null;
        };
        for (const p of (data ?? []) as unknown as Row[]) {
          const set = Array.isArray(p.sets) ? p.sets[0] : p.sets;
          lotProductMap.set(p.id, {
            id: p.id,
            name: p.name,
            card_number: p.card_number,
            image_url: p.image_url,
            set_name: set?.name ?? null,
          });
        }
      }
      const combined = new Map<string, ProductInfo>();
      for (const p of catalog.values()) combined.set(p.id, p);
      for (const [id, p] of lotProductMap.entries()) combined.set(id, p);
      setProducts(combined);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  const buckets: Bucket[] = useMemo(() => {
    if (csvRows == null || lots == null) return [];
    const map = new Map<string, Bucket>();

    type Resolved = ProductInfo | null;
    const productList = Array.from(products.values());
    const byNum = new Map<string, ProductInfo[]>();
    for (const p of productList) {
      if (p.card_number) {
        const arr = byNum.get(p.card_number) ?? [];
        arr.push(p);
        byNum.set(p.card_number, arr);
      }
    }
    const resolveRow = (r: CsvRow): Resolved => {
      if (r.card_product_id) return products.get(r.card_product_id) ?? null;
      if (!r.card_number) return null;
      const arr = byNum.get(r.card_number) ?? [];
      const desiredSet = (r.set_name ?? "").toLowerCase().trim();
      const desiredName = (r.card_name ?? "").toLowerCase().trim();
      let candidates = desiredSet
        ? arr.filter((x) => (x.set_name ?? "").toLowerCase().trim() === desiredSet)
        : arr.slice();
      if (candidates.length === 0 && arr.length === 1) candidates = arr.slice();
      if (candidates.length === 1) return candidates[0];
      if (candidates.length > 1 && desiredName) {
        return (
          candidates.find((x) => (x.name ?? "").toLowerCase() === desiredName) ??
          candidates.find((x) => (x.name ?? "").toLowerCase().includes(desiredName)) ??
          candidates.find((x) => desiredName.includes((x.name ?? "").toLowerCase())) ??
          null
        );
      }
      return null;
    };

    for (const r of csvRows) {
      const service = (r.grading_service ?? "ungraded").toLowerCase();
      const product = resolveRow(r);
      const fallback = `${r.card_number ?? ""}|${r.set_name ?? ""}|${r.card_name ?? ""}`;
      const key = bucketKey(product?.id ?? null, service, r.grade, fallback);
      let b = map.get(key);
      if (!b) {
        b = {
          key,
          card_product_id: product?.id ?? null,
          csv_card_name: r.card_name,
          csv_card_number: r.card_number,
          csv_set_name: r.set_name,
          grading_service: service,
          grade: service === "ungraded" ? null : r.grade,
          csv_qty: 0,
          op_qty: 0,
          csv_cost_cents: null,
          csv_currency: null,
          csv_group_name: null,
          csv_rows: [],
          lots: [],
          product,
          status: "matched_equal",
        };
        map.set(key, b);
      }
      b.csv_qty += r.quantity;
      b.csv_rows.push(r);
      if (r.group_name && !b.csv_group_name) b.csv_group_name = r.group_name;
      if (r.purchase_cents != null && b.csv_cost_cents == null) {
        b.csv_cost_cents = r.purchase_cents;
        b.csv_currency = (r.purchase_currency ?? "AUD").toUpperCase();
      }
    }

    for (const l of lots) {
      if (!l.card_product_id) continue;
      const service = (l.grading_service ?? "ungraded").toLowerCase();
      const key = bucketKey(l.card_product_id, service, l.grade, "");
      let b = map.get(key);
      if (!b) {
        const product = products.get(l.card_product_id) ?? null;
        b = {
          key,
          card_product_id: l.card_product_id,
          csv_card_name: null,
          csv_card_number: null,
          csv_set_name: null,
          grading_service: service,
          grade: service === "ungraded" ? null : l.grade,
          csv_qty: 0,
          op_qty: 0,
          csv_cost_cents: null,
          csv_currency: null,
          csv_group_name: null,
          csv_rows: [],
          lots: [],
          product,
          status: "matched_equal",
        };
        map.set(key, b);
      }
      b.op_qty += l.quantity_remaining;
      b.lots.push(l);
    }

    for (const b of map.values()) {
      if (b.csv_qty > 0 && !b.card_product_id) {
        b.status = "no_catalog_match";
      } else if (b.csv_qty > 0 && b.op_qty > 0) {
        b.status = b.csv_qty === b.op_qty ? "matched_equal" : "qty_mismatch";
      } else if (b.csv_qty > 0) {
        b.status = "csv_only";
      } else {
        b.status = "op_trader_only";
      }
    }

    return Array.from(map.values());
  }, [csvRows, lots, products]);

  const counts = useMemo(() => {
    const c: Record<Status, number> = {
      matched_equal: 0,
      qty_mismatch: 0,
      csv_only: 0,
      op_trader_only: 0,
      no_catalog_match: 0,
    };
    for (const b of buckets) c[b.status]++;
    return c;
  }, [buckets]);

  const filteredBuckets = useMemo(() => {
    let list = filter === "all" ? buckets : buckets.filter((b) => b.status === filter);
    if (search.trim()) {
      const needle = search.trim().toLowerCase();
      list = list.filter((b) => {
        const hay = `${b.product?.name ?? b.csv_card_name ?? ""} ${b.product?.card_number ?? b.csv_card_number ?? ""} ${b.product?.set_name ?? b.csv_set_name ?? ""}`.toLowerCase();
        return hay.includes(needle);
      });
    }
    return [...list].sort((a, b) => {
      const so = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
      if (so !== 0) return so;
      return (a.product?.name ?? a.csv_card_name ?? "").localeCompare(
        b.product?.name ?? b.csv_card_name ?? "",
      );
    });
  }, [buckets, filter, search]);

  const createLot = async (b: Bucket) => {
    if (!activeAccountId) return;
    if (!b.card_product_id) {
      setError("Bucket has no catalog match — can't seed a lot.");
      return;
    }
    if (b.csv_cost_cents == null) {
      setError("No cost basis in CSV — can't seed a lot.");
      return;
    }
    setCreatingKey(b.key);
    setError(null);
    setNotice(null);
    try {
      const qty = b.csv_qty;
      const currency = b.csv_currency ?? "AUD";
      const subtotal = b.csv_cost_cents * qty;
      const today = new Date().toISOString().slice(0, 10);

      const { data: purchase, error: pErr } = await supabase
        .schema("ecom")
        .from("purchases")
        .insert({
          account_id: activeAccountId,
          purchased_at: today,
          subtotal_cents: subtotal,
          shipping_cents: 0,
          fees_cents: 0,
          total_cents: subtotal,
          purchase_currency: currency,
          allocation_method: "equal",
          notes: `Lot seeded from inventory reconcile CSV on ${today}.`,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      const { error: lErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .insert({
          account_id: activeAccountId,
          card_product_id: b.card_product_id,
          grading_service: b.grading_service,
          grade: b.grade,
          quantity_acquired: qty,
          quantity_remaining: qty,
          acquisition_cost_cents: b.csv_cost_cents,
          acquisition_currency: currency,
          acquisition_source: "purchase",
          acquired_at: today,
          purchase_id: purchase.id,
        });
      if (lErr) throw lErr;

      setNotice(`Created a lot of ${qty} for ${b.product?.name ?? "card"}.`);
      await loadLots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create lot");
    } finally {
      setCreatingKey(null);
    }
  };

  // For qty_mismatch rows where the CSV says we have more than optrader:
  // seed a lot for the missing difference using the bucket's CSV cost basis.
  // Same shape as createLot but with qty = csv_qty - op_qty.
  const createLotForMissingQty = async (b: Bucket) => {
    if (!activeAccountId) return;
    if (!b.card_product_id) {
      setError("Bucket has no catalog match — can't seed a lot.");
      return;
    }
    if (b.csv_cost_cents == null) {
      setError("No cost basis in CSV — can't seed a lot.");
      return;
    }
    const qty = b.csv_qty - b.op_qty;
    if (qty <= 0) {
      setError("CSV quantity is not greater than optrader's — nothing to add.");
      return;
    }
    const diffKey = `${b.key}::diff`;
    setCreatingKey(diffKey);
    setError(null);
    setNotice(null);
    try {
      const currency = b.csv_currency ?? "AUD";
      const subtotal = b.csv_cost_cents * qty;
      const today = new Date().toISOString().slice(0, 10);

      const { data: purchase, error: pErr } = await supabase
        .schema("ecom")
        .from("purchases")
        .insert({
          account_id: activeAccountId,
          purchased_at: today,
          subtotal_cents: subtotal,
          shipping_cents: 0,
          fees_cents: 0,
          total_cents: subtotal,
          purchase_currency: currency,
          allocation_method: "equal",
          notes: `Reconcile diff: CSV had ${b.csv_qty}, optrader had ${b.op_qty} — seeded ${qty} on ${today}.`,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      const { error: lErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .insert({
          account_id: activeAccountId,
          card_product_id: b.card_product_id,
          grading_service: b.grading_service,
          grade: b.grade,
          quantity_acquired: qty,
          quantity_remaining: qty,
          acquisition_cost_cents: b.csv_cost_cents,
          acquisition_currency: currency,
          acquisition_source: "purchase",
          acquired_at: today,
          purchase_id: purchase.id,
        });
      if (lErr) throw lErr;

      setNotice(`Added ${qty} to ${b.product?.name ?? "card"} (was ${b.op_qty}, now ${b.op_qty + qty}).`);
      await loadLots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create lot");
    } finally {
      setCreatingKey(null);
    }
  };

  const createLotForRow = async (b: Bucket, row: CsvRow, rowIdx: number) => {
    if (!activeAccountId) return;
    if (!b.card_product_id) {
      setError("Bucket has no catalog match — can't seed a lot.");
      return;
    }
    if (row.purchase_cents == null) {
      setError("This CSV row has no purchase price — can't seed a lot.");
      return;
    }
    const rowKey = `${b.key}::row::${rowIdx}`;
    setCreatingKey(rowKey);
    setError(null);
    setNotice(null);
    try {
      const qty = row.quantity || 1;
      const currency = (row.purchase_currency ?? "AUD").toUpperCase();
      const subtotal = row.purchase_cents * qty;
      const today = new Date().toISOString().slice(0, 10);

      const { data: purchase, error: pErr } = await supabase
        .schema("ecom")
        .from("purchases")
        .insert({
          account_id: activeAccountId,
          purchased_at: today,
          subtotal_cents: subtotal,
          shipping_cents: 0,
          fees_cents: 0,
          total_cents: subtotal,
          purchase_currency: currency,
          allocation_method: "equal",
          notes: `Lot seeded from inventory reconcile CSV row on ${today}.`,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      const { error: lErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .insert({
          account_id: activeAccountId,
          card_product_id: b.card_product_id,
          grading_service: b.grading_service,
          grade: b.grade,
          quantity_acquired: qty,
          quantity_remaining: qty,
          acquisition_cost_cents: row.purchase_cents,
          acquisition_currency: currency,
          acquisition_source: "purchase",
          acquired_at: today,
          purchase_id: purchase.id,
        });
      if (lErr) throw lErr;

      setNotice(
        `Created a lot of ${qty} at ${formatPrice(
          row.purchase_cents,
          sellerCurrency,
          rates ?? {},
          currency,
        )} for ${b.product?.name ?? "card"}.`,
      );
      await loadLots();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create lot");
    } finally {
      setCreatingKey(null);
    }
  };

  const batchCreateLotsForCsvOnly = async () => {
    if (!activeAccountId) return;
    const targets = filteredBuckets.filter(
      (b) =>
        b.status === "csv_only" &&
        b.card_product_id &&
        b.csv_cost_cents != null,
    );
    if (targets.length === 0) return;
    setBatchCreating(true);
    setError(null);
    setNotice(null);
    let created = 0;
    const errors: string[] = [];
    for (const b of targets) {
      try {
        await createLot(b);
        created++;
      } catch (e) {
        errors.push(
          `${b.product?.name ?? b.csv_card_name ?? "row"}: ${
            e instanceof Error ? e.message : "failed"
          }`,
        );
      }
    }
    setBatchCreating(false);
    setNotice(
      `Created ${created} lot${created === 1 ? "" : "s"}` +
        (errors.length > 0 ? `; ${errors.length} error${errors.length === 1 ? "" : "s"}.` : "."),
    );
    if (errors.length > 0) setError(errors.slice(0, 5).join("; "));
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/${slug}/manage/inventory`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to inventory
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Reconcile inventory
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upload a CSV listing what you own and compare it side-by-side
        against your OP Trader inventory. Works for a Shiny export, a hand
        list, anything that matches the column shape. Buckets group by
        (card, grading, grade); ungraded raw cards are bucketed together
        regardless of condition string. Consigned lots are excluded.
      </p>

      {/* Upload + template */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Inventory CSV
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
          />
          {fileName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {fileName}
              {csvRows && ` — ${csvRows.length} rows`}
              {parsing && " — parsing…"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Download template
        </button>
      </div>

      {csvRows && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-6 text-sm">
          <Counter label="Buckets" value={buckets.length} />
          <Counter
            label="Matched"
            value={counts.matched_equal}
            color="text-green-600 dark:text-green-400"
          />
          <Counter
            label="Qty mismatch"
            value={counts.qty_mismatch}
            color="text-orange-600 dark:text-orange-400"
          />
          <Counter
            label="CSV only"
            value={counts.csv_only}
            color="text-amber-600 dark:text-amber-400"
          />
          <Counter
            label="OP Trader only"
            value={counts.op_trader_only}
            color="text-blue-600 dark:text-blue-400"
          />
          <Counter
            label="No catalog"
            value={counts.no_catalog_match}
            color="text-red-600 dark:text-red-400"
          />
        </div>
      )}

      {csvRows && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Show
          </span>
          {(
            [
              "all",
              "qty_mismatch",
              "csv_only",
              "op_trader_only",
              "no_catalog_match",
              "matched_equal",
            ] as const
          ).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={
                filter === f
                  ? "px-2.5 py-1 text-xs font-semibold rounded bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "px-2.5 py-1 text-xs font-medium rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }
            >
              {f === "all"
                ? "All"
                : f === "qty_mismatch"
                  ? "Qty mismatch"
                  : f === "csv_only"
                    ? "CSV only"
                    : f === "op_trader_only"
                      ? "OP Trader only"
                      : f === "no_catalog_match"
                        ? "No catalog"
                        : "Matched"}
            </button>
          ))}
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search card, number, set…"
            className="ml-auto px-3 py-1.5 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          />
          {(() => {
            const n = filteredBuckets.filter(
              (b) =>
                b.status === "csv_only" &&
                b.card_product_id &&
                b.csv_cost_cents != null,
            ).length;
            if (n === 0) return null;
            return (
              <button
                type="button"
                onClick={batchCreateLotsForCsvOnly}
                disabled={batchCreating}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-gray-800 hover:bg-gray-900 rounded disabled:opacity-50"
              >
                {batchCreating ? "Creating…" : `Create ${n} lots`}
              </button>
            );
          })()}
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          {notice}
        </div>
      )}

      {csvRows && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-6 text-sm text-gray-500 text-center">Loading…</div>
          ) : filteredBuckets.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              {buckets.length === 0
                ? "Nothing to compare."
                : "No buckets match the current filter."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left"></th>
                    <th className="px-3 py-2 text-left">Card</th>
                    <th className="px-3 py-2 text-left">Grade</th>
                    <th className="px-3 py-2 text-right">CSV qty</th>
                    <th className="px-3 py-2 text-right">OP Trader qty</th>
                    <th className="px-3 py-2 text-right">CSV cost</th>
                    <th className="px-3 py-2 text-left">Group</th>
                    <th className="px-3 py-2 text-left">Status</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredBuckets.map((b) => {
                    const canExpand =
                      b.csv_rows.length + b.lots.length > 1 ||
                      b.status === "qty_mismatch";
                    const isOpen = expanded.has(b.key);
                    return (
                      <Fragment key={b.key}>
                        <tr className="align-top">
                          <td className="px-3 py-3">
                            {b.product?.image_url ? (
                              <ZoomableImage
                                src={b.product.image_url}
                                alt={b.product.name ?? ""}
                                className="w-10 h-14 object-contain rounded"
                              />
                            ) : (
                              <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                            )}
                          </td>
                          <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                            <div className="flex items-start gap-2">
                              {canExpand && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpanded(b.key)}
                                  className="mt-0.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-xs leading-none w-4 flex-shrink-0"
                                  aria-label={isOpen ? "Collapse" : "Expand"}
                                >
                                  {isOpen ? "▼" : "▶"}
                                </button>
                              )}
                              <div className={canExpand ? "" : "ml-6"}>
                                <p className="font-medium">
                                  {b.product?.name ?? b.csv_card_name ?? "(unknown card)"}
                                  {(b.product?.card_number ?? b.csv_card_number) && (
                                    <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                                      #{b.product?.card_number ?? b.csv_card_number}
                                    </span>
                                  )}
                                </p>
                                {(b.product?.set_name ?? b.csv_set_name) && (
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {b.product?.set_name ?? b.csv_set_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                            {gradeLabel(b.grading_service, b.grade)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {b.csv_qty || "—"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {b.op_qty || "—"}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                            {b.csv_cost_cents != null
                              ? formatPrice(
                                  b.csv_cost_cents,
                                  sellerCurrency,
                                  rates ?? {},
                                  b.csv_currency ?? sellerCurrency,
                                )
                              : "—"}
                          </td>
                          <td className="px-3 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                            {b.csv_group_name ?? "—"}
                          </td>
                          <td className="px-3 py-3">{statusBadge(b.status)}</td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {b.status === "csv_only" &&
                              b.card_product_id &&
                              b.csv_cost_cents != null && (
                                <button
                                  type="button"
                                  onClick={() => createLot(b)}
                                  disabled={creatingKey === b.key}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded disabled:opacity-50"
                                >
                                  {creatingKey === b.key ? "Creating…" : "Create lot"}
                                </button>
                              )}
                            {b.status === "qty_mismatch" &&
                              b.card_product_id &&
                              b.csv_cost_cents != null &&
                              b.csv_qty > b.op_qty && (
                                <button
                                  type="button"
                                  onClick={() => createLotForMissingQty(b)}
                                  disabled={creatingKey === `${b.key}::diff`}
                                  className="px-2.5 py-1 text-xs font-medium text-white bg-amber-600 hover:bg-amber-700 rounded disabled:opacity-50"
                                  title={`Create a lot of ${b.csv_qty - b.op_qty} to match the CSV`}
                                >
                                  {creatingKey === `${b.key}::diff`
                                    ? "Creating…"
                                    : `Add ${b.csv_qty - b.op_qty}`}
                                </button>
                              )}
                          </td>
                        </tr>
                        {canExpand && isOpen && (
                          <tr className="bg-gray-50 dark:bg-gray-900/40">
                            <td colSpan={9} className="px-3 py-3">
                              <BucketDetail
                                bucket={b}
                                sellerCurrency={sellerCurrency}
                                rates={rates ?? {}}
                                creatingKey={creatingKey}
                                onCreateRow={createLotForRow}
                                slug={slug}
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number | string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`text-xl font-semibold ${color ?? "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </p>
    </div>
  );
}

function BucketDetail({
  bucket,
  sellerCurrency,
  rates,
  creatingKey,
  onCreateRow,
  slug,
}: {
  bucket: Bucket;
  sellerCurrency: string;
  rates: Record<string, number>;
  creatingKey: string | null;
  onCreateRow: (b: Bucket, row: CsvRow, rowIdx: number) => void;
  slug: string;
}) {
  const showCreate =
    bucket.card_product_id != null &&
    bucket.csv_qty > bucket.op_qty; // only offer per-row when CSV has more units than we own

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
          CSV rows ({bucket.csv_rows.length})
        </p>
        {bucket.csv_rows.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No CSV rows.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-right pr-2 font-medium">Qty</th>
                <th className="text-right pr-2 font-medium">Price</th>
                <th className="text-left pr-2 font-medium">Group</th>
                <th className="text-left pr-2 font-medium">Source id</th>
                {showCreate && <th className="text-right pr-1 font-medium"></th>}
              </tr>
            </thead>
            <tbody>
              {bucket.csv_rows.map((r, i) => {
                const rowKey = `${bucket.key}::row::${i}`;
                const isCreating = creatingKey === rowKey;
                return (
                  <tr
                    key={i}
                    className="border-t border-gray-200 dark:border-gray-700"
                  >
                    <td className="text-right pr-2 py-1 tabular-nums text-gray-800 dark:text-gray-200">
                      {r.quantity}
                    </td>
                    <td className="text-right pr-2 py-1 tabular-nums text-gray-800 dark:text-gray-200 whitespace-nowrap">
                      {r.purchase_cents != null
                        ? formatPrice(
                            r.purchase_cents,
                            sellerCurrency,
                            rates,
                            (r.purchase_currency ?? "AUD").toUpperCase(),
                          )
                        : "—"}
                    </td>
                    <td className="text-left pr-2 py-1 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {r.group_name ?? "—"}
                    </td>
                    <td className="text-left pr-2 py-1 text-gray-500 dark:text-gray-500 font-mono text-[10px] truncate max-w-[120px]">
                      {r.shiny_product_id ?? r.external_id ?? "—"}
                    </td>
                    {showCreate && (
                      <td className="text-right pr-1 py-1 whitespace-nowrap">
                        {r.purchase_cents != null && (
                          <button
                            type="button"
                            onClick={() => onCreateRow(bucket, r, i)}
                            disabled={isCreating}
                            className="px-2 py-0.5 text-[10px] font-medium text-white bg-gray-800 hover:bg-gray-900 rounded disabled:opacity-50"
                          >
                            {isCreating ? "…" : "Create lot"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1.5">
          OP Trader lots ({bucket.lots.length})
        </p>
        {bucket.lots.length === 0 ? (
          <p className="text-xs text-gray-400 italic">No lots.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-500 dark:text-gray-400">
              <tr>
                <th className="text-right pr-2 font-medium">Qty</th>
                <th className="text-right pr-2 font-medium">Cost</th>
                <th className="text-left pr-2 font-medium">Source</th>
                <th className="text-left pr-2 font-medium">Lot id</th>
              </tr>
            </thead>
            <tbody>
              {bucket.lots.map((l) => (
                <tr
                  key={l.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="text-right pr-2 py-1 tabular-nums text-gray-800 dark:text-gray-200">
                    {l.quantity_remaining}
                  </td>
                  <td className="text-right pr-2 py-1 tabular-nums text-gray-800 dark:text-gray-200 whitespace-nowrap">
                    {l.acquisition_cost_cents != null
                      ? formatPrice(
                          l.acquisition_cost_cents,
                          sellerCurrency,
                          rates,
                          (l.acquisition_currency ?? "AUD").toUpperCase(),
                        )
                      : "—"}
                  </td>
                  <td className="text-left pr-2 py-1 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                    {l.acquisition_source}
                  </td>
                  <td className="text-left pr-2 py-1 font-mono text-[10px] truncate max-w-[120px]">
                    <Link
                      href={`/${slug}/manage/inventory/${l.id}`}
                      className="text-gray-500 dark:text-gray-500 hover:text-red-600"
                      title="Open inventory lot"
                    >
                      {l.id.slice(0, 8)}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
