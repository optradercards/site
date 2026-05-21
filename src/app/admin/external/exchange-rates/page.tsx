"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Rate = {
  currency_code: string;
  rate_from_usd: number;
  fetched_at: string;
};

export default function ExchangeRatesPage() {
  const supabase = createClient();
  const [rates, setRates] = useState<Rate[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<{
    count: number;
    fetched_at?: string;
  } | null>(null);

  const loadRates = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from("exchange_rates")
      .select("currency_code, rate_from_usd, fetched_at")
      .order("currency_code");
    if (fetchErr) setError(fetchErr.message);
    setRates((data ?? []) as Rate[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadRates();
  }, [loadRates]);

  async function runRefresh() {
    setRefreshing(true);
    setError(null);
    setLastRefresh(null);
    try {
      const { data, error: invokeErr } = await supabase.functions.invoke(
        "refresh-exchange-rates",
      );
      if (invokeErr) throw new Error(invokeErr.message);
      if (!data?.success) throw new Error(data?.error ?? "Refresh failed");
      setLastRefresh({ count: data.count, fetched_at: data.fetched_at });
      await loadRates();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRefreshing(false);
    }
  }

  const newestFetchedAt = rates.reduce<string | null>(
    (latest, r) => (latest == null || r.fetched_at > latest ? r.fetched_at : latest),
    null,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Exchange Rates
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            USD → currency conversion rates from Shiny. Refreshed automatically
            every day at 01:30 UTC; use the button for an on-demand refresh.
          </p>
          {newestFetchedAt && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Last updated {new Date(newestFetchedAt).toLocaleString()}
            </p>
          )}
        </div>
        <button
          onClick={runRefresh}
          disabled={refreshing}
          className="shrink-0 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium text-sm"
        >
          {refreshing ? "Refreshing…" : "Refresh Now"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      {lastRefresh && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 text-sm">
          <p className="text-green-700 dark:text-green-400 font-medium">
            Refresh complete — {lastRefresh.count} currencies updated
            {lastRefresh.fetched_at && (
              <span className="text-green-600 dark:text-green-500 font-normal">
                {" "}
                at {new Date(lastRefresh.fetched_at).toLocaleString()}
              </span>
            )}
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-500 dark:text-gray-400 text-sm">
            Loading…
          </div>
        ) : rates.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-700 dark:text-gray-300 font-medium">
              No rates yet
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Click <strong>Refresh Now</strong> to populate from the Shiny API.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 text-left">Currency</th>
                <th className="px-4 py-3 text-right">1 USD =</th>
                <th className="px-4 py-3 text-right">1 unit in USD</th>
                <th className="px-4 py-3 text-right">Last updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rates.map((r) => {
                const rate = Number(r.rate_from_usd);
                const inverse = rate > 0 ? 1 / rate : null;
                return (
                  <tr
                    key={r.currency_code}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3 font-mono uppercase font-medium text-gray-900 dark:text-gray-100">
                      {r.currency_code}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                      {rate.toFixed(6)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-gray-400">
                      {inverse != null ? `$${inverse.toFixed(6)}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400">
                      {new Date(r.fetched_at).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
