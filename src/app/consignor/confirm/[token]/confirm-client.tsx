"use client";

import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type IntakeLot = {
  id: string;
  card_name: string | null;
  card_image_url: string | null;
  card_number: string | null;
  set_name: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_acquired: number;
  consignor_acceptance: string;
  consignor_dispute_notes: string | null;
  consignor_split_pct: number | null;
  consignor_chargeback_per_unit_cents: number | null;
  market_usd_cents: number | null;
  total_usd_cents: number | null;
  share_usd_cents: number | null;
  market_display: string | null;
  total_display: string | null;
  share_display: string | null;
};

type Props = {
  token: string;
  lots: IntakeLot[];
  grandTotalDisplay: string | null;
  grandShareDisplay: string | null;
};

function gradeLabel(service: string | null, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

function formatChargeback(cents: number | null): string {
  if (cents == null || cents === 0) return "—";
  const formatted = (cents / 100).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `A$${formatted}`;
}

export default function ConfirmIntakeClient({
  token,
  lots,
  grandTotalDisplay,
  grandShareDisplay,
}: Props) {
  const supabase = useMemo(() => createClient(), []);

  // Per-lot dispute state
  const [disputed, setDisputed] = useState<Record<string, boolean>>({});
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});

  type SortCol =
    | "card"
    | "grade"
    | "qty"
    | "market"
    | "total"
    | "split"
    | "share"
    | "chargeback";
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" } | null>(
    null,
  );
  const toggleSort = (col: SortCol) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  };

  const sortedLots = useMemo(() => {
    if (!sort) return lots;
    const dir = sort.dir === "asc" ? 1 : -1;
    const getKey = (l: IntakeLot): string | number | null => {
      switch (sort.col) {
        case "card":
          return l.card_name?.toLowerCase() ?? null;
        case "grade":
          return gradeLabel(l.grading_service, l.grade).toLowerCase();
        case "qty":
          return l.quantity_acquired;
        case "market":
          return l.market_usd_cents;
        case "total":
          return l.total_usd_cents;
        case "split":
          return l.consignor_split_pct;
        case "share":
          return l.share_usd_cents;
        case "chargeback":
          return l.consignor_chargeback_per_unit_cents;
      }
    };
    return [...lots].sort((a, b) => {
      const av = getKey(a);
      const bv = getKey(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [lots, sort]);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<
    | { kind: "success"; status: string }
    | { kind: "error"; message: string }
    | null
  >(null);

  const disputedIds = Object.entries(disputed)
    .filter(([, v]) => v)
    .map(([id]) => id);

  const submit = async (action: "accept_all" | "accept_with_disputes" | "reject_all") => {
    setSubmitting(true);
    setDone(null);
    try {
      const disputes = action === "accept_with_disputes"
        ? disputedIds.map((id) => ({ lot_id: id, notes: disputeNotes[id] ?? "" }))
        : [];
      const { data, error } = await supabase
        .schema("ecom")
        .rpc("confirm_consignment_intake", {
          p_token: token,
          p_action: action,
          p_disputes: disputes,
        });

      if (error) {
        setDone({ kind: "error", message: error.message });
        return;
      }
      const result = data as { ok: boolean; error?: string } | null;
      if (!result || !result.ok) {
        setDone({ kind: "error", message: result?.error ?? "Submit failed" });
        return;
      }

      const status =
        action === "reject_all"
          ? "rejected"
          : disputedIds.length > 0
            ? "accepted with disputes"
            : "accepted";
      setDone({ kind: "success", status });
    } catch (e) {
      setDone({
        kind: "error",
        message: e instanceof Error ? e.message : "Submit failed",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (done?.kind === "success") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
        <p className="text-base">
          Thanks — your response has been recorded. The intake is now{" "}
          <span className="font-semibold">{done.status}</span>. You can close
          this page.
        </p>
      </div>
    );
  }

  const itemCount = lots.length;
  const totalUnits = lots.reduce((a, l) => a + l.quantity_acquired, 0);
  const acceptCount = itemCount - disputedIds.length;
  const canSubmitDisputes =
    disputedIds.length > 0 &&
    disputedIds.every((id) => (disputeNotes[id] ?? "").trim().length > 0);

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden mb-6">
        <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Market price is a catalog reference and is not the sale price — the
            final price is set when the item is listed.
          </p>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <SortTh col="card" align="left" sort={sort} onToggle={toggleSort}>Card</SortTh>
              <SortTh col="grade" align="left" sort={sort} onToggle={toggleSort}>Grade</SortTh>
              <SortTh col="qty" align="right" sort={sort} onToggle={toggleSort}>Qty</SortTh>
              <SortTh col="market" align="right" sort={sort} onToggle={toggleSort}>Market</SortTh>
              <SortTh col="total" align="right" sort={sort} onToggle={toggleSort}>Total</SortTh>
              <SortTh col="split" align="right" sort={sort} onToggle={toggleSort}>Split</SortTh>
              <SortTh col="share" align="right" sort={sort} onToggle={toggleSort}>You receive</SortTh>
              <SortTh col="chargeback" align="right" sort={sort} onToggle={toggleSort}>Chargeback/unit</SortTh>
              <th className="px-3 py-2 text-left">Wrong?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {sortedLots.map((lot) => {
              const isDisputed = !!disputed[lot.id];
              return (
                <tr key={lot.id} className="align-top">
                  <td className="px-3 py-3">
                    {lot.card_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={lot.card_image_url}
                        alt={lot.card_name ?? ""}
                        className="w-10 h-14 object-contain rounded"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <p className="font-medium">
                      {lot.card_name ?? "—"}
                      {lot.card_number && (
                        <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                          #{lot.card_number}
                        </span>
                      )}
                    </p>
                    {lot.set_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {lot.set_name}
                      </p>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                    {gradeLabel(lot.grading_service, lot.grade)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {lot.quantity_acquired}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {lot.market_display ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {lot.total_display ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {lot.consignor_split_pct != null
                      ? `${lot.consignor_split_pct}%`
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    {lot.share_display ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatChargeback(lot.consignor_chargeback_per_unit_cents)}
                  </td>
                  <td className="px-3 py-3">
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={isDisputed}
                        onChange={(e) =>
                          setDisputed((p) => ({
                            ...p,
                            [lot.id]: e.target.checked,
                          }))
                        }
                        className="rounded text-red-500 focus:ring-red-500"
                      />
                      This is wrong
                    </label>
                    {isDisputed && (
                      <textarea
                        rows={2}
                        value={disputeNotes[lot.id] ?? ""}
                        onChange={(e) =>
                          setDisputeNotes((p) => ({
                            ...p,
                            [lot.id]: e.target.value,
                          }))
                        }
                        placeholder="What's wrong? (required)"
                        className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-xs text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <tr>
              <td
                colSpan={5}
                className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-300"
              >
                Grand total
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {grandTotalDisplay ?? "—"}
              </td>
              <td></td>
              <td className="px-3 py-2 text-right tabular-nums font-semibold text-gray-900 dark:text-gray-100 whitespace-nowrap">
                {grandShareDisplay ?? "—"}
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
        {itemCount} line item{itemCount === 1 ? "" : "s"} · {totalUnits} unit
        {totalUnits === 1 ? "" : "s"} total
      </p>

      {done?.kind === "error" && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {done.message}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <button
          type="button"
          disabled={submitting}
          onClick={() => submit("reject_all")}
          className="px-4 py-2 text-sm font-medium text-red-600 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
        >
          Reject entire intake
        </button>
        {disputedIds.length > 0 ? (
          <button
            type="button"
            disabled={submitting || !canSubmitDisputes}
            onClick={() => submit("accept_with_disputes")}
            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
          >
            {submitting
              ? "Submitting…"
              : `Submit ${disputedIds.length} dispute${disputedIds.length === 1 ? "" : "s"} (accept ${acceptCount})`}
          </button>
        ) : (
          <button
            type="button"
            disabled={submitting}
            onClick={() => submit("accept_all")}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {submitting
              ? "Submitting…"
              : `Accept all (${itemCount} item${itemCount === 1 ? "" : "s"})`}
          </button>
        )}
      </div>
    </div>
  );
}

function SortTh<T extends string>({
  col,
  align,
  sort,
  onToggle,
  children,
}: {
  col: T;
  align: "left" | "right";
  sort: { col: T; dir: "asc" | "desc" } | null;
  onToggle: (col: T) => void;
  children: React.ReactNode;
}) {
  const active = sort?.col === col;
  const arrow = active ? (sort!.dir === "asc" ? "▲" : "▼") : "↕";
  return (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : "text-left"}`}
    >
      <button
        type="button"
        onClick={() => onToggle(col)}
        className="inline-flex items-center gap-1 uppercase text-xs font-semibold hover:text-gray-900 dark:hover:text-white"
      >
        {children}
        <span
          className={`text-[10px] ${active ? "opacity-100" : "opacity-40"}`}
          aria-hidden
        >
          {arrow}
        </span>
      </button>
    </th>
  );
}
