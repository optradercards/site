"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface TraderRow {
  account_id: string;
  name: string | null;
  slug: string | null;
  plan_type: "collector" | "trader" | "trader_plus";
  billing_period: "monthly" | "yearly" | null;
  created_at: string;
}

interface Stats {
  totalTraders: number | null;
  pendingApplications: number | null;
  thisMonthSalesCents: number | null;
  monthlyRevenueCents: number | null;
  activeTraders: number | null;
  activeTraderPlus: number | null;
}

const PLAN_LABEL: Record<TraderRow["plan_type"], string> = {
  collector: "Collector",
  trader: "Trader",
  trader_plus: "Trader++",
};

const PLAN_PILL: Record<TraderRow["plan_type"], string> = {
  collector:
    "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200",
  trader: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
  trader_plus:
    "bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200",
};

function compactDollars(cents: number | null): string {
  if (cents == null) return "—";
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1_000_000)
    return "$" + (dollars / 1_000_000).toFixed(1) + "M";
  if (Math.abs(dollars) >= 1_000)
    return "$" + (dollars / 1_000).toFixed(1) + "K";
  return "$" + dollars.toFixed(2);
}

export default function AdminTradersPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [traders, setTraders] = useState<TraderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const monthStart = new Date();
      monthStart.setUTCDate(1);
      monthStart.setUTCHours(0, 0, 0, 0);

      const head = { count: "exact" as const, head: true };

      const [
        totalTraders,
        activeTraders,
        activeTraderPlus,
        monthSales,
        tradersOnly,
      ] = await Promise.all([
        // Total non-personal accounts = traders
        supabase
          .schema("basejump")
          .from("accounts")
          .select("id", head)
          .eq("personal_account", false),
        supabase
          .from("traders")
          .select("account_id", head)
          .eq("plan_type", "trader"),
        supabase
          .from("traders")
          .select("account_id", head)
          .eq("plan_type", "trader_plus"),
        supabase
          .schema("ecom")
          .from("transactions")
          .select("total_cents")
          .eq("type", "order")
          .eq("status", "completed")
          .gte("completed_at", monthStart.toISOString()),
        supabase
          .from("traders")
          .select("account_id, plan_type, billing_period, created_at")
          .order("created_at", { ascending: false })
          .limit(25),
      ]);

      const monthSalesCents = (monthSales.data ?? []).reduce(
        (sum: number, row: { total_cents: number | null }) =>
          sum + (row.total_cents ?? 0),
        0
      );

      // traders.account_id references basejump.accounts(id) cross-schema,
      // so PostgREST won't auto-resolve a foreign-table join. Fetch
      // accounts in a second pass and merge client-side.
      const accountIds = (tradersOnly.data ?? []).map((t) => t.account_id);
      const { data: accounts } = accountIds.length
        ? await supabase
            .schema("basejump")
            .from("accounts")
            .select("id, name, slug, personal_account")
            .in("id", accountIds)
        : { data: [] as Array<{ id: string; name: string | null; slug: string | null; personal_account: boolean }> };
      const accountsById = new Map(
        (accounts ?? []).map((a) => [a.id, a])
      );
      const rows: TraderRow[] = [];
      for (const t of tradersOnly.data ?? []) {
        const a = accountsById.get(t.account_id);
        if (!a || a.personal_account) continue;
        rows.push({
          account_id: t.account_id,
          name: a.name,
          slug: a.slug,
          plan_type: t.plan_type as TraderRow["plan_type"],
          billing_period:
            t.billing_period as TraderRow["billing_period"],
          created_at: t.created_at as string,
        });
      }

      setStats({
        totalTraders: totalTraders.count ?? 0,
        pendingApplications: null, // No applications table exists
        thisMonthSalesCents: monthSalesCents,
        monthlyRevenueCents: null, // No subscription revenue tracking exists
        activeTraders: activeTraders.count ?? 0,
        activeTraderPlus: activeTraderPlus.count ?? 0,
      });
      setTraders(rows);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Traders
        </h2>
        <button className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded transition-colors">
          Add Trader
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
            Total Traders
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : (stats.totalTraders ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
            Pending Applications
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : stats.pendingApplications == null ? "—" : stats.pendingApplications.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
            This Month Sales
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : compactDollars(stats.thisMonthSalesCents)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
            Monthly Revenue (Plans)
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : stats.monthlyRevenueCents == null ? "—" : compactDollars(stats.monthlyRevenueCents)}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
            Traders (Active)
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : (stats.activeTraders ?? 0).toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
            Trader++ (Active)
          </div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : (stats.activeTraderPlus ?? 0).toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : traders.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No traders found.
          </p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Trader Name
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Slug
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Plan
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Billing
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Joined
                </th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {traders.map((t) => (
                <tr
                  key={t.account_id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {t.name ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 font-mono text-xs">
                    {t.slug ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded text-xs font-semibold ${PLAN_PILL[t.plan_type]}`}
                    >
                      {PLAN_LABEL[t.plan_type]}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {t.billing_period ?? "—"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(t.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button className="text-red-500 hover:text-red-600 font-semibold">
                      View
                    </button>
                    <button className="text-gray-500 hover:text-gray-600 font-semibold">
                      Suspend
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
