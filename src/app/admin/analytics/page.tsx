"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface KeyMetrics {
  totalRevenueCents: number;
  totalRevenueDeltaPct: number | null;
  avgOrderValueCents: number | null;
  avgOrderValueDeltaCents: number | null;
  repeatCustomerPct: number | null;
  repeatCustomerDeltaPct: number | null;
}

interface DayBar {
  label: string;
  revenueCents: number;
}

interface TopProduct {
  card_product_id: string;
  name: string;
  quantity: number;
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

function compactDollars(cents: number | null): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000) return "$" + (dollars / 1_000_000).toFixed(1) + "M";
  if (Math.abs(dollars) >= 1_000) return "$" + (dollars / 1_000).toFixed(1) + "K";
  return "$" + dollars.toFixed(0);
}

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function AdminAnalyticsPage() {
  const supabase = createClient();
  const [metrics, setMetrics] = useState<KeyMetrics | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<DayBar[] | null>(null);
  const [topProducts, setTopProducts] = useState<TopProduct[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ecom = supabase.schema("ecom");
      const cards = supabase.schema("cards");

      const now = new Date();
      const monthStart = new Date(now);
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);
      const prevMonthStart = new Date(monthStart);
      prevMonthStart.setUTCMonth(prevMonthStart.getUTCMonth() - 1);
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
      sevenDaysAgo.setUTCHours(0, 0, 0, 0);

      const [allRes, thisMonthRes, prevMonthRes, weekRes, itemsRes] =
        await Promise.all([
          ecom
            .from("transactions")
            .select("total_cents, buyer_user_id, buyer_contact, completed_at")
            .eq("type", "order")
            .eq("status", "completed"),
          ecom
            .from("transactions")
            .select("total_cents")
            .eq("type", "order")
            .eq("status", "completed")
            .gte("completed_at", monthStart.toISOString()),
          ecom
            .from("transactions")
            .select("total_cents")
            .eq("type", "order")
            .eq("status", "completed")
            .gte("completed_at", prevMonthStart.toISOString())
            .lt("completed_at", monthStart.toISOString()),
          ecom
            .from("transactions")
            .select("total_cents, completed_at")
            .eq("type", "order")
            .eq("status", "completed")
            .gte("completed_at", sevenDaysAgo.toISOString()),
          ecom
            .from("transaction_items")
            .select(
              "card_product_id, quantity, transaction:transactions!inner(type, status)"
            )
            .eq("transaction.type", "order")
            .eq("transaction.status", "completed")
            .limit(2000),
        ]);

      const allOrders = (allRes.data ?? []) as Array<{
        total_cents: number | null;
        buyer_user_id: string | null;
        buyer_contact: { email?: string } | null;
      }>;

      const totalRevenueCents = allOrders.reduce(
        (s, r) => s + (r.total_cents ?? 0),
        0
      );
      const aov =
        allOrders.length > 0 ? Math.round(totalRevenueCents / allOrders.length) : null;

      // Repeat customer rate: customers (by buyer_user_id, else email) with > 1 order.
      const buyerCounts = new Map<string, number>();
      for (const r of allOrders) {
        const key = r.buyer_user_id ?? r.buyer_contact?.email ?? null;
        if (!key) continue;
        buyerCounts.set(key, (buyerCounts.get(key) ?? 0) + 1);
      }
      const totalBuyers = buyerCounts.size;
      const repeatBuyers = [...buyerCounts.values()].filter((c) => c > 1).length;
      const repeatPct =
        totalBuyers > 0 ? Math.round((repeatBuyers / totalBuyers) * 1000) / 10 : null;

      const thisMonthRevenue = (thisMonthRes.data ?? []).reduce(
        (s, r) => s + ((r.total_cents as number | null) ?? 0),
        0
      );
      const prevMonthRevenue = (prevMonthRes.data ?? []).reduce(
        (s, r) => s + ((r.total_cents as number | null) ?? 0),
        0
      );
      const totalRevenueDeltaPct =
        prevMonthRevenue > 0
          ? Math.round(
              ((thisMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 1000
            ) / 10
          : null;

      // Bucket last 7 days
      const trendBuckets: DayBar[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setUTCDate(d.getUTCDate() - i);
        d.setUTCHours(0, 0, 0, 0);
        trendBuckets.push({
          label: DAY_LABELS[d.getUTCDay()],
          revenueCents: 0,
        });
      }
      for (const r of (weekRes.data ?? []) as Array<{
        total_cents: number | null;
        completed_at: string | null;
      }>) {
        if (!r.completed_at) continue;
        const d = new Date(r.completed_at);
        d.setUTCHours(0, 0, 0, 0);
        const diffDays = Math.round(
          (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
            d.getTime()) /
            (24 * 60 * 60 * 1000)
        );
        const idx = 6 - diffDays;
        if (idx >= 0 && idx < 7) {
          trendBuckets[idx].revenueCents += r.total_cents ?? 0;
        }
      }

      // Top products: aggregate transaction_items quantities per card_product_id,
      // then resolve names.
      const productQty = new Map<string, number>();
      for (const r of (itemsRes.data ?? []) as Array<{
        card_product_id: string;
        quantity: number | null;
      }>) {
        productQty.set(
          r.card_product_id,
          (productQty.get(r.card_product_id) ?? 0) + (r.quantity ?? 0)
        );
      }
      const topIds = [...productQty.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
      const { data: productRows } = topIds.length
        ? await cards
            .from("products")
            .select("id, name")
            .in(
              "id",
              topIds.map(([id]) => id)
            )
        : { data: [] as Array<{ id: string; name: string | null }> };
      const nameById = new Map(
        (productRows ?? []).map((p) => [p.id as string, p.name as string | null])
      );
      const top: TopProduct[] = topIds.map(([id, qty]) => ({
        card_product_id: id,
        name: nameById.get(id) ?? "Unknown",
        quantity: qty,
      }));

      setMetrics({
        totalRevenueCents,
        totalRevenueDeltaPct,
        avgOrderValueCents: aov,
        avgOrderValueDeltaCents: null,
        repeatCustomerPct: repeatPct,
        repeatCustomerDeltaPct: null,
      });
      setRevenueTrend(trendBuckets);
      setTopProducts(top);
      setLoading(false);
    })();
  }, [supabase]);

  const maxTrend =
    revenueTrend && revenueTrend.length > 0
      ? Math.max(1, ...revenueTrend.map((d) => d.revenueCents))
      : 1;
  const maxTopQty =
    topProducts && topProducts.length > 0
      ? Math.max(1, ...topProducts.map((p) => p.quantity))
      : 1;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h2>

      {/* Key Metrics */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Total Revenue</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {loading || !metrics ? "…" : compactDollars(metrics.totalRevenueCents)}
          </div>
          {metrics?.totalRevenueDeltaPct != null ? (
            <p
              className={`text-sm mt-2 ${metrics.totalRevenueDeltaPct >= 0 ? "text-green-600" : "text-red-600"}`}
            >
              {metrics.totalRevenueDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(metrics.totalRevenueDeltaPct)}% from last month
            </p>
          ) : (
            <p className="text-sm mt-2 text-gray-400">No prior month data</p>
          )}
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Conversion Rate</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">—</div>
          <p className="text-sm mt-2 text-gray-400">No session tracking</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Avg Order Value</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {loading || !metrics ? "…" : formatPrice(metrics.avgOrderValueCents)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Repeat Customer Rate</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {loading || !metrics ? "…" : metrics.repeatCustomerPct == null ? "—" : `${metrics.repeatCustomerPct}%`}
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Revenue Trend (Last 7 Days)</h3>
          {loading || !revenueTrend ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : (
            <>
              <div className="h-40 flex items-end gap-2">
                {revenueTrend.map((d, i) => {
                  const heightPct =
                    d.revenueCents === 0 ? 2 : Math.max(2, (d.revenueCents / maxTrend) * 100);
                  return (
                    <div
                      key={i}
                      className="flex-1 bg-red-500 rounded-t"
                      style={{ height: `${heightPct}%` }}
                      title={`${d.label}: ${formatPrice(d.revenueCents)}`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mt-4">
                {revenueTrend.map((d, i) => (
                  <span key={i}>{d.label}</span>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Top Products</h3>
          {loading || !topProducts ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
          ) : topProducts.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400">No sold items yet.</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const widthPct = Math.max(4, (p.quantity / maxTopQty) * 100);
                const barColor =
                  i === 0
                    ? "bg-red-500"
                    : i === 1
                      ? "bg-blue-500"
                      : i === 2
                        ? "bg-green-500"
                        : i === 3
                          ? "bg-yellow-500"
                          : "bg-purple-500";
                return (
                  <div key={p.card_product_id} className="flex items-center justify-between">
                    <span className="text-gray-600 dark:text-gray-400 truncate max-w-[180px]">
                      {p.name}
                    </span>
                    <div className="flex-1 mx-4 bg-gray-200 dark:bg-gray-700 rounded h-2">
                      <div
                        className={`${barColor} rounded h-2`}
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">
                      {p.quantity}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Traffic Sources — no tracking data available */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Traffic Sources</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No traffic-source data is being tracked yet.
        </p>
      </div>
    </div>
  );
}
