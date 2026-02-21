"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "prices" | "history" | "purchases";

interface MarketPrice {
  id: string;
  product_id: string;
  card_name?: string;
  ungraded_price: number | null;
  psa_9_price: number | null;
  psa_10_price: number | null;
  bgs_price: number | null;
  cgc_price: number | null;
  updated_at: string | null;
}

interface PriceHistory {
  id: string;
  product_id: string;
  recorded_date: string;
  condition: string | null;
  price: number | null;
  created_at: string;
}

interface RecentPurchase {
  id: string;
  product_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  activity_timestamp: string | null;
  source: string | null;
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

export default function MarketPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("prices");
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [priceHistory, setPriceHistory] = useState<PriceHistory[]>([]);
  const [purchases, setPurchases] = useState<RecentPurchase[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTab = useCallback(async () => {
    setLoading(true);

    if (tab === "prices") {
      const { data } = await supabase
        .schema("cards")
        .from("market_data")
        .select("*, products!inner(name)")
        .order("updated_at", { ascending: false })
        .limit(100);
      setMarketPrices(
        (data ?? []).map((d: Record<string, unknown>) => ({
          ...d,
          card_name: (d.products as { name: string } | null)?.name ?? "—",
        })) as MarketPrice[],
      );
    } else if (tab === "history") {
      const { data } = await supabase
        .schema("cards")
        .from("price_history")
        .select("*")
        .order("recorded_date", { ascending: false })
        .limit(100);
      setPriceHistory((data ?? []) as PriceHistory[]);
    } else {
      const { data } = await supabase
        .schema("cards")
        .from("recent_purchases")
        .select("*")
        .order("activity_timestamp", { ascending: false })
        .limit(100);
      setPurchases((data ?? []) as RecentPurchase[]);
    }

    setLoading(false);
  }, [tab, supabase]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "prices", label: "Market Prices" },
    { key: "history", label: "Price History" },
    { key: "purchases", label: "Recent Purchases" },
  ];

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
                        {formatPrice(row.ungraded_price)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.psa_9_price)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.psa_10_price)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.bgs_price)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.cgc_price)}
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
                      <td className="px-4 py-2 font-mono text-xs max-w-[200px] truncate">
                        {row.product_id}
                      </td>
                      <td className="px-4 py-2">
                        {new Date(row.recorded_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-2">{row.condition ?? "—"}</td>
                      <td className="px-4 py-2">{formatPrice(row.price)}</td>
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
                    <td className="px-4 py-2 font-mono text-xs max-w-[200px] truncate">
                      {row.product_id}
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
                    <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                      {row.activity_timestamp
                        ? new Date(row.activity_timestamp).toLocaleString()
                        : "—"}
                    </td>
                    <td className="px-4 py-2">{row.source ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
