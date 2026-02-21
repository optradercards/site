"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";

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

type MarketData = {
  product_id: string;
  price_ungraded: number | null;
  price_psa_1: number | null;
  price_psa_2: number | null;
  price_psa_3: number | null;
  price_psa_4: number | null;
  price_psa_5: number | null;
  price_psa_6: number | null;
  price_psa_7: number | null;
  price_psa_8: number | null;
  price_psa_9: number | null;
  price_psa_10: number | null;
  price_psa_9_5: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
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
  quantity: number;
  status: "draft" | "active";
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function gradeLabel(service: string | null, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return `${service.toUpperCase()} ${grade ?? ""}`.trim();
}

function resolveMarketPrice(
  market: MarketData | undefined,
  service: string | null,
  grade: string | null
): number | null {
  if (!market) return null;
  if (!service || service === "ungraded") return market.price_ungraded;
  if (service === "psa") {
    if (grade === "10") return market.price_psa_10;
    if (grade === "9.5") return market.price_psa_9_5;
    if (grade === "9") return market.price_psa_9;
    if (grade === "8") return market.price_psa_8;
    if (grade === "7") return market.price_psa_7;
    if (grade === "6") return market.price_psa_6;
    if (grade === "5") return market.price_psa_5;
    if (grade === "4") return market.price_psa_4;
    if (grade === "3") return market.price_psa_3;
    if (grade === "2") return market.price_psa_2;
    if (grade === "1") return market.price_psa_1;
    return market.price_ungraded;
  }
  if (service === "bgs") return market.price_bgs;
  if (service === "cgc") return market.price_cgc;
  if (service === "sgc") return market.price_ungraded;
  return market.price_ungraded;
}

function resolveStagedPrice(
  staged: StagedListing,
  marketValue: number | null,
  cost: number | null
): number | null {
  let price: number | null;
  if (staged.pricingMode === "fixed") {
    price = staged.fixedPriceCents;
  } else if (marketValue == null) {
    price = null;
  } else {
    const multiplier = staged.marketMultiplier ?? 1;
    const roundTo = staged.marketRoundTo ?? 100;
    price = Math.round((marketValue * multiplier) / roundTo) * roundTo;
  }
  if (price != null && cost != null && cost > price) return cost;
  return price;
}

type PricingRule = {
  maxCents: number | null;
  multiplier: number;
  roundTo: number;
};

function resolveRulePrice(
  rules: PricingRule[],
  marketValue: number | null,
  costUsd: number | null,
  displayRate: number
): { price: number | null; displayCents: number | null; ruleIndex: number | null } {
  const base = Math.max(marketValue ?? 0, costUsd ?? 0);
  if (base === 0) return { price: null, displayCents: null, ruleIndex: null };

  // Sort by threshold descending (highest first), catch-all last
  const sorted = [...rules].sort((a, b) => {
    if (a.maxCents == null) return 1;
    if (b.maxCents == null) return -1;
    return b.maxCents - a.maxCents;
  });

  // First rule where base > threshold wins; otherwise catch-all
  let matched = sorted.find((r) => r.maxCents == null) ?? sorted[sorted.length - 1];
  for (const rule of sorted) {
    if (rule.maxCents != null && base > rule.maxCents) {
      matched = rule;
      break;
    }
  }

  const multiplier = matched?.multiplier ?? 1;
  const roundTo = matched?.roundTo ?? 100;

  // Round in display currency, keep both for display and DB storage
  const rawDisplayCents = base * multiplier * displayRate;
  const roundedDisplay = Math.ceil(rawDisplayCents / roundTo) * roundTo;
  const price = Math.round(roundedDisplay / displayRate);

  // Find original index in the unsorted rules array
  const ruleIndex = matched ? rules.indexOf(matched) : null;

  return { price, displayCents: roundedDisplay, ruleIndex };
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
  const currency = profileData?.profile?.default_currency ?? "AUD";
  const rates = exchangeRates ?? {};
  const fmt = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, currency, rates);
  const fmtDisplay = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, currency, rates, currency);
  const fmtCost = (cents: number | null | undefined, srcCurrency: string | null) =>
    formatPrice(cents ?? null, currency, rates, (srcCurrency ?? "USD").toUpperCase());

  // Convert any-currency cents to USD cents for calculations
  const toUsdCents = useCallback(
    (cents: number, sourceCurrency: string): number => {
      const from = sourceCurrency.toLowerCase();
      if (from === "usd") return cents;
      const fromRate = rates[from] ?? 1;
      return Math.round(cents / fromRate);
    },
    [rates]
  );

  const [items, setItems] = useState<CollectionItem[]>([]);
  const [marketMap, setMarketMap] = useState<Record<string, MarketData>>({});
  const [listedKeys, setListedKeys] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Pricing rules
  const [rules, setRules] = useState<PricingRule[]>([
    { maxCents: 20000, multiplier: 1.1, roundTo: 500 },
    { maxCents: 10000, multiplier: 1.15, roundTo: 500 },
    { maxCents: 5000, multiplier: 1.2, roundTo: 100 },
    { maxCents: 2500, multiplier: 1.3, roundTo: 100 },
    { maxCents: null, multiplier: 1.4, roundTo: 100 },
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
      const marketValue = resolveMarketPrice(
        market,
        item.grading_service,
        item.grade
      );
      const costUsd =
        item.purchase_price_cents != null
          ? toUsdCents(
              item.purchase_price_cents,
              (item.purchase_price_currency ?? "USD").toUpperCase()
            )
          : null;
      const staged = stagedMap.get(item.instance_id);

      // Live rule price (always computed from current rules)
      const displayRate = rates[currency.toLowerCase()] ?? 1;
      const { price: rulePrice, displayCents: ruleDisplayCents, ruleIndex } = resolveRulePrice(rules, marketValue, costUsd, displayRate);

      // Display price: staged override uses fmt (USD→display), rule price uses pre-rounded display cents
      const price = staged ? resolveStagedPrice(staged, marketValue, costUsd) : rulePrice;
      // For display: use the pre-rounded display cents to avoid round-trip error
      const displayCents = staged ? null : ruleDisplayCents;

      const profit =
        price != null && costUsd != null ? price - costUsd : null;
      // Profit in display currency (avoid round-trip)
      const displayProfit =
        ruleDisplayCents != null && costUsd != null
          ? ruleDisplayCents - costUsd * displayRate
          : null;

      return { item, marketValue, costUsd, staged, rulePrice, ruleIndex, price, displayCents, displayProfit, profit };
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
          return (b.marketValue ?? 0) - (a.marketValue ?? 0);
        case "market-asc":
          return (a.marketValue ?? 0) - (b.marketValue ?? 0);
        case "name-asc":
          return a.item.product_name.localeCompare(b.item.product_name);
        case "name-desc":
          return b.item.product_name.localeCompare(a.item.product_name);
        case "cost-desc": {
          const aCost = a.item.purchase_price_cents ?? 0;
          const bCost = b.item.purchase_price_cents ?? 0;
          return bCost - aCost;
        }
        case "cost-asc": {
          const aCost = a.item.purchase_price_cents ?? 0;
          const bCost = b.item.purchase_price_cents ?? 0;
          return aCost - bCost;
        }
        default:
          return 0;
      }
    });

    return result;
  }, [unlistedItems, marketMap, stagedMap, gradeFilter, sortBy, rules, toUsdCents, currency, rates]);

  // -------------------------------------------------------------------------
  // Summary totals
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalMarket = 0;
    let totalDisplayPrice = 0;
    let totalDisplayProfit = 0;

    for (const r of rows) {
      const qty = r.item.quantity;
      totalItems += qty;
      if (r.costUsd != null) totalCost += r.costUsd * qty;
      if (r.marketValue != null) totalMarket += r.marketValue * qty;
      if (r.displayCents != null) totalDisplayPrice += r.displayCents * qty;
      if (r.displayProfit != null) totalDisplayProfit += Math.round(r.displayProfit) * qty;
    }

    return { totalItems, totalCost, totalMarket, totalDisplayPrice, totalDisplayProfit };
  }, [rows]);

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
  // Apply bulk pricing
  // -------------------------------------------------------------------------

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

      // Use the matched rule's multiplier & round-to for dynamic market pricing
      const matchedRule = r.ruleIndex != null ? rules[r.ruleIndex] : null;

      const row = {
        account_id: activeAccountId,
        card_product_id: r.item.product_id,
        grading_service: r.item.grading_service ?? "ungraded",
        grade: r.item.grade,
        pricing_mode: "market" as const,
        fixed_price_cents: null,
        market_multiplier: matchedRule?.multiplier ?? 1,
        market_round_to: matchedRule?.roundTo ?? 100,
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
        <SummaryCard label="List Price" value={fmtDisplay(totals.totalDisplayPrice)} />
        <SummaryCard
          label="Profit"
          value={fmtDisplay(totals.totalDisplayProfit)}
          color={
            totals.totalDisplayProfit > 0
              ? "text-green-600 dark:text-green-400"
              : totals.totalDisplayProfit < 0
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
                      <span className="text-sm text-gray-400">$</span>
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
                    { maxCents: newThreshold, multiplier: 1.2, roundTo: 100 },
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
                      {fmt(r.marketValue)}
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
                          <span className="text-gray-400 text-xs">$</span>
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
                          {fmt(r.price)}
                        </button>
                      ) : (
                        <span className="text-gray-400">
                          {fmtDisplay(r.displayCents)}
                        </span>
                      )}
                    </td>
                    {/* Profit */}
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        (r.displayProfit ?? r.profit ?? 0) > 0
                          ? "text-green-600 dark:text-green-400"
                          : (r.displayProfit ?? r.profit ?? 0) < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {r.staged ? fmt(r.profit) : fmtDisplay(r.displayProfit != null ? Math.round(r.displayProfit) : null)}
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
