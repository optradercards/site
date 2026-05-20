"use client";

import { useState, useEffect, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";
import ProductBadges from "@/components/ProductBadges";
import type {
  CardWithDetails,
  PriceHistoryEntry,
} from "@/types/cardDetail";

const CHART_COLORS = [
  "#ef4444", // red
  "#3b82f6", // blue
  "#10b981", // green
  "#f59e0b", // amber
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#f97316", // orange
];

export default function CardDetailPage() {
  const params = useParams();
  const cardId = params?.id as string;
  const supabase = createClient();
  const { data: profileData } = useProfile();
  const { data: exchangeRates } = useExchangeRates();
  const currency = profileData?.profile?.default_currency ?? "USD";
  const rates = exchangeRates ?? {};

  const [card, setCard] = useState<CardWithDetails | null>(null);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cardId) return;

    async function fetchData() {
      setLoading(true);
      setError(null);

      const [cardResult, historyResult] = await Promise.all([
        supabase
          .schema("cards")
          .from("products_with_details")
          .select("*")
          .eq("id", cardId)
          .single(),
        supabase
          .schema("cards")
          .from("price_history")
          .select("*")
          .eq("product_id", cardId)
          .order("recorded_date", { ascending: false })
          .limit(50),
      ]);

      if (cardResult.error || !cardResult.data) {
        setError("Card not found");
        setLoading(false);
        return;
      }

      setCard(cardResult.data as CardWithDetails);
      setPriceHistory((historyResult.data ?? []) as PriceHistoryEntry[]);
      setLoading(false);
    }

    fetchData();
  }, [cardId, supabase]);

  // Build chart data: one row per date, one key per condition (converted)
  const { chartData, conditions } = useMemo(() => {
    if (priceHistory.length === 0) return { chartData: [], conditions: [] };

    const rateKey = currency.toLowerCase();
    const rate = rateKey === "usd" ? 1 : (rates[rateKey] ?? 1);

    const conditionSet = new Set<string>();
    const byDate = new Map<string, Record<string, number>>();

    // priceHistory is sorted desc — iterate in reverse for chronological order
    for (let i = priceHistory.length - 1; i >= 0; i--) {
      const entry = priceHistory[i];
      conditionSet.add(entry.condition);
      let row = byDate.get(entry.recorded_date);
      if (!row) {
        row = {};
        byDate.set(entry.recorded_date, row);
      }
      row[entry.condition] = (entry.price_cents / 100) * rate;
    }

    const conditions = Array.from(conditionSet);
    const chartData = Array.from(byDate.entries()).map(([date, values]) => ({
      date,
      ...values,
    }));

    return { chartData, conditions };
  }, [priceHistory, currency, rates]);

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="flex items-center justify-center py-20">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent" />
        </div>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <p className="text-red-600 dark:text-red-400">
            {error || "Card not found"}
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-red-500 hover:text-red-600 font-medium"
          >
            &larr; Back to Cards
          </Link>
        </div>
      </div>
    );
  }

  const unitChangeColor =
    card.unit_change_cents != null && card.unit_change_cents >= 0
      ? "text-green-600 dark:text-green-400"
      : "text-red-600 dark:text-red-400";

  const unitChangeSign =
    card.unit_change_cents != null && card.unit_change_cents >= 0 ? "+" : "";

  const ebaySoldUrl = (() => {
    const parts = [
      card.set_name,
      card.name,
      card.card_number ? `#${card.card_number}` : null,
    ].filter(Boolean);
    const query = encodeURIComponent(parts.join(" "));
    return `https://www.ebay.com/sch/i.html?_nkw=${query}&LH_Sold=1&LH_Complete=1`;
  })();

  const psaGrades: { label: string; value: number | null }[] = [
    { label: "PSA 10", value: card.price_psa_10 },
    { label: "PSA 9.5", value: card.price_psa_9_5 },
    { label: "PSA 9", value: card.price_psa_9 },
    { label: "PSA 8", value: card.price_psa_8 },
    { label: "PSA 7", value: card.price_psa_7 },
    { label: "PSA 6", value: card.price_psa_6 },
    { label: "PSA 5", value: card.price_psa_5 },
    { label: "PSA 4", value: card.price_psa_4 },
    { label: "PSA 3", value: card.price_psa_3 },
    { label: "PSA 2", value: card.price_psa_2 },
    { label: "PSA 1", value: card.price_psa_1 },
  ].filter((g) => g.value != null);

  const otherGrades: { label: string; value: number | null }[] = [
    { label: "BGS", value: card.price_bgs },
    { label: "CGC", value: card.price_cgc },
  ].filter((g) => g.value != null);

  const hasMarketPrices =
    card.price_ungraded != null || psaGrades.length > 0 || otherGrades.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      {/* Back link */}
      <Link
        href="/"
        className="inline-flex items-center text-red-500 hover:text-red-600 font-medium"
      >
        &larr; Back to Cards
      </Link>

      {/* Hero */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Images */}
          <div className="flex gap-4 items-start min-w-0">
            {card.image_url ? (
              <img
                src={card.image_url}
                alt={card.name}
                className="max-w-[50%] shrink rounded-lg object-contain"
              />
            ) : (
              <div className="max-w-[50%] shrink h-80 bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center text-gray-400 dark:text-gray-500 text-sm">
                No image
              </div>
            )}
            {card.back_image_url && (
              <img
                src={card.back_image_url}
                alt={`${card.name} (back)`}
                className="max-w-[50%] shrink rounded-lg object-contain"
              />
            )}
          </div>

          {/* Identity + Stats */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {card.name}
              </h1>
              <div className="flex flex-wrap items-center gap-2 mt-2 text-sm text-gray-600 dark:text-gray-400">
                {card.card_number && <span>#{card.card_number}</span>}
                {card.rarity && (
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    {card.rarity}
                  </span>
                )}
                {card.product_code && <span>{card.product_code}</span>}
              </div>
            </div>

            {/* Brand / Set / Group breadcrumb */}
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <div className="flex items-center gap-2">
                {card.brand_icon && (
                  <img
                    src={card.brand_icon}
                    alt=""
                    className="w-4 h-4 object-contain"
                  />
                )}
                <span className="font-medium text-gray-900 dark:text-white">
                  {card.brand_name}
                </span>
              </div>
              <div>
                {card.set_name}
                {card.group_name && (
                  <span className="text-gray-400 dark:text-gray-500">
                    {" "}
                    / {card.group_name}
                  </span>
                )}
              </div>
            </div>

            {/* Price */}
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Price
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {formatPrice(card.price_ungraded, currency, rates)}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Type
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                  {card.product_kind}
                </p>
                <ProductBadges
                  isFoil={card.is_foil}
                  isVariantEdition={card.is_variant_edition}
                  isCase={card.is_case}
                  className="mt-1"
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Purchases
                </p>
                <p className="text-lg font-semibold text-gray-900 dark:text-white">
                  {card.purchase_unit_count ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Unit Change
                </p>
                {card.unit_change_cents != null ? (
                  <p className={`text-lg font-semibold ${unitChangeColor}`}>
                    {unitChangeSign}
                    {formatPrice(card.unit_change_cents, currency, rates)}
                    {card.unit_change_percent != null && (
                      <span className="text-sm ml-1">
                        ({unitChangeSign}
                        {Number(card.unit_change_percent).toFixed(2)}%)
                      </span>
                    )}
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    —
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Market Prices */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Market Prices
          </h2>
        </div>
        {!hasMarketPrices ? (
          <p className="px-6 py-6 text-sm text-gray-500 dark:text-gray-400">
            No market prices available.
          </p>
        ) : (
          <div className="px-6 py-6 space-y-6">
            {/* Ungraded — featured */}
            {card.price_ungraded != null && (
              <div className="flex items-center justify-between rounded-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-700/50 dark:to-gray-800 border border-gray-200 dark:border-gray-700 px-5 py-4">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Raw
                  </p>
                  <p className="text-base font-semibold text-gray-900 dark:text-white mt-0.5">
                    Ungraded
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {formatPrice(card.price_ungraded, currency, rates)}
                </p>
              </div>
            )}

            {/* PSA grades */}
            {psaGrades.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                  PSA
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {psaGrades.map((g) => {
                    const isTop = g.label === "PSA 10";
                    return (
                      <div
                        key={g.label}
                        className={
                          isTop
                            ? "rounded-lg border border-amber-300 dark:border-amber-600/60 bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/10 px-4 py-3"
                            : "rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-3"
                        }
                      >
                        <p
                          className={
                            isTop
                              ? "text-xs font-semibold text-amber-700 dark:text-amber-400"
                              : "text-xs font-semibold text-gray-500 dark:text-gray-400"
                          }
                        >
                          {g.label}
                        </p>
                        <p
                          className={
                            isTop
                              ? "text-lg font-bold text-gray-900 dark:text-white mt-1"
                              : "text-lg font-semibold text-gray-900 dark:text-white mt-1"
                          }
                        >
                          {formatPrice(g.value, currency, rates)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Other graders */}
            {otherGrades.length > 0 && (
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                  Other Graders
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {otherGrades.map((g) => (
                    <div
                      key={g.label}
                      className="rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30 px-4 py-3"
                    >
                      <p className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                        {g.label}
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white mt-1">
                        {formatPrice(g.value, currency, rates)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* eBay Last Sold */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            eBay Last Sold
          </h2>
        </div>
        <div className="px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            See recently completed sales for this card on eBay.
          </p>
          <a
            href={ebaySoldUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
          >
            View Sold on eBay
            <svg
              className="ml-2 w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>
      </div>

      {/* Price History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">
            Price History
          </h2>
        </div>
        {priceHistory.length === 0 ? (
          <p className="px-6 py-6 text-sm text-gray-500 dark:text-gray-400">
            No price history recorded.
          </p>
        ) : (
          <>
            {/* Chart */}
            <div className="px-6 pt-4 pb-2">
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      tickFormatter={(d: string) =>
                        new Date(d).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      }
                      stroke="#9ca3af"
                    />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v: number) => {
                        const sym = SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$";
                        return `${sym}${v.toFixed(0)}`;
                      }}
                      stroke="#9ca3af"
                      width={60}
                    />
                    <Tooltip
                      formatter={(value) => {
                        const sym = SUPPORTED_CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$";
                        const n = typeof value === "number" ? value : Number(value);
                        return Number.isFinite(n) ? `${sym}${n.toFixed(2)}` : "\u2014";
                      }}
                      labelFormatter={(d) =>
                        new Date(String(d)).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      }
                      contentStyle={{
                        backgroundColor: "var(--color-gray-800, #1f2937)",
                        border: "1px solid var(--color-gray-700, #374151)",
                        borderRadius: "0.5rem",
                        color: "#f3f4f6",
                        fontSize: "0.875rem",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "0.75rem" }} />
                    {conditions.map((condition, i) => (
                      <Line
                        key={condition}
                        type="monotone"
                        dataKey={condition}
                        stroke={CHART_COLORS[i % CHART_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto border-t border-gray-200 dark:border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-6 py-3">Date</th>
                    <th className="px-6 py-3">Condition</th>
                    <th className="px-6 py-3">Price</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {priceHistory.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-6 py-2">
                        {new Date(entry.recorded_date).toLocaleDateString(
                          "en-US",
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                      </td>
                      <td className="px-6 py-2">{entry.condition}</td>
                      <td className="px-6 py-2">
                        {formatPrice(entry.price_cents, currency, rates)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
