"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { gradeLabel, type EcomListing } from "@/lib/pricing";
import CardCell from "@/components/CardCell";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// Store Page — shows ecom.listings (active listings)
// ---------------------------------------------------------------------------

export default function ListingsPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [listings, setListings] = useState<EcomListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting
  type SortKey = "card" | "grade" | "qty" | "cost" | "market" | "calculated" | "price" | "diff" | "profit" | "status";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  // Bulk action state
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkUnlisting, setBulkUnlisting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Selection (matches unlisted page pattern)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters — initialized from query string so they survive reload and can
  // be shared by link. URL sync happens in the useEffect below.
  const [filtersOpen, setFiltersOpen] = useState(
    () => searchParams.get("filters") === "1",
  );
  const [staleOnly, setStaleOnly] = useState(
    () => searchParams.get("stale") === "1",
  );
  const [gradeFilter, setGradeFilter] = useState<string>(
    () => searchParams.get("grade") ?? "all",
  );
  const [costMin, setCostMin] = useState<string>(
    () => searchParams.get("cost_min") ?? "",
  );
  const [costMax, setCostMax] = useState<string>(
    () => searchParams.get("cost_max") ?? "",
  );
  const [marketMin, setMarketMin] = useState<string>(
    () => searchParams.get("mkt_min") ?? "",
  );
  const [marketMax, setMarketMax] = useState<string>(
    () => searchParams.get("mkt_max") ?? "",
  );
  const [hasCostFilter, setHasCostFilter] = useState<"any" | "with" | "without">(
    () => {
      const v = searchParams.get("has_cost");
      return v === "with" || v === "without" ? v : "any";
    },
  );
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "draft" | "sold"
  >(() => {
    const v = searchParams.get("status");
    return v === "active" || v === "draft" || v === "sold" ? v : "all";
  });
  const [cardNumberFilter, setCardNumberFilter] = useState<string>(
    () => searchParams.get("card_no") ?? "",
  );
  const [nameFilter, setNameFilter] = useState<string>(
    () => searchParams.get("name") ?? "",
  );

  // Push filter state into the URL on change. Skips default values to keep
  // clean URLs clean. router.replace doesn't push a history entry, so the
  // browser back button still goes to the previous page rather than walking
  // through filter changes.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filtersOpen) next.set("filters", "1");
    if (staleOnly) next.set("stale", "1");
    if (gradeFilter !== "all") next.set("grade", gradeFilter);
    if (costMin.trim()) next.set("cost_min", costMin.trim());
    if (costMax.trim()) next.set("cost_max", costMax.trim());
    if (marketMin.trim()) next.set("mkt_min", marketMin.trim());
    if (marketMax.trim()) next.set("mkt_max", marketMax.trim());
    if (hasCostFilter !== "any") next.set("has_cost", hasCostFilter);
    if (statusFilter !== "all") next.set("status", statusFilter);
    if (cardNumberFilter.trim()) next.set("card_no", cardNumberFilter.trim());
    if (nameFilter.trim()) next.set("name", nameFilter.trim());
    const qs = next.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (url !== `${pathname}${window.location.search}`) {
      router.replace(url, { scroll: false });
    }
  }, [
    filtersOpen,
    staleOnly,
    gradeFilter,
    costMin,
    costMax,
    marketMin,
    marketMax,
    hasCostFilter,
    statusFilter,
    cardNumberFilter,
    nameFilter,
    pathname,
    router,
  ]);
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelectedIds(new Set());

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data } = await supabase
      .schema("ecom")
      .from("listing_details")
      .select("*")
      .eq("account_id", activeAccountId)
      .neq("status", "archived");

    setListings((data ?? []) as EcomListing[]);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seller's currency (all listings share the same account/currency)
  const sellerCurrency = listings[0]?.currency ?? "AUD";
  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === sellerCurrency)?.symbol ?? "$";
  const fmt = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, sellerCurrency, {}, sellerCurrency);

  // Build rows
  const rows = useMemo(() => {
    return listings.map((listing) => {
      const profit =
        listing.price_cents != null && listing.cost_cents != null
          ? listing.price_cents - listing.cost_cents
          : null;
      const diff =
        listing.calculated_price_cents != null && listing.price_cents != null
          ? listing.calculated_price_cents - listing.price_cents
          : null;
      // What the row would earn if it sold at the calculated price
      // instead of the current listed price — answers "is bumping to
      // the calculated price worth it?"
      const calcProfit =
        listing.calculated_price_cents != null && listing.cost_cents != null
          ? listing.calculated_price_cents - listing.cost_cents
          : null;
      return { listing, profit, diff, calcProfit };
    });
  }, [listings]);

  // Filtered + sorted rows. Filter runs before sort so the select-all
  // checkbox (which keys off sortedRows) picks up the filtered set.
  const sortedRows = useMemo(() => {
    let filtered = rows;
    if (staleOnly) {
      filtered = filtered.filter(
        (r) =>
          r.listing.calculated_price_cents != null &&
          r.listing.price_cents != null &&
          r.listing.calculated_price_cents !== r.listing.price_cents,
      );
    }
    if (gradeFilter !== "all") {
      filtered = filtered.filter(
        (r) =>
          gradeLabel(r.listing.grading_service, r.listing.grade) === gradeFilter,
      );
    }
    const parseDollarsToCents = (s: string): number | null => {
      const trimmed = s.trim();
      if (!trimmed) return null;
      const n = Number(trimmed);
      if (!Number.isFinite(n)) return null;
      return Math.round(n * 100);
    };
    const costMinCents = parseDollarsToCents(costMin);
    const costMaxCents = parseDollarsToCents(costMax);
    if (costMinCents != null) {
      filtered = filtered.filter(
        (r) => r.listing.cost_cents != null && r.listing.cost_cents >= costMinCents,
      );
    }
    if (costMaxCents != null) {
      filtered = filtered.filter(
        (r) => r.listing.cost_cents != null && r.listing.cost_cents <= costMaxCents,
      );
    }
    const marketMinCents = parseDollarsToCents(marketMin);
    const marketMaxCents = parseDollarsToCents(marketMax);
    if (marketMinCents != null) {
      filtered = filtered.filter(
        (r) =>
          r.listing.market_price_cents != null &&
          r.listing.market_price_cents >= marketMinCents,
      );
    }
    if (marketMaxCents != null) {
      filtered = filtered.filter(
        (r) =>
          r.listing.market_price_cents != null &&
          r.listing.market_price_cents <= marketMaxCents,
      );
    }
    if (hasCostFilter === "with") {
      filtered = filtered.filter((r) => r.listing.cost_cents != null);
    } else if (hasCostFilter === "without") {
      filtered = filtered.filter((r) => r.listing.cost_cents == null);
    }
    if (statusFilter !== "all") {
      filtered = filtered.filter((r) => r.listing.status === statusFilter);
    }
    const cardNoQuery = cardNumberFilter.trim().toLowerCase();
    if (cardNoQuery) {
      filtered = filtered.filter((r) =>
        (r.listing.card_number ?? "").toLowerCase().includes(cardNoQuery),
      );
    }
    const nameQuery = nameFilter.trim().toLowerCase();
    if (nameQuery) {
      filtered = filtered.filter((r) =>
        (r.listing.card_name ?? "").toLowerCase().includes(nameQuery),
      );
    }
    if (!sortKey) return filtered;
    const sorted = [...filtered].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      switch (sortKey) {
        case "card":
          // Sort by card name, then set so cards with the same name
          // (e.g. reprints across sets) group their sets predictably.
          av = `${a.listing.card_name?.toLowerCase() ?? ""}|${a.listing.set_name?.toLowerCase() ?? ""}`;
          bv = `${b.listing.card_name?.toLowerCase() ?? ""}|${b.listing.set_name?.toLowerCase() ?? ""}`;
          break;
        case "grade":
          av = gradeLabel(a.listing.grading_service, a.listing.grade).toLowerCase();
          bv = gradeLabel(b.listing.grading_service, b.listing.grade).toLowerCase();
          break;
        case "qty":
          av = a.listing.quantity;
          bv = b.listing.quantity;
          break;
        case "cost":
          av = a.listing.cost_cents ?? -Infinity;
          bv = b.listing.cost_cents ?? -Infinity;
          break;
        case "market":
          av = a.listing.market_price_cents ?? -Infinity;
          bv = b.listing.market_price_cents ?? -Infinity;
          break;
        case "calculated":
          av = a.listing.calculated_price_cents ?? -Infinity;
          bv = b.listing.calculated_price_cents ?? -Infinity;
          break;
        case "price":
          av = a.listing.price_cents ?? -Infinity;
          bv = b.listing.price_cents ?? -Infinity;
          break;
        case "diff":
          av = a.diff ?? -Infinity;
          bv = b.diff ?? -Infinity;
          break;
        case "profit":
          av = a.profit ?? -Infinity;
          bv = b.profit ?? -Infinity;
          break;
        case "status":
          av = a.listing.status;
          bv = b.listing.status;
          break;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [
    rows,
    sortKey,
    sortDir,
    staleOnly,
    gradeFilter,
    costMin,
    costMax,
    marketMin,
    marketMax,
    hasCostFilter,
    statusFilter,
    cardNumberFilter,
    nameFilter,
  ]);

  // Available grades from current listings (for the filter dropdown)
  const gradeOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const r of rows) {
      labels.add(gradeLabel(r.listing.grading_service, r.listing.grade));
    }
    return [...labels].sort();
  }, [rows]);

  // Count of stale listings (any price drift, regardless of current filter state)
  const staleCount = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.listing.calculated_price_cents != null &&
          r.listing.price_cents != null &&
          r.listing.calculated_price_cents !== r.listing.price_cents,
      ).length,
    [rows],
  );

  // Summary totals
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalValue = 0;
    let totalProfit = 0;
    let totalDiff = 0;

    for (const r of sortedRows) {
      const qty = r.listing.quantity;
      totalItems += qty;
      if (r.listing.cost_cents != null) totalCost += r.listing.cost_cents * qty;
      if (r.listing.price_cents != null) totalValue += r.listing.price_cents * qty;
      if (r.profit != null) totalProfit += r.profit * qty;
      if (r.diff != null) totalDiff += r.diff * qty;
    }

    return { totalItems, totalCost, totalValue, totalProfit, totalDiff };
  }, [sortedRows]);

  // Pricing health — how many listings are priced under, on, or over
  // their calculated value. Uses a ±5% tolerance band so micro-drift
  // (rounding, cents-level rate changes) doesn't churn the buckets.
  // Listings without a calculated price (e.g. cost_plus with unknown
  // blended cost) and zero-priced rows are skipped.
  const PRICING_TOLERANCE = 0.05;
  const pricingHealth = useMemo(() => {
    let under = 0;
    let onTarget = 0;
    let over = 0;
    for (const r of sortedRows) {
      const listed = r.listing.price_cents;
      const calc = r.listing.calculated_price_cents;
      if (listed == null || calc == null || listed === 0) continue;
      const ratio = (calc - listed) / listed;
      if (ratio > PRICING_TOLERANCE) under++;
      else if (ratio < -PRICING_TOLERANCE) over++;
      else onTarget++;
    }
    return { under, onTarget, over };
  }, [sortedRows]);

  // Inline price edit handlers
  const startEditing = (listing: EcomListing) => {
    setEditingId(listing.id);
    const price =
      listing.pricing_mode === "fixed"
        ? listing.fixed_price_cents
        : listing.price_cents;
    setEditPrice(price != null ? (price / 100).toFixed(2) : "");
  };

  const savePrice = async (listingId: string) => {
    setSaving(true);
    const cents = Math.round(parseFloat(editPrice) * 100);
    if (isNaN(cents) || cents < 0) {
      setSaving(false);
      return;
    }

    await supabase
      .schema("ecom")
      .from("listings")
      .update({
        pricing_mode: "fixed",
        fixed_price_cents: cents,
        price_cents: cents,
        market_multiplier: null,
        market_round_to: null,
        market_extra_cents: null,
      })
      .eq("id", listingId);

    setEditingId(null);
    setSaving(false);
    await loadData();
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  // Bulk-update only currently selected listings whose price has drifted.
  // Skips selected rows that are already up-to-date or have no calculated
  // price; doesn't error on those, they just count as no-ops.
  const updateSelected = async () => {
    const targets = listings.filter(
      (l) =>
        selectedIds.has(l.id) &&
        l.calculated_price_cents != null &&
        l.calculated_price_cents !== l.price_cents,
    );
    if (targets.length === 0) {
      setActionNotice("No selected listings need updating.");
      return;
    }
    setBulkUpdating(true);
    setActionError(null);
    setActionNotice(null);
    let ok = 0;
    let failed = 0;
    for (const l of targets) {
      const patch: Record<string, number | null> = {
        price_cents: l.calculated_price_cents,
      };
      if (l.pricing_mode === "fixed") {
        patch.fixed_price_cents = l.calculated_price_cents;
      }
      const { error } = await supabase
        .schema("ecom")
        .from("listings")
        .update(patch)
        .eq("id", l.id);
      if (error) failed++;
      else ok++;
    }
    setBulkUpdating(false);
    setActionNotice(
      `Updated ${ok} listing${ok === 1 ? "" : "s"}` +
        (failed > 0 ? `; ${failed} failed.` : "."),
    );
    clearSelection();
    await loadData();
  };

  const unlistSelected = async () => {
    if (selectedIds.size === 0) return;
    if (
      !window.confirm(
        `Unlist ${selectedIds.size} listing${
          selectedIds.size === 1 ? "" : "s"
        }? The lots return to your unlisted inventory; pricing config is kept.`,
      )
    ) {
      return;
    }
    setBulkUnlisting(true);
    setActionError(null);
    setActionNotice(null);
    const ids = Array.from(selectedIds);
    const { error } = await supabase
      .schema("ecom")
      .from("listings")
      .update({ status: "archived" })
      .in("id", ids);
    setBulkUnlisting(false);
    if (error) {
      setActionError(`Bulk unlist failed: ${error.message}`);
      return;
    }
    setActionNotice(
      `Unlisted ${ids.length} listing${ids.length === 1 ? "" : "s"}.`,
    );
    clearSelection();
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">
          Loading store...
        </div>
      </div>
    );
  }

  return (
    <div>
      {actionError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {actionError}
        </div>
      )}
      {actionNotice && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          {actionNotice}
        </div>
      )}

      {/* Selection bar — appears when at least one listing is checked */}
      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <button
            type="button"
            onClick={updateSelected}
            disabled={bulkUpdating}
            className="px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 rounded-lg disabled:opacity-50"
          >
            {bulkUpdating
              ? "Updating…"
              : `Update ${selectedIds.size} selected`}
          </button>
          <button
            type="button"
            onClick={unlistSelected}
            disabled={bulkUnlisting}
            className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg disabled:opacity-50"
          >
            {bulkUnlisting
              ? "Unlisting…"
              : `Unlist ${selectedIds.size} selected`}
          </button>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedIds.size} of {sortedRows.length} selected
          </div>
          <button
            type="button"
            onClick={clearSelection}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <SummaryCard label="Listings" value={String(totals.totalItems)} />
        <SummaryCard label="Total Cost" value={fmt(totals.totalCost)} />
        <SummaryCard label="Listing Value" value={fmt(totals.totalValue)} />
        <SummaryCard
          label="Profit"
          value={fmt(totals.totalProfit)}
          color={
            totals.totalProfit > 0
              ? "text-green-600 dark:text-green-400"
              : totals.totalProfit < 0
                ? "text-red-600 dark:text-red-400"
                : undefined
          }
        />
        <SummaryCard
          label="Calc − Listed"
          value={`${totals.totalDiff > 0 ? "+" : ""}${fmt(totals.totalDiff)}`}
          color={
            totals.totalDiff > 0
              ? "text-green-600 dark:text-green-400"
              : totals.totalDiff < 0
                ? "text-red-600 dark:text-red-400"
                : undefined
          }
        />
        <PricingHealthCard
          under={pricingHealth.under}
          onTarget={pricingHealth.onTarget}
          over={pricingHealth.over}
          tolerancePct={PRICING_TOLERANCE * 100}
        />
      </div>

      {/* Filters */}
      {rows.length > 0 && (() => {
        const activeFilterCount =
          (staleOnly ? 1 : 0) +
          (gradeFilter !== "all" ? 1 : 0) +
          (costMin.trim() ? 1 : 0) +
          (costMax.trim() ? 1 : 0) +
          (marketMin.trim() ? 1 : 0) +
          (marketMax.trim() ? 1 : 0) +
          (hasCostFilter !== "any" ? 1 : 0) +
          (statusFilter !== "all" ? 1 : 0) +
          (cardNumberFilter.trim() ? 1 : 0) +
          (nameFilter.trim() ? 1 : 0);
        const clearAll = () => {
          setStaleOnly(false);
          setGradeFilter("all");
          setCostMin("");
          setCostMax("");
          setMarketMin("");
          setMarketMax("");
          setHasCostFilter("any");
          setStatusFilter("all");
          setCardNumberFilter("");
          setNameFilter("");
        };
        const inputCls =
          "mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500";
        const labelCls =
          "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase";
        return (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-4">
            <button
              type="button"
              onClick={() => setFiltersOpen((p) => !p)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
            >
              <span className="flex items-center gap-2">
                <span>{filtersOpen ? "▾" : "▸"}</span>
                <span>Filters</span>
                {activeFilterCount > 0 && (
                  <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">
                    {activeFilterCount}
                  </span>
                )}
                {staleCount > 0 && !staleOnly && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    {staleCount} stale
                  </span>
                )}
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({sortedRows.length} of {rows.length})
                </span>
              </span>
              {activeFilterCount > 0 && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    clearAll();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      clearAll();
                    }
                  }}
                  className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline cursor-pointer"
                >
                  Clear all
                </span>
              )}
            </button>
            {filtersOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-gray-100 dark:border-gray-700 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <label className="block">
                  <span className={labelCls}>Stale prices</span>
                  <select
                    value={staleOnly ? "stale" : "any"}
                    onChange={(e) => setStaleOnly(e.target.value === "stale")}
                    className={inputCls}
                  >
                    <option value="any">Any</option>
                    <option value="stale">Stale only ({staleCount})</option>
                  </select>
                </label>

                <label className="block">
                  <span className={labelCls}>Grade</span>
                  <select
                    value={gradeFilter}
                    onChange={(e) => setGradeFilter(e.target.value)}
                    className={inputCls}
                  >
                    <option value="all">All grades</option>
                    {gradeOptions.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelCls}>Status</span>
                  <select
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(
                        e.target.value as "all" | "active" | "draft" | "sold",
                      )
                    }
                    className={inputCls}
                  >
                    <option value="all">All</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="sold">Sold</option>
                  </select>
                </label>

                <label className="block">
                  <span className={labelCls}>Name</span>
                  <input
                    type="text"
                    placeholder="e.g. Charizard"
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className={labelCls}>Card number</span>
                  <input
                    type="text"
                    placeholder="e.g. 001 or BLK-1"
                    value={cardNumberFilter}
                    onChange={(e) => setCardNumberFilter(e.target.value)}
                    className={inputCls}
                  />
                </label>

                <label className="block">
                  <span className={labelCls}>Has cost</span>
                  <select
                    value={hasCostFilter}
                    onChange={(e) =>
                      setHasCostFilter(
                        e.target.value as "any" | "with" | "without",
                      )
                    }
                    className={inputCls}
                  >
                    <option value="any">Any</option>
                    <option value="with">With cost</option>
                    <option value="without">Without cost</option>
                  </select>
                </label>

                <div className="block">
                  <span className={labelCls}>Cost ({currencySymbol})</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Min"
                      value={costMin}
                      onChange={(e) => setCostMin(e.target.value)}
                      className={inputCls.replace("w-full", "w-1/2")}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Max"
                      value={costMax}
                      onChange={(e) => setCostMax(e.target.value)}
                      className={inputCls.replace("w-full", "w-1/2")}
                    />
                  </div>
                </div>

                <div className="block">
                  <span className={labelCls}>Market value ({currencySymbol})</span>
                  <div className="mt-1 flex gap-2">
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Min"
                      value={marketMin}
                      onChange={(e) => setMarketMin(e.target.value)}
                      className={inputCls.replace("w-full", "w-1/2")}
                    />
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder="Max"
                      value={marketMax}
                      onChange={(e) => setMarketMax(e.target.value)}
                      className={inputCls.replace("w-full", "w-1/2")}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No listings yet.{" "}
          <Link
            href={`/${slug}/manage/unlisted`}
            className="text-red-500 hover:text-red-600 font-medium"
          >
            Add your first listing
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    aria-label="Select all"
                    checked={
                      sortedRows.length > 0 &&
                      sortedRows.every((r) => selectedIds.has(r.listing.id))
                    }
                    onChange={() => {
                      if (
                        sortedRows.length > 0 &&
                        sortedRows.every((r) => selectedIds.has(r.listing.id))
                      ) {
                        clearSelection();
                      } else {
                        setSelectedIds(
                          new Set(sortedRows.map((r) => r.listing.id)),
                        );
                      }
                    }}
                    className="rounded text-red-500 focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3 w-14"></th>
                <SortHeader label="Card" sortKey="card" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Grade" sortKey="grade" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Qty" sortKey="qty" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-left">Pricing</th>
                <SortHeader label="Cost" sortKey="cost" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Market" sortKey="market" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Calculated" sortKey="calculated" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Price" sortKey="price" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Diff" sortKey="diff" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Profit" sortKey="profit" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status" sortKey="status" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedRows.map((r) => {
                const isEditing = editingId === r.listing.id;
                const priceStale =
                  r.listing.calculated_price_cents != null &&
                  r.listing.price_cents != null &&
                  r.listing.calculated_price_cents !== r.listing.price_cents;

                return (
                  <tr
                    key={r.listing.id}
                    className={`align-top ${
                      priceStale
                        ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                    title={
                      priceStale
                        ? "Listed price differs from the current calculated price"
                        : undefined
                    }
                  >
                    {/* Selection */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.listing.card_name ?? "listing"}`}
                        checked={selectedIds.has(r.listing.id)}
                        onChange={() => toggleSelection(r.listing.id)}
                        className="rounded text-red-500 focus:ring-red-500"
                      />
                    </td>
                    {/* Image */}
                    <td className="px-4 py-3 w-14">
                      {r.listing.image_url ? (
                        <ZoomableImage
                          src={r.listing.image_url}
                          alt={r.listing.card_name ?? ""}
                          className="w-10 h-14 object-contain rounded max-w-none"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400 shrink-0">
                          {"\u2014"}
                        </div>
                      )}
                    </td>
                    {/* Card \u2014 name, #card_number, set */}
                    <td className="px-4 py-3">
                      <CardCell
                        cardProductId={r.listing.card_product_id}
                        name={r.listing.card_name}
                        cardNumber={r.listing.card_number}
                        setName={r.listing.set_name}
                      />
                    </td>
                    {/* Grade */}
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {gradeLabel(r.listing.grading_service, r.listing.grade)}
                    </td>
                    {/* Qty */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.listing.quantity}
                    </td>
                    {/* Pricing \u2014 Mode + (market: mult, round, extra) + rate */}
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-0.5 text-xs">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                            r.listing.pricing_mode === "fixed"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                          }`}>
                            {r.listing.pricing_mode === "fixed" ? "Fixed" : "Mkt"}
                          </span>
                          {r.listing.pricing_mode === "market" && (
                            <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                              {r.listing.market_multiplier != null && `\u00d7${r.listing.market_multiplier}`}
                              {r.listing.market_round_to != null && (
                                <span className="text-gray-400 dark:text-gray-500"> rd {fmt(r.listing.market_round_to)}</span>
                              )}
                              {r.listing.market_extra_cents ? (
                                <span className="text-gray-400 dark:text-gray-500"> +{fmt(r.listing.market_extra_cents)}</span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.listing.cost_cents)}
                    </td>
                    {/* Market */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.listing.market_price_cents)}
                    </td>
                    {/* Calculated (+ projected profit at that price) */}
                    <td className={`px-4 py-3 text-right ${
                      r.listing.calculated_price_cents != null && r.listing.price_cents != null && r.listing.calculated_price_cents !== r.listing.price_cents
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}>
                      <div>{fmt(r.listing.calculated_price_cents)}</div>
                      {r.calcProfit != null && (
                        <div
                          className={`text-xs tabular-nums ${
                            r.calcProfit > 0
                              ? "text-green-600 dark:text-green-400"
                              : r.calcProfit < 0
                                ? "text-red-600 dark:text-red-400"
                                : "text-gray-400 dark:text-gray-500"
                          }`}
                          title="Profit if sold at the calculated price"
                        >
                          {r.calcProfit > 0 ? "+" : ""}
                          {fmt(r.calcProfit)}
                        </div>
                      )}
                    </td>
                    {/* Price — editable */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") savePrice(r.listing.id);
                              if (e.key === "Escape") cancelEditing();
                            }}
                            autoFocus
                            disabled={saving}
                            className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                          <button
                            onClick={() => savePrice(r.listing.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-700 text-xs font-medium"
                          >
                            {saving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(r.listing)}
                          className="text-gray-900 dark:text-gray-100 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                          title="Click to edit price"
                        >
                          {fmt(r.listing.price_cents)}
                        </button>
                      )}
                    </td>
                    {/* Diff (calculated − listed) */}
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        r.diff != null && r.diff > 0
                          ? "text-green-600 dark:text-green-400"
                          : r.diff != null && r.diff < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-gray-500"
                      }`}
                      title="Calculated price − listed price"
                    >
                      {r.diff == null
                        ? "—"
                        : `${r.diff > 0 ? "+" : ""}${fmt(r.diff)}`}
                    </td>
                    {/* Profit */}
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        r.profit != null && r.profit > 0
                          ? "text-green-600 dark:text-green-400"
                          : r.profit != null && r.profit < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {fmt(r.profit)}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.listing.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {r.listing.status === "active" ? "Active" : "Draft"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  sortKey,
  align,
  activeSortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: string;
  align: "left" | "right";
  activeSortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: any) => void;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${
        align === "right" ? "text-right" : ""
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === "right" && isActive && (
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
            {sortDir === "asc" ? (
              <path d="M6 2l4 5H2z" />
            ) : (
              <path d="M6 10l4-5H2z" />
            )}
          </svg>
        )}
        {label}
        {align === "left" && isActive && (
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
            {sortDir === "asc" ? (
              <path d="M6 2l4 5H2z" />
            ) : (
              <path d="M6 10l4-5H2z" />
            )}
          </svg>
        )}
      </span>
    </th>
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

function PricingHealthCard({
  under,
  onTarget,
  over,
  tolerancePct,
}: {
  under: number;
  onTarget: number;
  over: number;
  tolerancePct: number;
}) {
  const total = under + onTarget + over;
  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-lg shadow p-4"
      title={`Listings priced relative to calculated price (±${tolerancePct.toFixed(0)}% tolerance)`}
    >
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        Pricing health
      </div>
      <div className="mt-1 flex items-baseline gap-3 text-sm">
        <span
          className="font-bold text-amber-600 dark:text-amber-400 tabular-nums"
          title="Listed below calculated — room to raise"
        >
          ↓{under}
        </span>
        <span
          className="font-bold text-gray-700 dark:text-gray-300 tabular-nums"
          title={`Within ±${tolerancePct.toFixed(0)}% of calculated`}
        >
          ={onTarget}
        </span>
        <span
          className="font-bold text-red-600 dark:text-red-400 tabular-nums"
          title="Listed above calculated — may be sitting"
        >
          ↑{over}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
        of {total} priced
      </div>
    </div>
  );
}
