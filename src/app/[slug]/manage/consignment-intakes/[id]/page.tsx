"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

// ---------------------------------------------------------------------------
// /manage/consignment-intakes/[id] — vendor view of a single intake.
// Actions: resend email, copy link, vendor self-attest, cancel intake.
// ---------------------------------------------------------------------------

type IntakeStatus =
  | "draft"
  | "pending_consignor"
  | "accepted"
  | "partial"
  | "rejected"
  | "cancelled";

type ConsignorAcceptance =
  | "not_applicable"
  | "pending"
  | "accepted"
  | "disputed"
  | "rejected";

type IntakeRow = {
  id: string;
  vendor_account_id: string;
  consignor_contact_id: string | null;
  intake_date: string;
  status: IntakeStatus;
  acknowledgement_token: string | null;
  acknowledged_at: string | null;
  acknowledged_by_vendor: boolean;
  notes: string | null;
  created_at: string;
};

type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type LotRow = {
  lot_id: string;
  product_name: string | null;
  image_url: string | null;
  set_name: string | null;
  card_number: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_acquired: number;
  consignor_acceptance: ConsignorAcceptance;
  consignor_split_pct: number | null;
};

type FullLot = LotRow & { consignor_dispute_notes: string | null };

function gradeLabel(service: string | null, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

function statusColor(status: IntakeStatus): string {
  switch (status) {
    case "accepted":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "partial":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "pending_consignor":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
}

function acceptanceColor(a: ConsignorAcceptance): string {
  switch (a) {
    case "accepted":
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    case "disputed":
      return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300";
    case "rejected":
      return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    case "pending":
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
    default:
      return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  }
}

export default function ConsignmentIntakeDetailPage() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const id = params?.id as string;
  const { activeAccountId } = useAccounts();

  const [intake, setIntake] = useState<IntakeRow | null>(null);
  const [contact, setContact] = useState<Contact | null>(null);
  const [lots, setLots] = useState<FullLot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [resending, setResending] = useState(false);
  const [attesting, setAttesting] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    if (!id || !activeAccountId) return;
    setLoading(true);
    setError(null);

    const { data: intakeData, error: iErr } = await supabase
      .schema("ecom")
      .from("consignment_intakes")
      .select(
        "id, vendor_account_id, consignor_contact_id, intake_date, status, acknowledgement_token, acknowledged_at, acknowledged_by_vendor, notes, created_at",
      )
      .eq("id", id)
      .maybeSingle();

    if (iErr) {
      setError(iErr.message);
      setLoading(false);
      return;
    }
    if (!intakeData) {
      setError("Intake not found.");
      setLoading(false);
      return;
    }
    const i = intakeData as IntakeRow;
    // Drafts have no lots and no detail to show — send the user back to
    // the receive form to keep editing.
    if (i.status === "draft") {
      router.replace(
        `/${slug}/manage/inventory/receive?mode=consignment&draft_id=${i.id}`,
      );
      return;
    }
    setIntake(i);

    const [contactRes, lotsRes, notesRes] = await Promise.all([
      i.consignor_contact_id
        ? supabase
            .schema("ecom")
            .from("contacts")
            .select("id, name, email, phone")
            .eq("id", i.consignor_contact_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null } as const),
      supabase
        .schema("ecom")
        .from("vendor_inventory_summary")
        .select(
          "lot_id, product_name, image_url, set_name, card_number, grading_service, grade, quantity_acquired, consignor_acceptance, consignor_split_pct",
        )
        .eq("consignment_intake_id", id),
      supabase
        .schema("ecom")
        .from("inventory_lots")
        .select("id, consignor_dispute_notes")
        .eq("consignment_intake_id", id),
    ]);

    setContact((contactRes.data ?? null) as Contact | null);
    const lotsBase = (lotsRes.data ?? []) as LotRow[];
    const noteMap = new Map<string, string | null>();
    for (const n of (notesRes.data ?? []) as {
      id: string;
      consignor_dispute_notes: string | null;
    }[]) {
      noteMap.set(n.id, n.consignor_dispute_notes);
    }
    setLots(
      lotsBase.map((l) => ({
        ...l,
        consignor_dispute_notes: noteMap.get(l.lot_id) ?? null,
      })),
    );

    setLoading(false);
  }, [supabase, id, activeAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const shareUrl = useMemo(() => {
    if (!intake?.acknowledgement_token) return null;
    if (typeof window === "undefined") return null;
    return `${window.location.origin}/consignor/confirm/${intake.acknowledgement_token}`;
  }, [intake?.acknowledgement_token]);

  const resendEmail = async () => {
    if (!id) return;
    setResending(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/consignment-intakes/${id}/send-email`, {
        method: "POST",
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setNotice(body?.error ?? "Send failed");
      } else if (body?.emailSent) {
        setNotice(`Confirmation email sent to ${contact?.email ?? "consignor"}.`);
      } else {
        setNotice(
          `Email not sent (${body?.reason ?? "unknown"}). Copy the link below and share it manually.`,
        );
      }
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Send failed");
    } finally {
      setResending(false);
    }
  };

  const copyLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setNotice("Confirmation link copied to clipboard.");
    } catch {
      setNotice("Could not copy automatically — select and copy manually.");
    }
  };

  const attest = async () => {
    if (!id) return;
    if (
      !confirm(
        "Mark this intake as accepted on the consignor's behalf? This should only be used when you've confirmed in person.",
      )
    )
      return;
    setAttesting(true);
    setNotice(null);
    try {
      const { data, error: err } = await supabase
        .schema("ecom")
        .rpc("vendor_attest_consignment_intake", { p_intake_id: id });
      if (err) {
        setNotice(err.message);
        return;
      }
      const result = data as { ok: boolean; error?: string } | null;
      if (!result?.ok) {
        setNotice(result?.error ?? "Could not attest");
        return;
      }
      setNotice("Intake marked as accepted.");
      await load();
    } finally {
      setAttesting(false);
    }
  };

  const cancelIntake = async () => {
    if (!id) return;
    if (
      !confirm(
        "Cancel this intake? Lots stay in inventory but the intake will be marked cancelled.",
      )
    )
      return;
    setCancelling(true);
    setNotice(null);
    try {
      const { error: err } = await supabase
        .schema("ecom")
        .from("consignment_intakes")
        .update({ status: "cancelled" })
        .eq("id", id);
      if (err) {
        setNotice(err.message);
        return;
      }
      setNotice("Intake cancelled.");
      await load();
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 dark:text-gray-400">
        Loading…
      </div>
    );
  }
  if (error || !intake) {
    return (
      <div>
        <div className="mb-4">
          <Link
            href={`/${slug}/manage/consignment-intakes`}
            className="text-sm text-red-500 hover:text-red-600"
          >
            &larr; Back to intakes
          </Link>
        </div>
        <p className="text-red-600 dark:text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  const canResend =
    intake.status === "pending_consignor" && !!contact?.email;
  const canShareLink =
    intake.status === "pending_consignor" && !!intake.acknowledgement_token;
  const canAttest = intake.status === "pending_consignor";
  const canCancel = intake.status !== "cancelled";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Link
          href={`/${slug}/manage/consignment-intakes`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to intakes
        </Link>
        <button
          type="button"
          onClick={() => router.refresh()}
          className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Refresh
        </button>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Consignment intake
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Intake from {new Date(intake.intake_date).toLocaleDateString()}.
      </p>

      {/* Meta + actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-xs uppercase text-gray-500">Consignor</p>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {contact?.name ?? "—"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {contact?.email ?? "no email"}
              {contact?.phone ? ` · ${contact.phone}` : ""}
            </p>
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Status</p>
            <span
              className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${statusColor(intake.status)}`}
            >
              {intake.status.replace(/_/g, " ")}
            </span>
            {intake.acknowledged_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {intake.acknowledged_by_vendor ? "Vendor-attested" : "Consignor-confirmed"}{" "}
                · {new Date(intake.acknowledged_at).toLocaleString()}
              </p>
            )}
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Notes</p>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {intake.notes ?? "—"}
            </p>
          </div>
        </div>

        {notice && (
          <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-300 text-sm">
            {notice}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700 flex flex-wrap gap-3">
          {canResend && (
            <button
              type="button"
              disabled={resending}
              onClick={resendEmail}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {resending ? "Sending…" : "Resend confirmation email"}
            </button>
          )}
          {canShareLink && shareUrl && (
            <button
              type="button"
              onClick={copyLink}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Copy confirmation link
            </button>
          )}
          {canAttest && (
            <button
              type="button"
              disabled={attesting}
              onClick={attest}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {attesting ? "Working…" : "Confirm on consignor's behalf"}
            </button>
          )}
          {canCancel && (
            <button
              type="button"
              disabled={cancelling}
              onClick={cancelIntake}
              className="ml-auto px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
            >
              {cancelling ? "Working…" : "Cancel intake"}
            </button>
          )}
        </div>

        {shareUrl && canShareLink && (
          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400 break-all">
            {shareUrl}
          </div>
        )}
      </div>

      {/* Lots */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {lots.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            No lots are linked to this intake.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Card</th>
                  <th className="px-3 py-2 text-left">Set</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Split %</th>
                  <th className="px-3 py-2 text-left">Acceptance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lots.map((l) => (
                  <tr key={l.lot_id} className="align-top">
                    <td className="px-3 py-3">
                      {l.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.image_url}
                          alt={l.product_name ?? ""}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                      )}
                    </td>
                    <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {l.product_name ?? "—"}
                      {l.card_number && (
                        <span className="ml-2 text-xs text-gray-400">
                          #{l.card_number}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {l.set_name ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(l.grading_service, l.grade)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {l.quantity_acquired}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {l.consignor_split_pct ?? "—"}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${acceptanceColor(l.consignor_acceptance)}`}
                      >
                        {l.consignor_acceptance.replace(/_/g, " ")}
                      </span>
                      {l.consignor_dispute_notes && (
                        <p className="mt-1 text-xs text-gray-600 dark:text-gray-300 italic">
                          “{l.consignor_dispute_notes}”
                        </p>
                      )}
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
