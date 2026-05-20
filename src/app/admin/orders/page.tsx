"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type TxStatus = "draft" | "completed" | "cancelled";

interface OrderRow {
  id: string;
  status: TxStatus;
  total_cents: number;
  currency: string;
  buyer_user_id: string | null;
  buyer_contact: { name?: string; email?: string; phone?: string } | null;
  created_at: string;
  completed_at: string | null;
}

interface Stats {
  draft: number;
  completed: number;
  cancelled: number;
  total: number;
}

const STATUS_PILL: Record<TxStatus, string> = {
  draft: "bg-yellow-100 text-yellow-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-800",
};

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

function buyerLabel(row: OrderRow): string {
  if (row.buyer_contact?.name) return row.buyer_contact.name;
  if (row.buyer_contact?.email) return row.buyer_contact.email;
  if (row.buyer_user_id) return row.buyer_user_id.slice(0, 8);
  return "Walk-up";
}

export default function AdminOrdersPage() {
  const supabase = createClient();
  const [stats, setStats] = useState<Stats | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const ecom = supabase.schema("ecom");
      const head = { count: "exact" as const, head: true };

      const [draftRes, completedRes, cancelledRes, totalRes, listRes] =
        await Promise.all([
          ecom
            .from("transactions")
            .select("id", head)
            .eq("type", "order")
            .eq("status", "draft"),
          ecom
            .from("transactions")
            .select("id", head)
            .eq("type", "order")
            .eq("status", "completed"),
          ecom
            .from("transactions")
            .select("id", head)
            .eq("type", "order")
            .eq("status", "cancelled"),
          ecom
            .from("transactions")
            .select("id", head)
            .eq("type", "order"),
          ecom
            .from("transactions")
            .select(
              "id, status, total_cents, currency, buyer_user_id, buyer_contact, created_at, completed_at"
            )
            .eq("type", "order")
            .order("created_at", { ascending: false })
            .limit(25),
        ]);

      setStats({
        draft: draftRes.count ?? 0,
        completed: completedRes.count ?? 0,
        cancelled: cancelledRes.count ?? 0,
        total: totalRes.count ?? 0,
      });
      setOrders((listRes.data ?? []) as OrderRow[]);
      setLoading(false);
    })();
  }, [supabase]);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Orders</h2>

      <div className="grid md:grid-cols-4 gap-6 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Draft</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : stats.draft.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Completed</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : stats.completed.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Cancelled</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : stats.cancelled.toLocaleString()}
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">Total</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white">
            {stats == null ? "…" : stats.total.toLocaleString()}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">No orders yet.</p>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Order ID</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Customer</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Total</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Created</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">Actions</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr
                  key={o.id}
                  className="border-t border-gray-200 dark:border-gray-700"
                >
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-mono text-xs">
                    #{o.id.slice(0, 8)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {buyerLabel(o)}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                    {formatPrice(o.total_cents)}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${STATUS_PILL[o.status]}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {new Date(o.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm space-x-2">
                    <button className="text-red-500 hover:text-red-600 font-semibold">View</button>
                    <button className="text-gray-500 hover:text-gray-600 font-semibold">Update</button>
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
