"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";
import {
  gradeLabel,
  resolveMarketValue,
  previewMarketPrice,
  type MarketData,
} from "@/lib/pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollectionItem = {
  instance_id: string;
  product_id: string;
  quantity: number;
  product_name: string;
  image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  set_name: string;
  brand_name: string;
  grading_service: string | null;
  grade: string | null;
  purchase_price_cents: number | null;
  purchase_price_currency: string | null;
  current_value_cents: number | null;
  is_wishlist: boolean;
  collection_name: string | null;
};

type EcomProduct = {
  id: string;
  card_product_id: string;
  grading_service: string | null;
  grade: string | null;
};

type StagedListing = {
  pricingMode: "fixed" | "market";
  fixedPriceCents: number | null;
  marketMultiplier: number | null;
  marketRoundTo: number | null;
  extraCents: number | null;
  quantity: number;
  status: "draft" | "active";
};

type PricingRule = {
  maxCents: number | null;
  multiplier: number;
  roundTo: number;
  extraCents: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>
): number {
  if (fromCurrency === toCurrency) return cents;
  const from = fromCurrency.toLowerCase();
  const to = toCurrency.toLowerCase();
  const fromRate = from === "usd" ? 1 : (rates[from] ?? 1);
  const toRate = to === "usd" ? 1 : (rates[to] ?? 1);
  return Math.round(cents * (toRate / fromRate));
}

function matchRule(
  rules: PricingRule[],
  base: number
): { rule: PricingRule; index: number } | null {
  if (rules.length === 0) return null;
  // Sort by threshold descending, catch-all last
  const sorted = rules
    .map((r, i) => ({ rule: r, index: i }))
    .sort((a, b) => {
      if (a.rule.maxCents == null) return 1;
      if (b.rule.maxCents == null) return -1;
      return b.rule.maxCents - a.rule.maxCents;
    });

  let matched = sorted.find((r) => r.rule.maxCents == null) ?? sorted[sorted.length - 1];
  for (const entry of sorted) {
    if (entry.rule.maxCents != null && base > entry.rule.maxCents) {
      matched = entry;
      break;
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// Unlisted Page — bulk staging for items not yet in ecom
// ---------------------------------------------------------------------------

export default function UnlistedPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const { data: profileData } = useProfile();
  const { data: exchangeRates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";
  const rates = exchangeRates ?? {};
  const exchangeRate = sellerCurrency.toLowerCase() === "usd" ? 1 : (rates[sellerCurrency.toLowerCase()] ?? 1);
  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === sellerCurrency)?.symbol ?? "$";
  const fmt = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, sellerCurrency, {}, sellerCurrency);
  const fmtCost = (cents: number | null | undefined, srcCurrency: string | null) =>
    formatPrice(cents ?? null, sellerCurrency, rates, (srcCurrency ?? "USD").toUpperCase());

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [marketMap, setMarketMap] = useState<Record<string, MarketData>>({});
  const [listedKeys, setListedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Pricing rules
  const [rules, setRules] = useState<PricingRule[]>([
    { maxCents: 20000, multiplier: 1.1, roundTo: 500, extraCents: 0 },
    { maxCents: 10000, multiplier: 1.15, roundTo: 500, extraCents: 0 },
    { maxCents: 5000, multiplier: 1.2, roundTo: 100, extraCents: 0 },
    { maxCents: 2500, multiplier: 1.3, roundTo: 100, extraCents: 0 },
    { maxCents: null, multiplier: 1.4, roundTo: 100, extraCents: 0 },
  ]);
  const [bulkStatus, setBulkStatus] = useState<"draft" | "active">("draft");

  // Filters & sorting
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name-asc");

  // Per-item staged overrides
  const [stagedMap, setStagedMap] = useState<Map<string, StagedListing>>(
    new Map()
  );

  // Inline edit
  const [editingId, setEditingId] = useState<string | null>(null);

  // Submitting
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data: collData } = await supabase
      .schema("cards")
      .from("user_collection_summary")
      .select("*")
      .eq("account_id", activeAccountId)
      .eq("is_wishlist", false)
      .order("product_name");

    const collection = (collData ?? []) as CollectionItem[];
    setItems(collection);

    if (collection.length === 0) {
      setMarketMap({});
      setListedKeys(new Set());
      setLoading(false);
      return;
    }

    const productIds = [...new Set(collection.map((c) => c.product_id))];

    const [marketRes, listingsRes] = await Promise.all([
      supabase
        .schema("cards")
        .from("market_data")
        .select("*")
        .in("product_id", productIds),
      supabase
        .schema("ecom")
        .from("products")
        .select("card_product_id, grading_service, grade")
        .eq("account_id", activeAccountId),
    ]);

    const mMap: Record<string, MarketData> = {};
    for (const m of (marketRes.data ?? []) as MarketData[]) {
      mMap[m.product_id] = m;
    }
    setMarketMap(mMap);

    const keys = new Set<string>();
    for (const l of (listingsRes.data ?? []) as EcomProduct[]) {
      keys.add(
        `${l.card_product_id}|${l.grading_service ?? ""}|${l.grade ?? ""}`
      );
    }
    setListedKeys(keys);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Filter to unlisted only
  // -------------------------------------------------------------------------

  const listingKey = (item: CollectionItem) =>
    `${item.product_id}|${item.grading_service ?? ""}|${item.grade ?? ""}`;

  const unlistedItems = useMemo(() => {
    return items.filter((item) => !listedKeys.has(listingKey(item)));
  }, [items, listedKeys]);

  const gradeOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const item of unlistedItems) {
      labels.add(gradeLabel(item.grading_service, item.grade));
    }
    return [...labels].sort();
  }, [unlistedItems]);

  const rows = useMemo(() => {
    let result = unlistedItems.map((item) => {
      const market = marketMap[item.product_id];
      const marketValueUsd = resolveMarketValue(
        market,
        item.grading_service,
        item.grade
      );
      // Convert cost to seller's currency
      const costSeller =
        item.purchase_price_cents != null
          ? convertCents(
              item.purchase_price_cents,
              (item.purchase_price_currency ?? "USD").toUpperCase(),
              sellerCurrency,
              rates
            )
          : null;

      const staged = stagedMap.get(item.instance_id);

      // Compute base for rule matching (in seller's currency)
      const marketConverted = Math.round((marketValueUsd ?? 0) * exchangeRate);
      const base = Math.max(costSeller ?? 0, marketConverted);

      // Match rule
      const matched = matchRule(rules, base);
      const ruleIndex = matched?.index ?? null;

      // Preview price
      let priceCents: number | null;
      if (staged) {
        if (staged.pricingMode === "fixed") {
          priceCents = staged.fixedPriceCents;
        } else {
          priceCents = previewMarketPrice(
            costSeller,
            marketValueUsd,
            exchangeRate,
            staged.marketMultiplier ?? 1,
            staged.extraCents ?? 0,
            staged.marketRoundTo ?? 100
          );
        }
      } else {
        priceCents = matched
          ? previewMarketPrice(
              costSeller,
              marketValueUsd,
              exchangeRate,
              matched.rule.multiplier,
              matched.rule.extraCents,
              matched.rule.roundTo
            )
          : null;
      }

      const profit =
        priceCents != null && costSeller != null
          ? priceCents - costSeller
          : null;

      return {
        item,
        marketValueUsd,
        costSeller,
        staged,
        ruleIndex,
        priceCents,
        profit,
      };
    });

    // Filter by grade
    if (gradeFilter !== "all") {
      result = result.filter(
        (r) =>
          gradeLabel(r.item.grading_service, r.item.grade) === gradeFilter
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "market-desc":
          return (b.marketValueUsd ?? 0) - (a.marketValueUsd ?? 0);
        case "market-asc":
          return (a.marketValueUsd ?? 0) - (b.marketValueUsd ?? 0);
        case "name-asc":
          return a.item.product_name.localeCompare(b.item.product_name);
        case "name-desc":
          return b.item.product_name.localeCompare(a.item.product_name);
        case "cost-desc": {
          const aCost = a.costSeller ?? 0;
          const bCost = b.costSeller ?? 0;
          return bCost - aCost;
        }
        case "cost-asc": {
          const aCost = a.costSeller ?? 0;
          const bCost = b.costSeller ?? 0;
          return aCost - bCost;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [unlistedItems, marketMap, stagedMap, gradeFilter, sortBy, rules, sellerCurrency, rates, exchangeRate]);

  // -------------------------------------------------------------------------
  // Summary totals
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalMarket = 0;
    let totalPrice = 0;
    let totalProfit = 0;

    for (const r of rows) {
      const qty = r.item.quantity;
      totalItems += qty;
      if (r.costSeller != null) totalCost += r.costSeller * qty;
      if (r.marketValueUsd != null) totalMarket += Math.round(r.marketValueUsd * exchangeRate) * qty;
      if (r.priceCents != null) totalPrice += r.priceCents * qty;
      if (r.profit != null) totalProfit += r.profit * qty;
    }

    return { totalItems, totalCost, totalMarket, totalPrice, totalProfit };
  }, [rows, exchangeRate]);

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  const toggleSelection = (instanceId: string) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(instanceId)) next.delete(instanceId);
      else next.add(instanceId);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedItems(new Set(rows.map((r) => r.item.instance_id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
  };

  const selectedCount = rows.filter((r) =>
    selectedItems.has(r.item.instance_id)
  ).length;

  // -------------------------------------------------------------------------
  // Per-item edit
  // -------------------------------------------------------------------------

  const updateStaged = (instanceId: string, patch: Partial<StagedListing>) => {
    setStagedMap((prev) => {
      const next = new Map(prev);
      const existing = next.get(instanceId);
      if (existing) {
        next.set(instanceId, { ...existing, ...patch });
      }
      return next;
    });
  };

  // -------------------------------------------------------------------------
  // Bulk submit — creates listings for selected items using rule prices
  // -------------------------------------------------------------------------

  const handleBulkSubmit = async () => {
    if (!activeAccountId || selectedCount === 0) return;
    setSubmitting(true);
    setSubmitError(null);

    let created = 0;
    let errors = 0;

    for (const r of rows) {
      if (!selectedItems.has(r.item.instance_id)) continue;

      // Use the matched rule's pricing config
      const matched = r.ruleIndex != null ? rules[r.ruleIndex] : null;

      const row = {
        account_id: activeAccountId,
        card_product_id: r.item.product_id,
        grading_service: r.item.grading_service ?? "ungraded",
        grade: r.item.grade,
        pricing_mode: "market" as const,
        fixed_price_cents: null,
        market_multiplier: matched?.multiplier ?? 1,
        market_round_to: matched?.roundTo ?? 100,
        market_extra_cents: matched?.extraCents ?? 0,
        cost_cents: r.costSeller,
        exchange_rate: exchangeRate,
        price_cents: r.priceCents,
        currency: sellerCurrency,
        quantity: r.item.quantity,
        status: bulkStatus,
      };

      const { error } = await supabase
        .schema("ecom")
        .from("products")
        .insert(row);

      if (error) errors++;
      else created++;
    }

    if (errors > 0) {
      setSubmitError(
        `Created ${created} listing(s) with ${errors} error(s).`
      );
    }

    setStagedMap(new Map());
    setSelectedItems(new Set());
    await loadData();
    setSubmitting(false);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <SummaryCard label="Items" value={String(totals.totalItems)} />
        <SummaryCard label="Total Cost" value={fmt(totals.totalCost)} />
        <SummaryCard label="Market Value" value={fmt(totals.totalMarket)} />
        <SummaryCard label="List Price" value={fmt(totals.totalPrice)} />
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
      </div>

      {/* Selection Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleBulkSubmit}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {submitting
              ? "Creating..."
              : `List ${selectedCount} Item${selectedCount === 1 ? "" : "s"}`}
          </button>
          <select
            value={bulkStatus}
            onChange={(e) =>
              setBulkStatus(e.target.value as "draft" | "active")
            }
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          >
            <option value="draft">Draft</option>
            <option value="active">Active</option>
          </select>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCount} of {rows.length} selected
          </div>
          <button
            onClick={clearSelection}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters & Sort */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Grade
            </span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="mt-1 block w-36 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="all">All Grades</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Sort By
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 block w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="name-asc">Name (A–Z)</option>
              <option value="name-desc">Name (Z–A)</option>
              <option value="market-desc">Market (High–Low)</option>
              <option value="market-asc">Market (Low–High)</option>
              <option value="cost-desc">Cost (High–Low)</option>
              <option value="cost-asc">Cost (Low–High)</option>
            </select>
          </label>
        </div>
      )}

      {/* Pricing Rules */}
      {rows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
          <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-3">
            Pricing Rules
          </div>
          <div className="space-y-2 mb-4">
            {rules.map((rule, i) => {
              const isLast = rule.maxCents == null;
              return (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-6 text-xs font-bold text-gray-400 dark:text-gray-500">
                    {i + 1}
                  </span>
                  {isLast ? (
                    <span className="w-36 text-sm text-gray-500 dark:text-gray-400">
                      Otherwise
                    </span>
                  ) : (
                    <div className="flex items-center gap-1 w-36">
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {">"}
                      </span>
                      <span className="text-sm text-gray-400">{currencySymbol}</span>
                      <input
                        type="number"
                        step="1"
                        min="1"
                        value={rule.maxCents! / 100}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          if (isNaN(val)) return;
                          setRules((prev) =>
                            prev.map((r, j) =>
                              j === i
                                ? { ...r, maxCents: Math.round(val * 100) }
                                : r
                            )
                          );
                        }}
                        className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      />
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-400">&times;</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={rule.multiplier}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) return;
                        setRules((prev) =>
                          prev.map((r, j) =>
                            j === i ? { ...r, multiplier: val } : r
                          )
                        );
                      }}
                      className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-400">+{currencySymbol}</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={rule.extraCents / 100}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (isNaN(val)) return;
                        setRules((prev) =>
                          prev.map((r, j) =>
                            j === i
                              ? { ...r, extraCents: Math.round(val * 100) }
                              : r
                          )
                        );
                      }}
                      className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-gray-400">round</span>
                    <select
                      value={rule.roundTo}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setRules((prev) =>
                          prev.map((r, j) =>
                            j === i ? { ...r, roundTo: val } : r
                          )
                        );
                      }}
                      className="w-20 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                    >
                      <option value="50">$0.50</option>
                      <option value="100">$1.00</option>
                      <option value="500">$5.00</option>
                    </select>
                  </div>
                  {!isLast && (
                    <button
                      onClick={() =>
                        setRules((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-sm"
                      title="Remove rule"
                    >
                      &times;
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <button
              onClick={() => {
                setRules((prev) => {
                  const catchAll = prev.find((r) => r.maxCents == null);
                  const thresholds = prev.filter((r) => r.maxCents != null);
                  const lowest = thresholds.reduce(
                    (min, r) => Math.min(min, r.maxCents!),
                    Infinity
                  );
                  const newThreshold = lowest === Infinity ? 5000 : Math.max(Math.round(lowest / 2), 100);
                  return [
                    ...thresholds,
                    { maxCents: newThreshold, multiplier: 1.2, roundTo: 100, extraCents: 0 },
                    ...(catchAll ? [catchAll] : []),
                  ];
                });
              }}
              className="text-sm font-medium text-red-500 hover:text-red-600"
            >
              + Add Rule
            </button>
          </div>
        </div>
      )}

      {/* Submit Error */}
      {submitError && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {submitError}
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          All collection items are already listed.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedCount === rows.length && rows.length > 0
                    }
                    onChange={() => {
                      if (selectedCount === rows.length) clearSelection();
                      else selectAll();
                    }}
                    className="rounded text-red-500 focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Market</th>
                <th className="px-4 py-3 text-center">Rule</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Profit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((r) => {
                const isSelected = selectedItems.has(r.item.instance_id);
                const staged = r.staged;
                const isEditing = editingId === r.item.instance_id;

                return (
                  <tr
                    key={r.item.instance_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(r.item.instance_id)}
                        className="rounded text-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {r.item.image_url ? (
                        <img
                          src={r.item.image_url}
                          alt={r.item.product_name}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
                          {"\u2014"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {r.item.product_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.item.set_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(r.item.grading_service, r.item.grade)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.item.quantity}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmtCost(r.item.purchase_price_cents, r.item.purchase_price_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.marketValueUsd != null ? Math.round(r.marketValueUsd * exchangeRate) : null)}
                    </td>
                    {/* Rule */}
                    <td className="px-4 py-3 text-center">
                      {r.ruleIndex != null ? (
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-xs font-bold text-gray-500 dark:text-gray-400">
                          {r.ruleIndex + 1}
                        </span>
                      ) : (
                        <span className="text-gray-400">{"\u2014"}</span>
                      )}
                    </td>
                    {/* Price — live from rules, editable if staged */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {isEditing && staged?.pricingMode === "fixed" ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={
                              staged.fixedPriceCents != null
                                ? (staged.fixedPriceCents / 100).toFixed(2)
                                : ""
                            }
                            onChange={(e) =>
                              updateStaged(r.item.instance_id, {
                                fixedPriceCents: Math.round(
                                  parseFloat(e.target.value) * 100
                                ),
                              })
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === "Escape")
                                setEditingId(null);
                            }}
                            autoFocus
                            className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                        </div>
                      ) : staged ? (
                        <button
                          onClick={() => setEditingId(r.item.instance_id)}
                          className="hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                          title="Click to edit price"
                        >
                          {fmt(r.priceCents)}
                        </button>
                      ) : (
                        <span className="text-gray-400">
                          {fmt(r.priceCents)}
                        </span>
                      )}
                    </td>
                    {/* Profit */}
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        (r.profit ?? 0) > 0
                          ? "text-green-600 dark:text-green-400"
                          : (r.profit ?? 0) < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {fmt(r.profit)}
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
// Summary Card
// ---------------------------------------------------------------------------

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
