"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
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
import CardCell from "@/components/CardCell";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollectionItem = {
  // Renamed from instance_id (cards.user_collection_summary) to lot_id under
  // the redesigned inventory model. Kept the alias to minimize diff churn.
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
  consignor_asking_price_cents: number | null;
  consignor_acceptance:
    | "not_applicable"
    | "pending"
    | "accepted"
    | "disputed"
    | "rejected"
    | null;
};

type EcomListing = {
  id: string;
  card_product_id: string | null;
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
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  // Filters & sorting — initialized from query string; pushed back via the
  // effect below.
  const [filtersOpen, setFiltersOpen] = useState(
    () => searchParams.get("filters") === "1",
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
  const [ruleFilter, setRuleFilter] = useState<string>(
    () => searchParams.get("rule") ?? "any",
  );
  const [consignmentFilter, setConsignmentFilter] = useState<
    "all" | "owned" | "consigned"
  >(() => {
    const v = searchParams.get("consign");
    return v === "owned" || v === "consigned" ? v : "all";
  });

  // Push filter state into the URL on change. router.replace doesn't push a
  // history entry, so back button still goes to the previous page.
  useEffect(() => {
    const next = new URLSearchParams();
    if (filtersOpen) next.set("filters", "1");
    if (gradeFilter !== "all") next.set("grade", gradeFilter);
    if (costMin.trim()) next.set("cost_min", costMin.trim());
    if (costMax.trim()) next.set("cost_max", costMax.trim());
    if (marketMin.trim()) next.set("mkt_min", marketMin.trim());
    if (marketMax.trim()) next.set("mkt_max", marketMax.trim());
    if (hasCostFilter !== "any") next.set("has_cost", hasCostFilter);
    if (ruleFilter !== "any") next.set("rule", ruleFilter);
    if (consignmentFilter !== "all") next.set("consign", consignmentFilter);
    const qs = next.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (url !== `${pathname}${window.location.search}`) {
      router.replace(url, { scroll: false });
    }
  }, [
    filtersOpen,
    gradeFilter,
    costMin,
    costMax,
    marketMin,
    marketMax,
    hasCostFilter,
    ruleFilter,
    consignmentFilter,
    pathname,
    router,
  ]);
  type SortKey =
    | "name"
    | "grade"
    | "qty"
    | "cost"
    | "market"
    | "calculated"
    | "price"
    | "diff"
    | "profit";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
  });
  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "grade" ? "asc" : "desc" },
    );
  };

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

    const { data: invData } = await supabase
      .schema("ecom")
      .from("vendor_inventory_summary")
      .select(
        "lot_id, card_product_id, quantity_remaining, product_name, image_url, card_number, rarity, set_name, brand_name, grading_service, grade, acquisition_cost_cents, acquisition_currency, consignor_acceptance, consignor_asking_price_cents"
      )
      .eq("account_id", activeAccountId)
      .gt("quantity_remaining", 0)
      .not("card_product_id", "is", null)
      .order("product_name");

    const collection: CollectionItem[] = (invData ?? []).map((r: any) => ({
      instance_id: r.lot_id,
      product_id: r.card_product_id,
      quantity: r.quantity_remaining,
      product_name: r.product_name,
      image_url: r.image_url,
      card_number: r.card_number,
      rarity: r.rarity,
      set_name: r.set_name,
      brand_name: r.brand_name,
      grading_service: r.grading_service,
      grade: r.grade,
      purchase_price_cents: r.acquisition_cost_cents,
      purchase_price_currency: r.acquisition_currency,
      consignor_asking_price_cents: r.consignor_asking_price_cents ?? null,
      consignor_acceptance: r.consignor_acceptance ?? null,
    }));
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
        .from("listings")
        .select("id, card_product_id, grading_service, grade")
        .eq("account_id", activeAccountId)
        .neq("status", "archived"),
    ]);

    const mMap: Record<string, MarketData> = {};
    for (const m of (marketRes.data ?? []) as MarketData[]) {
      mMap[m.product_id] = m;
    }
    setMarketMap(mMap);

    const keys = new Set<string>();
    for (const l of (listingsRes.data ?? []) as EcomListing[]) {
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
    // Hide consigned lots until the consignor has explicitly accepted —
    // pending/disputed/rejected can't be sold yet, and surfacing them
    // here invites accidental listings against unconfirmed inventory.
    // Owned and not-applicable lots (purchases, quick adds) always show.
    const consignmentReady = (a: CollectionItem["consignor_acceptance"]) =>
      a == null || a === "not_applicable" || a === "accepted";
    return items.filter(
      (item) =>
        !listedKeys.has(listingKey(item)) && consignmentReady(item.consignor_acceptance),
    );
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
      const matchedRule = matched?.rule ?? null;

      // Calculated — pure rule output, independent of any user-edited override.
      // Mirrors listing_details.calculated_price_cents on the listed page.
      const calculatedPriceCents = matchedRule
        ? previewMarketPrice(
            costSeller,
            marketValueUsd,
            exchangeRate,
            matchedRule.multiplier,
            matchedRule.extraCents,
            matchedRule.roundTo,
          )
        : null;

      // Price — staged override if set, then the consignor's asking price
      // (agreed at intake), then the rule-calculated price as a last resort.
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
            staged.marketRoundTo ?? 100,
          );
        }
      } else if (item.consignor_asking_price_cents != null) {
        priceCents = item.consignor_asking_price_cents;
      } else {
        priceCents = calculatedPriceCents;
      }

      const profit =
        priceCents != null && costSeller != null
          ? priceCents - costSeller
          : null;

      // Diff — calculated − displayed price. Non-zero only when the user
      // has staged an override that differs from the rule's output. Mirrors
      // the "Diff" column on the listed page.
      const diff =
        calculatedPriceCents != null && priceCents != null
          ? calculatedPriceCents - priceCents
          : null;

      return {
        item,
        marketValueUsd,
        costSeller,
        staged,
        ruleIndex,
        matchedRule,
        calculatedPriceCents,
        priceCents,
        diff,
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

    // Cost range (inputs are dollar strings in sellerCurrency)
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
      result = result.filter(
        (r) => r.costSeller != null && r.costSeller >= costMinCents,
      );
    }
    if (costMaxCents != null) {
      result = result.filter(
        (r) => r.costSeller != null && r.costSeller <= costMaxCents,
      );
    }

    // Market value range — marketValueUsd is in USD, convert input to USD
    const dollarsToUsdCents = (s: string): number | null => {
      const cents = parseDollarsToCents(s);
      if (cents == null) return null;
      // input is in sellerCurrency cents; convert to USD cents
      return Math.round(cents / (exchangeRate || 1));
    };
    const marketMinUsdCents = dollarsToUsdCents(marketMin);
    const marketMaxUsdCents = dollarsToUsdCents(marketMax);
    if (marketMinUsdCents != null) {
      result = result.filter((r) => {
        if (r.marketValueUsd == null) return false;
        return Math.round(r.marketValueUsd * 100) >= marketMinUsdCents;
      });
    }
    if (marketMaxUsdCents != null) {
      result = result.filter((r) => {
        if (r.marketValueUsd == null) return false;
        return Math.round(r.marketValueUsd * 100) <= marketMaxUsdCents;
      });
    }

    // Has cost
    if (hasCostFilter === "with") {
      result = result.filter((r) => r.costSeller != null);
    } else if (hasCostFilter === "without") {
      result = result.filter((r) => r.costSeller == null);
    }

    // Pricing rule matched
    if (ruleFilter === "none") {
      result = result.filter((r) => r.ruleIndex == null);
    } else if (ruleFilter !== "any") {
      const idx = Number(ruleFilter);
      if (Number.isFinite(idx)) {
        result = result.filter((r) => r.ruleIndex === idx);
      }
    }

    // Consignment status
    if (consignmentFilter === "owned") {
      result = result.filter(
        (r) =>
          r.item.consignor_acceptance == null ||
          r.item.consignor_acceptance === "not_applicable",
      );
    } else if (consignmentFilter === "consigned") {
      result = result.filter(
        (r) =>
          r.item.consignor_acceptance != null &&
          r.item.consignor_acceptance !== "not_applicable",
      );
    }

    // Sort
    const dir = sort.dir === "asc" ? 1 : -1;
    const numKey = (
      r: (typeof result)[number],
    ): number => {
      switch (sort.key) {
        case "qty":
          return r.item.quantity;
        case "cost":
          return r.costSeller ?? 0;
        case "market":
          return r.marketValueUsd ?? 0;
        case "calculated":
          return r.calculatedPriceCents ?? 0;
        case "price":
          return r.priceCents ?? 0;
        case "diff":
          return r.diff ?? 0;
        case "profit":
          return r.profit ?? 0;
        default:
          return 0;
      }
    };
    result.sort((a, b) => {
      if (sort.key === "name") {
        return dir * a.item.product_name.localeCompare(b.item.product_name);
      }
      if (sort.key === "grade") {
        return (
          dir *
          gradeLabel(a.item.grading_service, a.item.grade).localeCompare(
            gradeLabel(b.item.grading_service, b.item.grade),
          )
        );
      }
      return dir * (numKey(a) - numKey(b));
    });

    return result;
  }, [
    unlistedItems,
    marketMap,
    stagedMap,
    gradeFilter,
    costMin,
    costMax,
    marketMin,
    marketMax,
    hasCostFilter,
    ruleFilter,
    consignmentFilter,
    sort,
    rules,
    sellerCurrency,
    rates,
    exchangeRate,
  ]);

  // -------------------------------------------------------------------------
  // Summary totals
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalValue = 0;
    let totalProfit = 0;
    let totalDiff = 0;

    for (const r of rows) {
      const qty = r.item.quantity;
      totalItems += qty;
      if (r.costSeller != null) totalCost += r.costSeller * qty;
      if (r.priceCents != null) totalValue += r.priceCents * qty;
      if (r.profit != null) totalProfit += r.profit * qty;
      if (r.diff != null) totalDiff += r.diff * qty;
    }

    return { totalItems, totalCost, totalValue, totalProfit, totalDiff };
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
    let duplicates = 0;

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
        price_cents: r.priceCents,
        currency: sellerCurrency,
        quantity: r.item.quantity,
        status: bulkStatus,
      };

      const { error } = await supabase
        .schema("ecom")
        .from("listings")
        .insert(row);

      if (error) {
        if (error.code === "23505") duplicates++;
        else errors++;
      } else {
        created++;
      }
    }

    if (errors > 0 || duplicates > 0) {
      const parts: string[] = [`Created ${created} listing(s)`];
      if (duplicates > 0)
        parts.push(
          `${duplicates} skipped (already listed at this grade)`
        );
      if (errors > 0) parts.push(`${errors} error(s)`);
      setSubmitError(parts.join(", ") + ".");
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

      {/* Filters */}
      {unlistedItems.length > 0 && (() => {
        const activeFilterCount =
          (gradeFilter !== "all" ? 1 : 0) +
          (costMin.trim() ? 1 : 0) +
          (costMax.trim() ? 1 : 0) +
          (marketMin.trim() ? 1 : 0) +
          (marketMax.trim() ? 1 : 0) +
          (hasCostFilter !== "any" ? 1 : 0) +
          (ruleFilter !== "any" ? 1 : 0) +
          (consignmentFilter !== "all" ? 1 : 0);
        const clearAll = () => {
          setGradeFilter("all");
          setCostMin("");
          setCostMax("");
          setMarketMin("");
          setMarketMax("");
          setHasCostFilter("any");
          setRuleFilter("any");
          setConsignmentFilter("all");
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
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  ({rows.length} of {unlistedItems.length} items)
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

                <label className="block">
                  <span className={labelCls}>Pricing rule</span>
                  <select
                    value={ruleFilter}
                    onChange={(e) => setRuleFilter(e.target.value)}
                    className={inputCls}
                  >
                    <option value="any">Any</option>
                    <option value="none">No match</option>
                    {rules.map((r, i) => (
                      <option key={i} value={String(i)}>
                        Rule {i + 1}
                        {r.maxCents == null
                          ? " (catch-all)"
                          : ` (≤ ${currencySymbol}${(r.maxCents / 100).toFixed(0)})`}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className={labelCls}>Consignment</span>
                  <select
                    value={consignmentFilter}
                    onChange={(e) =>
                      setConsignmentFilter(
                        e.target.value as "all" | "owned" | "consigned",
                      )
                    }
                    className={inputCls}
                  >
                    <option value="all">All</option>
                    <option value="owned">Owned only</option>
                    <option value="consigned">Consigned only</option>
                  </select>
                </label>
              </div>
            )}
          </div>
        );
      })()}

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
                <th className="px-4 py-3 w-14"></th>
                <SortTh
                  label="Card"
                  active={sort.key === "name"}
                  dir={sort.dir}
                  onClick={() => toggleSort("name")}
                />
                <SortTh
                  label="Grade"
                  active={sort.key === "grade"}
                  dir={sort.dir}
                  onClick={() => toggleSort("grade")}
                />
                <SortTh
                  label="Qty"
                  align="right"
                  active={sort.key === "qty"}
                  dir={sort.dir}
                  onClick={() => toggleSort("qty")}
                />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Pricing
                </th>
                <SortTh
                  label="Cost"
                  align="right"
                  active={sort.key === "cost"}
                  dir={sort.dir}
                  onClick={() => toggleSort("cost")}
                />
                <SortTh
                  label="Market"
                  align="right"
                  active={sort.key === "market"}
                  dir={sort.dir}
                  onClick={() => toggleSort("market")}
                />
                <SortTh
                  label="Calculated"
                  align="right"
                  active={sort.key === "calculated"}
                  dir={sort.dir}
                  onClick={() => toggleSort("calculated")}
                />
                <SortTh
                  label="Price"
                  align="right"
                  active={sort.key === "price"}
                  dir={sort.dir}
                  onClick={() => toggleSort("price")}
                />
                <SortTh
                  label="Diff"
                  align="right"
                  active={sort.key === "diff"}
                  dir={sort.dir}
                  onClick={() => toggleSort("diff")}
                />
                <SortTh
                  label="Profit"
                  align="right"
                  active={sort.key === "profit"}
                  dir={sort.dir}
                  onClick={() => toggleSort("profit")}
                />
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
                    <td className="px-4 py-3 w-14">
                      {r.item.image_url ? (
                        <ZoomableImage
                          src={r.item.image_url}
                          alt={r.item.product_name}
                          className="w-10 h-14 object-contain rounded max-w-none"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400 shrink-0">
                          {"\u2014"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CardCell
                        cardProductId={r.item.product_id}
                        name={r.item.product_name}
                        cardNumber={r.item.card_number}
                        setName={r.item.set_name}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(r.item.grading_service, r.item.grade)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.item.quantity}
                    </td>
                    {/* Pricing — Mkt badge + matched rule params */}
                    <td className="px-4 py-3">
                      {r.matchedRule ? (
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            title={`Rule ${(r.ruleIndex ?? 0) + 1}`}
                          >
                            Mkt
                          </span>
                          <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                            &times;{r.matchedRule.multiplier}
                            <span className="text-gray-400 dark:text-gray-500">
                              {" "}rd {fmt(r.matchedRule.roundTo)}
                            </span>
                            {r.matchedRule.extraCents ? (
                              <span className="text-gray-400 dark:text-gray-500">
                                {" "}+{fmt(r.matchedRule.extraCents)}
                              </span>
                            ) : null}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">{"—"}</span>
                      )}
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmtCost(r.item.purchase_price_cents, r.item.purchase_price_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.marketValueUsd != null ? Math.round(r.marketValueUsd * exchangeRate) : null)}
                    </td>
                    {/* Calculated \u2014 pure rule output, amber when staged price overrides */}
                    <td
                      className={`px-4 py-3 text-right ${
                        r.calculatedPriceCents != null &&
                        r.priceCents != null &&
                        r.calculatedPriceCents !== r.priceCents
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {fmt(r.calculatedPriceCents)}
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
                        <span className="text-gray-900 dark:text-gray-100">
                          {fmt(r.priceCents)}
                        </span>
                      )}
                    </td>
                    {/* Diff (calculated − price) */}
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        r.diff != null && r.diff > 0
                          ? "text-green-600 dark:text-green-400"
                          : r.diff != null && r.diff < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-400 dark:text-gray-500"
                      }`}
                      title="Calculated price − staged price"
                    >
                      {r.diff == null
                        ? "—"
                        : `${r.diff > 0 ? "+" : ""}${fmt(r.diff)}`}
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

function SortTh({
  label,
  align = "left",
  active,
  dir,
  onClick,
}: {
  label: string;
  align?: "left" | "right" | "center";
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  const alignCls =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  const flexJustify =
    align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start";
  return (
    <th className={`px-4 py-3 ${alignCls}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${flexJustify} uppercase text-xs font-medium tracking-wide ${
          active
            ? "text-gray-900 dark:text-gray-100"
            : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        }`}
      >
        <span>{label}</span>
        <span className="text-[10px] leading-none">
          {active ? (dir === "asc" ? "▲" : "▼") : "↕"}
        </span>
      </button>
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
