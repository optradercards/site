"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "prices" | "history" | "purchases";

interface Stats {
  pricedProducts: number;
  priceHistoryRows: number;
  recentPurchases24h: number;
  recentPurchasesTotal: number;
}

interface MarketPrice {
  product_id: string;
  card_name?: string;
  price_ungraded: number | null;
  price_psa_9: number | null;
  price_psa_9_5: number | null;
  price_psa_10: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
  updated_at: string | null;
}

interface PriceHistory {
  id: string;
  product_id: string;
  source_provider: string | null;
  recorded_date: string;
  condition: string | null;
  price_cents: number | null;
  created_at: string;
  card_name?: string | null;
}

interface RecentPurchase {
  id: string;
  product_id: string;
  source_provider: string | null;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  activity_timestamp: number | string | null; // bigint comes back as string from postgrest
  created_at: string;
  card_name?: string | null;
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

// activity_timestamp is Unix seconds (matches CardDetailPage formatTimestamp).
function formatActivityTimestamp(ts: number | string | null): string {
  if (ts == null) return "—";
  const seconds = typeof ts === "string" ? Number(ts) : ts;
  if (!Number.isFinite(seconds)) return "—";
  return new Date(seconds * 1000).toLocaleString();
}

const PAGE_SIZE = 50;

export default function MarketPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("prices");
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const cards = supabase.schema("cards");
      const head = { count: "exact" as const, head: true };
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [priced, history, recent24h, recentTotal] = await Promise.all([
        cards.from("market_data").select("*", head),
        cards.from("price_history").select("*", head),
        cards
          .from("recent_purchases")
          .select("*", head)
          .gte("created_at", since24h),
        cards.from("recent_purchases").select("*", head),
      ]);
      setStats({
        pricedProducts: priced.count ?? 0,
        priceHistoryRows: history.count ?? 0,
        recentPurchases24h: recent24h.count ?? 0,
        recentPurchasesTotal: recentTotal.count ?? 0,
      });
    })();
  }, [supabase]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = (page + 1) * PAGE_SIZE - 1;

    if (tab === "prices") {
      const { data } = await supabase
        .schema("cards")
        .from("market_data")
        .select("*, products!inner(name)")
        .order("updated_at", { ascending: false })
        .range(from, to);
      const rows = (data ?? []).map((d: Record<string, unknown>) => ({
        ...d,
        card_name: (d.products as { name: string } | null)?.name ?? "—",
      })) as MarketPrice[];
      setMarketPrices(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } else if (tab === "history") {
      const { data } = await supabase
        .schema("cards")
        .from("price_history")
        .select("*, product:products(name)")
        .order("recorded_date", { ascending: false })
        .range(from, to);
      const rows = (data ?? []).map((r: unknown) => {
        const row = r as PriceHistory & { product?: { name?: string } | null };
        return {
          ...row,
          card_name: row.product?.name ?? null,
        } as PriceHistory;
      });
      setPriceHistory(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } else {
      const { data } = await supabase
        .schema("cards")
        .from("recent_purchases")
        .select("*, product:products(name)")
        .order("activity_timestamp", { ascending: false })
        .range(from, to);
      const rows = (data ?? []).map((r: unknown) => {
        const row = r as RecentPurchase & {
          product?: { name?: string } | null;
        };
        return {
          ...row,
          card_name: row.product?.name ?? null,
        } as RecentPurchase;
      });
      setPurchases(rows);
      setHasMore(rows.length === PAGE_SIZE);
    }

    setLoading(false);
  }, [tab, page, supabase]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "prices", label: "Market Prices" },
    { key: "history", label: "Price History" },
    { key: "purchases", label: "Recent Purchases" },
  ];

  const currentRowCount =
    tab === "prices"
      ? marketPrices.length
      : tab === "history"
        ? priceHistory.length
        : purchases.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Market
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Market data, price history, and recent purchases
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Priced Products", value: stats?.pricedProducts },
          { label: "Price History Rows", value: stats?.priceHistoryRows },
          { label: "Purchases (24h)", value: stats?.recentPurchases24h },
          { label: "Purchases (total)", value: stats?.recentPurchasesTotal },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stat.value == null ? "…" : stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : tab === "prices" ? (
          marketPrices.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
              No market data found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3">Card Name</th>
                    <th className="px-4 py-3">Ungraded</th>
                    <th className="px-4 py-3">PSA 9</th>
                    <th className="px-4 py-3">PSA 9.5</th>
                    <th className="px-4 py-3">PSA 10</th>
                    <th className="px-4 py-3">BGS</th>
                    <th className="px-4 py-3">CGC</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {marketPrices.map((row) => (
                    <tr
                      key={row.product_id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-4 py-2 font-medium">
                        {row.card_name}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.price_ungraded)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.price_psa_9)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.price_psa_9_5)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.price_psa_10)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.price_bgs)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.price_cgc)}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {row.updated_at
                          ? new Date(row.updated_at).toLocaleDateString()
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "history" ? (
          priceHistory.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
              No price history found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3">Card</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Condition</th>
                    <th className="px-4 py-3">Price</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {priceHistory.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-4 py-2 max-w-[240px] truncate">
                        {row.card_name ?? (
                          <span className="font-mono text-xs text-gray-400">
                            {row.product_id}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs">
                        {row.source_provider ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(row.recorded_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">{row.condition ?? "—"}</td>
                      <td className="px-4 py-2">{formatPrice(row.price_cents)}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : purchases.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No recent purchases found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3">Card</th>
                  <th className="px-4 py-3">Handle</th>
                  <th className="px-4 py-3">Display Name</th>
                  <th className="px-4 py-3">Avatar</th>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {purchases.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="px-4 py-2 max-w-[240px] truncate">
                      {row.card_name ?? (
                        <span className="font-mono text-xs text-gray-400">
                          {row.product_id}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">{row.handle ?? "—"}</td>
                    <td className="px-4 py-2">{row.display_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      {row.avatar_url ? (
                        <img
                          src={row.avatar_url}
                          alt=""
                          className="w-6 h-6 rounded-full"
                        />
                      ) : (
                        <div className="w-6 h-6 bg-gray-100 dark:bg-gray-700 rounded-full" />
                      )}
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                      {formatActivityTimestamp(row.activity_timestamp)}
                    </td>
                    <td className="px-4 py-2">{row.source_provider ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && currentRowCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
