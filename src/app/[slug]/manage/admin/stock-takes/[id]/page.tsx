"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

// ---------------------------------------------------------------------------
// /[slug]/manage/admin/stock-takes/[id]
//
// Active stock-take session. The trader searches the catalog by name or
// card number, picks the variant (grading + grade), and types the quantity
// they physically counted. We snapshot the current system quantity for
// that SKU bucket so a sale that lands mid-session doesn't shift the delta
// computed at commit. Hitting "Complete" calls ecom.commit_stock_take
// which atomically writes stock_adjustments and updates inventory_lots.
// ---------------------------------------------------------------------------

const GRADING_OPTIONS: { value: string; label: string }[] = [
  { value: "ungraded", label: "Ungraded" },
  { value: "psa", label: "PSA" },
  { value: "bgs", label: "BGS" },
  { value: "cgc", label: "CGC" },
  { value: "sgc", label: "SGC" },
  { value: "ace", label: "ACE" },
  { value: "ags", label: "AGS" },
  { value: "ars", label: "ARS" },
  { value: "tag", label: "TAG" },
];

type Status = "draft" | "completed" | "cancelled";

type StockTake = {
  id: string;
  status: Status;
  started_at: string;
  completed_at: string | null;
  notes: string | null;
};

type StockTakeItem = {
  id: string;
  card_product_id: string | null;
  custom_product_id: string | null;
  grading_service: string;
  grade: string | null;
  counted_qty: number;
  system_qty_at_count: number;
  status: "pending" | "adjusted" | "skipped";
  notes: string | null;
  // Hydrated client-side after load.
  product_name?: string;
  card_number?: string | null;
  set_name?: string | null;
  image_url?: string | null;
};

type CatalogResult = {
  id: string;
  name: string;
  card_number: string | null;
  image_url: string | null;
  set_name: string | null;
};

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function gradeLabel(service: string, grade: string | null): string {
  if (service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

function bucketKey(
  cardId: string | null,
  customId: string | null,
  service: string,
  grade: string | null,
): string {
  const p = cardId ? `c:${cardId}` : customId ? `x:${customId}` : "?";
  if (service === "ungraded") return `${p}|ungraded`;
  return `${p}|${service}|${grade ?? ""}`;
}

export default function StockTakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const stockTakeId = params?.id as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();

  const [take, setTake] = useState<StockTake | null>(null);
  const [items, setItems] = useState<StockTakeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isReadOnly = take?.status !== "draft";

  // -------------------------------------------------------------------------
  // Load
  // -------------------------------------------------------------------------
  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);

    const { data: takeRow, error: tErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .select("id, status, started_at, completed_at, notes")
      .eq("id", stockTakeId)
      .eq("account_id", activeAccountId)
      .maybeSingle();

    if (tErr || !takeRow) {
      setError(tErr?.message ?? "Stock take not found.");
      setLoading(false);
      return;
    }
    setTake(takeRow as StockTake);

    const { data: itemRows, error: iErr } = await supabase
      .schema("ecom")
      .from("stock_take_items")
      .select(
        "id, card_product_id, custom_product_id, grading_service, grade, counted_qty, system_qty_at_count, status, notes",
      )
      .eq("stock_take_id", stockTakeId)
      .order("created_at", { ascending: false });
    if (iErr) {
      setError(iErr.message);
      setLoading(false);
      return;
    }

    const itemsRaw = (itemRows ?? []) as StockTakeItem[];

    // Hydrate product details so the table can render names/images.
    const cardIds = Array.from(
      new Set(
        itemsRaw
          .map((i) => i.card_product_id)
          .filter((x): x is string => !!x),
      ),
    );
    const cardLookup = new Map<string, CatalogResult>();
    if (cardIds.length > 0) {
      const { data: cards } = await supabase
        .schema("cards")
        .from("products")
        .select("id, name, image_url, card_number, sets!inner(name)")
        .in("id", cardIds);
      type Row = {
        id: string;
        name: string | null;
        card_number: string | null;
        image_url: string | null;
        sets: { name: string | null } | Array<{ name: string | null }> | null;
      };
      for (const p of (cards ?? []) as unknown as Row[]) {
        const set = Array.isArray(p.sets) ? p.sets[0] : p.sets;
        cardLookup.set(p.id, {
          id: p.id,
          name: p.name ?? "",
          card_number: p.card_number,
          image_url: p.image_url,
          set_name: set?.name ?? null,
        });
      }
    }

    setItems(
      itemsRaw.map((i) => {
        const hit = i.card_product_id ? cardLookup.get(i.card_product_id) : null;
        return {
          ...i,
          product_name: hit?.name ?? "(unknown)",
          card_number: hit?.card_number ?? null,
          set_name: hit?.set_name ?? null,
          image_url: hit?.image_url ?? null,
        };
      }),
    );
    setLoading(false);
  }, [supabase, activeAccountId, stockTakeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Catalog search
  // -------------------------------------------------------------------------
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 250);
  const [searchResults, setSearchResults] = useState<CatalogResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!search.trim() || isReadOnly) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      const q = search.trim();
      const { data } = await supabase
        .schema("cards")
        .from("products")
        .select("id, name, image_url, card_number, sets!inner(name)")
        .or(`name.ilike.%${q}%,card_number.ilike.%${q}%`)
        .limit(20);
      if (cancelled) return;
      type Row = {
        id: string;
        name: string | null;
        card_number: string | null;
        image_url: string | null;
        sets: { name: string | null } | Array<{ name: string | null }> | null;
      };
      const results: CatalogResult[] = ((data ?? []) as unknown as Row[]).map(
        (p) => {
          const set = Array.isArray(p.sets) ? p.sets[0] : p.sets;
          return {
            id: p.id,
            name: p.name ?? "",
            card_number: p.card_number,
            image_url: p.image_url,
            set_name: set?.name ?? null,
          };
        },
      );
      setSearchResults(results);
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, search, isReadOnly]);

  // -------------------------------------------------------------------------
  // Add-to-count form (opens when a search result is picked)
  // -------------------------------------------------------------------------
  const [picked, setPicked] = useState<CatalogResult | null>(null);
  const [formGrading, setFormGrading] = useState<string>("ungraded");
  const [formGrade, setFormGrade] = useState<string>("");
  const [formCounted, setFormCounted] = useState<string>("1");
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const countedRef = useRef<HTMLInputElement | null>(null);

  const onPickResult = (r: CatalogResult) => {
    setPicked(r);
    setFormGrading("ungraded");
    setFormGrade("");
    setFormCounted("1");
    setSearchInput("");
    setSearchResults([]);
    // Defer focus until the form mounts on next paint.
    setTimeout(() => countedRef.current?.focus(), 50);
  };

  const cancelPicked = () => {
    setPicked(null);
  };

  // Snapshot the current sum(quantity_remaining) across matching lots for
  // this SKU bucket so the delta we compute at commit time reflects what
  // the system thought it had when the user counted.
  const fetchSystemQty = async (
    cardProductId: string,
    grading: string,
    grade: string | null,
  ): Promise<number> => {
    if (!activeAccountId) return 0;
    let query = supabase
      .schema("ecom")
      .from("inventory_lots")
      .select("quantity_remaining")
      .eq("account_id", activeAccountId)
      .eq("card_product_id", cardProductId)
      .eq("grading_service", grading)
      .gt("quantity_remaining", 0);
    if (grading === "ungraded") {
      // Bucketing rule: ungraded ignores the grade dimension (matches
      // reconcile.ts and fulfill_sale_from_lots).
      // Leaving grade unfiltered.
    } else if (grade == null) {
      query = query.is("grade", null);
    } else {
      query = query.eq("grade", grade);
    }
    const { data } = await query;
    return (data ?? []).reduce(
      (sum: number, l: { quantity_remaining: number }) =>
        sum + l.quantity_remaining,
      0,
    );
  };

  const submitAdd = async () => {
    if (!picked || !activeAccountId) return;
    const counted = Math.max(0, Math.floor(Number(formCounted)));
    if (!Number.isFinite(counted)) {
      setError("Counted quantity must be a non-negative integer.");
      return;
    }
    const grading = formGrading;
    const grade =
      grading === "ungraded" ? null : formGrade.trim() ? formGrade.trim() : null;
    setSubmittingAdd(true);
    setError(null);
    setNotice(null);
    try {
      const systemQty = await fetchSystemQty(picked.id, grading, grade);

      // Recount: if a row already exists for this bucket in this session,
      // update it (and re-snapshot system_qty so the delta stays meaningful).
      const existing = items.find(
        (i) =>
          bucketKey(i.card_product_id, i.custom_product_id, i.grading_service, i.grade) ===
          bucketKey(picked.id, null, grading, grade),
      );

      if (existing) {
        const { error: uErr } = await supabase
          .schema("ecom")
          .from("stock_take_items")
          .update({
            counted_qty: counted,
            system_qty_at_count: systemQty,
          })
          .eq("id", existing.id);
        if (uErr) throw uErr;
        setNotice(`Updated count for ${picked.name}.`);
      } else {
        const { error: iErr } = await supabase
          .schema("ecom")
          .from("stock_take_items")
          .insert({
            stock_take_id: stockTakeId,
            card_product_id: picked.id,
            grading_service: grading,
            grade,
            counted_qty: counted,
            system_qty_at_count: systemQty,
          });
        if (iErr) throw iErr;
        setNotice(`Added ${picked.name}.`);
      }
      setPicked(null);
      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save count.");
    } finally {
      setSubmittingAdd(false);
    }
  };

  // -------------------------------------------------------------------------
  // Row edit / remove
  // -------------------------------------------------------------------------
  const removeItem = async (id: string) => {
    if (!confirm("Remove this item from the stock take?")) return;
    const { error: dErr } = await supabase
      .schema("ecom")
      .from("stock_take_items")
      .delete()
      .eq("id", id);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    await loadData();
  };

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>("");
  const startEdit = (it: StockTakeItem) => {
    setEditingId(it.id);
    setEditValue(String(it.counted_qty));
  };
  const saveEdit = async (id: string) => {
    const counted = Math.max(0, Math.floor(Number(editValue)));
    if (!Number.isFinite(counted)) {
      setError("Counted quantity must be a non-negative integer.");
      return;
    }
    const { error: uErr } = await supabase
      .schema("ecom")
      .from("stock_take_items")
      .update({ counted_qty: counted })
      .eq("id", id);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setEditingId(null);
    await loadData();
  };

  // -------------------------------------------------------------------------
  // Complete / cancel session
  // -------------------------------------------------------------------------
  const [completing, setCompleting] = useState(false);
  const complete = async () => {
    if (
      !confirm(
        `Complete this stock take? Adjustments will be applied to ${items.length} item${items.length === 1 ? "" : "s"} and inventory will be updated.`,
      )
    ) {
      return;
    }
    setCompleting(true);
    setError(null);
    setNotice(null);
    const { data, error: rpcErr } = await supabase
      .schema("ecom")
      .rpc("commit_stock_take", { p_stock_take_id: stockTakeId });
    setCompleting(false);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const payload = (data ?? {}) as { adjusted?: number; skipped?: number };
    setNotice(
      `Committed. ${payload.adjusted ?? 0} adjusted, ${payload.skipped ?? 0} skipped (no delta).`,
    );
    await loadData();
  };

  const cancelSession = async () => {
    if (
      !confirm(
        "Cancel this stock take? Items will be kept for reference but no adjustments will be applied.",
      )
    ) {
      return;
    }
    const { error: uErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .update({ status: "cancelled" })
      .eq("id", stockTakeId);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    await loadData();
  };

  // -------------------------------------------------------------------------
  // Save notes
  // -------------------------------------------------------------------------
  const [notesDraft, setNotesDraft] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  useEffect(() => {
    setNotesDraft(take?.notes ?? "");
    setNotesDirty(false);
  }, [take?.notes]);
  const saveNotes = async () => {
    const { error: uErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .update({ notes: notesDraft.trim() || null })
      .eq("id", stockTakeId);
    if (uErr) {
      setError(uErr.message);
      return;
    }
    setNotesDirty(false);
    await loadData();
  };

  // -------------------------------------------------------------------------
  // Totals
  // -------------------------------------------------------------------------
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalDelta = 0;
    let totalShortage = 0;
    let totalOverage = 0;
    for (const i of items) {
      totalItems += 1;
      const d = i.counted_qty - i.system_qty_at_count;
      totalDelta += d;
      if (d < 0) totalShortage += -d;
      if (d > 0) totalOverage += d;
    }
    return { totalItems, totalDelta, totalShortage, totalOverage };
  }, [items]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading…</div>
      </div>
    );
  }
  if (!take) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-gray-400">
        Stock take not found.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/${slug}/manage/admin/stock-takes`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to stock takes
        </Link>
      </div>

      <div className="flex items-start justify-between gap-3 mb-6 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Stock take — {new Date(take.started_at).toLocaleString()}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Status:{" "}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {take.status}
            </span>
            {take.completed_at && (
              <>
                {" "}
                · Completed {new Date(take.completed_at).toLocaleString()}
              </>
            )}
          </p>
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelSession}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={complete}
              disabled={completing || items.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {completing ? "Committing…" : "Complete stock take"}
            </button>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Items counted" value={String(totals.totalItems)} />
        <SummaryCard
          label="Net delta"
          value={`${totals.totalDelta > 0 ? "+" : ""}${totals.totalDelta}`}
          color={
            totals.totalDelta > 0
              ? "text-green-600 dark:text-green-400"
              : totals.totalDelta < 0
                ? "text-red-600 dark:text-red-400"
                : undefined
          }
        />
        <SummaryCard
          label="Shortage (qty)"
          value={String(totals.totalShortage)}
          color={
            totals.totalShortage > 0 ? "text-red-600 dark:text-red-400" : undefined
          }
        />
        <SummaryCard
          label="Overage (qty)"
          value={String(totals.totalOverage)}
          color={
            totals.totalOverage > 0
              ? "text-green-600 dark:text-green-400"
              : undefined
          }
        />
      </div>

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

      {/* Search + add */}
      {!isReadOnly && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Search catalog
          </label>
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Card name or number…"
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          />
          {searching && (
            <p className="text-xs text-gray-400 mt-1">Searching…</p>
          )}
          {searchResults.length > 0 && (
            <ul className="mt-3 max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 border border-gray-200 dark:border-gray-700 rounded">
              {searchResults.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => onPickResult(r)}
                    className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt={r.name}
                        className="w-8 h-11 object-contain rounded flex-shrink-0"
                      />
                    ) : (
                      <div className="w-8 h-11 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {r.name}
                        {r.card_number && (
                          <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                            #{r.card_number}
                          </span>
                        )}
                      </p>
                      {r.set_name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                          {r.set_name}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {picked && (
            <div className="mt-4 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">
                {picked.name}
                {picked.card_number && (
                  <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                    #{picked.card_number}
                  </span>
                )}
              </p>
              <div className="flex flex-wrap items-end gap-3">
                <label className="block">
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Grading
                  </span>
                  <select
                    value={formGrading}
                    onChange={(e) => setFormGrading(e.target.value)}
                    className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                  >
                    {GRADING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                {formGrading !== "ungraded" && (
                  <label className="block">
                    <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Grade
                    </span>
                    <input
                      type="text"
                      value={formGrade}
                      onChange={(e) => setFormGrade(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                    />
                  </label>
                )}
                <label className="block">
                  <span className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Counted
                  </span>
                  <input
                    ref={countedRef}
                    type="number"
                    min={0}
                    step={1}
                    value={formCounted}
                    onChange={(e) => setFormCounted(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void submitAdd();
                      if (e.key === "Escape") cancelPicked();
                    }}
                    className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                  />
                </label>
                <button
                  type="button"
                  onClick={submitAdd}
                  disabled={submittingAdd}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded hover:bg-red-600 disabled:opacity-50"
                >
                  {submittingAdd ? "Saving…" : "Save count"}
                </button>
                <button
                  type="button"
                  onClick={cancelPicked}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Items table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {items.length === 0 ? (
          <div className="p-12 text-sm text-gray-500 dark:text-gray-400 text-center">
            No items counted yet.{" "}
            {!isReadOnly && "Search the catalog above to add your first count."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Card</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                  <th className="px-3 py-2 text-right">System</th>
                  <th className="px-3 py-2 text-right">Counted</th>
                  <th className="px-3 py-2 text-right">Delta</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map((it) => {
                  const delta = it.counted_qty - it.system_qty_at_count;
                  const isEditing = editingId === it.id;
                  return (
                    <tr key={it.id} className="align-top">
                      <td className="px-3 py-3">
                        {it.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={it.image_url}
                            alt={it.product_name ?? ""}
                            className="w-10 h-14 object-contain rounded"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                        <p className="font-medium">
                          {it.product_name}
                          {it.card_number && (
                            <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                              #{it.card_number}
                            </span>
                          )}
                        </p>
                        {it.set_name && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {it.set_name}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        {gradeLabel(it.grading_service, it.grade)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                        {it.system_qty_at_count}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {!isReadOnly && isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void saveEdit(it.id);
                                if (e.key === "Escape") setEditingId(null);
                              }}
                              autoFocus
                              className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                            />
                          </div>
                        ) : !isReadOnly ? (
                          <button
                            type="button"
                            onClick={() => startEdit(it)}
                            className="hover:text-red-500"
                            title="Click to edit count"
                          >
                            {it.counted_qty}
                          </button>
                        ) : (
                          it.counted_qty
                        )}
                      </td>
                      <td
                        className={`px-3 py-3 text-right tabular-nums font-medium ${
                          delta > 0
                            ? "text-green-600 dark:text-green-400"
                            : delta < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-gray-400 dark:text-gray-500"
                        }`}
                      >
                        {delta > 0 ? "+" : ""}
                        {delta}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${
                            it.status === "adjusted"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                              : it.status === "skipped"
                                ? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                                : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                          }`}
                        >
                          {it.status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => removeItem(it.id)}
                            className="text-xs text-gray-500 hover:text-red-600"
                            title="Remove"
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Notes */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mt-6">
        <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
          Notes
        </label>
        <textarea
          value={notesDraft}
          onChange={(e) => {
            setNotesDraft(e.target.value);
            setNotesDirty(true);
          }}
          disabled={isReadOnly}
          rows={2}
          placeholder="Where you counted, anything unusual…"
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 disabled:opacity-60"
        />
        {!isReadOnly && notesDirty && (
          <div className="mt-2">
            <button
              type="button"
              onClick={saveNotes}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded hover:bg-red-600"
            >
              Save notes
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
