"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import CardCell from "@/components/CardCell";
import ZoomableImage from "@/components/ZoomableImage";
import { applyMultiWordIlike } from "@/lib/search";

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
  language?: string | null;
};

type CatalogResult = {
  id: string;
  name: string;
  card_number: string | null;
  image_url: string | null;
  set_name: string | null;
  language: string | null;
};

// Inventory SKU bucket that has lots on hand but no row in this stock
// take session — i.e. "stuff you haven't counted yet". Surfaced via the
// Uncounted filter so a full-store walk-around can verify coverage.
type UncountedBucket = {
  card_product_id: string;
  product_name: string | null;
  card_number: string | null;
  set_name: string | null;
  language: string | null;
  image_url: string | null;
  grading_service: string;
  grade: string | null;
  system_qty: number;
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

// Build the /manage/inventory deep-link for a stocktake bucket. Mirrors the
// filter rules used by ecom.fetch_system_qty: ungraded ignores grade entirely;
// any graded service pins grade (or grade IS NULL via the __null__ sentinel).
function inventoryLinkForBucket(
  slug: string,
  cardProductId: string,
  service: string,
  grade: string | null,
): string {
  const params = new URLSearchParams();
  params.set("card_product_id", cardProductId);
  params.set("grading_service", service);
  if (service !== "ungraded") {
    params.set("grade", grade ?? "__null__");
  }
  return `/${slug}/manage/inventory?${params.toString()}`;
}

export default function StockTakeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const slug = params?.slug as string;
  const stockTakeId = params?.id as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();

  const [take, setTake] = useState<StockTake | null>(null);
  const [items, setItems] = useState<StockTakeItem[]>([]);
  const [uncountedBuckets, setUncountedBuckets] = useState<UncountedBucket[]>(
    [],
  );
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
      // Order by updated_at so adding more to an existing row pops it
      // back to the top (the table has an update_updated_at_column
      // trigger so this reflects the latest save).
      .order("updated_at", { ascending: false });
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
        .select("id, name, image_url, card_number, sets!inner(name, language)")
        .in("id", cardIds);
      type Row = {
        id: string;
        name: string | null;
        card_number: string | null;
        image_url: string | null;
        sets:
          | { name: string | null; language: string | null }
          | Array<{ name: string | null; language: string | null }>
          | null;
      };
      for (const p of (cards ?? []) as unknown as Row[]) {
        const set = Array.isArray(p.sets) ? p.sets[0] : p.sets;
        cardLookup.set(p.id, {
          id: p.id,
          name: p.name ?? "",
          card_number: p.card_number,
          image_url: p.image_url,
          set_name: set?.name ?? null,
          language: set?.language ?? null,
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
          language: hit?.language ?? null,
        };
      }),
    );

    // Compute "uncounted" buckets: SKU buckets that have lots on hand but
    // no row in this session. Bucket key uses the same collapse rule as
    // the rest of the page (ungraded ignores grade text).
    const sessionKeys = new Set(
      itemsRaw.map((i) =>
        bucketKey(
          i.card_product_id,
          i.custom_product_id,
          i.grading_service,
          i.grade,
        ),
      ),
    );
    const { data: lotRows } = await supabase
      .schema("ecom")
      .from("vendor_inventory_summary")
      .select(
        "card_product_id, product_name, image_url, card_number, set_name, language, grading_service, grade, quantity_remaining",
      )
      .eq("account_id", activeAccountId)
      .gt("quantity_remaining", 0)
      .not("card_product_id", "is", null);

    type LotRow = {
      card_product_id: string;
      product_name: string | null;
      image_url: string | null;
      card_number: string | null;
      set_name: string | null;
      language: string | null;
      grading_service: string;
      grade: string | null;
      quantity_remaining: number;
    };
    const bucketMap = new Map<string, UncountedBucket>();
    for (const r of (lotRows ?? []) as LotRow[]) {
      const key = bucketKey(r.card_product_id, null, r.grading_service, r.grade);
      if (sessionKeys.has(key)) continue;
      const existing = bucketMap.get(key);
      if (existing) {
        existing.system_qty += r.quantity_remaining;
      } else {
        bucketMap.set(key, {
          card_product_id: r.card_product_id,
          product_name: r.product_name,
          card_number: r.card_number,
          set_name: r.set_name,
          language: r.language,
          image_url: r.image_url,
          // Normalise ungraded grade to null so the "Add count" handoff
          // creates the right session bucket.
          grading_service: r.grading_service,
          grade: r.grading_service === "ungraded" ? null : r.grade,
          system_qty: r.quantity_remaining,
        });
      }
    }
    const uncounted = Array.from(bucketMap.values()).sort((a, b) =>
      (a.product_name ?? "").localeCompare(b.product_name ?? ""),
    );
    setUncountedBuckets(uncounted);

    setLoading(false);
  }, [supabase, activeAccountId, stockTakeId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Catalog search
  // -------------------------------------------------------------------------
  const SEARCH_PAGE_SIZE = 20;
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 250);
  const [searchResults, setSearchResults] = useState<CatalogResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchHasMore, setSearchHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const focusSearch = () => {
    // Defer past whichever state update triggered the call so the input
    // exists in the DOM by the time we try to focus it (the form swaps
    // between picked/edit/idle states).
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  // Run a single page of the catalog query. offset=0 replaces, otherwise
  // appends to the existing results list.
  const runSearch = useCallback(
    async (text: string, offset: number): Promise<void> => {
      const { data } = await applyMultiWordIlike(
        supabase
          .schema("cards")
          .from("products_with_details")
          .select("id, name, image_url, card_number, set_name, language"),
        text,
        ["name", "card_number", "language"],
      ).range(offset, offset + SEARCH_PAGE_SIZE - 1);
      type Row = {
        id: string;
        name: string | null;
        card_number: string | null;
        image_url: string | null;
        set_name: string | null;
        language: string | null;
      };
      const page: CatalogResult[] = ((data ?? []) as unknown as Row[]).map(
        (p) => ({
          id: p.id,
          name: p.name ?? "",
          card_number: p.card_number,
          image_url: p.image_url,
          set_name: p.set_name ?? null,
          language: p.language ?? null,
        }),
      );
      setSearchHasMore(page.length === SEARCH_PAGE_SIZE);
      setSearchResults((prev) => (offset === 0 ? page : [...prev, ...page]));
    },
    [supabase],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!search.trim() || isReadOnly) {
        setSearchResults([]);
        setSearchHasMore(false);
        return;
      }
      setSearching(true);
      // products_with_details exposes set_name + language at the top
      // level so PostgREST .or() can filter on them — embedded
      // (sets.language) isn't allowed inside a top-level or() filter.
      await runSearch(search, 0);
      if (cancelled) return;
      setSearching(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [search, isReadOnly, runSearch]);

  const loadMoreResults = async () => {
    if (loadingMore || !searchHasMore || !search.trim()) return;
    setLoadingMore(true);
    await runSearch(search, searchResults.length);
    setLoadingMore(false);
  };

  // -------------------------------------------------------------------------
  // Add-to-count form (opens when a search result is picked)
  // editingItemId is non-null when the form is editing an existing row
  // instead of adding a new one. Same form, different commit path.
  // -------------------------------------------------------------------------
  const [picked, setPicked] = useState<CatalogResult | null>(null);
  const [formGrading, setFormGrading] = useState<string>("ungraded");
  const [formGrade, setFormGrade] = useState<string>("");
  const [formCounted, setFormCounted] = useState<string>("1");
  const [submittingAdd, setSubmittingAdd] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const countedRef = useRef<HTMLInputElement | null>(null);
  const formAnchorRef = useRef<HTMLDivElement | null>(null);

  // Auto-focus the search whenever the page lands on the idle add state:
  // first paint after load, after a save/edit clears the form, after
  // cancelling an edit. Skipped when the session is read-only.
  useEffect(() => {
    if (!loading && !isReadOnly && !picked && !editingItemId) {
      searchInputRef.current?.focus();
    }
  }, [loading, isReadOnly, picked, editingItemId]);

  // When a card is picked, fetch its existing lots so the user can click
  // the exact variant (matching grade text) instead of guessing what the
  // DB stored — Shiny imports use ids like "psa_10" or "tag10_pristine"
  // which don't match free-text input.
  type PickedLot = {
    grading_service: string;
    grade: string | null;
    quantity_remaining: number;
  };
  const [pickedLots, setPickedLots] = useState<PickedLot[]>([]);
  const [pickedLotsLoading, setPickedLotsLoading] = useState(false);

  useEffect(() => {
    if (!picked || !activeAccountId) {
      setPickedLots([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setPickedLotsLoading(true);
      const { data } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .select("grading_service, grade, quantity_remaining")
        .eq("account_id", activeAccountId)
        .eq("card_product_id", picked.id)
        .gt("quantity_remaining", 0);
      if (cancelled) return;
      // Collapse to one entry per (grading, grade) summing quantity.
      const agg = new Map<string, PickedLot>();
      for (const row of (data ?? []) as PickedLot[]) {
        const key = `${row.grading_service}|${row.grade ?? ""}`;
        const cur = agg.get(key);
        if (cur) cur.quantity_remaining += row.quantity_remaining;
        else agg.set(key, { ...row });
      }
      // Sort: ungraded first, then by grading then grade.
      const sorted = Array.from(agg.values()).sort((a, b) => {
        if (a.grading_service === "ungraded" && b.grading_service !== "ungraded") return -1;
        if (b.grading_service === "ungraded" && a.grading_service !== "ungraded") return 1;
        const g = a.grading_service.localeCompare(b.grading_service);
        if (g !== 0) return g;
        return (a.grade ?? "").localeCompare(b.grade ?? "");
      });
      setPickedLots(sorted);
      setPickedLotsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [picked, activeAccountId, supabase]);

  const onPickResult = (r: CatalogResult) => {
    setPicked(r);
    setEditingItemId(null);
    setFormGrading("ungraded");
    setFormGrade("");
    setFormCounted("1");
    setSearchInput("");
    setSearchResults([]);
    // Defer focus until the form mounts on next paint.
    setTimeout(() => countedRef.current?.focus(), 50);
  };

  // Open the same picker form pre-filled for an existing item. Saving from
  // edit mode targets the row by id, so changing grade or grading_service
  // updates in place instead of leaving an orphan + creating a new row.
  const startEditItem = (it: StockTakeItem) => {
    if (!it.card_product_id) return;
    setPicked({
      id: it.card_product_id,
      name: it.product_name ?? "",
      card_number: it.card_number ?? null,
      image_url: it.image_url ?? null,
      set_name: it.set_name ?? null,
      language: it.language ?? null,
    });
    setEditingItemId(it.id);
    setFormGrading(it.grading_service);
    setFormGrade(it.grade ?? "");
    setFormCounted(String(it.counted_qty));
    setSearchInput("");
    setSearchResults([]);
    setTimeout(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      countedRef.current?.focus();
    }, 50);
  };

  // Pre-fill the form from an existing variant so the grade text matches
  // exactly what's in inventory_lots (avoids "+1 delta even though I have
  // it" caused by Shiny-style ids vs user-typed grades).
  const onPickExistingLot = (lot: PickedLot) => {
    setFormGrading(lot.grading_service);
    setFormGrade(lot.grade ?? "");
    setTimeout(() => countedRef.current?.focus(), 50);
  };

  // Open the picker from an Uncounted bucket — same flow as picking
  // from search, but the card + grading + grade are pre-locked to the
  // bucket so the user only has to enter the counted qty.
  const startCountFromBucket = (b: UncountedBucket) => {
    setPicked({
      id: b.card_product_id,
      name: b.product_name ?? "",
      card_number: b.card_number,
      image_url: b.image_url,
      set_name: b.set_name,
      language: b.language,
    });
    setEditingItemId(null);
    setFormGrading(b.grading_service);
    setFormGrade(b.grade ?? "");
    setFormCounted("");
    setSearchInput("");
    setSearchResults([]);
    setTimeout(() => {
      formAnchorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
      countedRef.current?.focus();
    }, 50);
  };

  const cancelPicked = () => {
    setPicked(null);
    setEditingItemId(null);
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

      if (editingItemId) {
        // Edit mode: update the targeted row in place, even if grading/grade
        // changed. Always re-snapshots system_qty so the delta reflects the
        // (possibly new) bucket.
        const { error: uErr } = await supabase
          .schema("ecom")
          .from("stock_take_items")
          .update({
            grading_service: grading,
            grade,
            counted_qty: counted,
            system_qty_at_count: systemQty,
          })
          .eq("id", editingItemId);
        if (uErr) throw uErr;
        setNotice(`Updated ${picked.name}.`);
      } else {
        // Add mode: if a row already exists for this bucket in this session,
        // ADD to its counted_qty rather than replace — matches the way a
        // physical stocktake actually accumulates (find more of the same
        // card on another shelf, tally the new ones in). system_qty_at_count
        // stays pinned to its original snapshot so a mid-session sale
        // doesn't artificially shift the delta. Use the per-row Edit
        // button if you need to overwrite or re-snapshot.
        const existing = items.find(
          (i) =>
            bucketKey(i.card_product_id, i.custom_product_id, i.grading_service, i.grade) ===
            bucketKey(picked.id, null, grading, grade),
        );
        if (existing) {
          const newCount = existing.counted_qty + counted;
          const { error: uErr } = await supabase
            .schema("ecom")
            .from("stock_take_items")
            .update({
              counted_qty: newCount,
            })
            .eq("id", existing.id);
          if (uErr) throw uErr;
          setNotice(
            `Added ${counted} to ${picked.name} (total counted: ${newCount}).`,
          );
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
      }
      setPicked(null);
      setEditingItemId(null);
      await loadData();
      // Re-focus the search so the user can scan/type the next card
      // without reaching back to the input each time.
      focusSearch();
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

  // Delete the session. Draft/cancelled remove cleanly (stock_take_items
  // cascades). Completed sessions: the row + items go away but
  // stock_adjustments survive (FK on delete set null) — applied inventory
  // changes are NOT reversed, only the session metadata is lost. Strong
  // confirmation reflects that.
  const [deleting, setDeleting] = useState(false);
  const deleteSession = async () => {
    if (!take) return;
    const warning =
      take.status === "completed"
        ? "Delete this completed stock take? The inventory adjustments it applied will NOT be reversed — only the count session and its item breakdown are removed. This can't be undone."
        : `Delete this ${take.status} stock take? Counts in this session will be lost. This can't be undone.`;
    if (!confirm(warning)) return;
    setDeleting(true);
    setError(null);
    const { error: dErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .delete()
      .eq("id", stockTakeId);
    setDeleting(false);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    router.push(`/${slug}/manage/admin/stock-takes`);
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
  // Filter the items table: all / shortages (missing) / overages (found) /
  // matched (zero delta). Defaults to all; flips to shortages on completed
  // sessions so "what went missing?" is one click away. Synced to ?view=…
  // so reload + back/forward + sharing a URL preserves the active tab.
  type ItemFilter = "all" | "shortage" | "overage" | "matched" | "uncounted";
  const ITEM_FILTERS: ItemFilter[] = [
    "all",
    "shortage",
    "overage",
    "matched",
    "uncounted",
  ];
  const viewParam = searchParams?.get("view") ?? null;
  const itemFilter: ItemFilter =
    viewParam && (ITEM_FILTERS as string[]).includes(viewParam)
      ? (viewParam as ItemFilter)
      : "all";
  const setItemFilter = useCallback(
    (next: ItemFilter) => {
      const sp = new URLSearchParams(searchParams?.toString() ?? "");
      if (next === "all") sp.delete("view");
      else sp.set("view", next);
      const qs = sp.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );
  const visibleItems = useMemo(() => {
    if (itemFilter === "all") return items;
    return items.filter((it) => {
      const d = it.counted_qty - it.system_qty_at_count;
      if (itemFilter === "shortage") return d < 0;
      if (itemFilter === "overage") return d > 0;
      return d === 0;
    });
  }, [items, itemFilter]);

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalDelta = 0;
    let totalShortage = 0;
    let totalOverage = 0;
    let shortageRows = 0;
    let overageRows = 0;
    let matchedRows = 0;
    for (const i of items) {
      totalItems += 1;
      const d = i.counted_qty - i.system_qty_at_count;
      totalDelta += d;
      if (d < 0) {
        totalShortage += -d;
        shortageRows += 1;
      } else if (d > 0) {
        totalOverage += d;
        overageRows += 1;
      } else {
        matchedRows += 1;
      }
    }
    return {
      totalItems,
      totalDelta,
      totalShortage,
      totalOverage,
      shortageRows,
      overageRows,
      matchedRows,
    };
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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={deleteSession}
            disabled={deleting}
            className="px-3 py-2 text-sm font-medium text-red-600 dark:text-red-400 bg-white dark:bg-gray-700 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
          {!isReadOnly && (
            <>
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
            </>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
        <SummaryCard
          label="Uncounted"
          value={String(uncountedBuckets.length)}
          color={
            uncountedBuckets.length > 0
              ? "text-amber-600 dark:text-amber-400"
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
        <div
          ref={formAnchorRef}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6"
        >
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            {editingItemId ? "Editing item" : "Search catalog"}
          </label>
          {!editingItemId && (
            <>
              <input
                ref={searchInputRef}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Card name or number…"
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
              />
              {searching && (
                <p className="text-xs text-gray-400 mt-1">Searching…</p>
              )}
            </>
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
                        className="w-16 h-[5.5rem] object-contain rounded flex-shrink-0 bg-gray-50 dark:bg-gray-900"
                      />
                    ) : (
                      <div className="w-16 h-[5.5rem] bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0" />
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
                      {(r.set_name || r.language) && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate flex items-center gap-1.5">
                          {r.set_name && <span>{r.set_name}</span>}
                          {r.language && (
                            <span
                              className="inline-block px-1.5 py-0.5 text-[10px] uppercase tracking-wide font-medium rounded bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200"
                              title="Language"
                            >
                              {r.language}
                            </span>
                          )}
                        </p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
              {searchHasMore && (
                <li>
                  <button
                    type="button"
                    onClick={loadMoreResults}
                    disabled={loadingMore}
                    className="w-full px-3 py-2 text-sm font-medium text-red-500 hover:text-red-600 hover:bg-gray-50 dark:hover:bg-gray-700/50 disabled:opacity-50"
                  >
                    {loadingMore
                      ? "Loading…"
                      : `Load more (${searchResults.length} shown)`}
                  </button>
                </li>
              )}
            </ul>
          )}

          {picked && (
            <div className="mt-4 p-3 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
              <div className="flex items-start gap-3 mb-3">
                {picked.image_url ? (
                  <ZoomableImage
                    src={picked.image_url}
                    alt={picked.name}
                    className="w-20 h-28 object-contain rounded bg-gray-50 dark:bg-gray-900 flex-shrink-0"
                  />
                ) : (
                  <div className="w-20 h-28 bg-gray-200 dark:bg-gray-600 rounded flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <CardCell
                    cardProductId={picked.id}
                    name={picked.name}
                    cardNumber={picked.card_number}
                    setName={picked.set_name}
                    language={picked.language}
                  />
                </div>
              </div>

              {/* Existing variants in your inventory — click to pre-fill
                  grading + grade so the system-qty lookup matches the lot
                  exactly (avoids text-mismatch +1-delta bugs). */}
              <div className="mb-3">
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Existing in inventory
                </p>
                {pickedLotsLoading ? (
                  <p className="text-xs text-gray-400">Loading…</p>
                ) : pickedLots.length === 0 ? (
                  <p className="text-xs text-gray-400 italic">
                    No lots — anything you count creates a new &ldquo;found&rdquo; lot.
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {pickedLots.map((lot) => {
                      const isActive =
                        lot.grading_service === formGrading &&
                        (lot.grade ?? "") === formGrade;
                      return (
                        <button
                          key={`${lot.grading_service}|${lot.grade ?? ""}`}
                          type="button"
                          onClick={() => onPickExistingLot(lot)}
                          className={`px-2 py-1 text-xs rounded border ${
                            isActive
                              ? "bg-red-500 text-white border-red-500"
                              : "bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600"
                          }`}
                          title="Pre-fill grading + grade from this lot"
                        >
                          {gradeLabel(lot.grading_service, lot.grade)}
                          <span className="ml-1 opacity-70">
                            &times;{lot.quantity_remaining}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

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
                  {submittingAdd
                    ? "Saving…"
                    : editingItemId
                      ? "Save changes"
                      : "Save count"}
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

      {/* Items filter — quick lens onto shortages / overages / uncounted */}
      {(items.length > 0 || uncountedBuckets.length > 0) && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Show
          </span>
          {(
            [
              { key: "all" as const, label: "All", count: items.length },
              { key: "shortage" as const, label: "Missing", count: totals.shortageRows },
              { key: "overage" as const, label: "Found", count: totals.overageRows },
              { key: "matched" as const, label: "Matched", count: totals.matchedRows },
              { key: "uncounted" as const, label: "Uncounted", count: uncountedBuckets.length },
            ]
          ).map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setItemFilter(f.key)}
              className={
                itemFilter === f.key
                  ? "px-2.5 py-1 text-xs font-semibold rounded bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                  : "px-2.5 py-1 text-xs font-medium rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }
            >
              {f.label}
              <span className="ml-1 opacity-70 tabular-nums">{f.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Items table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {itemFilter === "uncounted" ? (
          uncountedBuckets.length === 0 ? (
            <div className="p-12 text-sm text-gray-500 dark:text-gray-400 text-center">
              No uncounted inventory — every SKU bucket with stock is
              represented in this session.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left w-20 min-w-[5rem] max-w-[5rem]"></th>
                    <th className="px-3 py-2 text-left">Card</th>
                    <th className="px-3 py-2 text-left">Grade</th>
                    <th className="px-3 py-2 text-right">System</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {uncountedBuckets.map((b) => {
                    const bk = bucketKey(
                      b.card_product_id,
                      null,
                      b.grading_service,
                      b.grade,
                    );
                    return (
                      <tr key={bk} className="align-top">
                        <td className="px-3 py-3 w-20 min-w-[5rem] max-w-[5rem]">
                          {b.image_url ? (
                            <ZoomableImage
                              src={b.image_url}
                              alt={b.product_name ?? ""}
                              className="w-14 h-[5rem] object-contain rounded bg-gray-50 dark:bg-gray-900"
                            />
                          ) : (
                            <div className="w-14 h-[5rem] bg-gray-200 dark:bg-gray-600 rounded" />
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <CardCell
                            cardProductId={b.card_product_id}
                            name={b.product_name}
                            cardNumber={b.card_number}
                            setName={b.set_name}
                            language={b.language}
                          />
                          <Link
                            href={inventoryLinkForBucket(
                              slug,
                              b.card_product_id,
                              b.grading_service,
                              b.grade,
                            )}
                            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border border-gray-200 dark:border-gray-700 text-gray-600 hover:text-red-600 hover:border-red-300 dark:text-gray-300 dark:hover:border-red-700"
                            title="Open inventory filtered to this bucket (card + grading + grade)"
                          >
                            Inventory &rarr;
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                          {gradeLabel(b.grading_service, b.grade)}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                          {b.system_qty}
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          {!isReadOnly && (
                            <button
                              type="button"
                              onClick={() => startCountFromBucket(b)}
                              className="px-2 py-1 text-xs font-medium rounded text-white bg-red-500 hover:bg-red-600"
                              title="Open the picker pre-filled with this bucket"
                            >
                              Count
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )
        ) : items.length === 0 ? (
          <div className="p-12 text-sm text-gray-500 dark:text-gray-400 text-center">
            No items counted yet.{" "}
            {!isReadOnly && "Search the catalog above to add your first count."}
          </div>
        ) : visibleItems.length === 0 ? (
          <div className="p-12 text-sm text-gray-500 dark:text-gray-400 text-center">
            No items match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left w-20 min-w-[5rem] max-w-[5rem]"></th>
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
                {visibleItems.map((it) => {
                  const delta = it.counted_qty - it.system_qty_at_count;
                  const isEditing = editingId === it.id;
                  return (
                    <tr key={it.id} className="align-top">
                      <td className="px-3 py-3 w-20 min-w-[5rem] max-w-[5rem]">
                        {it.image_url ? (
                          <ZoomableImage
                            src={it.image_url}
                            alt={it.product_name ?? ""}
                            className="w-14 h-[5rem] object-contain rounded bg-gray-50 dark:bg-gray-900"
                          />
                        ) : (
                          <div className="w-14 h-[5rem] bg-gray-200 dark:bg-gray-600 rounded" />
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <CardCell
                          cardProductId={it.card_product_id}
                          name={it.product_name ?? null}
                          cardNumber={it.card_number ?? null}
                          setName={it.set_name ?? null}
                          language={it.language ?? null}
                        />
                        {it.card_product_id && (
                          <Link
                            href={inventoryLinkForBucket(
                              slug,
                              it.card_product_id,
                              it.grading_service,
                              it.grade,
                            )}
                            className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] font-medium rounded border border-gray-200 dark:border-gray-700 text-gray-600 hover:text-red-600 hover:border-red-300 dark:text-gray-300 dark:hover:border-red-700"
                            title="Open inventory filtered to this bucket (card + grading + grade)"
                          >
                            Inventory &rarr;
                          </Link>
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
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => startEditItem(it)}
                              disabled={!it.card_product_id}
                              className="text-xs font-medium text-gray-600 hover:text-red-600 dark:text-gray-300 disabled:opacity-40 disabled:hover:text-gray-600"
                              title={
                                it.card_product_id
                                  ? "Edit grading, grade or counted qty (also re-snapshots system qty)"
                                  : "Edit not supported for custom products yet"
                              }
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeItem(it.id)}
                              className="text-xs text-gray-500 hover:text-red-600"
                              title="Remove"
                            >
                              Remove
                            </button>
                          </div>
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
