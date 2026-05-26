"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { formatPrice } from "@/lib/currency";

// ---------------------------------------------------------------------------
// Purchases list — ecom.purchases ordered by purchased_at desc
// ---------------------------------------------------------------------------

type PurchaseRow = {
  id: string;
  purchased_at: string;
  vendor_invoice_ref: string | null;
  subtotal_cents: number;
  shipping_cents: number;
  fees_cents: number;
  total_cents: number;
  purchase_currency: string;
  allocation_method: "pro_rata_value" | "equal" | "by_quantity";
  receipt_url: string | null;
  notes: string | null;
};

type LotCountRow = {
  purchase_id: string;
  count: number;
};

export default function PurchasesPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;

  const [rows, setRows] = useState<PurchaseRow[]>([]);
  const [lotCounts, setLotCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data } = await supabase
      .schema("ecom")
      .from("purchases")
      .select("*")
      .eq("account_id", activeAccountId)
      .order("purchased_at", { ascending: false });

    const purchases = (data ?? []) as PurchaseRow[];
    setRows(purchases);

    if (purchases.length > 0) {
      const ids = purchases.map((p) => p.id);
      const { data: lotData } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .select("purchase_id")
        .in("purchase_id", ids);

      const counts = new Map<string, number>();
      for (const row of (lotData ?? []) as { purchase_id: string }[]) {
        counts.set(row.purchase_id, (counts.get(row.purchase_id) ?? 0) + 1);
      }
      setLotCounts(counts);
    } else {
      setLotCounts(new Map());
    }
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const deletePurchase = async (r: PurchaseRow) => {
    const lots = lotCounts.get(r.id) ?? 0;
    const label = `${new Date(r.purchased_at).toLocaleDateString()} — ${formatPrice(r.total_cents, r.purchase_currency, {}, r.purchase_currency)}`;
    if (
      !window.confirm(
        `Delete purchase ${label}? This removes the purchase and its ${lots} lot${lots === 1 ? "" : "s"}. Refused if any lot has already been sold.`,
      )
    ) {
      return;
    }
    setDeletingId(r.id);
    setError(null);
    setNotice(null);
    const { data, error: rpcErr } = await supabase
      .schema("ecom")
      .rpc("delete_purchase", { p_purchase_id: r.id });
    setDeletingId(null);
    if (rpcErr) {
      setError(rpcErr.message);
      return;
    }
    const payload = (data ?? {}) as { lots_deleted?: number };
    setNotice(
      `Deleted purchase + ${payload.lots_deleted ?? 0} lot${(payload.lots_deleted ?? 0) === 1 ? "" : "s"}.`,
    );
    await loadData();
  };

  const totals = useMemo(() => {
    let total = 0;
    let shipping = 0;
    let fees = 0;
    for (const r of rows) {
      total += r.total_cents;
      shipping += r.shipping_cents;
      fees += r.fees_cents;
    }
    return { total, shipping, fees };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading purchases...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <Link
          href={`/${slug}/manage/inventory/receive?mode=purchase`}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
        >
          Record purchase
        </Link>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          {notice}
        </div>
      )}

      {/* Summary */}
      {rows.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <SummaryCard label="Purchases" value={String(rows.length)} />
          <SummaryCard
            label="Total spend"
            value={formatPrice(totals.total, rows[0].purchase_currency, {}, rows[0].purchase_currency)}
          />
          <SummaryCard
            label="Shipping"
            value={formatPrice(totals.shipping, rows[0].purchase_currency, {}, rows[0].purchase_currency)}
          />
          <SummaryCard
            label="Fees"
            value={formatPrice(totals.fees, rows[0].purchase_currency, {}, rows[0].purchase_currency)}
          />
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No purchases yet.{" "}
          <Link
            href={`/${slug}/manage/inventory/receive?mode=purchase`}
            className="text-red-500 hover:text-red-600 font-medium"
          >
            Record your first purchase
          </Link>
          .
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Invoice ref</th>
                <th className="px-4 py-3 text-right">Subtotal</th>
                <th className="px-4 py-3 text-right">Shipping</th>
                <th className="px-4 py-3 text-right">Fees</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3">Currency</th>
                <th className="px-4 py-3">Allocation</th>
                <th className="px-4 py-3 text-right">Lots</th>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((r) => {
                const count = lotCounts.get(r.id) ?? 0;
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer"
                    onClick={() =>
                      (window.location.href = `/${slug}/manage/inventory?purchase_id=${r.id}`)
                    }
                  >
                    <td className="px-4 py-3 text-gray-900 dark:text-gray-100">
                      {new Date(r.purchased_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                      {r.vendor_invoice_ref ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {formatPrice(r.subtotal_cents, r.purchase_currency, {}, r.purchase_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {formatPrice(r.shipping_cents, r.purchase_currency, {}, r.purchase_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {formatPrice(r.fees_cents, r.purchase_currency, {}, r.purchase_currency)}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatPrice(r.total_cents, r.purchase_currency, {}, r.purchase_currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                      {r.purchase_currency}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                        {r.allocation_method.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {count}
                    </td>
                    <td className="px-4 py-3">
                      {r.receipt_url ? (
                        <a
                          href={r.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          View
                        </a>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void deletePurchase(r);
                        }}
                        disabled={deletingId === r.id}
                        className="px-2 py-1 text-xs font-medium rounded text-red-700 dark:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 disabled:opacity-50"
                        title="Delete this purchase and reverse its inventory (refuses if any lot has been sold)"
                      >
                        {deletingId === r.id ? "Deleting…" : "Delete"}
                      </button>
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

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-gray-900 dark:text-gray-100">
        {value}
      </div>
    </div>
  );
}
