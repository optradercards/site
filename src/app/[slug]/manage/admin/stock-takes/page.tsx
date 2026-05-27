"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

// ---------------------------------------------------------------------------
// /[slug]/manage/admin/stock-takes
//
// History of stock-take sessions. Start a new one from here; click any row
// to view/continue. Each session aggregates a count delta (sum of every
// item's counted - system_qty_at_count) so you can tell at a glance whether
// it ran flat, found inventory, or surfaced shortages.
// ---------------------------------------------------------------------------

type StockTakeRow = {
  id: string;
  status: "draft" | "completed" | "cancelled";
  started_at: string;
  completed_at: string | null;
  notes: string | null;
  item_count: number;
  total_delta: number;
};

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

function statusBadge(status: StockTakeRow["status"]) {
  const map = {
    draft: {
      label: "Draft",
      cls: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
    },
    completed: {
      label: "Completed",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    cancelled: {
      label: "Cancelled",
      cls: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
    },
  } as const;
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

export default function StockTakesListPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();

  const [rows, setRows] = useState<StockTakeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);

    const { data: takeRows, error: takeErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .select("id, status, started_at, completed_at, notes")
      .eq("account_id", activeAccountId)
      .order("started_at", { ascending: false })
      .limit(100);

    if (takeErr) {
      setError(takeErr.message);
      setLoading(false);
      return;
    }

    const takes = (takeRows ?? []) as Pick<
      StockTakeRow,
      "id" | "status" | "started_at" | "completed_at" | "notes"
    >[];

    // Aggregate item counts + total delta per session. Could be denormalised
    // onto stock_takes later, but with at most ~100 sessions in flight this
    // single query is fine.
    const ids = takes.map((t) => t.id);
    const itemAgg = new Map<string, { count: number; delta: number }>();
    if (ids.length > 0) {
      const { data: itemRows } = await supabase
        .schema("ecom")
        .from("stock_take_items")
        .select("stock_take_id, counted_qty, system_qty_at_count")
        .in("stock_take_id", ids);
      for (const r of (itemRows ?? []) as {
        stock_take_id: string;
        counted_qty: number;
        system_qty_at_count: number;
      }[]) {
        const cur = itemAgg.get(r.stock_take_id) ?? { count: 0, delta: 0 };
        cur.count += 1;
        cur.delta += r.counted_qty - r.system_qty_at_count;
        itemAgg.set(r.stock_take_id, cur);
      }
    }

    setRows(
      takes.map((t) => ({
        ...t,
        item_count: itemAgg.get(t.id)?.count ?? 0,
        total_delta: itemAgg.get(t.id)?.delta ?? 0,
      })),
    );
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const startNew = async () => {
    if (!activeAccountId) return;
    setStarting(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .insert({ account_id: activeAccountId, status: "draft" })
      .select("id")
      .single();
    setStarting(false);
    if (insErr || !data) {
      setError(insErr?.message ?? "Failed to start stock take");
      return;
    }
    router.push(`/${slug}/manage/admin/stock-takes/${data.id}`);
  };

  // Delete a session. Draft/cancelled go cleanly (stock_take_items cascades).
  // Completed sessions: the row plus its items go away but the related
  // stock_adjustments rows survive (FK on delete set null) — inventory
  // numbers stay as they are, only the count session breakdown is lost.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const deleteRow = async (r: StockTakeRow) => {
    const when = relativeTime(r.started_at);
    const warning =
      r.status === "completed"
        ? `Delete this completed stock take from ${when}? The inventory adjustments it applied will NOT be reversed — only the count session and its item breakdown are removed.`
        : `Delete this ${r.status} stock take from ${when}? Counts in this session will be lost.`;
    if (!confirm(warning)) return;
    setDeletingId(r.id);
    setError(null);
    const { error: dErr } = await supabase
      .schema("ecom")
      .from("stock_takes")
      .delete()
      .eq("id", r.id);
    setDeletingId(null);
    if (dErr) {
      setError(dErr.message);
      return;
    }
    setRows((prev) => prev.filter((row) => row.id !== r.id));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Stock takes
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Walk-around physical inventory counts. Each session captures a
            point-in-time snapshot of system quantities so partial work
            doesn&apos;t drift the truth. Lots you don&apos;t touch are left
            alone (partial-count model).
          </p>
        </div>
        <button
          type="button"
          onClick={startNew}
          disabled={starting}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
        >
          {starting ? "Starting…" : "Start new stock take"}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500 text-center">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-sm text-gray-500 dark:text-gray-400 text-center">
            No stock takes yet. Hit <strong>Start new stock take</strong> to
            begin counting.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-4 py-3 text-left">Started</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-right">Items counted</th>
                  <th className="px-4 py-3 text-right">Net delta</th>
                  <th className="px-4 py-3 text-left">Completed</th>
                  <th className="px-4 py-3 text-left">Notes</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td
                      className="px-4 py-3 text-gray-900 dark:text-gray-100"
                      title={new Date(r.started_at).toLocaleString()}
                    >
                      {relativeTime(r.started_at)}
                    </td>
                    <td className="px-4 py-3">{statusBadge(r.status)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                      {r.item_count}
                    </td>
                    <td
                      className={`px-4 py-3 text-right tabular-nums font-medium ${
                        r.total_delta > 0
                          ? "text-green-600 dark:text-green-400"
                          : r.total_delta < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-500 dark:text-gray-400"
                      }`}
                    >
                      {r.total_delta > 0 ? "+" : ""}
                      {r.total_delta}
                    </td>
                    <td
                      className="px-4 py-3 text-gray-500 dark:text-gray-400"
                      title={
                        r.completed_at
                          ? new Date(r.completed_at).toLocaleString()
                          : undefined
                      }
                    >
                      {relativeTime(r.completed_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 max-w-[200px] truncate">
                      {r.notes ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          onClick={() => deleteRow(r)}
                          disabled={deletingId === r.id}
                          className="text-xs text-gray-500 hover:text-red-600 disabled:opacity-50"
                          title="Delete this stock take"
                        >
                          {deletingId === r.id ? "Deleting…" : "Delete"}
                        </button>
                        <Link
                          href={`/${slug}/manage/admin/stock-takes/${r.id}`}
                          className="text-sm font-medium text-red-500 hover:text-red-600"
                        >
                          {r.status === "draft" ? "Continue" : "View"} &rarr;
                        </Link>
                      </div>
                    </td>
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
