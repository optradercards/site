"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";
import { lineDiscountShareCents } from "@/lib/transactions";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// /[slug]/manage/sales/[id]
//
// View-only detail of a single transaction: customer, trade %, line items
// grouped by side (sold/traded_out and traded_in/bought), payments, and
// cost basis per item from sale_allocations.
// ---------------------------------------------------------------------------

type Side = "sold" | "bought" | "traded_in" | "traded_out";
type Allocation = {
  quantity: number;
  acquisition_cost_cents_snapshot: number | null;
  acquisition_currency_snapshot: string | null;
  consignor_split_pct_snapshot: number | null;
  consignor_chargeback_per_unit_snapshot: number | null;
};

// Effective cost for a single sale_allocation, accounting for consignment
// payout (unit_price * qty * split% − chargeback). Returns null when
// neither path can be computed.
function allocCostCents(a: Allocation, unitPriceCents: number): number | null {
  if (a.consignor_split_pct_snapshot != null) {
    const gross = unitPriceCents * a.quantity;
    const payout = Math.round(gross * Number(a.consignor_split_pct_snapshot) / 100);
    const chargeback = (a.consignor_chargeback_per_unit_snapshot ?? 0) * a.quantity;
    return Math.max(0, payout - chargeback);
  }
  if (a.acquisition_cost_cents_snapshot != null) {
    return a.acquisition_cost_cents_snapshot * a.quantity;
  }
  return null;
}
type Item = {
  id: string;
  side: Side;
  card_product_id: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity: number;
  unit_price_cents: number;
  sale_allocations: Allocation[];
};
type Payment = {
  id: string;
  method: string;
  amount_cents: number;
  currency: string;
  reference: string | null;
  status: string;
  paid_at: string | null;
};
type Tx = {
  id: string;
  type: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  outgoing_subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  notes: string | null;
  buyer_user_id: string | null;
  buyer_contact: { name?: string | null; email?: string | null; phone?: string | null } | null;
  trade_value_pct: number | null;
  source_provider: string | null;
  source_id: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  transaction_items: Item[];
  order_payments: Payment[];
};
type CardLite = {
  id: string;
  name: string | null;
  image_url: string | null;
  card_number: string | null;
};

function sourceLabel(s: string | null): string {
  if (s === null) return "Manual";
  if (s === "csv_import") return "CSV";
  if (s === "shiny_sold") return "Shiny";
  return s;
}

function methodLabel(m: string): string {
  if (m === "cash") return "Cash";
  if (m === "payid_manual") return "PayID";
  if (m === "bank_transfer") return "Bank transfer";
  return m;
}

export default function SaleDetailPage() {
  const supabase = createClient();
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const id = params?.id as string;
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  const [tx, setTx] = useState<Tx | null>(null);
  const [cards, setCards] = useState<Map<string, CardLite>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!tx) return;
    const hasInbound = tx.transaction_items.some(
      (it) => it.side === "traded_in" || it.side === "bought",
    );
    const inboundWarning = hasInbound
      ? "\n\nNote: any inventory lots that were created from trade-in items on this ticket will NOT be removed — delete those from /manage/inventory if needed."
      : "";
    const ok = window.confirm(
      `Delete this sale and restore the inventory it consumed?${inboundWarning}\n\nThis action cannot be undone.`,
    );
    if (!ok) return;
    setDeleting(true);
    setError(null);
    const { error: err } = await supabase
      .schema("ecom")
      .rpc("delete_sale", { p_transaction_id: tx.id });
    if (err) {
      setError(err.message);
      setDeleting(false);
      return;
    }
    router.push(`/${slug}/manage/sales`);
  }, [tx, supabase, router, slug]);

  const load = useCallback(async () => {
    if (!activeAccountId || !id) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .schema("ecom")
      .from("transactions")
      .select(
        `
          id, type, status, currency, subtotal_cents, outgoing_subtotal_cents, discount_cents, total_cents, notes,
          buyer_user_id, buyer_contact, trade_value_pct,
          source_provider, source_id, completed_at, created_at, updated_at,
          transaction_items (
            id, side, card_product_id, grading_service, grade, quantity, unit_price_cents,
            sale_allocations ( quantity, acquisition_cost_cents_snapshot, acquisition_currency_snapshot,
              consignor_split_pct_snapshot, consignor_chargeback_per_unit_snapshot )
          ),
          order_payments ( id, method, amount_cents, currency, reference, status, paid_at )
        `,
      )
      .eq("id", id)
      .eq("account_id", activeAccountId)
      .maybeSingle();
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setError("Sale not found.");
      setLoading(false);
      return;
    }
    const txData = data as unknown as Tx;
    setTx(txData);

    const cardIds = Array.from(
      new Set(
        txData.transaction_items
          .map((i) => i.card_product_id)
          .filter((x): x is string => !!x),
      ),
    );
    if (cardIds.length > 0) {
      const { data: cardRows } = await supabase
        .schema("cards")
        .from("products")
        .select("id, name, image_url, card_number")
        .in("id", cardIds);
      setCards(
        new Map(((cardRows ?? []) as CardLite[]).map((c) => [c.id, c])),
      );
    } else {
      setCards(new Map());
    }
    setLoading(false);
  }, [supabase, activeAccountId, id]);

  useEffect(() => {
    load();
  }, [load]);

  const outbound = useMemo(
    () =>
      tx?.transaction_items.filter(
        (it) => it.side === "sold" || it.side === "traded_out",
      ) ?? [],
    [tx],
  );
  const inbound = useMemo(
    () =>
      tx?.transaction_items.filter(
        (it) => it.side === "traded_in" || it.side === "bought",
      ) ?? [],
    [tx],
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading sale…</div>
      </div>
    );
  }
  if (error || !tx) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
        <p className="text-red-600 dark:text-red-400">{error ?? "Sale not found"}</p>
        <Link
          href={`/${slug}/manage/sales`}
          className="mt-4 inline-block text-sm font-medium text-red-500 hover:text-red-600"
        >
          ← Back to sales
        </Link>
      </div>
    );
  }

  const fmt = (cents: number | null | undefined, txCurrency: string) =>
    formatPrice(cents ?? null, sellerCurrency, rates ?? {}, txCurrency);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <Link
          href={`/${slug}/manage/sales`}
          className="text-sm font-medium text-red-500 hover:text-red-600"
        >
          ← All sales
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">
            {tx.id.slice(0, 8)}
          </span>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-300 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 rounded-md disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete sale"}
          </button>
        </div>
      </div>
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-md p-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <div className="flex items-baseline justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {tx.type === "trade" ? "Trade" : "Sale"}
          </h1>
          <div className="text-right">
            <span className="text-3xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">
              {fmt(tx.total_cents, tx.currency)}
            </span>
            {tx.discount_cents > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 tabular-nums mt-0.5">
                {fmt(tx.subtotal_cents, tx.currency)} subtotal · −
                {fmt(tx.discount_cents, tx.currency)} discount
              </p>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <Stat label="Date">
            {tx.completed_at
              ? new Date(tx.completed_at).toLocaleString()
              : new Date(tx.created_at).toLocaleString()}
          </Stat>
          <Stat label="Status">{tx.status}</Stat>
          <Stat label="Source">{sourceLabel(tx.source_provider)}</Stat>
          {tx.trade_value_pct != null && (
            <Stat label="Trade %">{Number(tx.trade_value_pct).toFixed(0)}%</Stat>
          )}
        </dl>
        {tx.notes && (
          <p className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
            {tx.notes}
          </p>
        )}
      </div>

      {/* Customer */}
      {tx.buyer_contact &&
        (tx.buyer_contact.name || tx.buyer_contact.email || tx.buyer_contact.phone) && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
              Customer
            </h2>
            <dl className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
              {tx.buyer_contact.name && <Stat label="Name">{tx.buyer_contact.name}</Stat>}
              {tx.buyer_contact.email && <Stat label="Email">{tx.buyer_contact.email}</Stat>}
              {tx.buyer_contact.phone && <Stat label="Phone">{tx.buyer_contact.phone}</Stat>}
            </dl>
          </div>
        )}

      {/* Outbound items */}
      {outbound.length > 0 && (
        <ItemSection
          label="Sold to customer"
          tone="out"
          items={outbound}
          cards={cards}
          fmt={fmt}
          txCurrency={tx.currency}
          discountCents={tx.discount_cents}
          outgoingSubtotalCents={tx.outgoing_subtotal_cents}
        />
      )}

      {/* Inbound items */}
      {inbound.length > 0 && (
        <ItemSection
          label="Taken in (trade-in)"
          tone="in"
          items={inbound}
          cards={cards}
          fmt={fmt}
          txCurrency={tx.currency}
          discountCents={tx.discount_cents}
          outgoingSubtotalCents={tx.outgoing_subtotal_cents}
        />
      )}

      {/* Payments */}
      {tx.order_payments.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
            Payments
          </h2>
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {tx.order_payments.map((p) => (
              <li key={p.id} className="py-3 flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    {methodLabel(p.method)}
                    {p.reference && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {p.reference}
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {p.status}
                    {p.paid_at && ` · ${new Date(p.paid_at).toLocaleString()}`}
                  </p>
                </div>
                <span className="text-base font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                  {fmt(p.amount_cents, p.currency)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-0.5">
        {label}
      </dt>
      <dd className="text-sm text-gray-900 dark:text-gray-100">{children}</dd>
    </div>
  );
}

function ItemSection({
  label,
  tone,
  items,
  cards,
  fmt,
  txCurrency,
  discountCents,
  outgoingSubtotalCents,
}: {
  label: string;
  tone: "out" | "in";
  items: Item[];
  cards: Map<string, CardLite>;
  fmt: (cents: number | null | undefined, txCurrency: string) => string;
  txCurrency: string;
  discountCents: number;
  outgoingSubtotalCents: number;
}) {
  const accent =
    tone === "out"
      ? "border-l-4 border-red-300 dark:border-red-700"
      : "border-l-4 border-green-300 dark:border-green-700";
  const subtotal = items.reduce(
    (s, it) => s + it.unit_price_cents * it.quantity,
    0,
  );
  const sectionDiscountAllocated = items.reduce(
    (s, it) =>
      s +
      lineDiscountShareCents(
        it.unit_price_cents,
        it.quantity,
        it.side,
        discountCents,
        outgoingSubtotalCents,
      ),
    0,
  );
  return (
    <section
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${accent} overflow-hidden`}
    >
      <div className="flex items-baseline justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {label}
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
            ({items.length} item{items.length === 1 ? "" : "s"})
          </span>
        </h3>
        <div className="text-right">
          <span className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
            {fmt(subtotal - sectionDiscountAllocated, txCurrency)}
          </span>
          {sectionDiscountAllocated > 0 && (
            <p className="text-[11px] text-amber-700 dark:text-amber-400 tabular-nums">
              {fmt(subtotal, txCurrency)} − {fmt(sectionDiscountAllocated, txCurrency)} discount
            </p>
          )}
        </div>
      </div>
      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {items.map((it) => {
          const card = it.card_product_id ? cards.get(it.card_product_id) : null;
          const lineTotal = it.unit_price_cents * it.quantity;
          const lineDiscountShare = lineDiscountShareCents(
            it.unit_price_cents,
            it.quantity,
            it.side,
            discountCents,
            outgoingSubtotalCents,
          );
          const effectiveLineTotal = lineTotal - lineDiscountShare;
          let costCents: number | null = null;
          for (const a of it.sale_allocations ?? []) {
            const c = allocCostCents(a, it.unit_price_cents);
            if (c != null) {
              costCents = (costCents ?? 0) + c;
            }
          }
          const marginCents =
            costCents != null ? effectiveLineTotal - costCents : null;
          return (
            <li
              key={it.id}
              className="px-5 py-4 flex items-start gap-4"
            >
              <div className="w-14 h-20 shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                {card?.image_url ? (
                  <ZoomableImage
                    src={card.image_url}
                    alt={card.name ?? ""}
                    className="w-full h-full object-cover"
                  />
                ) : null}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                  {card?.name ?? "(unknown card)"}
                </p>
                {card?.card_number && (
                  <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                    #{card.card_number}
                  </p>
                )}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {gradeLabel(it.grading_service, it.grade)} · ×{it.quantity} ·{" "}
                  {fmt(it.unit_price_cents, txCurrency)} each
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {fmt(effectiveLineTotal, txCurrency)}
                </p>
                {lineDiscountShare > 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 tabular-nums">
                    {fmt(lineTotal, txCurrency)} − {fmt(lineDiscountShare, txCurrency)}
                  </p>
                )}
                {costCents != null && marginCents != null && (
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                    cost {fmt(costCents, txCurrency)} ·{" "}
                    <span
                      className={
                        marginCents >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {marginCents >= 0 ? "+" : ""}
                      {fmt(marginCents, txCurrency)}
                    </span>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
