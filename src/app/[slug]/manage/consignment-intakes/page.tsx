"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

// ---------------------------------------------------------------------------
// /manage/consignment-intakes — list of consignment intakes for the vendor.
// Filter by status; click through to detail/actions.
// ---------------------------------------------------------------------------

type IntakeStatus =
  | "draft"
  | "pending_consignor"
  | "accepted"
  | "partial"
  | "rejected"
  | "cancelled";

type IntakeRow = {
  id: string;
  vendor_account_id: string;
  consignor_contact_id: string | null;
  intake_date: string;
  status: IntakeStatus;
  acknowledged_at: string | null;
  acknowledged_by_vendor: boolean;
  notes: string | null;
  created_at: string;
};

type ContactLite = { id: string; name: string; email: string | null };

const STATUS_OPTIONS: { value: "all" | IntakeStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_consignor", label: "Pending consignor" },
  { value: "partial", label: "Partial (with disputes)" },
  { value: "accepted", label: "Accepted" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
];

function statusBadge(status: IntakeStatus) {
  const styles: Record<IntakeStatus, string> = {
    draft:
      "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    pending_consignor:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    partial:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    accepted:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    rejected:
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    cancelled:
      "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
  };
  return (
    <span
      className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${styles[status]}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export default function ConsignmentIntakesListPage() {
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const searchParams = useSearchParams();

  const [rows, setRows] = useState<IntakeRow[]>([]);
  const [contacts, setContacts] = useState<Map<string, ContactLite>>(new Map());
  const [lotCounts, setLotCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const initialStatusFromUrl = (() => {
    const s = searchParams?.get("status");
    if (
      s === "draft" ||
      s === "pending_consignor" ||
      s === "accepted" ||
      s === "partial" ||
      s === "rejected" ||
      s === "cancelled"
    ) {
      return s as IntakeStatus;
    }
    return "all" as const;
  })();
  const [statusFilter, setStatusFilter] = useState<"all" | IntakeStatus>(
    initialStatusFromUrl,
  );

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);

    const { data, error: err } = await supabase
      .schema("ecom")
      .from("consignment_intakes")
      .select(
        "id, vendor_account_id, consignor_contact_id, intake_date, status, acknowledged_at, acknowledged_by_vendor, notes, created_at",
      )
      .eq("vendor_account_id", activeAccountId)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const intakes = (data ?? []) as IntakeRow[];
    setRows(intakes);

    if (intakes.length === 0) {
      setContacts(new Map());
      setLotCounts(new Map());
      setLoading(false);
      return;
    }

    const contactIds = Array.from(
      new Set(
        intakes
          .map((i) => i.consignor_contact_id)
          .filter((x): x is string => !!x),
      ),
    );
    const intakeIds = intakes.map((i) => i.id);

    const [contactsRes, lotsRes] = await Promise.all([
      contactIds.length > 0
        ? supabase
            .schema("ecom")
            .from("contacts")
            .select("id, name, email")
            .in("id", contactIds)
        : Promise.resolve({ data: [], error: null } as const),
      supabase
        .schema("ecom")
        .from("inventory_lots")
        .select("consignment_intake_id")
        .in("consignment_intake_id", intakeIds),
    ]);

    const cMap = new Map<string, ContactLite>();
    for (const c of (contactsRes.data ?? []) as ContactLite[]) {
      cMap.set(c.id, c);
    }
    setContacts(cMap);

    const lMap = new Map<string, number>();
    for (const l of (lotsRes.data ?? []) as { consignment_intake_id: string }[]) {
      lMap.set(
        l.consignment_intake_id,
        (lMap.get(l.consignment_intake_id) ?? 0) + 1,
      );
    }
    setLotCounts(lMap);

    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    if (statusFilter === "all") return rows;
    return rows.filter((r) => r.status === statusFilter);
  }, [rows, statusFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Consignment intakes
        </h1>
        <Link
          href={`/${slug}/manage/inventory/receive?mode=consignment`}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
        >
          + New intake
        </Link>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Each intake groups the lots from a single consignor drop-off. Pending
        intakes show what's still awaiting consignor confirmation.
      </p>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <label className="block">
          <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
            Status
          </span>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as typeof statusFilter)
            }
            className="mt-1 block w-56 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            {rows.length === 0
              ? "No consignment intakes yet."
              : "No intakes match the current filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Consignor</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Lots</th>
                  <th className="px-3 py-2 text-left">Acknowledged</th>
                  <th className="px-3 py-2 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((row) => {
                  const contact = row.consignor_contact_id
                    ? contacts.get(row.consignor_contact_id)
                    : null;
                  const lotCount = lotCounts.get(row.id) ?? 0;
                  const needsAttention = row.status === "pending_consignor";
                  return (
                    <tr
                      key={row.id}
                      className={
                        needsAttention
                          ? "bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/50 dark:hover:bg-amber-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }
                    >
                      <td className="px-3 py-3 whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {new Date(row.intake_date).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-3">
                        {contact ? (
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {contact.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {contact.email ?? "no email"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {statusBadge(row.status)}
                          {row.acknowledged_by_vendor && (
                            <span className="text-[10px] text-gray-500 dark:text-gray-400">
                              vendor-attested
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {lotCount}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {row.acknowledged_at
                          ? new Date(row.acknowledged_at).toLocaleString()
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={
                            row.status === "draft"
                              ? `/${slug}/manage/inventory/receive?mode=consignment&draft_id=${row.id}`
                              : `/${slug}/manage/consignment-intakes/${row.id}`
                          }
                          className="text-sm font-medium text-red-500 hover:text-red-600"
                        >
                          {row.status === "draft" ? "Resume" : "Open"}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
