"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { SUPPORTED_CURRENCIES, formatPrice } from "@/lib/currency";
import {
  CardPicker,
  type CardOption,
  type CardPickerHandle,
  type MarketSnapshot,
  type PickedCard,
} from "./card-picker";
import {
  ContactPicker,
  LinkStatusBadge,
  type ContactRow,
} from "./contact-picker";
import { resolveMarketValue, type MarketData } from "@/lib/pricing";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import ProductLink from "@/components/ProductLink";

// ---------------------------------------------------------------------------
// Receive Inventory hub — three modes (Purchase / Consignment / Quick Add)
// that all funnel into ecom.inventory_lots.
// ---------------------------------------------------------------------------

type Mode = "purchase" | "consignment" | "quick";

const ACQUISITION_SOURCES = [
  "purchase",
  "trade_in",
  "consignment",
  "pack_pull",
  "gift",
  "unknown",
] as const;
type AcquisitionSource = (typeof ACQUISITION_SOURCES)[number];

type AllocationMethod = "pro_rata_value" | "equal" | "by_quantity";

const GRADING_SERVICES = ["ungraded", "psa", "bgs", "cgc", "sgc"] as const;
type GradingService = (typeof GRADING_SERVICES)[number];

type CustomDraft = {
  name: string;
  set_label: string;
  brand_label: string;
  image_url: string;
};

type LineItem = {
  key: string;
  cardKind: "card" | "custom";
  cardProductId: string | null;
  customDraft: CustomDraft | null;
  cardName: string;
  imageUrl: string | null;
  market: MarketSnapshot | null;
  gradingService: GradingService;
  grade: string;
  quantity: number;
  unitCostInput: string; // only used by purchase mode
  source: AcquisitionSource; // only used by purchase mode
};

// Build a MarketData-shaped object from a MarketSnapshot so resolveMarketValue
// (defined in lib/pricing for the catalog flow) can be reused.
function marketDataFromSnapshot(
  cardId: string,
  m: MarketSnapshot | null,
): MarketData | undefined {
  if (!m) return undefined;
  return { product_id: cardId, ...m };
}

function lineMarketUsdCents(line: LineItem): number | null {
  if (!line.market || !line.cardProductId) return null;
  const md = marketDataFromSnapshot(line.cardProductId, line.market);
  return resolveMarketValue(md, line.gradingService, line.grade || null);
}

function uniqueKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function parseCents(input: string): number {
  const v = parseFloat(input);
  if (isNaN(v) || v < 0) return 0;
  return Math.round(v * 100);
}

// Mirrors purchases/new — allocates an extra cents bucket per line item.
function allocate(
  lines: { unitCostCents: number; quantity: number }[],
  shippingCents: number,
  method: AllocationMethod,
): number[] {
  const lineSubtotals = lines.map((l) => l.unitCostCents * l.quantity);
  const totalSubtotal = lineSubtotals.reduce((a, b) => a + b, 0);
  const totalUnits = lines.reduce((a, b) => a + b.quantity, 0);
  const numLots = lines.length;

  if (shippingCents <= 0 || numLots === 0) {
    return lines.map((l) => l.unitCostCents);
  }

  return lines.map((l, i) => {
    if (l.quantity <= 0) return l.unitCostCents;
    let share = 0;
    if (method === "pro_rata_value") {
      share =
        totalSubtotal > 0
          ? Math.round((shippingCents * lineSubtotals[i]) / totalSubtotal)
          : Math.round(shippingCents / numLots);
    } else if (method === "equal") {
      share = Math.round(shippingCents / numLots);
    } else {
      share =
        totalUnits > 0
          ? Math.round((shippingCents / totalUnits) * l.quantity)
          : 0;
    }
    const totalLineCost = l.unitCostCents * l.quantity + share;
    return Math.round(totalLineCost / l.quantity);
  });
}

function newLine(picked: PickedCard, source: AcquisitionSource = "purchase"): LineItem {
  if (picked.kind === "custom") {
    return {
      key: uniqueKey(),
      cardKind: "custom",
      cardProductId: null,
      customDraft: { name: "", set_label: "", brand_label: "", image_url: "" },
      cardName: "",
      imageUrl: null,
      market: null,
      gradingService: "ungraded",
      grade: "",
      quantity: 1,
      unitCostInput: "0",
      source,
    };
  }
  const c = picked.card;
  const market: MarketSnapshot = {
    price_ungraded: c.price_ungraded,
    price_psa_1: c.price_psa_1,
    price_psa_2: c.price_psa_2,
    price_psa_3: c.price_psa_3,
    price_psa_4: c.price_psa_4,
    price_psa_5: c.price_psa_5,
    price_psa_6: c.price_psa_6,
    price_psa_7: c.price_psa_7,
    price_psa_8: c.price_psa_8,
    price_psa_9: c.price_psa_9,
    price_psa_10: c.price_psa_10,
    price_psa_9_5: c.price_psa_9_5,
    price_bgs: c.price_bgs,
    price_cgc: c.price_cgc,
  };
  return {
    key: uniqueKey(),
    cardKind: "card",
    cardProductId: picked.card.id,
    customDraft: null,
    cardName: picked.card.name,
    imageUrl: picked.card.image_url,
    market,
    gradingService: "ungraded",
    grade: "",
    quantity: 1,
    unitCostInput: "0",
    source,
  };
}

export default function ReceiveInventoryPage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;
  const searchParams = useSearchParams();
  const modeParam = (searchParams?.get("mode") ?? "purchase") as Mode;
  const mode: Mode =
    modeParam === "consignment" || modeParam === "quick" ? modeParam : "purchase";

  const setMode = (next: Mode) => {
    router.replace(`/${slug}/manage/inventory/receive?mode=${next}`);
  };

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/${slug}/manage/inventory`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to inventory
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Receive inventory
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Bring new lots into inventory — purchases, consignment intake, or a single quick add.
      </p>

      {/* Mode tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6 flex gap-1">
        {([
          { key: "purchase", label: "Purchase", hint: "Multi-item buy with shipping/fees" },
          { key: "consignment", label: "Consignment", hint: "Bulk intake from one consignor" },
          { key: "quick", label: "Quick Add", hint: "Single card, fast" },
        ] as const).map((t) => {
          const active = mode === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setMode(t.key)}
              className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium transition-colors ${
                active
                  ? "border-red-500 text-red-600 dark:text-red-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              }`}
              title={t.hint}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {mode === "purchase" && <PurchaseMode slug={slug} />}
      {mode === "consignment" && <ConsignmentMode slug={slug} />}
      {mode === "quick" && <QuickAddMode slug={slug} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared subcomponents
// ---------------------------------------------------------------------------

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

function CustomProductFields({
  draft,
  onChange,
}: {
  draft: CustomDraft;
  onChange: (d: CustomDraft) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 p-3 rounded-md bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/40">
      <Field label="Custom name *">
        <input
          type="text"
          value={draft.name}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
        />
      </Field>
      <Field label="Set label">
        <input
          type="text"
          value={draft.set_label}
          onChange={(e) => onChange({ ...draft, set_label: e.target.value })}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
        />
      </Field>
      <Field label="Brand label">
        <input
          type="text"
          value={draft.brand_label}
          onChange={(e) => onChange({ ...draft, brand_label: e.target.value })}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
        />
      </Field>
      <Field label="Image URL">
        <input
          type="text"
          value={draft.image_url}
          onChange={(e) => onChange({ ...draft, image_url: e.target.value })}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PURCHASE MODE — mirrors the legacy /manage/purchases/new logic exactly.
// ---------------------------------------------------------------------------

function PurchaseMode({ slug }: { slug: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { activeAccountId } = useAccounts();
  const { data: rates } = useExchangeRates();

  const today = new Date().toISOString().slice(0, 10);
  const [purchasedAt, setPurchasedAt] = useState<string>(today);
  const [currency, setCurrency] = useState<string>("AUD");
  const [invoiceRef, setInvoiceRef] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [notes, setNotes] = useState("");
  const [allocationMethod, setAllocationMethod] = useState<AllocationMethod>("pro_rata_value");
  const [shippingInput, setShippingInput] = useState("0");
  const [feesInput, setFeesInput] = useState("0");

  const [lines, setLines] = useState<LineItem[]>([]);
  const pickerRef = useRef<CardPickerHandle | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onPick = useCallback((picked: PickedCard) => {
    setLines((prev) => [...prev, newLine(picked, "purchase")]);
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);
  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const shippingCents = parseCents(shippingInput);
  const feesCents = parseCents(feesInput);

  const computedLines = useMemo(
    () =>
      lines.map((l) => ({
        unitCostCents: parseCents(l.unitCostInput),
        quantity: l.quantity,
      })),
    [lines],
  );

  const subtotalCents = useMemo(
    () => computedLines.reduce((sum, l) => sum + l.unitCostCents * l.quantity, 0),
    [computedLines],
  );

  const allocatedShippingPerUnit = useMemo(
    () => allocate(computedLines, shippingCents, allocationMethod),
    [computedLines, shippingCents, allocationMethod],
  );
  const allocatedFeesPerUnit = useMemo(
    () => allocate(computedLines, feesCents, allocationMethod),
    [computedLines, feesCents, allocationMethod],
  );

  const allocatedPerUnit = useMemo(() => {
    return computedLines.map((l, i) => {
      const shippingShare = allocatedShippingPerUnit[i] - l.unitCostCents;
      const feesShare = allocatedFeesPerUnit[i] - l.unitCostCents;
      return l.unitCostCents + Math.max(0, shippingShare) + Math.max(0, feesShare);
    });
  }, [computedLines, allocatedShippingPerUnit, allocatedFeesPerUnit]);

  const totalCents = subtotalCents + shippingCents + feesCents;

  const canSubmit =
    !submitting &&
    activeAccountId !== null &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        (l.cardKind === "card" && !!l.cardProductId) ||
        (l.cardKind === "custom" && !!l.customDraft && !!l.customDraft.name.trim()),
    ) &&
    lines.every((l) => l.quantity > 0);

  const submit = async () => {
    if (!canSubmit || !activeAccountId) return;
    setSubmitting(true);
    setError(null);

    try {
      const purchasedAtIso = new Date(purchasedAt).toISOString();
      const { data: purchase, error: pErr } = await supabase
        .schema("ecom")
        .from("purchases")
        .insert({
          account_id: activeAccountId,
          purchased_at: purchasedAtIso,
          subtotal_cents: subtotalCents,
          shipping_cents: shippingCents,
          fees_cents: feesCents,
          total_cents: totalCents,
          purchase_currency: currency,
          allocation_method: allocationMethod,
          vendor_invoice_ref: invoiceRef.trim() || null,
          receipt_url: receiptUrl.trim() || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();
      if (pErr || !purchase) throw pErr ?? new Error("Failed to create purchase");

      const customIdByKey = new Map<string, string>();
      const customLines = lines.filter((l) => l.cardKind === "custom" && l.customDraft);
      if (customLines.length > 0) {
        const customInsertRows = customLines.map((l) => ({
          account_id: activeAccountId,
          name: l.customDraft!.name,
          set_label: l.customDraft!.set_label || null,
          brand_label: l.customDraft!.brand_label || null,
          image_url: l.customDraft!.image_url || null,
        }));
        const { data: customRows, error: cErr } = await supabase
          .schema("ecom")
          .from("custom_products")
          .insert(customInsertRows)
          .select("id");
        if (cErr || !customRows) throw cErr ?? new Error("Failed to create custom products");
        customLines.forEach((l, idx) => {
          customIdByKey.set(l.key, (customRows as { id: string }[])[idx].id);
        });
      }

      const lotRows = lines.map((l, i) => {
        const perUnit = allocatedPerUnit[i];
        return {
          account_id: activeAccountId,
          card_product_id: l.cardKind === "card" ? l.cardProductId : null,
          custom_product_id:
            l.cardKind === "custom" ? customIdByKey.get(l.key) ?? null : null,
          grading_service: l.gradingService,
          grade: l.grade.trim() || null,
          quantity_acquired: l.quantity,
          quantity_remaining: l.quantity,
          acquisition_cost_cents: perUnit,
          acquisition_currency: currency,
          acquisition_source: l.source,
          acquired_at: purchasedAtIso,
          purchase_id: purchase.id,
        };
      });

      const { error: lErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .insert(lotRows);
      if (lErr) throw lErr;

      router.push(`/${slug}/manage/purchases`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Top form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Purchase details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Purchased at">
            <input
              type="date"
              value={purchasedAt}
              onChange={(e) => setPurchasedAt(e.target.value)}
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
          <Field label="Allocation method">
            <select
              value={allocationMethod}
              onChange={(e) => setAllocationMethod(e.target.value as AllocationMethod)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="pro_rata_value">Pro-rata by value</option>
              <option value="equal">Equal per lot</option>
              <option value="by_quantity">By quantity (per unit)</option>
            </select>
          </Field>
          <Field label="Vendor invoice ref">
            <input
              type="text"
              value={invoiceRef}
              onChange={(e) => setInvoiceRef(e.target.value)}
              placeholder="Order #12345"
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Receipt URL">
            <input
              type="text"
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              placeholder="https://..."
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Notes">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Line items
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Type to search, &uarr;/&darr; to navigate, Enter to add
          </span>
        </div>

        <div className="mb-4">
          <CardPicker ref={pickerRef} onPick={onPick} autoFocus />
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No line items yet. Use the search above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-left">Grading</th>
                  <th className="px-2 py-2 text-left">Grade</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Market</th>
                  <th className="px-2 py-2 text-right">Unit cost</th>
                  <th className="px-2 py-2 text-left">Source</th>
                  <th className="px-2 py-2 text-right">Allocated / unit</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map((l, i) => {
                  const marketUsd = lineMarketUsdCents(l);
                  return (
                  <tr key={l.key} className="align-top">
                    <td className="px-2 py-2">
                      <ProductCell line={l} onChange={(d) => updateLine(l.key, { customDraft: d, cardName: d.name, imageUrl: d.image_url || null })} />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={l.gradingService}
                        onChange={(e) =>
                          updateLine(l.key, { gradingService: e.target.value as GradingService })
                        }
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      >
                        {GRADING_SERVICES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={l.grade}
                        onChange={(e) => updateLine(l.key, { grade: e.target.value })}
                        disabled={l.gradingService === "ungraded"}
                        placeholder={l.gradingService === "ungraded" ? "" : "10"}
                        className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(l.key, {
                            quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {marketUsd != null ? (
                        <div className="leading-tight">
                          <div>{formatPrice(marketUsd, currency, rates ?? {}, "USD")}</div>
                          {l.quantity > 1 && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              × {l.quantity} ={" "}
                              {formatPrice(
                                marketUsd * l.quantity,
                                currency,
                                rates ?? {},
                                "USD",
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={l.unitCostInput}
                        onChange={(e) => updateLine(l.key, { unitCostInput: e.target.value })}
                        className="w-24 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={l.source}
                        onChange={(e) =>
                          updateLine(l.key, { source: e.target.value as AcquisitionSource })
                        }
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      >
                        {ACQUISITION_SOURCES.map((s) => (
                          <option key={s} value={s}>
                            {s.replace(/_/g, " ")}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatPrice(allocatedPerUnit[i] ?? 0, currency, {}, currency)}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => removeLine(l.key)}
                        className="text-gray-400 hover:text-red-500 text-lg"
                        aria-label="Remove row"
                      >
                        &times;
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

      {/* Shipping/fees + totals */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <Field label="Shipping (purchase currency)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={shippingInput}
                onChange={(e) => setShippingInput(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
              />
            </Field>
            <Field label="Fees (purchase currency)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={feesInput}
                onChange={(e) => setFeesInput(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
              />
            </Field>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Subtotal</span>
              <span className="text-gray-900 dark:text-gray-100 tabular-nums">
                {formatPrice(subtotalCents, currency, {}, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">+ Shipping</span>
              <span className="text-gray-900 dark:text-gray-100 tabular-nums">
                {formatPrice(shippingCents, currency, {}, currency)}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">+ Fees</span>
              <span className="text-gray-900 dark:text-gray-100 tabular-nums">
                {formatPrice(feesCents, currency, {}, currency)}
              </span>
            </div>
            <div className="flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-2">
              <span className="text-gray-700 dark:text-gray-200">Total</span>
              <span className="text-gray-900 dark:text-gray-100 tabular-nums">
                {formatPrice(totalCents, currency, {}, currency)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-3">
        <Link
          href={`/${slug}/manage/purchases`}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Cancel
        </Link>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Save purchase"}
        </button>
      </div>
    </div>
  );
}

// Tiny cell that either shows the picked card or shows the custom-product
// inline fields when the line was created via the "+ Custom product" path.
function ProductCell({
  line,
  onChange,
}: {
  line: LineItem;
  onChange: (d: CustomDraft) => void;
}) {
  if (line.cardKind === "card") {
    return (
      <div className="flex items-center gap-2 min-w-[14rem]">
        {line.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={line.imageUrl}
            alt={line.cardName}
            className="w-8 h-11 object-contain rounded shrink-0"
          />
        ) : (
          <div className="w-8 h-11 bg-gray-200 dark:bg-gray-600 rounded shrink-0" />
        )}
        <ProductLink
          cardProductId={line.cardProductId}
          showIcon
          className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2"
        >
          {line.cardName}
        </ProductLink>
      </div>
    );
  }
  return (
    <div className="min-w-[18rem]">
      <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">
        Custom product
      </p>
      <CustomProductFields
        draft={
          line.customDraft ?? { name: "", set_label: "", brand_label: "", image_url: "" }
        }
        onChange={onChange}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// CONSIGNMENT MODE — one consignor, many lots, no parent purchase row.
// ---------------------------------------------------------------------------

// Shape of the draft_form jsonb on consignment_intakes.
type ConsignmentDraftForm = {
  splitPct: string;
  chargebackInput: string;
  lines: {
    key: string;
    cardKind: "card" | "custom";
    cardProductId: string | null;
    customDraft: CustomDraft | null;
    gradingService: GradingService;
    grade: string;
    quantity: number;
  }[];
};

function ConsignmentMode({ slug }: { slug: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const searchParams = useSearchParams();
  const draftIdFromUrl = searchParams?.get("draft_id") ?? null;
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  // Tracks the intake row we're editing. Null = brand new consignment.
  // Non-null = either a draft we're resuming, or a draft we just saved.
  const [draftId, setDraftId] = useState<string | null>(draftIdFromUrl);
  const [hydrating, setHydrating] = useState<boolean>(!!draftIdFromUrl);
  const [savingDraft, setSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<Date | null>(null);

  const today = new Date().toISOString().slice(0, 10);
  const [acquiredAt, setAcquiredAt] = useState<string>(today);
  const [notes, setNotes] = useState("");
  const [splitPct, setSplitPct] = useState<string>("70");
  const [chargebackInput, setChargebackInput] = useState<string>("0");

  // Consignor — single contact selected from the vendor's CRM.
  const [selectedContact, setSelectedContact] = useState<ContactRow | null>(null);

  // Confirmation method — defaults to "email" when contact has an email,
  // "vendor_attest" otherwise. User can flip either way.
  const [confirmationMode, setConfirmationMode] = useState<
    "email" | "vendor_attest"
  >("email");

  // Line items
  const [lines, setLines] = useState<LineItem[]>([]);
  const pickerRef = useRef<CardPickerHandle | null>(null);

  const onPick = useCallback((picked: PickedCard) => {
    setLines((prev) => [...prev, newLine(picked, "consignment")]);
  }, []);

  const updateLine = useCallback((key: string, patch: Partial<LineItem>) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }, []);
  const removeLine = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-default confirmation mode whenever the contact changes.
  useEffect(() => {
    if (!selectedContact) return;
    setConfirmationMode(selectedContact.email ? "email" : "vendor_attest");
  }, [selectedContact]);

  // Resume from a saved draft: load the intake + contact + product details
  // and hydrate the form. Runs once per draftIdFromUrl.
  useEffect(() => {
    if (!draftIdFromUrl || !activeAccountId) return;
    let cancelled = false;
    (async () => {
      setHydrating(true);
      const { data: intake } = await supabase
        .schema("ecom")
        .from("consignment_intakes")
        .select(
          "id, status, intake_date, notes, consignor_contact_id, draft_form",
        )
        .eq("id", draftIdFromUrl)
        .eq("vendor_account_id", activeAccountId)
        .maybeSingle();
      if (cancelled || !intake) {
        if (!cancelled) setHydrating(false);
        return;
      }
      if (intake.status !== "draft") {
        // Past the draft stage — bounce to detail page rather than re-edit.
        router.replace(
          `/${slug}/manage/consignment-intakes/${draftIdFromUrl}`,
        );
        return;
      }

      const form = (intake.draft_form ?? {}) as Partial<ConsignmentDraftForm>;

      // Fetch the consignor contact
      if (intake.consignor_contact_id) {
        const { data: c } = await supabase
          .schema("ecom")
          .from("contacts")
          .select(
            "id, name, email, phone, link_status, linked_account_id",
          )
          .eq("id", intake.consignor_contact_id)
          .maybeSingle();
        if (!cancelled && c) setSelectedContact(c as ContactRow);
      }

      // Restore top-level fields
      if (intake.intake_date) {
        const d = new Date(intake.intake_date as string);
        if (!cancelled) setAcquiredAt(d.toISOString().slice(0, 10));
      }
      if (!cancelled) setNotes((intake.notes as string) ?? "");
      if (!cancelled && form.splitPct != null) setSplitPct(form.splitPct);
      if (!cancelled && form.chargebackInput != null)
        setChargebackInput(form.chargebackInput);

      // Restore line items. For card lines we need to fetch product details
      // to repopulate the name / image / market snapshot.
      const formLines = form.lines ?? [];
      const cardIds = formLines
        .filter((l) => l.cardKind === "card" && l.cardProductId)
        .map((l) => l.cardProductId as string);
      const productById = new Map<string, CardOption>();
      if (cardIds.length > 0) {
        const { data: products } = await supabase
          .schema("cards")
          .from("products_with_details")
          .select(
            "id, name, image_url, set_name, card_number, rarity," +
              "price_ungraded, price_psa_1, price_psa_2, price_psa_3, price_psa_4," +
              "price_psa_5, price_psa_6, price_psa_7, price_psa_8, price_psa_9," +
              "price_psa_10, price_psa_9_5, price_bgs, price_cgc",
          )
          .in("id", cardIds);
        for (const p of (products ?? []) as unknown as CardOption[]) {
          productById.set(p.id, p);
        }
      }

      if (cancelled) return;

      const hydratedLines: LineItem[] = formLines.map((saved) => {
        if (saved.cardKind === "custom") {
          return {
            key: saved.key,
            cardKind: "custom",
            cardProductId: null,
            customDraft: saved.customDraft ?? {
              name: "",
              set_label: "",
              brand_label: "",
              image_url: "",
            },
            cardName: saved.customDraft?.name ?? "",
            imageUrl: saved.customDraft?.image_url || null,
            market: null,
            gradingService: saved.gradingService,
            grade: saved.grade,
            quantity: saved.quantity,
            unitCostInput: "0",
            source: "consignment",
          };
        }
        const p = saved.cardProductId
          ? productById.get(saved.cardProductId)
          : undefined;
        return {
          key: saved.key,
          cardKind: "card",
          cardProductId: saved.cardProductId,
          customDraft: null,
          cardName: p?.name ?? "(card not found)",
          imageUrl: p?.image_url ?? null,
          market: p
            ? {
                price_ungraded: p.price_ungraded,
                price_psa_1: p.price_psa_1,
                price_psa_2: p.price_psa_2,
                price_psa_3: p.price_psa_3,
                price_psa_4: p.price_psa_4,
                price_psa_5: p.price_psa_5,
                price_psa_6: p.price_psa_6,
                price_psa_7: p.price_psa_7,
                price_psa_8: p.price_psa_8,
                price_psa_9: p.price_psa_9,
                price_psa_10: p.price_psa_10,
                price_psa_9_5: p.price_psa_9_5,
                price_bgs: p.price_bgs,
                price_cgc: p.price_cgc,
              }
            : null,
          gradingService: saved.gradingService,
          grade: saved.grade,
          quantity: saved.quantity,
          unitCostInput: "0",
          source: "consignment",
        };
      });
      setLines(hydratedLines);
      setHydrating(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, draftIdFromUrl, activeAccountId, router, slug]);

  const splitPctNum = parseFloat(splitPct);
  const chargebackCents = parseCents(chargebackInput);

  const consignorOk = selectedContact !== null;

  const canSubmit =
    !submitting &&
    activeAccountId !== null &&
    consignorOk &&
    !isNaN(splitPctNum) &&
    splitPctNum >= 0 &&
    splitPctNum <= 100 &&
    lines.length > 0 &&
    lines.every(
      (l) =>
        (l.cardKind === "card" && !!l.cardProductId) ||
        (l.cardKind === "custom" && !!l.customDraft && !!l.customDraft.name.trim()),
    ) &&
    lines.every((l) => l.quantity > 0);

  // Drafts can be saved with looser requirements than a real submit — anything
  // typed counts. The vendor just has to have an active account.
  const canSaveDraft = !savingDraft && !submitting && activeAccountId !== null;

  const buildDraftForm = (): ConsignmentDraftForm => ({
    splitPct,
    chargebackInput,
    lines: lines.map((l) => ({
      key: l.key,
      cardKind: l.cardKind,
      cardProductId: l.cardProductId,
      customDraft: l.customDraft,
      gradingService: l.gradingService,
      grade: l.grade,
      quantity: l.quantity,
    })),
  });

  const saveDraft = async () => {
    if (!canSaveDraft || !activeAccountId) return;
    setSavingDraft(true);
    setError(null);
    try {
      const acquiredAtIso = new Date(acquiredAt).toISOString();
      const payload = {
        vendor_account_id: activeAccountId,
        consignor_contact_id: selectedContact?.id ?? null,
        intake_date: acquiredAtIso,
        status: "draft" as const,
        notes: notes.trim() || null,
        draft_form: buildDraftForm() as unknown as Record<string, unknown>,
      };
      if (draftId) {
        const { error: e } = await supabase
          .schema("ecom")
          .from("consignment_intakes")
          .update(payload)
          .eq("id", draftId);
        if (e) throw e;
      } else {
        const { data, error: e } = await supabase
          .schema("ecom")
          .from("consignment_intakes")
          .insert(payload)
          .select("id")
          .single();
        if (e || !data) throw e ?? new Error("Failed to save draft");
        setDraftId((data as { id: string }).id);
      }
      setDraftSavedAt(new Date());
    } catch (e) {
      console.error("Save draft failed:", e);
      const msg =
        e instanceof Error
          ? e.message
          : typeof e === "object" && e && "message" in e
            ? String((e as { message: unknown }).message)
            : "Failed to save draft";
      setError(`Save draft: ${msg}`);
    } finally {
      setSavingDraft(false);
    }
  };

  const discardDraft = async () => {
    if (!draftId) return;
    if (!confirm("Discard this draft? This cannot be undone.")) return;
    const { error: e } = await supabase
      .schema("ecom")
      .from("consignment_intakes")
      .delete()
      .eq("id", draftId);
    if (e) {
      setError(e.message);
      return;
    }
    router.push(`/${slug}/manage/consignment-intakes?status=draft`);
  };

  const submit = async () => {
    if (!canSubmit || !activeAccountId) return;
    setSubmitting(true);
    setError(null);

    try {
      const acquiredAtIso = new Date(acquiredAt).toISOString();

      // Create custom_products for any custom lines
      const customIdByKey = new Map<string, string>();
      const customLines = lines.filter((l) => l.cardKind === "custom" && l.customDraft);
      if (customLines.length > 0) {
        const customInsertRows = customLines.map((l) => ({
          account_id: activeAccountId,
          name: l.customDraft!.name,
          set_label: l.customDraft!.set_label || null,
          brand_label: l.customDraft!.brand_label || null,
          image_url: l.customDraft!.image_url || null,
        }));
        const { data: customRows, error: cErr } = await supabase
          .schema("ecom")
          .from("custom_products")
          .insert(customInsertRows)
          .select("id");
        if (cErr || !customRows) throw cErr ?? new Error("Failed to create custom products");
        customLines.forEach((l, idx) => {
          customIdByKey.set(l.key, (customRows as { id: string }[])[idx].id);
        });
      }

      const contact = selectedContact!;

      // Create the consignment intake first so we can stamp lots with its id.
      // If the consignor is being asked to confirm, generate a token client-side
      // and set status=pending_consignor. If the vendor is self-attesting,
      // skip the token and mark the intake accepted up front.
      const wantsEmail = confirmationMode === "email" && !!contact.email;
      const token = wantsEmail
        ? (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`)
        : null;

      // If we're finalising a draft, update the existing intake in place so
      // the intake id is preserved (anything pointing at it stays valid).
      // Otherwise insert a new intake.
      const finalisedFields = {
        vendor_account_id: activeAccountId,
        consignor_contact_id: contact.id,
        intake_date: acquiredAtIso,
        status: wantsEmail ? "pending_consignor" : "accepted",
        acknowledgement_token: token,
        acknowledged_at: wantsEmail ? null : new Date().toISOString(),
        acknowledged_by_vendor: !wantsEmail,
        notes: notes.trim() || null,
        draft_form: null, // clear the draft state once finalised
      };

      let intakeId: string;
      if (draftId) {
        const { data: updated, error: uErr } = await supabase
          .schema("ecom")
          .from("consignment_intakes")
          .update(finalisedFields)
          .eq("id", draftId)
          .select("id")
          .single();
        if (uErr || !updated) throw uErr ?? new Error("Failed to update intake");
        intakeId = (updated as { id: string }).id;
      } else {
        const { data: intakeRow, error: iErr } = await supabase
          .schema("ecom")
          .from("consignment_intakes")
          .insert(finalisedFields)
          .select("id")
          .single();
        if (iErr || !intakeRow) throw iErr ?? new Error("Failed to create intake");
        intakeId = (intakeRow as { id: string }).id;
      }

      const lotRows = lines.map((l) => ({
        account_id: activeAccountId,
        card_product_id: l.cardKind === "card" ? l.cardProductId : null,
        custom_product_id:
          l.cardKind === "custom" ? customIdByKey.get(l.key) ?? null : null,
        grading_service: l.gradingService,
        grade: l.grade.trim() || null,
        quantity_acquired: l.quantity,
        quantity_remaining: l.quantity,
        acquisition_cost_cents: 0,
        acquisition_currency: "AUD",
        acquisition_source: "consignment",
        acquired_at: acquiredAtIso,
        // New: link the consignor to a CRM contact row.
        consignor_contact_id: contact.id,
        // If the contact is linked to a platform account, mirror that here.
        consignor_account_id: contact.linked_account_id,
        // Legacy mirror fields — keep populated for backward compatibility
        // with views/exports that still read them.
        consignor_name: contact.name,
        consignor_contact: contact.email,
        consignor_split_pct: splitPctNum,
        consignor_chargeback_per_unit_cents: chargebackCents,
        notes: notes.trim() || null,
        consignment_intake_id: intakeId,
        consignor_acceptance: wantsEmail ? "pending" : "accepted",
      }));

      const { error: lErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .insert(lotRows);
      if (lErr) throw lErr;

      // Fire-and-await the email if we're requesting confirmation. We don't
      // block the redirect on a successful send — the detail page will surface
      // the shareable URL either way.
      if (wantsEmail) {
        try {
          await fetch(`/api/consignment-intakes/${intakeId}/send-email`, {
            method: "POST",
          });
        } catch {
          // Non-fatal; vendor can resend from the detail page.
        }
      }

      router.push(`/${slug}/manage/consignment-intakes/${intakeId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  };

  if (hydrating) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading draft…</p>
      </div>
    );
  }

  return (
    <div>
      {draftId && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-4 py-2">
          <p className="text-sm text-amber-800 dark:text-amber-300">
            Editing draft — nothing has been added to inventory yet.
          </p>
          <Link
            href={`/${slug}/manage/consignment-intakes?status=draft`}
            className="text-xs text-amber-900 dark:text-amber-200 underline"
          >
            See all drafts
          </Link>
        </div>
      )}
      {/* Consignor info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Consignor
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          This consignor and split apply to every lot you add below.
        </p>

        {selectedContact ? (
          <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                  {selectedContact.name}
                </p>
                <LinkStatusBadge status={selectedContact.link_status} />
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {selectedContact.email ?? "no email"}
                {selectedContact.phone ? ` · ${selectedContact.phone}` : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedContact(null)}
              className="text-sm text-red-500 hover:text-red-600 shrink-0 ml-3"
            >
              Change
            </button>
          </div>
        ) : activeAccountId ? (
          <ContactPicker
            accountId={activeAccountId}
            onSelect={(c) => setSelectedContact(c)}
            autoFocus
          />
        ) : (
          <p className="text-sm text-gray-500">Loading account…</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
          <Field label="Consignor split %">
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={splitPct}
              onChange={(e) => setSplitPct(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Consignor gets {isNaN(splitPctNum) ? "—" : splitPctNum}%, you keep{" "}
              {isNaN(splitPctNum) ? "—" : (100 - splitPctNum).toFixed(2)}%
            </p>
          </Field>
          <Field label="Chargeback / unit (AUD)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={chargebackInput}
              onChange={(e) => setChargebackInput(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Deducted from consignor payout at sale time (e.g. freight).
            </p>
          </Field>
          <Field label="Acquired at">
            <input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Notes">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
        </div>

        {/* Confirmation method */}
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">
            Confirmation
          </p>
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="confirmation-mode"
                value="email"
                checked={confirmationMode === "email"}
                disabled={!selectedContact?.email}
                onChange={() => setConfirmationMode("email")}
                className="mt-0.5 text-red-500 focus:ring-red-500"
              />
              <span>
                Send confirmation email to consignor
                {selectedContact?.email && (
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {" "}
                    ({selectedContact.email})
                  </span>
                )}
                {!selectedContact?.email && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    {" "}
                    — disabled, contact has no email
                  </span>
                )}
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input
                type="radio"
                name="confirmation-mode"
                value="vendor_attest"
                checked={confirmationMode === "vendor_attest"}
                onChange={() => setConfirmationMode("vendor_attest")}
                className="mt-0.5 text-red-500 focus:ring-red-500"
              />
              <span>
                Mark as accepted (confirmed in person)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Line items */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Cards received ({lines.length})
          </h2>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Type to search, &uarr;/&darr; to navigate, Enter to add
          </span>
        </div>

        <div className="mb-4">
          <CardPicker ref={pickerRef} onPick={onPick} autoFocus />
        </div>

        {lines.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
            No cards yet. Use the search above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-2 py-2 text-left">Product</th>
                  <th className="px-2 py-2 text-left">Grading</th>
                  <th className="px-2 py-2 text-left">Grade</th>
                  <th className="px-2 py-2 text-right">Qty</th>
                  <th className="px-2 py-2 text-right">Market</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {lines.map((l) => {
                  const marketUsd = lineMarketUsdCents(l);
                  return (
                  <tr key={l.key} className="align-top">
                    <td className="px-2 py-2">
                      <ProductCell
                        line={l}
                        onChange={(d) =>
                          updateLine(l.key, {
                            customDraft: d,
                            cardName: d.name,
                            imageUrl: d.image_url || null,
                          })
                        }
                      />
                    </td>
                    <td className="px-2 py-2">
                      <select
                        value={l.gradingService}
                        onChange={(e) =>
                          updateLine(l.key, {
                            gradingService: e.target.value as GradingService,
                          })
                        }
                        className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      >
                        {GRADING_SERVICES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-2">
                      <input
                        type="text"
                        value={l.grade}
                        onChange={(e) => updateLine(l.key, { grade: e.target.value })}
                        disabled={l.gradingService === "ungraded"}
                        placeholder={l.gradingService === "ungraded" ? "" : "10"}
                        className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 disabled:opacity-50"
                      />
                    </td>
                    <td className="px-2 py-2 text-right">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={l.quantity}
                        onChange={(e) =>
                          updateLine(l.key, {
                            quantity: Math.max(1, parseInt(e.target.value, 10) || 1),
                          })
                        }
                        className="w-20 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-2 py-2 text-right whitespace-nowrap text-gray-700 dark:text-gray-300">
                      {marketUsd != null ? (
                        <div className="leading-tight">
                          <div>
                            {formatPrice(marketUsd, sellerCurrency, rates ?? {}, "USD")}
                          </div>
                          {l.quantity > 1 && (
                            <div className="text-[11px] text-gray-500 dark:text-gray-400">
                              × {l.quantity} ={" "}
                              {formatPrice(
                                marketUsd * l.quantity,
                                sellerCurrency,
                                rates ?? {},
                                "USD",
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        onClick={() => removeLine(l.key)}
                        className="text-gray-400 hover:text-red-500 text-lg"
                        aria-label="Remove row"
                      >
                        &times;
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

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-3">
        {draftSavedAt && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mr-auto">
            Draft saved{" "}
            {draftSavedAt.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        )}
        {draftId && (
          <button
            type="button"
            onClick={discardDraft}
            className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
          >
            Discard draft
          </button>
        )}
        <Link
          href={`/${slug}/manage/inventory`}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Cancel
        </Link>
        <button
          type="button"
          onClick={saveDraft}
          disabled={!canSaveDraft}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {savingDraft ? "Saving..." : draftId ? "Update draft" : "Save draft"}
        </button>
        <button
          onClick={submit}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : `Submit consignment (${lines.length})`}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// QUICK ADD MODE — single card, no parent purchase.
// ---------------------------------------------------------------------------

function QuickAddMode({ slug }: { slug: string }) {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();
  const { activeAccountId } = useAccounts();
  const { data: rates } = useExchangeRates();

  const today = new Date().toISOString().slice(0, 10);
  const [acquiredAt, setAcquiredAt] = useState<string>(today);
  const [currency, setCurrency] = useState<string>("AUD");
  const [source, setSource] = useState<AcquisitionSource>("purchase");
  const [notes, setNotes] = useState("");
  const [gradingService, setGradingService] = useState<GradingService>("ungraded");
  const [grade, setGrade] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCostInput, setUnitCostInput] = useState<string>("");

  const [picked, setPicked] = useState<
    | {
        kind: "card";
        id: string;
        name: string;
        image_url: string | null;
        market: MarketSnapshot;
      }
    | { kind: "custom"; draft: CustomDraft }
    | null
  >(null);

  const onPick = (p: PickedCard) => {
    if (p.kind === "custom") {
      setPicked({
        kind: "custom",
        draft: { name: "", set_label: "", brand_label: "", image_url: "" },
      });
    } else {
      const c = p.card;
      setPicked({
        kind: "card",
        id: c.id,
        name: c.name,
        image_url: c.image_url,
        market: {
          price_ungraded: c.price_ungraded,
          price_psa_1: c.price_psa_1,
          price_psa_2: c.price_psa_2,
          price_psa_3: c.price_psa_3,
          price_psa_4: c.price_psa_4,
          price_psa_5: c.price_psa_5,
          price_psa_6: c.price_psa_6,
          price_psa_7: c.price_psa_7,
          price_psa_8: c.price_psa_8,
          price_psa_9: c.price_psa_9,
          price_psa_10: c.price_psa_10,
          price_psa_9_5: c.price_psa_9_5,
          price_bgs: c.price_bgs,
          price_cgc: c.price_cgc,
        },
      });
    }
  };

  // Market reference for the picked card at the chosen grade.
  const quickMarketUsdCents =
    picked && picked.kind === "card"
      ? resolveMarketValue(
          { product_id: picked.id, ...picked.market },
          gradingService,
          grade || null,
        )
      : null;

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit =
    !submitting &&
    activeAccountId !== null &&
    picked !== null &&
    (picked.kind === "card" || picked.draft.name.trim().length > 0) &&
    quantity > 0;

  const submit = async () => {
    if (!canSubmit || !activeAccountId || !picked) return;
    setSubmitting(true);
    setError(null);
    try {
      let cardProductId: string | null = null;
      let customProductId: string | null = null;

      if (picked.kind === "custom") {
        const { data: customRow, error: cErr } = await supabase
          .schema("ecom")
          .from("custom_products")
          .insert({
            account_id: activeAccountId,
            name: picked.draft.name,
            set_label: picked.draft.set_label || null,
            brand_label: picked.draft.brand_label || null,
            image_url: picked.draft.image_url || null,
          })
          .select("id")
          .single();
        if (cErr || !customRow) throw cErr ?? new Error("Failed to create custom product");
        customProductId = (customRow as { id: string }).id;
      } else {
        cardProductId = picked.id;
      }

      const acquisitionCostCents = unitCostInput.trim() === "" ? null : parseCents(unitCostInput);

      const { error: lErr } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .insert({
          account_id: activeAccountId,
          card_product_id: cardProductId,
          custom_product_id: customProductId,
          grading_service: gradingService,
          grade: grade.trim() || null,
          quantity_acquired: quantity,
          quantity_remaining: quantity,
          acquisition_cost_cents: acquisitionCostCents,
          acquisition_currency: currency,
          acquisition_source: source,
          acquired_at: new Date(acquiredAt).toISOString(),
          notes: notes.trim() || null,
        });
      if (lErr) throw lErr;

      router.push(`/${slug}/manage/inventory`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Submit failed");
      setSubmitting(false);
    }
  };

  // Quick Add intentionally doesn't allow 'consignment' here — that's what the
  // Consignment tab is for (and it requires consignor info).
  const sourcesForQuickAdd: AcquisitionSource[] = [
    "purchase",
    "trade_in",
    "pack_pull",
    "gift",
    "unknown",
  ];

  return (
    <div>
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
          Quick add
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
          A single lot, no parent purchase. Cost is optional — leave blank for
          unknown.
        </p>

        <Field label="Card">
          {picked ? (
            <div className="flex items-center justify-between p-3 rounded-md bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 min-w-0">
                {picked.kind === "card" && picked.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={picked.image_url}
                    alt={picked.name}
                    className="w-10 h-14 object-contain rounded shrink-0"
                  />
                ) : (
                  <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                    {picked.kind === "card" ? (
                      <ProductLink cardProductId={picked.id} showIcon>
                        {picked.name}
                      </ProductLink>
                    ) : (
                      "Custom product"
                    )}
                  </p>
                  {picked.kind === "custom" && (
                    <p className="text-xs text-amber-600 dark:text-amber-400">
                      Fill in the details below
                    </p>
                  )}
                  {picked.kind === "card" && quickMarketUsdCents != null && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      Market:{" "}
                      <span className="font-semibold text-gray-700 dark:text-gray-200">
                        {formatPrice(
                          quickMarketUsdCents,
                          currency,
                          rates ?? {},
                          "USD",
                        )}
                      </span>
                      {quantity > 1 && (
                        <>
                          {" "}× {quantity} ={" "}
                          <span className="font-semibold text-gray-700 dark:text-gray-200">
                            {formatPrice(
                              quickMarketUsdCents * quantity,
                              currency,
                              rates ?? {},
                              "USD",
                            )}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPicked(null)}
                className="text-sm text-red-500 hover:text-red-600 shrink-0 ml-3"
              >
                Change
              </button>
            </div>
          ) : (
            <CardPicker onPick={onPick} autoFocus />
          )}
        </Field>

        {picked?.kind === "custom" && (
          <CustomProductFields
            draft={picked.draft}
            onChange={(d) => setPicked({ kind: "custom", draft: d })}
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <Field label="Grading service">
            <select
              value={gradingService}
              onChange={(e) => setGradingService(e.target.value as GradingService)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              {GRADING_SERVICES.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grade">
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              disabled={gradingService === "ungraded"}
              placeholder={gradingService === "ungraded" ? "" : "10"}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 disabled:opacity-50"
            />
          </Field>
          <Field label="Quantity">
            <input
              type="number"
              min="1"
              step="1"
              value={quantity}
              onChange={(e) =>
                setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))
              }
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Acquisition source">
            <select
              value={source}
              onChange={(e) => setSource(e.target.value as AcquisitionSource)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              {sourcesForQuickAdd.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Unit cost (blank = unknown)">
            <input
              type="number"
              min="0"
              step="0.01"
              value={unitCostInput}
              onChange={(e) => setUnitCostInput(e.target.value)}
              placeholder="—"
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
          <Field label="Acquired at">
            <input
              type="date"
              value={acquiredAt}
              onChange={(e) => setAcquiredAt(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <div className="md:col-span-2">
            <Field label="Notes">
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
              />
            </Field>
          </div>
        </div>
      </div>

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
          onClick={submit}
          disabled={!canSubmit}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Saving..." : "Add to inventory"}
        </button>
      </div>
    </div>
  );
}
