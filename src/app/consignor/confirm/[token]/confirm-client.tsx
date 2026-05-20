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
};

type Props = {
  token: string;
  lots: IntakeLot[];
};

function gradeLabel(service: string | null, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

function formatChargeback(cents: number | null): string {
  if (cents == null || cents === 0) return "—";
  return `A$${(cents / 100).toFixed(2)}`;
}

export default function ConfirmIntakeClient({ token, lots }: Props) {
  const supabase = useMemo(() => createClient(), []);

  // Per-lot dispute state
  const [disputed, setDisputed] = useState<Record<string, boolean>>({});
  const [disputeNotes, setDisputeNotes] = useState<Record<string, string>>({});

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
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
            <tr>
              <th className="px-3 py-2 text-left"></th>
              <th className="px-3 py-2 text-left">Card</th>
              <th className="px-3 py-2 text-left">Set</th>
              <th className="px-3 py-2 text-left">Grade</th>
              <th className="px-3 py-2 text-right">Qty</th>
              <th className="px-3 py-2 text-right">Split %</th>
              <th className="px-3 py-2 text-right">Chargeback/unit</th>
              <th className="px-3 py-2 text-left">Wrong?</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
            {lots.map((lot) => {
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
                  <td className="px-3 py-3 font-medium">
                    {lot.card_name ?? "—"}
                    {lot.card_number && (
                      <span className="ml-2 text-xs text-gray-400">
                        #{lot.card_number}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                    {lot.set_name ?? "—"}
                  </td>
                  <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                    {gradeLabel(lot.grading_service, lot.grade)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {lot.quantity_acquired}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {lot.consignor_split_pct ?? "—"}
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
