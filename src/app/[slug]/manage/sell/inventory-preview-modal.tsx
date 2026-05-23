"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatPrice } from "@/lib/currency";
import { gradeLabel, resolveMarketValue, type MarketData } from "@/lib/pricing";

// Pre-sale inventory peek for the cards in the cart — vendor sees cost
// basis, source (purchase/consignment), market reference and a FIFO margin
// estimate so they can sanity-check pricing before completing the sale.

type InventoryLot = {
  id: string;
  card_product_id: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_remaining: number;
  acquisition_cost_cents: number | null;
  acquisition_currency: string;
  acquisition_source: string;
  acquired_at: string;
  consignor_name: string | null;
  consignor_split_pct: number | null;
};

export type CartItemForPreview = {
  key: string;
  // "out" = selling to customer (we want margin vs cost basis here).
  // "in"  = taking in from customer (we want to know how much we already
  //         have so we don't accept duplicate stock of something we're
  //         already heavy on).
  direction: "out" | "in";
  card_product_id: string | null;
  card_name: string;
  grading_service: string | null;
  grade: string | null;
  quantity: number;
  unit_price_cents: number;
};

export default function InventoryPreviewModal({
  isOpen,
  onClose,
  accountId,
  items,
  currency,
}: {
  isOpen: boolean;
  onClose: () => void;
  accountId: string | null;
  items: CartItemForPreview[];
  currency: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [lots, setLots] = useState<InventoryLot[]>([]);
  const [marketByProduct, setMarketByProduct] = useState<
    Map<string, MarketData>
  >(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !accountId) return;
    const productIds = Array.from(
      new Set(
        items
          .map((i) => i.card_product_id)
          .filter((x): x is string => !!x),
      ),
    );
    if (productIds.length === 0) {
      setLots([]);
      setMarketByProduct(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [lotsRes, marketRes] = await Promise.all([
        supabase
          .schema("ecom")
          .from("inventory_lots")
          .select(
            "id, card_product_id, grading_service, grade, quantity_remaining, " +
              "acquisition_cost_cents, acquisition_currency, acquisition_source, " +
              "acquired_at, consignor_name, consignor_split_pct",
          )
          .eq("account_id", accountId)
          .in("card_product_id", productIds)
          .gt("quantity_remaining", 0)
          .order("acquired_at", { ascending: true }),
        supabase
          .schema("cards")
          .from("market_data")
          .select("*")
          .in("product_id", productIds),
      ]);
      if (cancelled) return;
      setLots((lotsRes.data ?? []) as unknown as InventoryLot[]);
      const market = new Map<string, MarketData>();
      for (const m of (marketRes.data ?? []) as MarketData[]) {
        market.set(m.product_id, m);
      }
      setMarketByProduct(market);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, accountId, items, supabase]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const matchesVariant = (lot: InventoryLot, item: CartItemForPreview) => {
    if (lot.card_product_id !== item.card_product_id) return false;
    const ls = (lot.grading_service ?? "ungraded").toLowerCase();
    const is = (item.grading_service ?? "ungraded").toLowerCase();
    if (ls !== is) return false;
    return (lot.grade ?? null) === (item.grade ?? null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
              Inventory preview
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Cost basis, market reference and FIFO margin estimate for each
              cart item.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {items.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              No outbound items in the cart yet.
            </p>
          ) : loading ? (
            <p className="px-5 py-10 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading…
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {items.map((item) => {
                const itemLots = lots.filter((l) => matchesVariant(l, item));
                const market = item.card_product_id
                  ? marketByProduct.get(item.card_product_id)
                  : undefined;
                const marketUsd = market
                  ? resolveMarketValue(
                      market,
                      item.grading_service,
                      item.grade,
                    )
                  : null;
                const isOutbound = item.direction === "out";
                const lineTotal = item.unit_price_cents * item.quantity;

                // Outbound (selling): FIFO walk to estimate cost + margin.
                let qtyToCover = item.quantity;
                let estCostCents = 0;
                let costGap = false;
                if (isOutbound) {
                  for (const lot of itemLots) {
                    if (qtyToCover <= 0) break;
                    const take = Math.min(qtyToCover, lot.quantity_remaining);
                    if (lot.acquisition_cost_cents == null) {
                      costGap = true;
                    } else {
                      estCostCents += lot.acquisition_cost_cents * take;
                    }
                    qtyToCover -= take;
                  }
                }
                const insufficientStock = isOutbound && qtyToCover > 0;
                const fullyCosted =
                  isOutbound && !insufficientStock && !costGap && itemLots.length > 0;
                const margin = fullyCosted ? lineTotal - estCostCents : null;

                // Inbound (taking in): stock context — total of this exact
                // variant already on hand, so vendor can spot duplicates.
                const existingStockQty = itemLots.reduce(
                  (s, l) => s + l.quantity_remaining,
                  0,
                );
                const heavyStock = !isOutbound && existingStockQty >= 5;

                return (
                  <li key={item.key} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              isOutbound
                                ? "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300"
                                : "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                            }
                          >
                            {isOutbound ? "Sell" : "Trade-in"}
                          </span>
                          <p className="text-base font-medium text-gray-900 dark:text-gray-100 truncate">
                            {item.card_name}
                          </p>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {gradeLabel(item.grading_service, item.grade)} ·{" "}
                          {isOutbound ? "selling" : "taking in"} ×
                          {item.quantity} @{" "}
                          {formatPrice(item.unit_price_cents, currency, {}, currency)}{" "}
                          ={" "}
                          <span className="font-semibold">
                            {formatPrice(lineTotal, currency, {}, currency)}
                          </span>
                        </p>
                      </div>
                      <div className="text-right text-xs tabular-nums shrink-0">
                        {marketUsd != null && (
                          <div className="text-gray-500 dark:text-gray-400">
                            mkt USD{" "}
                            <span className="font-medium">
                              ${(marketUsd / 100).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {isOutbound ? (
                          <>
                            {fullyCosted && (
                              <div className="text-gray-500 dark:text-gray-400">
                                cost{" "}
                                {formatPrice(estCostCents, currency, {}, currency)}
                              </div>
                            )}
                            {margin !== null && (
                              <div
                                className={
                                  margin > 0
                                    ? "text-green-600 dark:text-green-400 font-semibold"
                                    : margin < 0
                                      ? "text-red-600 dark:text-red-400 font-semibold"
                                      : "text-gray-700 dark:text-gray-300"
                                }
                              >
                                margin{" "}
                                {formatPrice(margin, currency, {}, currency)}
                              </div>
                            )}
                            {costGap && (
                              <div className="text-amber-600 dark:text-amber-400 text-[11px] mt-0.5">
                                cost incomplete
                              </div>
                            )}
                            {insufficientStock && (
                              <div className="text-red-600 dark:text-red-400 text-[11px] mt-0.5">
                                short {qtyToCover}
                              </div>
                            )}
                          </>
                        ) : (
                          <div
                            className={
                              heavyStock
                                ? "text-amber-600 dark:text-amber-400 font-semibold"
                                : existingStockQty > 0
                                  ? "text-gray-600 dark:text-gray-300"
                                  : "text-gray-400 dark:text-gray-500"
                            }
                          >
                            {existingStockQty > 0
                              ? `already have ×${existingStockQty}`
                              : "new to stock"}
                          </div>
                        )}
                      </div>
                    </div>
                    {itemLots.length === 0 ? (
                      <p className="text-xs text-gray-400 dark:text-gray-500 italic">
                        {isOutbound
                          ? "No backing inventory for this variant."
                          : "Nothing of this variant in stock yet."}
                      </p>
                    ) : (
                      <ul className="mt-2 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                        {itemLots.map((lot) => (
                          <li
                            key={lot.id}
                            className="flex items-center justify-between gap-3"
                          >
                            <span className="truncate">
                              {new Date(lot.acquired_at).toLocaleDateString()}{" "}
                              · {lot.acquisition_source.replace(/_/g, " ")}
                              {lot.consignor_name &&
                                ` · ${lot.consignor_name}${lot.consignor_split_pct != null ? ` ${lot.consignor_split_pct}%` : ""}`}
                            </span>
                            <span className="font-mono tabular-nums shrink-0">
                              ×{lot.quantity_remaining}
                              {lot.acquisition_cost_cents != null
                                ? ` @ ${formatPrice(lot.acquisition_cost_cents, lot.acquisition_currency, {}, lot.acquisition_currency)}`
                                : " · cost unknown"}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
