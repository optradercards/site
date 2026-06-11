"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";

type OverviewStats = {
  totalListings: number;
  activeListings: number;
  listedValueCents: number;
  sellerCurrency: string;
};

type HistoryRow = {
  snapshot_date: string;
  total_value_cents: number;
  ungraded_value_cents: number | null;
  graded_value_cents: number | null;
  total_cards: number | null;
};

export default function ManageOverviewPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();

  const { data: stats, isLoading } = useQuery<OverviewStats>({
    queryKey: ["manage-overview", activeAccountId],
    enabled: !!activeAccountId,
    queryFn: async () => {
      const { data, error } = await supabase
        .schema("ecom")
        .from("listing_details")
        .select("status, price_cents, quantity, currency")
        .eq("account_id", activeAccountId);

      if (error) throw error;
      const rows = data ?? [];

      const totalListings = rows.length;
      const activeListings = rows.filter((r) => r.status === "active").length;
      const listedValueCents = rows
        .filter((r) => r.status === "active" && r.price_cents != null)
        .reduce(
          (sum, r) => sum + (r.price_cents as number) * (r.quantity ?? 1),
          0
        );
      const sellerCurrency =
        (rows.find((r) => r.currency)?.currency as string) ?? "AUD";

      return { totalListings, activeListings, listedValueCents, sellerCurrency };
    },
  });

  const { data: history } = useQuery<HistoryRow[]>({
    queryKey: ["portfolio-history", activeAccountId],
    enabled: !!activeAccountId,
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      const { data, error } = await supabase
        .schema("cards")
        .from("collection_value_history")
        .select(
          "snapshot_date, total_value_cents, ungraded_value_cents, graded_value_cents, total_cards"
        )
        .eq("account_id", activeAccountId)
        .gte("snapshot_date", cutoff.toISOString().slice(0, 10))
        .order("snapshot_date", { ascending: true });

      if (error) throw error;
      return (data ?? []) as HistoryRow[];
    },
  });

  const displayCurrency = profileData?.profile?.default_currency ?? "AUD";
  const displaySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === displayCurrency)?.symbol ?? "$";

  // Snapshots are stored in USD cents (market_data is USD-based). Convert.
  const chartData = useMemo(() => {
    if (!history) return [];
    const toRate =
      displayCurrency.toLowerCase() === "usd"
        ? 1
        : rates?.[displayCurrency.toLowerCase()] ?? 1;
    return history.map((row) => ({
      date: row.snapshot_date,
      value: (row.total_value_cents * toRate) / 100,
    }));
  }, [history, rates, displayCurrency]);

  const portfolioDelta = useMemo(() => {
    if (!chartData.length) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    if (first === 0) return null;
    return { abs: last - first, pct: ((last - first) / first) * 100 };
  }, [chartData]);

  const formatStat = (n: number | undefined) =>
    isLoading || n === undefined ? "—" : n.toLocaleString();

  const formatValue = (cents: number | undefined, source: string | undefined) =>
    isLoading || cents === undefined
      ? "—"
      : formatPrice(cents, displayCurrency, rates ?? {}, source ?? "AUD");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Listings
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatStat(stats?.totalListings)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Active Listings
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatStat(stats?.activeListings)}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Listed Value
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            {formatValue(stats?.listedValueCents, stats?.sellerCurrency)}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Sum of active listings at asking price
          </p>
        </div>
      </div>

      {/* Portfolio value chart */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
              Portfolio Value
            </h3>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
              Last 90 days · snapshots taken daily
            </p>
          </div>
          {portfolioDelta && (
            <div className="text-right">
              <p
                className={`text-lg font-semibold ${
                  portfolioDelta.abs >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {portfolioDelta.abs >= 0 ? "+" : ""}
                {displaySymbol}
                {Math.abs(portfolioDelta.abs).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {portfolioDelta.abs >= 0 ? "+" : ""}
                {portfolioDelta.pct.toFixed(2)}%
              </p>
            </div>
          )}
        </div>

        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
            No portfolio history yet — snapshots run daily at 04:00 UTC.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="portfolioFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickFormatter={(d) =>
                  new Date(String(d)).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })
                }
              />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="#9ca3af"
                tickFormatter={(v: number) => `${displaySymbol}${v.toFixed(0)}`}
                width={60}
              />
              <Tooltip
                formatter={(value) => {
                  const n = typeof value === "number" ? value : Number(value);
                  return Number.isFinite(n)
                    ? `${displaySymbol}${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                    : "—";
                }}
                labelFormatter={(d) =>
                  new Date(String(d)).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })
                }
                contentStyle={{
                  backgroundColor: "rgba(17,24,39,0.95)",
                  border: "1px solid #374151",
                  borderRadius: 6,
                  color: "#f3f4f6",
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#ef4444"
                strokeWidth={2}
                fill="url(#portfolioFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href={`/${slug}/manage/store`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Add Listings
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            List items from your collection for sale
          </p>
        </Link>
        <Link
          href={`/${slug}`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            View Public Store
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            See what buyers see when they visit your store
          </p>
        </Link>
      </div>
    </div>
  );
}
