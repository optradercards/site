"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { gradeLabel, type EcomListing } from "@/lib/pricing";
import { formatPrice } from "@/lib/currency";

// ---------------------------------------------------------------------------
// In-person Point of Sale.
//
// UI is two directions: Outbound (we give) and Inbound (we receive). The DB
// stores a four-value side enum (sold / bought / traded_in / traded_out)
// which is derived at save time from direction + whether cash changed
// hands. Reporting can still tell pure trades from cash sales.
// ---------------------------------------------------------------------------

type Direction = "out" | "in";
type ItemSide = "sold" | "bought" | "traded_in" | "traded_out";
type PaymentMethod = "cash" | "payid_manual" | "bank_transfer";

type DraftItem = {
  key: string;
  listing_id: string | null;
  card_product_id: string | null;
  card_name: string;
  card_number: string | null;
  set_name: string | null;
  image_url: string | null;
  grading_service: string | null;
  grade: string | null;
  direction: Direction;
  quantity: number;
  unit_price_cents: number;
  max_available: number; // Infinity for catalog-sourced (no inventory cap)
};

type CatalogProduct = {
  id: string;
  name: string;
  image_url: string | null;
  set_name: string | null;
  brand_name: string | null;
  card_number: string | null;
  rarity: string | null;
  price_ungraded: number | null; // USD cents
};

function uniqueKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

// Map (direction, net cash sign) to the DB side enum used for reporting.
function deriveSide(direction: Direction, netCashCents: number): ItemSide {
  if (direction === "out") {
    return netCashCents > 0 ? "sold" : "traded_out";
  }
  return netCashCents < 0 ? "bought" : "traded_in";
}

export default function SellPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";
  // USD → seller-currency conversion factor for cards.products prices.
  const usdToSellerRate =
    sellerCurrency.toLowerCase() === "usd"
      ? 1
      : (rates?.[sellerCurrency.toLowerCase()] ?? 1);

  // --- Inventory search (outbound by default) ----------------------------
  const [invSearchInput, setInvSearchInput] = useState("");
  const invSearch = useDebounced(invSearchInput, 250);
  const [invResults, setInvResults] = useState<EcomListing[]>([]);
  const [invSearching, setInvSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeAccountId) return;
      setInvSearching(true);
      let q = supabase
        .schema("ecom")
        .from("listing_details")
        .select("*")
        .eq("account_id", activeAccountId)
        .eq("status", "active")
        .gt("quantity", 0)
        .limit(30);
      if (invSearch.trim()) {
        const term = invSearch.trim();
        q = q.or(`card_name.ilike.%${term}%,card_number.ilike.%${term}%`);
      }
      const { data } = await q;
      if (!cancelled) {
        setInvResults((data ?? []) as EcomListing[]);
        setInvSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, activeAccountId, invSearch]);

  // --- Catalog search (trade-in) -----------------------------------------
  const [catSearchInput, setCatSearchInput] = useState("");
  const catSearch = useDebounced(catSearchInput, 250);
  const [catResults, setCatResults] = useState<CatalogProduct[]>([]);
  const [catSearching, setCatSearching] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!catSearch.trim()) {
        setCatResults([]);
        return;
      }
      setCatSearching(true);
      const { data } = await supabase
        .schema("cards")
        .from("products_with_details")
        .select(
          "id, name, image_url, set_name, brand_name, card_number, rarity, price_ungraded"
        )
        .or(`name.ilike.%${catSearch.trim()}%,card_number.ilike.%${catSearch.trim()}%`)
        .limit(30);
      if (!cancelled) {
        setCatResults((data ?? []) as CatalogProduct[]);
        setCatSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, catSearch]);

  // --- Cart --------------------------------------------------------------
  const [items, setItems] = useState<DraftItem[]>([]);
  const currency = invResults[0]?.currency ?? "AUD";

  const addOutbound = useCallback((listing: EcomListing) => {
    setInvSearchInput("");
    setItems((prev) => {
      const existing = prev.find(
        (i) => i.listing_id === listing.id && i.direction === "out"
      );
      const price = listing.price_cents ?? listing.calculated_price_cents ?? 0;
      if (existing) {
        if (existing.quantity >= existing.max_available) return prev;
        return prev.map((i) =>
          i.key === existing.key ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          key: uniqueKey(),
          listing_id: listing.id,
          card_product_id: listing.card_product_id,
          card_name: listing.card_name,
          card_number: listing.card_number,
          set_name: listing.set_name,
          image_url: listing.image_url,
          grading_service: listing.grading_service,
          grade: listing.grade,
          direction: "out",
          quantity: 1,
          unit_price_cents: price,
          max_available: listing.quantity,
        },
      ];
    });
  }, []);

  const addInbound = useCallback(
    (product: CatalogProduct) => {
      // Pre-fill the trade-in's market value with ungraded price converted
      // to seller currency. User can override before completing.
      const marketSellerCents =
        product.price_ungraded != null
          ? Math.round(product.price_ungraded * usdToSellerRate)
          : 0;
      setItems((prev) => [
        ...prev,
        {
          key: uniqueKey(),
          listing_id: null,
          card_product_id: product.id,
          card_name: product.name,
          card_number: product.card_number,
          set_name: product.set_name,
          image_url: product.image_url,
          grading_service: null,
          grade: null,
          direction: "in",
          quantity: 1,
          unit_price_cents: marketSellerCents,
          max_available: Number.POSITIVE_INFINITY,
        },
      ]);
      setCatSearchInput("");
    },
    [usdToSellerRate],
  );

  const updateItem = useCallback((key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const outbound = useMemo(
    () => items.filter((it) => it.direction === "out"),
    [items]
  );
  const inbound = useMemo(
    () => items.filter((it) => it.direction === "in"),
    [items]
  );

  // Trade percentage: what fraction of an inbound item's stated market
  // value the buyer gets as trade credit. 75 means $100 in trade-ins is
  // worth $75 toward what they're buying. The lot we book for inbound
  // items also uses this as the cost basis (×0.75 of market).
  const [tradePctInput, setTradePctInput] = useState("75");
  const tradePct = useMemo(() => {
    const n = parseFloat(tradePctInput);
    return Number.isFinite(n) && n >= 0 && n <= 200 ? n : 75;
  }, [tradePctInput]);

  const totals = useMemo(() => {
    const out = outbound.reduce(
      (sum, it) => sum + it.unit_price_cents * it.quantity,
      0
    );
    const inMarket = inbound.reduce(
      (sum, it) => sum + it.unit_price_cents * it.quantity,
      0
    );
    const inCredit = Math.round(inMarket * (tradePct / 100));
    return {
      out_cents: out,
      in_market_cents: inMarket,
      in_credit_cents: inCredit,
      net_cents: out - inCredit,
    };
  }, [outbound, inbound, tradePct]);

  // --- Buyer + payment ---------------------------------------------------
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [payidRef, setPayidRef] = useState("");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canComplete = items.length > 0 && !completing && activeAccountId !== null;

  const complete = useCallback(async () => {
    if (!canComplete || !activeAccountId) return;
    setError(null);
    setCompleting(true);

    try {
      const buyer_contact =
        buyerName || buyerEmail || buyerPhone
          ? { name: buyerName || null, email: buyerEmail || null, phone: buyerPhone || null }
          : null;

      // Pure trade = no cash changes hands.
      const type = totals.net_cents === 0 ? "trade" : "order";

      // Persist tradePct only when there's an actual trade-in mix; on
      // pure cash sales it stays null so it's clear from the row.
      const txTradePct = inbound.length > 0 ? tradePct : null;

      // 1. Insert transaction
      const { data: tx, error: txErr } = await supabase
        .schema("ecom")
        .from("transactions")
        .insert({
          account_id: activeAccountId,
          type,
          status: "draft",
          buyer_contact,
          currency,
          trade_value_pct: txTradePct,
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      // 1b. Upsert ecom.contacts when we have enough to identify the buyer.
      // Email is the unique key per account; if we only have phone/name we
      // skip the upsert (would create dupes on every visit).
      if (buyerEmail.trim()) {
        const { error: contactErr } = await supabase
          .schema("ecom")
          .from("contacts")
          .upsert(
            {
              account_id: activeAccountId,
              email: buyerEmail.trim(),
              name: buyerName.trim() || buyerEmail.trim(),
              phone: buyerPhone.trim() || null,
            },
            { onConflict: "account_id,email" },
          );
        if (contactErr) throw contactErr;
      }

      // 2. Insert items with derived side (capture ids so we can allocate lots)
      const rows = items.map((it) => ({
        transaction_id: tx.id,
        side: deriveSide(it.direction, totals.net_cents),
        listing_id: it.listing_id,
        card_product_id: it.card_product_id,
        grading_service: it.grading_service,
        grade: it.grade,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
      }));
      const { data: insertedItems, error: itErr } = await supabase
        .schema("ecom")
        .from("transaction_items")
        .insert(rows)
        .select("id");
      if (itErr) throw itErr;

      // 3. Payment (when net cash is owed to us)
      if (totals.net_cents > 0) {
        const { error: payErr } = await supabase
          .schema("ecom")
          .from("order_payments")
          .insert({
            transaction_id: tx.id,
            method: paymentMethod,
            amount_cents: totals.net_cents,
            currency,
            reference: paymentMethod === "payid_manual" ? payidRef || null : null,
            status: "received",
            paid_at: new Date().toISOString(),
          });
        if (payErr) throw payErr;
      }

      // 4. Allocate outbound items against inventory lots (decrements
      //    quantity_remaining, writes sale_allocations, snapshots market ref).
      //    The insertedItems array is in the same order as `items`.
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.direction !== "out") continue;
        if (!it.listing_id) continue;
        const txItem = insertedItems?.[i];
        if (!txItem) continue;
        const { error: allocErr } = await supabase
          .schema("ecom")
          .rpc("fulfill_sale_from_lots", {
            p_transaction_item_id: txItem.id,
            p_listing_id: it.listing_id,
            p_quantity: it.quantity,
          });
        if (allocErr) throw allocErr;
      }

      // 4b. Trade-in items land in inventory as new lots. Cost basis =
      //     market value × tradePct (we paid 75% of market for the trade).
      //     acquisition_source='trade_in' so reports can tell them from
      //     purchased stock.
      const today = new Date().toISOString().slice(0, 10);
      const inboundLots = items
        .filter((it) => it.direction === "in" && it.card_product_id)
        .map((it) => ({
          account_id: activeAccountId,
          card_product_id: it.card_product_id,
          grading_service: it.grading_service ?? "ungraded",
          grade: it.grade,
          quantity_acquired: it.quantity,
          quantity_remaining: it.quantity,
          acquisition_cost_cents: Math.round(
            it.unit_price_cents * (tradePct / 100),
          ),
          acquisition_currency: currency,
          acquisition_source: "trade_in" as const,
          acquired_at: today,
          notes: `Trade-in from sell ticket ${tx.id} on ${today}`,
        }));
      if (inboundLots.length > 0) {
        const { error: lotErr } = await supabase
          .schema("ecom")
          .from("inventory_lots")
          .insert(inboundLots);
        if (lotErr) throw lotErr;
      }

      // 5. Mark transaction completed
      const { error: doneErr } = await supabase
        .schema("ecom")
        .from("transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", tx.id);
      if (doneErr) throw doneErr;

      // Reset for next transaction
      setItems([]);
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
      setPayidRef("");
      setPaymentMethod("cash");
      setInvSearchInput("");
      setCatSearchInput("");
    } catch (e) {
      // Supabase errors come back as plain objects, not Error instances —
      // dig out the message + code so we can actually see what failed.
      console.error("complete-sale failed:", e);
      let msg = "Could not complete sale";
      if (e && typeof e === "object") {
        const err = e as { message?: string; details?: string; hint?: string; code?: string };
        const parts = [err.message, err.details, err.hint, err.code ? `(${err.code})` : null]
          .filter(Boolean);
        if (parts.length > 0) msg = parts.join(" — ");
      } else if (e instanceof Error) {
        msg = e.message;
      }
      setError(msg);
    } finally {
      setCompleting(false);
    }
  }, [
    activeAccountId,
    buyerEmail,
    buyerName,
    buyerPhone,
    canComplete,
    currency,
    inbound.length,
    items,
    payidRef,
    paymentMethod,
    supabase,
    totals.net_cents,
    tradePct,
  ]);

  // --- Render ------------------------------------------------------------
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Sell
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          In-person point of sale. Mix sales and trade-ins on the same ticket.
        </p>
      </header>

      {/* Invoice header — customer + trade percentage */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 md:p-8 mb-6">
        <div className="flex items-baseline justify-between mb-5 pb-4 border-b border-gray-100 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Customer
          </h2>
          <span className="text-xs uppercase tracking-wider text-gray-400 dark:text-gray-500">
            New invoice
          </span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <label className="block">
            <span className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Name
            </span>
            <input
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="Walk-in customer"
              className="block w-full px-4 py-3 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Email
            </span>
            <input
              value={buyerEmail}
              onChange={(e) => setBuyerEmail(e.target.value)}
              placeholder="customer@example.com"
              type="email"
              className="block w-full px-4 py-3 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </label>
          <label className="block">
            <span className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Phone
            </span>
            <input
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="04xx xxx xxx"
              className="block w-full px-4 py-3 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </label>
        </div>
        <div className="mt-5 pt-5 border-t border-gray-100 dark:border-gray-700 flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-6">
          <label className="block w-full sm:w-64 shrink-0">
            <span className="block text-sm font-medium text-gray-600 dark:text-gray-300 mb-1.5">
              Trade % of market value
            </span>
            <div className="flex items-stretch">
              <input
                type="number"
                inputMode="decimal"
                value={tradePctInput}
                onChange={(e) => setTradePctInput(e.target.value)}
                min="0"
                max="200"
                step="0.5"
                className="block w-full h-12 px-4 text-base font-semibold tabular-nums rounded-l-lg border border-r-0 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
              <span className="inline-flex items-center justify-center w-12 h-12 text-base font-semibold text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-r-lg">
                %
              </span>
            </div>
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 lg:pb-3 max-w-lg">
            We credit the customer this much of each trade-in's market value.
            E.g. <strong>75%</strong> means a $100 trade card is worth $75
            toward what they're buying, and lands in inventory at $75 cost.
          </p>
        </div>
      </div>

      {/* Compact search lines — full width above the invoice grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
        <SearchLine
          label="Add from inventory (sell)"
          placeholder="Search your inventory…"
          value={invSearchInput}
          onChange={setInvSearchInput}
          searching={invSearching}
          results={invResults}
          renderRow={(r) => (
            <>
              <div className="w-10 h-14 shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                {r.image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.image_url}
                    alt={r.card_name}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                  {r.card_name}
                  {r.card_number && (
                    <span className="ml-1.5 text-xs font-mono font-normal text-gray-500 dark:text-gray-400">
                      #{r.card_number}
                    </span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                  {r.set_name}
                  {r.grading_service && r.grading_service !== "ungraded"
                    ? ` · ${gradeLabel(r.grading_service, r.grade)}`
                    : ""}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                  {formatPrice(
                    r.price_cents ?? r.calculated_price_cents ?? null,
                    r.currency,
                    {},
                    r.currency,
                  )}
                </p>
                {r.market_price_cents != null && (
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 tabular-nums">
                    mkt {formatPrice(r.market_price_cents, r.currency, {}, r.currency)}
                  </p>
                )}
                <p className="text-[10px] text-gray-500 dark:text-gray-400">
                  qty {r.quantity}
                </p>
              </div>
            </>
          )}
          rowKey={(r) => r.id}
          onSelect={addOutbound}
          autoFocus
          size="compact"
        />

        <SearchLine
          label="Add trade-in (any card)"
          placeholder="Search the catalog…"
          value={catSearchInput}
          onChange={setCatSearchInput}
          searching={catSearching}
          results={catResults}
          renderRow={(p) => {
            const marketSellerCents =
              p.price_ungraded != null
                ? Math.round(p.price_ungraded * usdToSellerRate)
                : null;
            return (
              <>
                <div className="w-10 h-14 shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                  {p.image_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                    {p.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {[p.set_name, p.card_number].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {marketSellerCents != null ? (
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
                      {formatPrice(marketSellerCents, sellerCurrency, {}, sellerCurrency)}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500">no mkt</p>
                  )}
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">market</p>
                </div>
              </>
            );
          }}
          rowKey={(p) => p.id}
          onSelect={addInbound}
          size="compact"
        />
      </div>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT: Invoice line items (big) */}
        <section className="space-y-4">
          {items.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center text-gray-400 dark:text-gray-500 border border-dashed border-gray-200 dark:border-gray-700">
              Add items via the search above to start an invoice.
            </div>
          ) : (
            <>
              <ItemGroup
                label="Selling to customer"
                tone="out"
                items={outbound}
                subtotalCents={totals.out_cents}
                currency={currency}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
              <ItemGroup
                label="Taking in as trade"
                tone="in"
                items={inbound}
                subtotalCents={totals.in_market_cents}
                currency={currency}
                onUpdate={updateItem}
                onRemove={removeItem}
              />
            </>
          )}
        </section>

        {/* RIGHT: Current transaction */}
        <aside className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Summary
          </h2>

          {/* Totals breakdown */}
          <div className="pt-3 border-t border-gray-200 dark:border-gray-700 space-y-1 text-sm">
            <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
              <span>Sale total</span>
              <span className="tabular-nums">
                {formatPrice(totals.out_cents, currency, {}, currency)}
              </span>
            </div>
            {inbound.length > 0 && (
              <>
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Trade-in market value</span>
                  <span className="tabular-nums">
                    {formatPrice(totals.in_market_cents, currency, {}, currency)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-gray-600 dark:text-gray-300">
                  <span>Trade credit ({tradePct}%)</span>
                  <span className="tabular-nums">
                    − {formatPrice(totals.in_credit_cents, currency, {}, currency)}
                  </span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between text-base font-bold pt-1 border-t border-gray-100 dark:border-gray-700 mt-1">
              <span className="text-gray-700 dark:text-gray-200">
                {totals.net_cents > 0
                  ? "Customer pays"
                  : totals.net_cents < 0
                    ? "We pay customer"
                    : items.length === 0
                      ? "Total"
                      : "Even trade"}
              </span>
              <span
                className={
                  totals.net_cents > 0
                    ? "text-green-700 dark:text-green-400 tabular-nums"
                    : totals.net_cents < 0
                      ? "text-red-700 dark:text-red-400 tabular-nums"
                      : "text-gray-900 dark:text-gray-100 tabular-nums"
                }
              >
                {formatPrice(Math.abs(totals.net_cents), currency, {}, currency)}
              </span>
            </div>
          </div>

          {/* Payment */}
          {totals.net_cents > 0 && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Payment
              </p>
              <div className="grid grid-cols-3 gap-1.5">
                {(["cash", "payid_manual", "bank_transfer"] as PaymentMethod[]).map(
                  (m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPaymentMethod(m)}
                      className={`px-2 py-2 text-xs font-medium rounded transition-colors ${
                        paymentMethod === m
                          ? "bg-red-500 text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
                      }`}
                    >
                      {m === "cash"
                        ? "Cash"
                        : m === "payid_manual"
                          ? "PayID"
                          : "Bank"}
                    </button>
                  )
                )}
              </div>
              {paymentMethod === "payid_manual" && (
                <input
                  value={payidRef}
                  onChange={(e) => setPayidRef(e.target.value)}
                  placeholder="PayID reference (optional)"
                  className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                />
              )}
            </div>
          )}

          {error && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 p-2 rounded">
              {error}
            </div>
          )}

          <button
            type="button"
            disabled={!canComplete}
            onClick={complete}
            className="w-full py-3 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {completing ? "Saving…" : "Complete"}
          </button>
          <p className="text-[10px] text-gray-400 text-center -mt-2">
            Slug: {slug}
          </p>
        </aside>
      </div>
    </div>
  );
}

// Decimal input bound to a cents value. Keeps a local string while focused so
// typing partial decimals ("12.", "12.5") and backspacing don't get clobbered
// by the parent reformatting the value back to two decimals on every change.
function PriceInput({
  valueCents,
  onChange,
  className,
}: {
  valueCents: number;
  onChange: (cents: number) => void;
  className?: string;
}) {
  const [text, setText] = useState(() => (valueCents / 100).toFixed(2));
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) setText((valueCents / 100).toFixed(2));
  }, [valueCents, focused]);

  return (
    <input
      type="text"
      inputMode="decimal"
      value={text}
      onFocus={(e) => {
        setFocused(true);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const next = e.target.value;
        if (next !== "" && !/^\d*\.?\d{0,2}$/.test(next)) return;
        setText(next);
        if (next === "" || next === ".") {
          onChange(0);
          return;
        }
        const parsed = parseFloat(next);
        if (!Number.isNaN(parsed)) onChange(Math.round(parsed * 100));
      }}
      onBlur={() => {
        setFocused(false);
        const parsed = parseFloat(text);
        if (Number.isNaN(parsed)) {
          setText("0.00");
          onChange(0);
        } else {
          const cents = Math.round(parsed * 100);
          setText((cents / 100).toFixed(2));
          onChange(cents);
        }
      }}
      className={className}
    />
  );
}

function ItemGroup({
  label,
  tone,
  items,
  subtotalCents,
  currency,
  onUpdate,
  onRemove,
}: {
  label: string;
  tone: "out" | "in";
  items: DraftItem[];
  subtotalCents: number;
  currency: string;
  onUpdate: (key: string, patch: Partial<DraftItem>) => void;
  onRemove: (key: string) => void;
}) {
  const accent =
    tone === "out"
      ? "border-l-4 border-red-300 dark:border-red-700"
      : "border-l-4 border-green-300 dark:border-green-700";
  const toneTag =
    tone === "out"
      ? "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300"
      : "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300";
  return (
    <section
      className={`bg-white dark:bg-gray-800 rounded-lg shadow ${accent} overflow-hidden`}
    >
      <div className="flex items-baseline justify-between px-5 py-3 border-b border-gray-100 dark:border-gray-700">
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">
          {label}
          <span
            className={`ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wide ${toneTag}`}
          >
            {items.length} item{items.length === 1 ? "" : "s"}
          </span>
        </h3>
        <span className="text-base font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
          {items.length === 0
            ? "—"
            : formatPrice(subtotalCents, currency, {}, currency)}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="px-5 py-6 text-sm text-gray-400 dark:text-gray-500 italic text-center">
          Nothing here yet.
        </p>
      ) : (
        <ul className="divide-y divide-gray-100 dark:divide-gray-700">
          {items.map((it) => {
            const lineTotal = it.unit_price_cents * it.quantity;
            return (
              <li
                key={it.key}
                className="px-4 py-3 sm:px-5 sm:py-4 hover:bg-gray-50/50 dark:hover:bg-gray-700/20"
              >
                <div className="flex items-start gap-3 sm:gap-4">
                  {/* Thumbnail */}
                  <div className="w-14 h-20 shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                    {it.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.image_url}
                        alt={it.card_name}
                        className="w-full h-full object-cover"
                      />
                    ) : null}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-base font-medium text-gray-900 dark:text-gray-100 line-clamp-2">
                      {it.card_name}
                    </p>
                    {it.card_number && (
                      <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-0.5">
                        #{it.card_number}
                      </p>
                    )}
                    {it.set_name && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                        {it.set_name}
                      </p>
                    )}
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                      {it.listing_id
                        ? gradeLabel(it.grading_service, it.grade)
                        : it.grading_service && it.grading_service !== "ungraded"
                          ? `Trade-in · ${gradeLabel(it.grading_service, it.grade)}`
                          : "Trade-in from buyer"}
                    </p>
                  </div>

                  {/* Remove */}
                  <button
                    type="button"
                    onClick={() => onRemove(it.key)}
                    className="self-start text-gray-300 hover:text-red-500 text-2xl leading-none w-10 h-10 flex items-center justify-center rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                    aria-label="Remove"
                  >
                    ×
                  </button>
                </div>

                {/* Controls row — wraps below the name on narrow widths */}
                <div className="mt-3 flex flex-wrap items-end gap-4 sm:pl-[4.5rem]">
                  {/* Qty stepper */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                      Qty
                    </label>
                    <div className="inline-flex items-center rounded-md border border-gray-200 dark:border-gray-700">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(it.key, {
                            quantity: Math.max(1, it.quantity - 1),
                          })
                        }
                        className="w-11 h-11 text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 rounded-l-md"
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span className="px-3 min-w-[3rem] text-center text-base font-medium text-gray-900 dark:text-gray-100 tabular-nums">
                        {it.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          onUpdate(it.key, {
                            quantity: Math.min(it.max_available, it.quantity + 1),
                          })
                        }
                        className="w-11 h-11 text-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 active:bg-gray-200 dark:active:bg-gray-600 disabled:opacity-30 rounded-r-md"
                        disabled={it.quantity >= it.max_available}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>
                  </div>

                  {/* Grading — only for trade-ins. Existing listings come in
                      with their grade locked, but a buyer might trade in a
                      graded card we don't already stock. */}
                  {!it.listing_id && (
                    <>
                      <div>
                        <label className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                          Grading
                        </label>
                        <select
                          value={it.grading_service ?? "ungraded"}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "ungraded") {
                              onUpdate(it.key, {
                                grading_service: null,
                                grade: null,
                              });
                            } else {
                              onUpdate(it.key, { grading_service: v });
                            }
                          }}
                          className="h-11 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-base text-gray-900 dark:text-gray-100"
                        >
                          <option value="ungraded">Ungraded</option>
                          <option value="psa">PSA</option>
                          <option value="bgs">BGS</option>
                          <option value="cgc">CGC</option>
                          <option value="sgc">SGC</option>
                        </select>
                      </div>
                      {it.grading_service && it.grading_service !== "ungraded" && (
                        <div>
                          <label className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                            Grade
                          </label>
                          <input
                            type="text"
                            value={it.grade ?? ""}
                            onChange={(e) =>
                              onUpdate(it.key, {
                                grade: e.target.value || null,
                              })
                            }
                            placeholder="10"
                            className="w-16 h-11 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 text-base text-center text-gray-900 dark:text-gray-100"
                          />
                        </div>
                      )}
                    </>
                  )}

                  {/* Unit price */}
                  <div>
                    <label className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                      Unit price
                    </label>
                    <PriceInput
                      valueCents={it.unit_price_cents}
                      onChange={(cents) =>
                        onUpdate(it.key, { unit_price_cents: cents })
                      }
                      className="w-28 h-11 px-3 text-right text-base rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 tabular-nums"
                    />
                  </div>

                  {/* Line total */}
                  <div className="ml-auto text-right">
                    <label className="block text-[10px] uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-1">
                      Total
                    </label>
                    <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 tabular-nums h-11 flex items-center justify-end">
                      {formatPrice(lineTotal, currency, {}, currency)}
                    </p>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Typeahead search input with a dropdown of compact result rows.
// Generic over T so it works for both inventory listings and catalog products.
function SearchLine<T>({
  label,
  placeholder,
  value,
  onChange,
  searching,
  results,
  renderRow,
  rowKey,
  onSelect,
  autoFocus,
  size = "default",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  searching: boolean;
  results: T[];
  renderRow: (item: T) => React.ReactNode;
  rowKey: (item: T) => string;
  onSelect: (item: T) => void;
  autoFocus?: boolean;
  size?: "default" | "compact";
}) {
  const showDropdown = value.trim().length > 0;
  const inputCls =
    size === "compact"
      ? "w-full h-11 px-3 text-sm rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
      : "w-full h-12 px-4 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500";
  return (
    <div className="relative">
      <label className="block text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className={inputCls}
      />
      {showDropdown && (
        <ul className="absolute z-20 mt-1 w-full max-h-80 overflow-y-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg divide-y divide-gray-100 dark:divide-gray-700">
          {searching && results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              Searching…
            </li>
          ) : results.length === 0 ? (
            <li className="px-3 py-3 text-sm text-gray-500 dark:text-gray-400 text-center">
              No matches.
            </li>
          ) : (
            results.map((item) => (
              <li key={rowKey(item)}>
                <button
                  type="button"
                  onClick={() => onSelect(item)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 text-left"
                >
                  {renderRow(item)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
