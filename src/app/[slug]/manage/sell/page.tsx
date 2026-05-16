"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { gradeLabel, type EcomListing } from "@/lib/pricing";
import { formatPrice } from "@/lib/currency";

// ---------------------------------------------------------------------------
// In-person Point of Sale for the Trading Card Summit (and future events).
// Modes: Order (sell to walk-up) | Trade (give/get cards).
// Persists drafts on complete; survives reload via reload-existing-draft on mount.
// ---------------------------------------------------------------------------

type Mode = "order" | "trade";
type ItemSide = "sold" | "bought" | "traded_in" | "traded_out";
type PaymentMethod = "cash" | "payid_manual" | "bank_transfer";

type DraftItem = {
  key: string; // local key, distinct from DB id
  listing_id: string;
  card_product_id: string;
  card_name: string;
  image_url: string | null;
  grading_service: string | null;
  grade: string | null;
  side: ItemSide;
  quantity: number;
  unit_price_cents: number;
  max_available: number;
};

const ORDER_SIDES: ItemSide[] = ["sold"];
const TRADE_SIDES: ItemSide[] = ["traded_out", "traded_in"];

function uniqueKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function defaultSide(mode: Mode): ItemSide {
  return mode === "order" ? "sold" : "traded_out";
}

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SellPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;

  // -- State ----------------------------------------------------------------
  const [mode, setMode] = useState<Mode>("order");
  const [searchInput, setSearchInput] = useState("");
  const search = useDebounced(searchInput, 250);

  const [results, setResults] = useState<EcomListing[]>([]);
  const [searching, setSearching] = useState(false);

  const [items, setItems] = useState<DraftItem[]>([]);

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [buyerPhone, setBuyerPhone] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [payidRef, setPayidRef] = useState("");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // -- Search ---------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!activeAccountId) return;
      setSearching(true);
      let q = supabase
        .schema("ecom")
        .from("listing_details")
        .select("*")
        .eq("account_id", activeAccountId)
        .eq("status", "active")
        .gt("quantity", 0)
        .limit(30);
      if (search.trim()) {
        q = q.ilike("card_name", `%${search.trim()}%`);
      }
      const { data } = await q;
      if (!cancelled) {
        setResults((data ?? []) as EcomListing[]);
        setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, activeAccountId, search]);

  // -- Cart ops -------------------------------------------------------------
  const currency = items[0]?.["unit_price_cents"] != null && results[0]?.currency
    ? results[0].currency
    : "AUD";

  const addListing = useCallback(
    (listing: EcomListing) => {
      setItems((prev) => {
        const existing = prev.find((i) => i.listing_id === listing.id);
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
            image_url: listing.image_url,
            grading_service: listing.grading_service,
            grade: listing.grade,
            side: defaultSide(mode),
            quantity: 1,
            unit_price_cents: price,
            max_available: listing.quantity,
          },
        ];
      });
    },
    [mode]
  );

  const updateItem = useCallback((key: string, patch: Partial<DraftItem>) => {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const totals = useMemo(() => {
    const cashIn = items.reduce((sum, it) => {
      if (it.side === "sold" || it.side === "traded_out") {
        return sum + it.unit_price_cents * it.quantity;
      }
      if (it.side === "bought" || it.side === "traded_in") {
        return sum - it.unit_price_cents * it.quantity;
      }
      return sum;
    }, 0);
    return { net_cents: cashIn };
  }, [items]);

  // -- Complete -------------------------------------------------------------
  const canComplete =
    items.length > 0 && !completing && activeAccountId !== null;

  const complete = useCallback(async () => {
    if (!canComplete || !activeAccountId) return;
    setError(null);
    setCompleting(true);

    try {
      const buyer_contact =
        buyerName || buyerEmail || buyerPhone
          ? { name: buyerName || null, email: buyerEmail || null, phone: buyerPhone || null }
          : null;

      // 1. Insert transaction
      const { data: tx, error: txErr } = await supabase
        .schema("ecom")
        .from("transactions")
        .insert({
          account_id: activeAccountId,
          type: mode,
          status: "draft",
          buyer_contact,
          currency,
        })
        .select("id")
        .single();
      if (txErr) throw txErr;

      // 2. Insert items
      const rows = items.map((it) => ({
        transaction_id: tx.id,
        side: it.side,
        listing_id: it.listing_id,
        card_product_id: it.card_product_id,
        grading_service: it.grading_service,
        grade: it.grade,
        quantity: it.quantity,
        unit_price_cents: it.unit_price_cents,
      }));
      const { error: itErr } = await supabase
        .schema("ecom")
        .from("transaction_items")
        .insert(rows);
      if (itErr) throw itErr;

      // 3. Payment (if any cash in)
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

      // 4. Decrement listing quantities (app-side; consider DB trigger later)
      for (const it of items) {
        if (it.side !== "sold" && it.side !== "traded_out") continue;
        const newQty = Math.max(0, it.max_available - it.quantity);
        await supabase
          .schema("ecom")
          .from("products")
          .update({ quantity: newQty, status: newQty === 0 ? "sold" : "active" })
          .eq("id", it.listing_id)
          .eq("account_id", activeAccountId);
      }

      // 5. Mark transaction completed
      const { error: doneErr } = await supabase
        .schema("ecom")
        .from("transactions")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", tx.id);
      if (doneErr) throw doneErr;

      // Reset form for next sale
      setItems([]);
      setBuyerName("");
      setBuyerEmail("");
      setBuyerPhone("");
      setPayidRef("");
      setPaymentMethod("cash");
      setSearchInput("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not complete sale");
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
    items,
    mode,
    payidRef,
    paymentMethod,
    supabase,
    totals.net_cents,
  ]);

  // -- Render ---------------------------------------------------------------
  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <header className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
            Sell
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            In-person point of sale — for events and walk-up buyers.
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-gray-200 dark:border-gray-700 p-0.5 bg-white dark:bg-gray-800">
          {(["order", "trade"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setItems((prev) =>
                  prev.map((it) => ({ ...it, side: defaultSide(m) }))
                );
              }}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                mode === m
                  ? "bg-red-500 text-white"
                  : "text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              {m === "order" ? "Sale" : "Trade"}
            </button>
          ))}
        </div>
      </header>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* LEFT: Search + results */}
        <section className="space-y-4">
          <input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search your inventory by card name…"
            autoFocus
            className="w-full px-4 py-3 text-base rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          />

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {searching && results.length === 0 ? (
              <p className="col-span-full text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                Searching…
              </p>
            ) : results.length === 0 ? (
              <p className="col-span-full text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
                No active listings match.
              </p>
            ) : (
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => addListing(r)}
                  className="text-left bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:border-red-400 hover:shadow-md transition-all"
                >
                  <div className="aspect-[5/7] bg-gray-50 dark:bg-gray-900 relative overflow-hidden">
                    {r.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.image_url}
                        alt={r.card_name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : null}
                    {r.quantity > 1 && (
                      <span className="absolute top-1 right-1 px-1.5 py-0.5 text-[10px] font-bold bg-gray-900/70 text-white rounded">
                        ×{r.quantity}
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                      {r.card_name}
                    </p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 line-clamp-1">
                      {r.set_name}
                      {r.grading_service && r.grading_service !== "ungraded"
                        ? ` · ${gradeLabel(r.grading_service, r.grade)}`
                        : ""}
                    </p>
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-1">
                      {formatPrice(
                        r.price_cents ?? r.calculated_price_cents ?? null,
                        r.currency,
                        {},
                        r.currency
                      )}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        {/* RIGHT: Current transaction */}
        <aside className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Current {mode === "order" ? "sale" : "trade"}
          </h2>

          {items.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center border border-dashed border-gray-200 dark:border-gray-700 rounded-lg">
              Tap a card to add it.
            </p>
          ) : (
            <ul className="space-y-2 divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((it) => {
                const allowedSides = mode === "order" ? ORDER_SIDES : TRADE_SIDES;
                return (
                  <li key={it.key} className="pt-2 first:pt-0 space-y-1.5">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 line-clamp-1">
                          {it.card_name}
                        </p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400">
                          {gradeLabel(it.grading_service, it.grade)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(it.key)}
                        className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                        aria-label="Remove"
                      >
                        ×
                      </button>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <div className="inline-flex items-center rounded border border-gray-200 dark:border-gray-700">
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(it.key, {
                              quantity: Math.max(1, it.quantity - 1),
                            })
                          }
                          className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          −
                        </button>
                        <span className="px-2 py-1 min-w-[2rem] text-center text-gray-800 dark:text-gray-200">
                          {it.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            updateItem(it.key, {
                              quantity: Math.min(
                                it.max_available,
                                it.quantity + 1
                              ),
                            })
                          }
                          className="px-2 py-1 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                          disabled={it.quantity >= it.max_available}
                        >
                          +
                        </button>
                      </div>
                      <input
                        type="number"
                        value={(it.unit_price_cents / 100).toFixed(2)}
                        onChange={(e) =>
                          updateItem(it.key, {
                            unit_price_cents: Math.round(
                              parseFloat(e.target.value || "0") * 100
                            ),
                          })
                        }
                        step="0.01"
                        min="0"
                        className="w-24 px-2 py-1 text-right rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                      />
                      {mode === "trade" && (
                        <select
                          value={it.side}
                          onChange={(e) =>
                            updateItem(it.key, {
                              side: e.target.value as ItemSide,
                            })
                          }
                          className="px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                        >
                          {allowedSides.map((s) => (
                            <option key={s} value={s}>
                              {s === "traded_out" ? "We give" : "We get"}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between text-base font-bold">
              <span className="text-gray-600 dark:text-gray-300">
                {totals.net_cents >= 0 ? "Buyer pays" : "We pay"}
              </span>
              <span className="text-gray-900 dark:text-gray-100">
                {formatPrice(Math.abs(totals.net_cents), currency, {}, currency)}
              </span>
            </div>
          </div>

          {/* Buyer */}
          <details className="border-t border-gray-200 dark:border-gray-700 pt-3" open>
            <summary className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 cursor-pointer mb-2">
              Buyer
            </summary>
            <div className="space-y-2">
              <input
                value={buyerName}
                onChange={(e) => setBuyerName(e.target.value)}
                placeholder="Name"
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              />
              <input
                value={buyerEmail}
                onChange={(e) => setBuyerEmail(e.target.value)}
                placeholder="Email (for receipt)"
                type="email"
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              />
              <input
                value={buyerPhone}
                onChange={(e) => setBuyerPhone(e.target.value)}
                placeholder="Phone"
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
              />
            </div>
          </details>

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
            {completing
              ? "Saving…"
              : mode === "order"
                ? "Complete sale"
                : "Record trade"}
          </button>
          <p className="text-[10px] text-gray-400 text-center -mt-2">
            Slug: {slug}
          </p>
        </aside>
      </div>
    </div>
  );
}
