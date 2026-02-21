"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EcomProduct = {
  id: string;
  card_product_id: string;
  grading_service: string | null;
  grade: string | null;
  pricing_mode: "fixed" | "market";
  fixed_price_cents: number | null;
  market_multiplier: number | null;
  market_round_to: number | null;
  currency: string;
  status: string;
  quantity: number;
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

type CardInfo = {
  id: string;
  name: string;
  image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  set_name: string;
  brand_name: string;
};

type CollectionCost = {
  product_id: string;
  grading_service: string | null;
  grade: string | null;
  purchase_price_cents: number | null;
  purchase_price_currency: string | null;
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

function resolveListingPrice(
  listing: EcomProduct,
  marketValue: number | null,
  cost: number | null,
  displayRate: number = 1
): { price: number | null; displayCents: number | null } {
  if (listing.pricing_mode === "fixed") {
    // fixed_price_cents is in USD — convert to display for showing
    const price = listing.fixed_price_cents;
    const displayCents = price != null ? Math.round(price * displayRate) : null;
    return { price, displayCents };
  }
  const base = Math.max(marketValue ?? 0, cost ?? 0);
  if (base === 0) return { price: null, displayCents: null };
  const multiplier = listing.market_multiplier ?? 1;
  const roundTo = listing.market_round_to ?? 100;
  // Round up in display currency
  const rawDisplayCents = base * multiplier * displayRate;
  const displayCents = Math.ceil(rawDisplayCents / roundTo) * roundTo;
  // Convert back to USD for profit calculations
  const price = Math.round(displayCents / displayRate);
  return { price, displayCents };
}

// ---------------------------------------------------------------------------
// Store Page — shows ecom.products (active listings)
// ---------------------------------------------------------------------------

export default function StorePage() {
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

  const [listings, setListings] = useState<EcomProduct[]>([]);
  const [cardMap, setCardMap] = useState<Record<string, CardInfo>>({});
  const [marketMap, setMarketMap] = useState<Record<string, MarketData>>({});
  const [costMap, setCostMap] = useState<Record<string, { cents: number | null; currency: string }>>({});
  const [loading, setLoading] = useState(true);

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    // Fetch ecom listings for this account
    const { data: ecomData } = await supabase
      .schema("ecom")
      .from("products")
      .select("*")
      .eq("account_id", activeAccountId);

    const ecomList = (ecomData ?? []) as EcomProduct[];
    setListings(ecomList);

    if (ecomList.length === 0) {
      setCardMap({});
      setMarketMap({});
      setCostMap({});
      setLoading(false);
      return;
    }

    const productIds = [...new Set(ecomList.map((l) => l.card_product_id))];

    // Fetch card info, market data, and collection costs in parallel
    const [cardsRes, marketRes, collRes] = await Promise.all([
      supabase
        .schema("cards")
        .from("products_with_details")
        .select("id, name, image_url, card_number, rarity, set_name, brand_name")
        .in("id", productIds),
      supabase
        .schema("cards")
        .from("market_data")
        .select("*")
        .in("product_id", productIds),
      supabase
        .schema("cards")
        .from("user_collection_summary")
        .select("product_id, grading_service, grade, purchase_price_cents, purchase_price_currency")
        .eq("account_id", activeAccountId)
        .in("product_id", productIds),
    ]);

    const cMap: Record<string, CardInfo> = {};
    for (const c of (cardsRes.data ?? []) as CardInfo[]) {
      cMap[c.id] = c;
    }
    setCardMap(cMap);

    const mMap: Record<string, MarketData> = {};
    for (const m of (marketRes.data ?? []) as MarketData[]) {
      mMap[m.product_id] = m;
    }
    setMarketMap(mMap);

    // Build cost map keyed by product_id|grading_service|grade
    const costs: Record<string, { cents: number | null; currency: string }> = {};
    for (const c of (collRes.data ?? []) as CollectionCost[]) {
      const key = `${c.product_id}|${c.grading_service ?? ""}|${c.grade ?? ""}`;
      costs[key] = { cents: c.purchase_price_cents, currency: (c.purchase_price_currency ?? "USD").toUpperCase() };
    }
    setCostMap(costs);

    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

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

  // Build rows
  const rows = useMemo(() => {
    return listings.map((listing) => {
      const card = cardMap[listing.card_product_id];
      const market = marketMap[listing.card_product_id];
      const marketValue = resolveMarketPrice(
        market,
        listing.grading_service,
        listing.grade
      );
      const costKey = `${listing.card_product_id}|${listing.grading_service ?? ""}|${listing.grade ?? ""}`;
      const costEntry = costMap[costKey];
      const costCents = costEntry?.cents ?? null;
      const costCurrency = costEntry?.currency ?? "USD";
      // Normalize cost to USD for profit calc
      const costUsd = costCents != null ? toUsdCents(costCents, costCurrency) : null;
      const displayRate = rates[currency.toLowerCase()] ?? 1;
      const { price, displayCents } = resolveListingPrice(listing, marketValue, costUsd, displayRate);
      const profit = price != null && costUsd != null ? price - costUsd : null;
      const displayProfit = displayCents != null && costUsd != null
        ? displayCents - Math.round(costUsd * displayRate)
        : null;

      return { listing, card, marketValue, price, displayCents, costUsd, costCurrency, costCents, profit, displayProfit };
    });
  }, [listings, cardMap, marketMap, costMap, toUsdCents]);

  // Summary totals
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalDisplayValue = 0;
    let totalDisplayProfit = 0;

    for (const r of rows) {
      const qty = r.listing.quantity;
      totalItems += qty;
      if (r.costUsd != null) totalCost += r.costUsd * qty;
      if (r.displayCents != null) totalDisplayValue += r.displayCents * qty;
      if (r.displayProfit != null) totalDisplayProfit += r.displayProfit * qty;
    }

    return { totalItems, totalCost, totalDisplayValue, totalDisplayProfit };
  }, [rows]);

  // Inline price edit handlers
  const startEditing = (listing: EcomProduct) => {
    setEditingId(listing.id);
    setEditPrice(
      listing.fixed_price_cents != null
        ? (listing.fixed_price_cents / 100).toFixed(2)
        : ""
    );
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
      .from("products")
      .update({
        pricing_mode: "fixed",
        fixed_price_cents: cents,
        market_multiplier: null,
        market_round_to: null,
      })
      .eq("id", listingId);

    setEditingId(null);
    setSaving(false);
    await loadData();
  };

  const cancelEditing = () => {
    setEditingId(null);
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
      {/* Header with link to unlisted */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <Link
          href={`/${slug}/unlisted`}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
        >
          Add Listings
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Listings" value={String(totals.totalItems)} />
        <SummaryCard label="Total Cost" value={fmt(totals.totalCost)} />
        <SummaryCard label="Listing Value" value={fmtDisplay(totals.totalDisplayValue)} />
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

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No listings yet.{" "}
          <Link
            href={`/${slug}/unlisted`}
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
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Cost</th>
                <th className="px-4 py-3 text-right">Market</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 text-right">Profit</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((r) => {
                const isEditing = editingId === r.listing.id;

                return (
                  <tr
                    key={r.listing.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {/* Image */}
                    <td className="px-4 py-3">
                      {r.card?.image_url ? (
                        <img
                          src={r.card.image_url}
                          alt={r.card?.name ?? ""}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
                          {"\u2014"}
                        </div>
                      )}
                    </td>
                    {/* Card */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {r.card?.name ?? "\u2014"}
                    </td>
                    {/* Set */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.card?.set_name ?? "\u2014"}
                    </td>
                    {/* Grade */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(r.listing.grading_service, r.listing.grade)}
                    </td>
                    {/* Qty */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.listing.quantity}
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {formatPrice(r.costCents, currency, rates, r.costCurrency)}
                    </td>
                    {/* Market */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.marketValue)}
                    </td>
                    {/* Price — editable */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">$</span>
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
                          {fmtDisplay(r.displayCents)}
                        </button>
                      )}
                    </td>
                    {/* Profit */}
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        r.displayProfit != null && r.displayProfit > 0
                          ? "text-green-600 dark:text-green-400"
                          : r.displayProfit != null && r.displayProfit < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {fmtDisplay(r.displayProfit)}
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
