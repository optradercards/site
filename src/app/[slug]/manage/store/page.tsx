"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";
import {
  gradeLabel,
  relativeMarketAge,
  resolveMarketValue,
  previewMarketPrice,
  type MarketData,
  type EcomListing,
} from "@/lib/pricing";
import CardCell from "@/components/CardCell";
import ZoomableImage from "@/components/ZoomableImage";
import { matchesQuery } from "@/lib/search";

// ---------------------------------------------------------------------------
// Store page — one combined table of every sellable variant. Unlisted
// inventory lots (not yet in ecom.listings) and existing listings live in
// the same grid, distinguished by a Status column. Bulk actions adapt to the
// selection: unlisted lots can be Listed; listings can be Updated, Activated,
// or Unlisted. This merges the former /manage/unlisted ("List Items") and
// /manage/listings pages.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CollectionItem = {
  // lot_id from ecom.vendor_inventory_summary (kept as instance_id to mirror
  // the prior unlisted page).
  instance_id: string;
  product_id: string;
  quantity: number;
  product_name: string;
  image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  set_name: string;
  language: string | null;
  brand_name: string;
  grading_service: string | null;
  grade: string | null;
  purchase_price_cents: number | null;
  purchase_price_currency: string | null;
  consignor_asking_price_cents: number | null;
  acquired_at: string | null;
  consignor_acceptance:
    | "not_applicable"
    | "pending"
    | "accepted"
    | "disputed"
    | "rejected"
    | null;
};

type PricingRule = {
  maxCents: number | null;
  multiplier: number;
  roundTo: number;
  extraCents: number;
};

type RowStatus = "unlisted" | "active" | "draft" | "sold";

// Normalized row shared by both kinds so the table renders uniformly.
type UnifiedRow = {
  kind: "lot" | "listing";
  selKey: string; // "lot:<id>" | "listing:<id>"
  // identity / display
  cardProductId: string | null;
  customProductId: string | null;
  name: string;
  cardNumber: string | null;
  setName: string;
  language: string | null;
  imageUrl: string | null;
  gradingService: string | null;
  grade: string | null;
  quantity: number;
  // pricing (seller currency)
  pricing:
    | { mode: "market" | "fixed"; multiplier: number | null; roundTo: number | null; extraCents: number | null }
    | null;
  costCents: number | null;
  marketCents: number | null;
  calculatedCents: number | null;
  priceCents: number | null;
  diff: number | null; // calculated − price
  profit: number | null; // price − cost
  calcProfit: number | null; // calculated − cost
  status: RowStatus;
  addedIso: string | null;
  groups: string[];
  marketUpdatedAt: string | null;
  isConsigned: boolean;
  // action payloads
  ruleIndex: number | null; // lots only
  listing?: EcomListing;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null): string {
  if (!iso) return "—";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "—";
  const diff = Math.max(0, Date.now() - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function convertCents(
  cents: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
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
  base: number,
): { rule: PricingRule; index: number } | null {
  if (rules.length === 0) return null;
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

const STATUS_RANK: Record<RowStatus, number> = {
  unlisted: 0,
  draft: 1,
  active: 2,
  sold: 3,
};

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function StorePage() {
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
  const exchangeRate =
    sellerCurrency.toLowerCase() === "usd" ? 1 : (rates[sellerCurrency.toLowerCase()] ?? 1);
  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === sellerCurrency)?.symbol ?? "$";
  const fmt = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, sellerCurrency, {}, sellerCurrency);

  // Data
  const [items, setItems] = useState<CollectionItem[]>([]); // unlisted lots
  const [listings, setListings] = useState<EcomListing[]>([]);
  const [marketMap, setMarketMap] = useState<Record<string, MarketData>>({});
  const [listedKeys, setListedKeys] = useState<Set<string>>(new Set());
  const [groupsByLot, setGroupsByLot] = useState<Map<string, string[]>>(new Map());
  const [groupsByListingKey, setGroupsByListingKey] = useState<Map<string, string[]>>(
    new Map(),
  );
  const [earliestAcquiredByListingKey, setEarliestAcquiredByListingKey] = useState<
    Map<string, string>
  >(new Map());
  const [loading, setLoading] = useState(true);

  // Selection (selKeys across both kinds)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Pricing rules (drive the calculated price for unlisted lots)
  const [rules, setRules] = useState<PricingRule[]>([
    { maxCents: 20000, multiplier: 1.1, roundTo: 500, extraCents: 0 },
    { maxCents: 10000, multiplier: 1.15, roundTo: 500, extraCents: 0 },
    { maxCents: 5000, multiplier: 1.2, roundTo: 100, extraCents: 0 },
    { maxCents: 2500, multiplier: 1.3, roundTo: 100, extraCents: 0 },
    { maxCents: null, multiplier: 1.4, roundTo: 100, extraCents: 0 },
  ]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"draft" | "active">("draft");

  // Filters — initialized from the query string, synced back below.
  const [filtersOpen, setFiltersOpen] = useState(
    () => searchParams.get("filters") === "1",
  );
  const [staleOnly, setStaleOnly] = useState(() => searchParams.get("stale") === "1");
  const [gradeFilter, setGradeFilter] = useState<string>(
    () => searchParams.get("grade") ?? "all",
  );
  const [costMin, setCostMin] = useState<string>(() => searchParams.get("cost_min") ?? "");
  const [costMax, setCostMax] = useState<string>(() => searchParams.get("cost_max") ?? "");
  const [marketMin, setMarketMin] = useState<string>(() => searchParams.get("mkt_min") ?? "");
  const [marketMax, setMarketMax] = useState<string>(() => searchParams.get("mkt_max") ?? "");
  const [hasCostFilter, setHasCostFilter] = useState<"any" | "with" | "without">(() => {
    const v = searchParams.get("has_cost");
    return v === "with" || v === "without" ? v : "any";
  });
  const [statusFilter, setStatusFilter] = useState<
    "all" | "unlisted" | "active" | "draft" | "sold"
  >(() => {
    const v = searchParams.get("status");
    return v === "unlisted" || v === "active" || v === "draft" || v === "sold" ? v : "all";
  });
  const [ruleFilter, setRuleFilter] = useState<string>(() => searchParams.get("rule") ?? "any");
  const [consignmentFilter, setConsignmentFilter] = useState<"all" | "owned" | "consigned">(
    () => {
      const v = searchParams.get("consign");
      return v === "owned" || v === "consigned" ? v : "all";
    },
  );
  const [nameFilter, setNameFilter] = useState<string>(() => searchParams.get("name") ?? "");
  const [numberFilter, setNumberFilter] = useState<string>(() => searchParams.get("num") ?? "");

  // Sorting
  type SortKey =
    | "card"
    | "grade"
    | "qty"
    | "cost"
    | "market"
    | "calculated"
    | "price"
    | "diff"
    | "profit"
    | "status"
    | "added";
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" } | null>(null);
  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev && prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "card" || key === "grade" || key === "status" ? "asc" : "desc" },
    );
  };

  // Inline price edit (listings only)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  // Action state
  const [submitting, setSubmitting] = useState(false); // bulk list
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkActivating, setBulkActivating] = useState(false);
  const [bulkUnlisting, setBulkUnlisting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // URL sync
  // -------------------------------------------------------------------------

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
    if (ruleFilter !== "any") next.set("rule", ruleFilter);
    if (consignmentFilter !== "all") next.set("consign", consignmentFilter);
    if (nameFilter.trim()) next.set("name", nameFilter.trim());
    if (numberFilter.trim()) next.set("num", numberFilter.trim());
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
    ruleFilter,
    consignmentFilter,
    nameFilter,
    numberFilter,
    pathname,
    router,
  ]);

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
        "lot_id, card_product_id, quantity_remaining, product_name, image_url, card_number, rarity, set_name, language, brand_name, grading_service, grade, acquisition_cost_cents, acquisition_currency, consignor_acceptance, consignor_asking_price_cents, acquired_at",
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
      language: r.language ?? null,
      brand_name: r.brand_name,
      grading_service: r.grading_service,
      grade: r.grade,
      purchase_price_cents: r.acquisition_cost_cents,
      purchase_price_currency: r.acquisition_currency,
      consignor_asking_price_cents: r.consignor_asking_price_cents ?? null,
      acquired_at: r.acquired_at ?? null,
      consignor_acceptance: r.consignor_acceptance ?? null,
    }));

    const productIds = [...new Set(collection.map((c) => c.product_id))];

    const [listingsRes, marketRes, lotsRes, groupsRes, linksRes] = await Promise.all([
      supabase
        .schema("ecom")
        .from("listing_details")
        .select("*")
        .eq("account_id", activeAccountId)
        .neq("status", "archived"),
      productIds.length
        ? supabase.schema("cards").from("market_data").select("*").in("product_id", productIds)
        : Promise.resolve({ data: [] as any[] }),
      supabase
        .schema("ecom")
        .from("inventory_lots")
        .select(
          "id, card_product_id, custom_product_id, grading_service, grade, acquired_at, quantity_remaining",
        )
        .eq("account_id", activeAccountId),
      supabase
        .schema("ecom")
        .from("inventory_groups")
        .select("id, name")
        .eq("account_id", activeAccountId),
      supabase.schema("ecom").from("inventory_group_items").select("group_id, lot_id"),
    ]);

    const listingRows = (listingsRes.data ?? []) as EcomListing[];
    setListings(listingRows);

    // Variant keys already listed — used to hide them from the unlisted set.
    const lKeys = new Set<string>();
    for (const l of listingRows) {
      lKeys.add(`${l.card_product_id}|${l.grading_service ?? ""}|${l.grade ?? ""}`);
    }
    setListedKeys(lKeys);

    // Market data
    const mMap: Record<string, MarketData> = {};
    for (const m of (marketRes.data ?? []) as unknown as (MarketData & {
      updated_at?: string | null;
    })[]) {
      mMap[m.product_id] = {
        ...m,
        market_updated_at: m.market_updated_at ?? m.updated_at ?? null,
      };
    }
    setMarketMap(mMap);

    // Group names
    const groupNameById = new Map<string, string>();
    for (const g of (groupsRes.data ?? []) as { id: string; name: string }[]) {
      groupNameById.set(g.id, g.name);
    }

    // lot_id → variant key (for listing-level group + earliest-acquired rollup)
    const keyByLotId = new Map<string, string>();
    const earliestByKey = new Map<string, string>();
    for (const lot of (lotsRes.data ?? []) as {
      id: string;
      card_product_id: string | null;
      custom_product_id: string | null;
      grading_service: string | null;
      grade: string | null;
      acquired_at: string | null;
      quantity_remaining: number;
    }[]) {
      const key = `${lot.card_product_id ?? ""}|${lot.custom_product_id ?? ""}|${lot.grading_service ?? ""}|${lot.grade ?? ""}`;
      keyByLotId.set(lot.id, key);
      if (lot.acquired_at && lot.quantity_remaining > 0) {
        const prev = earliestByKey.get(key);
        if (!prev || lot.acquired_at < prev) earliestByKey.set(key, lot.acquired_at);
      }
    }
    setEarliestAcquiredByListingKey(earliestByKey);

    // Groups by lot (for unlisted rows) and by variant key (for listings)
    const byLot = new Map<string, string[]>();
    const namesByKey = new Map<string, Set<string>>();
    for (const link of (linksRes.data ?? []) as { group_id: string; lot_id: string }[]) {
      const name = groupNameById.get(link.group_id);
      if (!name) continue;
      const lotList = byLot.get(link.lot_id) ?? [];
      lotList.push(name);
      byLot.set(link.lot_id, lotList);
      const key = keyByLotId.get(link.lot_id);
      if (key) {
        const set = namesByKey.get(key) ?? new Set<string>();
        set.add(name);
        namesByKey.set(key, set);
      }
    }
    setGroupsByLot(byLot);
    const byKey = new Map<string, string[]>();
    for (const [key, set] of namesByKey) byKey.set(key, Array.from(set).sort());
    setGroupsByListingKey(byKey);

    setItems(collection);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // -------------------------------------------------------------------------
  // Build unified rows
  // -------------------------------------------------------------------------

  const listingKey = (item: CollectionItem) =>
    `${item.product_id}|${item.grading_service ?? ""}|${item.grade ?? ""}`;

  // Unlisted lots: variant key not already listed, and consignment-ready.
  const lotRows = useMemo<UnifiedRow[]>(() => {
    const consignmentReady = (a: CollectionItem["consignor_acceptance"]) =>
      a == null || a === "not_applicable" || a === "accepted";
    return items
      .filter(
        (item) =>
          !listedKeys.has(listingKey(item)) && consignmentReady(item.consignor_acceptance),
      )
      .map((item) => {
        const market = marketMap[item.product_id];
        const marketValueUsd = resolveMarketValue(market, item.grading_service, item.grade);
        const costSeller =
          item.purchase_price_cents != null
            ? convertCents(
                item.purchase_price_cents,
                (item.purchase_price_currency ?? "USD").toUpperCase(),
                sellerCurrency,
                rates,
              )
            : null;
        const marketConverted =
          marketValueUsd != null ? Math.round(marketValueUsd * exchangeRate) : null;
        const base = Math.max(costSeller ?? 0, marketConverted ?? 0);
        const matched = matchRule(rules, base);
        const matchedRule = matched?.rule ?? null;
        const calculatedCents = matchedRule
          ? previewMarketPrice(
              costSeller,
              marketValueUsd,
              exchangeRate,
              matchedRule.multiplier,
              matchedRule.extraCents,
              matchedRule.roundTo,
            )
          : null;
        // Price: consignor's agreed asking price, else the rule-calculated price.
        const priceCents =
          item.consignor_asking_price_cents != null
            ? item.consignor_asking_price_cents
            : calculatedCents;
        const profit =
          priceCents != null && costSeller != null ? priceCents - costSeller : null;
        const calcProfit =
          calculatedCents != null && costSeller != null ? calculatedCents - costSeller : null;
        const diff =
          calculatedCents != null && priceCents != null ? calculatedCents - priceCents : null;

        return {
          kind: "lot" as const,
          selKey: `lot:${item.instance_id}`,
          cardProductId: item.product_id,
          customProductId: null,
          name: item.product_name,
          cardNumber: item.card_number,
          setName: item.set_name,
          language: item.language,
          imageUrl: item.image_url,
          gradingService: item.grading_service,
          grade: item.grade,
          quantity: item.quantity,
          pricing: matchedRule
            ? {
                mode: "market" as const,
                multiplier: matchedRule.multiplier,
                roundTo: matchedRule.roundTo,
                extraCents: matchedRule.extraCents,
              }
            : null,
          costCents: costSeller,
          marketCents: marketConverted,
          calculatedCents,
          priceCents,
          diff,
          profit,
          calcProfit,
          status: "unlisted" as const,
          addedIso: item.acquired_at,
          groups: groupsByLot.get(item.instance_id) ?? [],
          marketUpdatedAt: market?.market_updated_at ?? null,
          isConsigned:
            item.consignor_acceptance != null &&
            item.consignor_acceptance !== "not_applicable",
          ruleIndex: matched?.index ?? null,
        };
      });
  }, [items, listedKeys, marketMap, rules, sellerCurrency, rates, exchangeRate, groupsByLot]);

  const listingRows = useMemo<UnifiedRow[]>(() => {
    return listings.map((l) => {
      const profit =
        l.price_cents != null && l.cost_cents != null ? l.price_cents - l.cost_cents : null;
      const diff =
        l.calculated_price_cents != null && l.price_cents != null
          ? l.calculated_price_cents - l.price_cents
          : null;
      const calcProfit =
        l.calculated_price_cents != null && l.cost_cents != null
          ? l.calculated_price_cents - l.cost_cents
          : null;
      const key = `${l.card_product_id ?? ""}|${l.custom_product_id ?? ""}|${l.grading_service ?? ""}|${l.grade ?? ""}`;
      const status: RowStatus =
        l.status === "active" || l.status === "draft" || l.status === "sold"
          ? (l.status as RowStatus)
          : "active";
      return {
        kind: "listing" as const,
        selKey: `listing:${l.id}`,
        cardProductId: l.card_product_id,
        customProductId: l.custom_product_id,
        name: l.card_name,
        cardNumber: l.card_number,
        setName: l.set_name,
        language: l.language,
        imageUrl: l.image_url,
        gradingService: l.grading_service,
        grade: l.grade,
        quantity: l.quantity,
        pricing:
          l.pricing_mode === "fixed"
            ? { mode: "fixed", multiplier: null, roundTo: null, extraCents: null }
            : {
                mode: "market",
                multiplier: l.market_multiplier,
                roundTo: l.market_round_to,
                extraCents: l.market_extra_cents,
              },
        costCents: l.cost_cents,
        marketCents: l.market_price_cents,
        calculatedCents: l.calculated_price_cents,
        priceCents: l.price_cents,
        diff,
        profit,
        calcProfit,
        status,
        addedIso: earliestAcquiredByListingKey.get(key) ?? null,
        groups: groupsByListingKey.get(key) ?? [],
        marketUpdatedAt: null,
        isConsigned: !!l.has_consignment,
        ruleIndex: null,
        listing: l,
      };
    });
  }, [listings, earliestAcquiredByListingKey, groupsByListingKey]);

  const allRows = useMemo(() => [...lotRows, ...listingRows], [lotRows, listingRows]);

  const gradeOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const r of allRows) labels.add(gradeLabel(r.gradingService, r.grade));
    return [...labels].sort();
  }, [allRows]);

  const staleCount = useMemo(
    () =>
      allRows.filter(
        (r) => r.calculatedCents != null && r.priceCents != null && r.calculatedCents !== r.priceCents,
      ).length,
    [allRows],
  );

  // Filter + sort
  const rows = useMemo(() => {
    let result = allRows;

    if (staleOnly) {
      result = result.filter(
        (r) => r.calculatedCents != null && r.priceCents != null && r.calculatedCents !== r.priceCents,
      );
    }
    if (gradeFilter !== "all") {
      result = result.filter((r) => gradeLabel(r.gradingService, r.grade) === gradeFilter);
    }
    if (nameFilter.trim()) {
      result = result.filter((r) => matchesQuery(nameFilter, r.name));
    }
    if (numberFilter.trim()) {
      result = result.filter((r) => matchesQuery(numberFilter, r.cardNumber));
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
      result = result.filter((r) => r.costCents != null && r.costCents >= costMinCents);
    }
    if (costMaxCents != null) {
      result = result.filter((r) => r.costCents != null && r.costCents <= costMaxCents);
    }
    const marketMinCents = parseDollarsToCents(marketMin);
    const marketMaxCents = parseDollarsToCents(marketMax);
    if (marketMinCents != null) {
      result = result.filter((r) => r.marketCents != null && r.marketCents >= marketMinCents);
    }
    if (marketMaxCents != null) {
      result = result.filter((r) => r.marketCents != null && r.marketCents <= marketMaxCents);
    }
    if (hasCostFilter === "with") {
      result = result.filter((r) => r.costCents != null);
    } else if (hasCostFilter === "without") {
      result = result.filter((r) => r.costCents == null);
    }
    if (statusFilter !== "all") {
      result = result.filter((r) => r.status === statusFilter);
    }
    // Pricing-rule filter is an unlisted concept: narrows to lots only.
    if (ruleFilter === "none") {
      result = result.filter((r) => r.kind === "lot" && r.ruleIndex == null);
    } else if (ruleFilter !== "any") {
      const idx = Number(ruleFilter);
      if (Number.isFinite(idx)) {
        result = result.filter((r) => r.kind === "lot" && r.ruleIndex === idx);
      }
    }
    if (consignmentFilter === "owned") {
      result = result.filter((r) => !r.isConsigned);
    } else if (consignmentFilter === "consigned") {
      result = result.filter((r) => r.isConsigned);
    }

    if (!sort) return result;
    const dir = sort.dir === "asc" ? 1 : -1;
    const numKey = (r: UnifiedRow): number => {
      switch (sort.key) {
        case "qty":
          return r.quantity;
        case "cost":
          return r.costCents ?? -Infinity;
        case "market":
          return r.marketCents ?? -Infinity;
        case "calculated":
          return r.calculatedCents ?? -Infinity;
        case "price":
          return r.priceCents ?? -Infinity;
        case "diff":
          return r.diff ?? -Infinity;
        case "profit":
          return r.profit ?? -Infinity;
        case "status":
          return STATUS_RANK[r.status];
        case "added":
          return r.addedIso ? new Date(r.addedIso).getTime() : -Infinity;
        default:
          return 0;
      }
    };
    return [...result].sort((a, b) => {
      if (sort.key === "card") {
        return (
          dir *
          `${a.name.toLowerCase()}|${a.setName?.toLowerCase() ?? ""}`.localeCompare(
            `${b.name.toLowerCase()}|${b.setName?.toLowerCase() ?? ""}`,
          )
        );
      }
      if (sort.key === "grade") {
        return (
          dir *
          gradeLabel(a.gradingService, a.grade).localeCompare(
            gradeLabel(b.gradingService, b.grade),
          )
        );
      }
      return dir * (numKey(a) - numKey(b));
    });
  }, [
    allRows,
    staleOnly,
    gradeFilter,
    nameFilter,
    numberFilter,
    costMin,
    costMax,
    marketMin,
    marketMax,
    hasCostFilter,
    statusFilter,
    ruleFilter,
    consignmentFilter,
    sort,
  ]);

  // -------------------------------------------------------------------------
  // Summary totals + pricing health
  // -------------------------------------------------------------------------

  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalValue = 0;
    let totalProfit = 0;
    let totalDiff = 0;
    let unlistedCount = 0;
    let listedCount = 0;
    for (const r of rows) {
      const qty = r.quantity;
      totalItems += qty;
      if (r.kind === "lot") unlistedCount += qty;
      else listedCount += qty;
      if (r.costCents != null) totalCost += r.costCents * qty;
      if (r.priceCents != null) totalValue += r.priceCents * qty;
      if (r.profit != null) totalProfit += r.profit * qty;
      if (r.diff != null) totalDiff += r.diff * qty;
    }
    return { totalItems, totalCost, totalValue, totalProfit, totalDiff, unlistedCount, listedCount };
  }, [rows]);

  const PRICING_TOLERANCE = 0.05;
  const pricingHealth = useMemo(() => {
    let under = 0;
    let onTarget = 0;
    let over = 0;
    for (const r of rows) {
      const listed = r.priceCents;
      const calc = r.calculatedCents;
      if (listed == null || calc == null || listed === 0) continue;
      const ratio = (calc - listed) / listed;
      if (ratio > PRICING_TOLERANCE) under++;
      else if (ratio < -PRICING_TOLERANCE) over++;
      else onTarget++;
    }
    return { under, onTarget, over };
  }, [rows]);

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  const toggleSelection = (selKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(selKey)) next.delete(selKey);
      else next.add(selKey);
      return next;
    });
  };
  const clearSelection = () => setSelectedKeys(new Set());
  const allSelected = rows.length > 0 && rows.every((r) => selectedKeys.has(r.selKey));
  const selectAll = () => {
    if (allSelected) clearSelection();
    else setSelectedKeys(new Set(rows.map((r) => r.selKey)));
  };

  const selectedRows = useMemo(
    () => rows.filter((r) => selectedKeys.has(r.selKey)),
    [rows, selectedKeys],
  );
  const selectedLotRows = selectedRows.filter((r) => r.kind === "lot");
  const selectedListingRows = selectedRows.filter((r) => r.kind === "listing");
  const selectedDraftCount = selectedListingRows.filter((r) => r.status === "draft").length;

  // -------------------------------------------------------------------------
  // Actions — list unlisted lots
  // -------------------------------------------------------------------------

  const listSelectedLots = async () => {
    if (!activeAccountId || selectedLotRows.length === 0) return;
    setSubmitting(true);
    setActionError(null);
    setActionNotice(null);

    let created = 0;
    let errors = 0;
    let duplicates = 0;

    for (const r of selectedLotRows) {
      const matched = r.ruleIndex != null ? rules[r.ruleIndex] : null;
      const row = {
        account_id: activeAccountId,
        card_product_id: r.cardProductId,
        grading_service: r.gradingService ?? "ungraded",
        grade: r.grade,
        pricing_mode: "market" as const,
        fixed_price_cents: null,
        market_multiplier: matched?.multiplier ?? 1,
        market_round_to: matched?.roundTo ?? 100,
        market_extra_cents: matched?.extraCents ?? 0,
        cost_cents: r.costCents,
        price_cents: r.priceCents,
        currency: sellerCurrency,
        quantity: r.quantity,
        status: bulkStatus,
      };
      const { error } = await supabase.schema("ecom").from("listings").insert(row);
      if (error) {
        if (error.code === "23505") duplicates++;
        else errors++;
      } else {
        created++;
      }
    }

    const parts: string[] = [`Listed ${created} item${created === 1 ? "" : "s"}`];
    if (duplicates > 0) parts.push(`${duplicates} skipped (already listed at this grade)`);
    if (errors > 0) parts.push(`${errors} error(s)`);
    if (errors > 0 || duplicates > 0) setActionError(parts.join(", ") + ".");
    else setActionNotice(parts.join(", ") + ".");

    clearSelection();
    await loadData();
    setSubmitting(false);
  };

  // -------------------------------------------------------------------------
  // Actions — listings (update / activate / unlist)
  // -------------------------------------------------------------------------

  const updateSelectedListings = async () => {
    const targets = selectedListingRows
      .map((r) => r.listing!)
      .filter(
        (l) =>
          l.calculated_price_cents != null && l.calculated_price_cents !== l.price_cents,
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
      const patch: Record<string, number | null> = { price_cents: l.calculated_price_cents };
      if (l.pricing_mode === "fixed") patch.fixed_price_cents = l.calculated_price_cents;
      const { error } = await supabase.schema("ecom").from("listings").update(patch).eq("id", l.id);
      if (error) failed++;
      else ok++;
    }
    setBulkUpdating(false);
    setActionNotice(`Updated ${ok} listing${ok === 1 ? "" : "s"}` + (failed > 0 ? `; ${failed} failed.` : "."));
    clearSelection();
    await loadData();
  };

  const activateSelectedDrafts = async () => {
    const draftIds = selectedListingRows
      .filter((r) => r.status === "draft")
      .map((r) => r.listing!.id);
    if (draftIds.length === 0) {
      setActionNotice("No selected listings are drafts.");
      return;
    }
    setBulkActivating(true);
    setActionError(null);
    setActionNotice(null);
    const { error } = await supabase
      .schema("ecom")
      .from("listings")
      .update({ status: "active" })
      .in("id", draftIds);
    setBulkActivating(false);
    if (error) {
      setActionError(`Bulk activate failed: ${error.message}`);
      return;
    }
    setActionNotice(`Activated ${draftIds.length} draft${draftIds.length === 1 ? "" : "s"}.`);
    clearSelection();
    await loadData();
  };

  const unlistSelectedListings = async () => {
    const ids = selectedListingRows.map((r) => r.listing!.id);
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Unlist ${ids.length} listing${ids.length === 1 ? "" : "s"}? The lots return to your unlisted inventory; pricing config is kept.`,
      )
    ) {
      return;
    }
    setBulkUnlisting(true);
    setActionError(null);
    setActionNotice(null);
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
    setActionNotice(`Unlisted ${ids.length} listing${ids.length === 1 ? "" : "s"}.`);
    clearSelection();
    await loadData();
  };

  // -------------------------------------------------------------------------
  // Inline price edit (listings)
  // -------------------------------------------------------------------------

  const startEditing = (listing: EcomListing) => {
    setEditingId(listing.id);
    const price =
      listing.pricing_mode === "fixed" ? listing.fixed_price_cents : listing.price_cents;
    setEditPrice(price != null ? (price / 100).toFixed(2) : "");
  };
  const cancelEditing = () => setEditingId(null);
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

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading store...</div>
      </div>
    );
  }

  const activeFilterCount =
    (staleOnly ? 1 : 0) +
    (gradeFilter !== "all" ? 1 : 0) +
    (costMin.trim() ? 1 : 0) +
    (costMax.trim() ? 1 : 0) +
    (marketMin.trim() ? 1 : 0) +
    (marketMax.trim() ? 1 : 0) +
    (hasCostFilter !== "any" ? 1 : 0) +
    (statusFilter !== "all" ? 1 : 0) +
    (ruleFilter !== "any" ? 1 : 0) +
    (consignmentFilter !== "all" ? 1 : 0) +
    (nameFilter.trim() ? 1 : 0) +
    (numberFilter.trim() ? 1 : 0);
  const clearAllFilters = () => {
    setStaleOnly(false);
    setGradeFilter("all");
    setCostMin("");
    setCostMax("");
    setMarketMin("");
    setMarketMax("");
    setHasCostFilter("any");
    setStatusFilter("all");
    setRuleFilter("any");
    setConsignmentFilter("all");
    setNameFilter("");
    setNumberFilter("");
  };
  const inputCls =
    "mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500";
  const labelCls = "text-xs font-medium text-gray-500 dark:text-gray-400 uppercase";

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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
        <SummaryCard
          label="Items"
          value={String(totals.totalItems)}
          sub={`${totals.unlistedCount} unlisted · ${totals.listedCount} listed`}
        />
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

      {/* Selection Bar */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {selectedLotRows.length > 0 && (
            <>
              <button
                onClick={listSelectedLots}
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {submitting
                  ? "Listing…"
                  : `List ${selectedLotRows.length} item${selectedLotRows.length === 1 ? "" : "s"}`}
              </button>
              <select
                value={bulkStatus}
                onChange={(e) => setBulkStatus(e.target.value as "draft" | "active")}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </>
          )}
          {selectedListingRows.length > 0 && (
            <>
              <button
                onClick={updateSelectedListings}
                disabled={bulkUpdating}
                className="px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-100 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 rounded-lg disabled:opacity-50"
              >
                {bulkUpdating ? "Updating…" : `Update ${selectedListingRows.length}`}
              </button>
              {selectedDraftCount > 0 && (
                <button
                  onClick={activateSelectedDrafts}
                  disabled={bulkActivating}
                  className="px-4 py-2 text-sm font-medium text-green-800 dark:text-green-200 bg-green-100 hover:bg-green-200 dark:bg-green-900/30 dark:hover:bg-green-900/50 rounded-lg disabled:opacity-50"
                >
                  {bulkActivating
                    ? "Activating…"
                    : `Activate ${selectedDraftCount} draft${selectedDraftCount === 1 ? "" : "s"}`}
                </button>
              )}
              <button
                onClick={unlistSelectedListings}
                disabled={bulkUnlisting}
                className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-lg disabled:opacity-50"
              >
                {bulkUnlisting ? "Unlisting…" : `Unlist ${selectedListingRows.length}`}
              </button>
            </>
          )}
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedRows.length} of {rows.length} selected
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
      {allRows.length > 0 && (
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
                ({rows.length} of {allRows.length})
              </span>
            </span>
            {activeFilterCount > 0 && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  clearAllFilters();
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.stopPropagation();
                    clearAllFilters();
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
                <span className={labelCls}>Card name</span>
                <input
                  type="text"
                  value={nameFilter}
                  onChange={(e) => setNameFilter(e.target.value)}
                  placeholder="e.g. Charizard"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>Card number</span>
                <input
                  type="text"
                  value={numberFilter}
                  onChange={(e) => setNumberFilter(e.target.value)}
                  placeholder="e.g. 025 or SV-P"
                  className={inputCls}
                />
              </label>

              <label className="block">
                <span className={labelCls}>Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) =>
                    setStatusFilter(
                      e.target.value as "all" | "unlisted" | "active" | "draft" | "sold",
                    )
                  }
                  className={inputCls}
                >
                  <option value="all">All</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="active">Active</option>
                  <option value="draft">Draft</option>
                  <option value="sold">Sold</option>
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
                    setHasCostFilter(e.target.value as "any" | "with" | "without")
                  }
                  className={inputCls}
                >
                  <option value="any">Any</option>
                  <option value="with">With cost</option>
                  <option value="without">Without cost</option>
                </select>
              </label>

              <label className="block">
                <span className={labelCls}>Consignment</span>
                <select
                  value={consignmentFilter}
                  onChange={(e) =>
                    setConsignmentFilter(e.target.value as "all" | "owned" | "consigned")
                  }
                  className={inputCls}
                >
                  <option value="all">All</option>
                  <option value="owned">Owned only</option>
                  <option value="consigned">Consigned only</option>
                </select>
              </label>

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
                <span className={labelCls}>Pricing rule (unlisted)</span>
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
            </div>
          )}
        </div>
      )}

      {/* Pricing Rules — drive the calculated price for unlisted items */}
      {lotRows.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6">
          <button
            type="button"
            onClick={() => setRulesOpen((p) => !p)}
            className="w-full flex items-center gap-2 px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded-lg"
          >
            <span>{rulesOpen ? "▾" : "▸"}</span>
            <span>Pricing Rules</span>
            <span className="normal-case text-gray-400 dark:text-gray-500 font-normal">
              applied to unlisted items when you list them
            </span>
          </button>
          {rulesOpen && (
            <div className="px-4 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700">
              <div className="space-y-2 mb-4 mt-3">
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
                          <span className="text-sm text-gray-500 dark:text-gray-400">{">"}</span>
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
                                  j === i ? { ...r, maxCents: Math.round(val * 100) } : r,
                                ),
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
                              prev.map((r, j) => (j === i ? { ...r, multiplier: val } : r)),
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
                                j === i ? { ...r, extraCents: Math.round(val * 100) } : r,
                              ),
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
                              prev.map((r, j) => (j === i ? { ...r, roundTo: val } : r)),
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
                          onClick={() => setRules((prev) => prev.filter((_, j) => j !== i))}
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
              <button
                onClick={() => {
                  setRules((prev) => {
                    const catchAll = prev.find((r) => r.maxCents == null);
                    const thresholds = prev.filter((r) => r.maxCents != null);
                    const lowest = thresholds.reduce(
                      (min, r) => Math.min(min, r.maxCents!),
                      Infinity,
                    );
                    const newThreshold =
                      lowest === Infinity ? 5000 : Math.max(Math.round(lowest / 2), 100);
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
          )}
        </div>
      )}

      {/* Table */}
      {allRows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No inventory yet.{" "}
          <Link
            href={`/${slug}/manage/inventory/receive`}
            className="text-red-500 hover:text-red-600 font-medium"
          >
            Receive your first items
          </Link>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No items match your filters.
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
                    checked={allSelected}
                    onChange={selectAll}
                    className="rounded text-red-500 focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3 w-14"></th>
                <SortTh label="Card" active={sort?.key === "card"} dir={sort?.dir} onClick={() => toggleSort("card")} />
                <SortTh label="Grade" active={sort?.key === "grade"} dir={sort?.dir} onClick={() => toggleSort("grade")} />
                <SortTh label="Qty" align="right" active={sort?.key === "qty"} dir={sort?.dir} onClick={() => toggleSort("qty")} />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Pricing
                </th>
                <SortTh label="Cost" align="right" active={sort?.key === "cost"} dir={sort?.dir} onClick={() => toggleSort("cost")} />
                <SortTh label="Market" align="right" active={sort?.key === "market"} dir={sort?.dir} onClick={() => toggleSort("market")} />
                <SortTh label="Calculated" align="right" active={sort?.key === "calculated"} dir={sort?.dir} onClick={() => toggleSort("calculated")} />
                <SortTh label="Price" align="right" active={sort?.key === "price"} dir={sort?.dir} onClick={() => toggleSort("price")} />
                <SortTh label="Diff" align="right" active={sort?.key === "diff"} dir={sort?.dir} onClick={() => toggleSort("diff")} />
                <SortTh label="Profit" align="right" active={sort?.key === "profit"} dir={sort?.dir} onClick={() => toggleSort("profit")} />
                <SortTh label="Status" active={sort?.key === "status"} dir={sort?.dir} onClick={() => toggleSort("status")} />
                <SortTh label="Added" active={sort?.key === "added"} dir={sort?.dir} onClick={() => toggleSort("added")} />
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-gray-600 dark:text-gray-300">
                  Groups
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((r) => {
                const isSelected = selectedKeys.has(r.selKey);
                const priceStale =
                  r.calculatedCents != null && r.priceCents != null && r.calculatedCents !== r.priceCents;
                const isEditing = r.kind === "listing" && editingId === r.listing!.id;

                return (
                  <tr
                    key={r.selKey}
                    className={`align-top ${
                      priceStale
                        ? "bg-amber-50 hover:bg-amber-100 dark:bg-amber-900/10 dark:hover:bg-amber-900/20"
                        : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    }`}
                    title={
                      priceStale ? "Listed price differs from the current calculated price" : undefined
                    }
                  >
                    {/* Selection */}
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${r.name}`}
                        checked={isSelected}
                        onChange={() => toggleSelection(r.selKey)}
                        className="rounded text-red-500 focus:ring-red-500"
                      />
                    </td>
                    {/* Image */}
                    <td className="px-4 py-3 w-14">
                      {r.imageUrl ? (
                        <ZoomableImage
                          src={r.imageUrl}
                          alt={r.name}
                          className="w-10 h-14 object-contain rounded max-w-none"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400 shrink-0">
                          {"—"}
                        </div>
                      )}
                    </td>
                    {/* Card */}
                    <td className="px-4 py-3">
                      <CardCell
                        cardProductId={r.cardProductId}
                        name={r.name}
                        cardNumber={r.cardNumber}
                        setName={r.setName}
                        language={r.language}
                      />
                      {r.kind === "lot" && (
                        <Link
                          href={`/${slug}/manage/inventory/${r.selKey.slice(4)}`}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 inline-block text-[11px] font-medium text-gray-500 hover:text-red-600 dark:text-gray-400"
                          title="Open inventory lot"
                        >
                          Lot &rarr;
                        </Link>
                      )}
                    </td>
                    {/* Grade */}
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      {gradeLabel(r.gradingService, r.grade)}
                    </td>
                    {/* Qty */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.quantity}
                    </td>
                    {/* Pricing */}
                    <td className="px-4 py-3">
                      {r.pricing ? (
                        <div className="flex items-center gap-1.5 flex-wrap text-xs">
                          <span
                            className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                              r.pricing.mode === "fixed"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            }`}
                          >
                            {r.pricing.mode === "fixed" ? "Fixed" : "Mkt"}
                          </span>
                          {r.pricing.mode === "market" && (
                            <span className="text-gray-700 dark:text-gray-300 tabular-nums">
                              {r.pricing.multiplier != null && `×${r.pricing.multiplier}`}
                              {r.pricing.roundTo != null && (
                                <span className="text-gray-400 dark:text-gray-500">
                                  {" "}rd {fmt(r.pricing.roundTo)}
                                </span>
                              )}
                              {r.pricing.extraCents ? (
                                <span className="text-gray-400 dark:text-gray-500">
                                  {" "}+{fmt(r.pricing.extraCents)}
                                </span>
                              ) : null}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">{"—"}</span>
                      )}
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.costCents)}
                    </td>
                    {/* Market */}
                    <td
                      className="px-4 py-3 text-right text-gray-900 dark:text-gray-100"
                      title={
                        r.marketUpdatedAt
                          ? `Market updated ${relativeMarketAge(r.marketUpdatedAt)} (${new Date(r.marketUpdatedAt).toLocaleString()})`
                          : undefined
                      }
                    >
                      {fmt(r.marketCents)}
                      {r.marketUpdatedAt && (
                        <div className="text-[10px] text-gray-400 dark:text-gray-500 font-normal">
                          {relativeMarketAge(r.marketUpdatedAt)}
                        </div>
                      )}
                    </td>
                    {/* Calculated (+ projected profit) */}
                    <td
                      className={`px-4 py-3 text-right ${
                        priceStale
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      <div>{fmt(r.calculatedCents)}</div>
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
                    {/* Price — editable for listings, read-only for unlisted lots */}
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
                              if (e.key === "Enter") savePrice(r.listing!.id);
                              if (e.key === "Escape") cancelEditing();
                            }}
                            autoFocus
                            disabled={saving}
                            className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                          <button
                            onClick={() => savePrice(r.listing!.id)}
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
                      ) : r.kind === "listing" ? (
                        <button
                          onClick={() => startEditing(r.listing!)}
                          className="text-gray-900 dark:text-gray-100 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                          title="Click to edit price"
                        >
                          {fmt(r.priceCents)}
                        </button>
                      ) : (
                        <span className="text-gray-900 dark:text-gray-100">{fmt(r.priceCents)}</span>
                      )}
                    </td>
                    {/* Diff */}
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
                      {r.diff == null ? "—" : `${r.diff > 0 ? "+" : ""}${fmt(r.diff)}`}
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
                    {/* Status */}
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    {/* Added */}
                    <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {r.addedIso ? (
                        <span title={new Date(r.addedIso).toLocaleString()}>
                          {relativeTime(r.addedIso)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {/* Groups */}
                    <td className="px-4 py-3 text-xs">
                      {r.groups.length === 0 ? (
                        <span className="text-gray-400">{"—"}</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {r.groups.map((g) => (
                            <span
                              key={g}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            >
                              {g}
                            </span>
                          ))}
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
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: RowStatus }) {
  const cfg: Record<RowStatus, { label: string; cls: string }> = {
    unlisted: {
      label: "Unlisted",
      cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    },
    draft: {
      label: "Draft",
      cls: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    },
    active: {
      label: "Active",
      cls: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    },
    sold: {
      label: "Sold",
      cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    },
  };
  const { label, cls } = cfg[status];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

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
  dir?: "asc" | "desc";
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
  sub,
}: {
  label: string;
  value: string;
  color?: string;
  sub?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{sub}</div>}
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
      title={`Items priced relative to calculated price (±${tolerancePct.toFixed(0)}% tolerance)`}
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
      <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">of {total} priced</div>
    </div>
  );
}
