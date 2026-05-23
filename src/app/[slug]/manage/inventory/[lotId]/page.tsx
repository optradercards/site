"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useProfile } from "@/hooks/useProfile";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";
import ProductLink from "@/components/ProductLink";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// Lot detail page — edit acquisition fields, manage group memberships
// ---------------------------------------------------------------------------

const ACQUISITION_SOURCES = [
  "purchase",
  "trade_in",
  "consignment",
  "pack_pull",
  "gift",
  "unknown",
] as const;

type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

type LotRow = {
  id: string;
  account_id: string;
  card_product_id: string | null;
  custom_product_id: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_acquired: number;
  quantity_remaining: number;
  acquisition_cost_cents: number | null;
  acquisition_currency: string;
  acquisition_source: AcquisitionSource;
  acquired_at: string;
  consignor_account_id: string | null;
  consignor_name: string | null;
  consignor_contact: string | null;
  consignor_split_pct: number | null;
  consignor_chargeback_per_unit_cents: number;
  purchase_id: string | null;
  source_lot_id: string | null;
  notes: string | null;
};

type SummaryRow = {
  product_name: string | null;
  image_url: string | null;
  set_name: string | null;
  brand_name: string | null;
  card_number: string | null;
};

type LotStatus = {
  quantity_in_grading: number;
};

type GroupRow = {
  id: string;
  name: string;
  slug: string;
};

type SaleAllocationRow = {
  id: string;
  quantity: number;
  acquisition_cost_cents_snapshot: number | null;
  acquisition_currency_snapshot: string | null;
  created_at: string;
  transaction_item_id: string;
  transaction_items: { transaction_id: string } | null;
};

// Trade-in lots are created by /sell with notes like
// "Trade-in from sell ticket {tx.id} on {date}". Pull the UUID out so we
// can offer a back-link to the source sale.
const UUID_RE =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
function sourceSaleIdFromNotes(notes: string | null): string | null {
  if (!notes) return null;
  const m = notes.match(UUID_RE);
  return m ? m[0] : null;
}

export default function InventoryLotPage() {
  const supabase = createClient();
  const router = useRouter();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const lotId = params?.lotId as string;

  const { data: profileData } = useProfile();
  const { data: exchangeRates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";
  const rates = exchangeRates ?? {};

  const [lot, setLot] = useState<LotRow | null>(null);
  const [summary, setSummary] = useState<SummaryRow | null>(null);
  const [quantityInGrading, setQuantityInGrading] = useState(0);
  const [allGroups, setAllGroups] = useState<GroupRow[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [initialGroups, setInitialGroups] = useState<Set<string>>(new Set());
  const [sales, setSales] = useState<SaleAllocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  // Editable form state
  const [costInput, setCostInput] = useState<string>("");
  const [currency, setCurrency] = useState<string>("AUD");
  const [source, setSource] = useState<AcquisitionSource>("purchase");
  const [notes, setNotes] = useState<string>("");
  const [consignorName, setConsignorName] = useState<string>("");
  const [consignorContact, setConsignorContact] = useState<string>("");
  const [consignorSplit, setConsignorSplit] = useState<string>("");
  const [consignorChargeback, setConsignorChargeback] = useState<string>("");

  const loadData = useCallback(async () => {
    if (!activeAccountId || !lotId) return;
    setLoading(true);

    const { data: lotData, error: lotErr } = await supabase
      .schema("ecom")
      .from("inventory_lots")
      .select("*")
      .eq("id", lotId)
      .eq("account_id", activeAccountId)
      .maybeSingle();

    if (lotErr || !lotData) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const lotRow = lotData as LotRow;
    setLot(lotRow);
    setCostInput(
      lotRow.acquisition_cost_cents != null
        ? (lotRow.acquisition_cost_cents / 100).toFixed(2)
        : "",
    );
    setCurrency(lotRow.acquisition_currency);
    setSource(lotRow.acquisition_source);
    setNotes(lotRow.notes ?? "");
    setConsignorName(lotRow.consignor_name ?? "");
    setConsignorContact(lotRow.consignor_contact ?? "");
    setConsignorSplit(
      lotRow.consignor_split_pct != null ? String(lotRow.consignor_split_pct) : "",
    );
    setConsignorChargeback(
      lotRow.consignor_chargeback_per_unit_cents
        ? (lotRow.consignor_chargeback_per_unit_cents / 100).toFixed(2)
        : "",
    );

    const [summaryRes, statusRes, groupsRes, linksRes, salesRes] = await Promise.all([
      supabase
        .schema("ecom")
        .from("vendor_inventory_summary")
        .select("product_name, image_url, set_name, brand_name, card_number")
        .eq("lot_id", lotId)
        .maybeSingle(),
      supabase
        .schema("ecom")
        .from("inventory_lot_status")
        .select("quantity_in_grading")
        .eq("lot_id", lotId)
        .maybeSingle(),
      supabase
        .schema("ecom")
        .from("inventory_groups")
        .select("id, name, slug")
        .eq("account_id", activeAccountId)
        .order("sort_order")
        .order("name"),
      supabase
        .schema("ecom")
        .from("inventory_group_items")
        .select("group_id")
        .eq("lot_id", lotId),
      supabase
        .schema("ecom")
        .from("sale_allocations")
        .select(
          "id, quantity, acquisition_cost_cents_snapshot, acquisition_currency_snapshot, created_at, transaction_item_id, " +
            "transaction_items!inner ( transaction_id )",
        )
        .eq("lot_id", lotId)
        .order("created_at", { ascending: false }),
    ]);

    setSummary((summaryRes.data ?? null) as SummaryRow | null);
    setQuantityInGrading(((statusRes.data ?? null) as LotStatus | null)?.quantity_in_grading ?? 0);
    setAllGroups((groupsRes.data ?? []) as GroupRow[]);

    const linkSet = new Set<string>(
      ((linksRes.data ?? []) as { group_id: string }[]).map((l) => l.group_id),
    );
    setSelectedGroups(linkSet);
    setInitialGroups(new Set(linkSet));

    setSales((salesRes.data ?? []) as SaleAllocationRow[]);

    setLoading(false);
  }, [supabase, activeAccountId, lotId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleGroup = (gid: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(gid)) next.delete(gid);
      else next.add(gid);
      return next;
    });
  };

  const handleSave = async () => {
    if (!lot || !activeAccountId) return;
    setSaving(true);
    setError(null);

    try {
      const costCents = costInput.trim()
        ? Math.round(parseFloat(costInput) * 100)
        : null;
      if (costInput.trim() && (costCents == null || isNaN(costCents) || costCents < 0)) {
        throw new Error("Invalid cost value");
      }

      const updates: Partial<LotRow> = {
        acquisition_cost_cents: costCents,
        acquisition_currency: currency,
        acquisition_source: source,
        notes: notes.trim() || null,
      };

      if (source === "consignment") {
        const split = parseFloat(consignorSplit);
        if (isNaN(split) || split < 0 || split > 100) {
          throw new Error("Consignor split must be between 0 and 100");
        }
        updates.consignor_name = consignorName.trim() || null;
        updates.consignor_contact = consignorContact.trim() || null;
        updates.consignor_split_pct = split;
        updates.consignor_chargeback_per_unit_cents = consignorChargeback.trim()
          ? Math.round(parseFloat(consignorChargeback) * 100)
          : 0;
      } else {
        updates.consignor_name = null;
        updates.consignor_contact = null;
        updates.consignor_split_pct = null;
        updates.consignor_chargeback_per_unit_cents = 0;
      }

      const { error: updErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .update(updates)
        .eq("id", lot.id);

      if (updErr) throw updErr;

      // Group memberships
      const toAdd = [...selectedGroups].filter((g) => !initialGroups.has(g));
      const toRemove = [...initialGroups].filter((g) => !selectedGroups.has(g));

      if (toAdd.length > 0) {
        const rows = toAdd.map((group_id) => ({ group_id, lot_id: lot.id }));
        const { error: insErr } = await supabase
          .schema("ecom")
          .from("inventory_group_items")
          .insert(rows);
        if (insErr) throw insErr;
      }

      for (const gid of toRemove) {
        const { error: delErr } = await supabase
          .schema("ecom")
          .from("inventory_group_items")
          .delete()
          .eq("group_id", gid)
          .eq("lot_id", lot.id);
        if (delErr) throw delErr;
      }

      await loadData();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const fmtSnapshot = useMemo(
    () => (cents: number | null, src: string | null) =>
      formatPrice(cents ?? null, sellerCurrency, rates, (src ?? sellerCurrency).toUpperCase()),
    [sellerCurrency, rates],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading lot...</div>
      </div>
    );
  }

  if (notFound || !lot) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <p className="text-gray-700 dark:text-gray-300">Lot not found.</p>
        <Link
          href={`/${slug}/manage/inventory`}
          className="inline-block mt-4 text-sm font-medium text-red-500 hover:text-red-600"
        >
          &larr; Back to inventory
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <button
          onClick={() => router.push(`/${slug}/manage/inventory`)}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to inventory
        </button>
      </div>

      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-start gap-4">
          {summary?.image_url ? (
            <ZoomableImage
              src={summary.image_url}
              alt={summary.product_name ?? ""}
              className="w-20 h-28 object-contain rounded"
            />
          ) : (
            <div className="w-20 h-28 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
              {"—"}
            </div>
          )}
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              <ProductLink cardProductId={lot.card_product_id} showIcon>
                {summary?.product_name ?? "Lot"}
              </ProductLink>
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {[summary?.set_name, summary?.brand_name, summary?.card_number ? `#${summary.card_number}` : null]
                .filter(Boolean)
                .join(" · ") || "Custom product"}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {gradeLabel(lot.grading_service, lot.grade)}
            </p>
          </div>
        </div>

        {/* Derived stats */}
        <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="Qty acquired" value={String(lot.quantity_acquired)} />
          <Stat label="Qty remaining" value={String(lot.quantity_remaining)} />
          <Stat label="In grading" value={String(quantityInGrading)} />
          <Stat label="Acquired" value={new Date(lot.acquired_at).toLocaleDateString()} />
        </dl>

        {(lot.purchase_id ||
          lot.source_lot_id ||
          sourceSaleIdFromNotes(lot.notes)) && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm">
            {lot.purchase_id && (
              <Link
                href={`/${slug}/manage/inventory?purchase_id=${lot.purchase_id}`}
                className="text-red-500 hover:text-red-600"
              >
                View purchase batch &rarr;
              </Link>
            )}
            {lot.source_lot_id && (
              <Link
                href={`/${slug}/manage/inventory/${lot.source_lot_id}`}
                className="text-red-500 hover:text-red-600"
              >
                View source lot (pre-grading) &rarr;
              </Link>
            )}
            {(() => {
              const sourceSaleId = sourceSaleIdFromNotes(lot.notes);
              if (!sourceSaleId) return null;
              return (
                <Link
                  href={`/${slug}/manage/sales/${sourceSaleId}`}
                  className="text-red-500 hover:text-red-600"
                  title="The sale this lot was created on"
                >
                  View source sale &rarr;
                </Link>
              );
            })()}
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Acquisition
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Cost per unit">
            <input
              type="number"
              step="0.01"
              min="0"
              value={costInput}
              onChange={(e) => setCostInput(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Currency">
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              {SUPPORTED_CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as AcquisitionSource)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              {ACQUISITION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div className="mt-4">
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
        </div>

        {/* Consignment fields */}
        {source === "consignment" && (
          <div className="mt-6 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Consignment
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Consignor name">
                <input
                  type="text"
                  value={consignorName}
                  onChange={(e) => setConsignorName(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
              </Field>
              <Field label="Consignor contact">
                <input
                  type="text"
                  value={consignorContact}
                  onChange={(e) => setConsignorContact(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
              </Field>
              <Field label="Consignor split %">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={consignorSplit}
                  onChange={(e) => setConsignorSplit(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
              </Field>
              <Field label="Chargeback per unit">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={consignorChargeback}
                  onChange={(e) => setConsignorChargeback(e.target.value)}
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Group memberships */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Groups
        </h2>
        {allGroups.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No groups yet.{" "}
            <Link href={`/${slug}/manage/groups`} className="text-red-500 hover:text-red-600">
              Create one
            </Link>
            .
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {allGroups.map((g) => (
              <label key={g.id} className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedGroups.has(g.id)}
                  onChange={() => toggleGroup(g.id)}
                  className="rounded text-red-500 focus:ring-red-500"
                />
                <span className="text-gray-700 dark:text-gray-300">{g.name}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Sale history */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Sale history
        </h2>
        {sales.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No sales from this lot yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Cost snapshot</th>
                  <th className="px-3 py-2">Txn item</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sales.map((s) => (
                  <tr key={s.id}>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-200">
                      {new Date(s.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {s.quantity}
                    </td>
                    <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {fmtSnapshot(s.acquisition_cost_cents_snapshot, s.acquisition_currency_snapshot)}
                    </td>
                    <td className="px-3 py-2 text-xs font-mono">
                      {s.transaction_items?.transaction_id ? (
                        <Link
                          href={`/${slug}/manage/sales/${s.transaction_items.transaction_id}`}
                          className="text-red-500 hover:text-red-600"
                          title="Open the sale"
                        >
                          sale {s.transaction_items.transaction_id.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="text-gray-500 dark:text-gray-400">
                          {s.transaction_item_id.slice(0, 8)}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Save bar */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Link
          href={`/${slug}/manage/inventory`}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Cancel
        </Link>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-gray-100">
        {value}
      </dd>
    </div>
  );
}
