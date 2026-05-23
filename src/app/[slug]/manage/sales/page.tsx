"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// /[slug]/manage/sales — completed orders for the active account.
// Aggregates ecom.transactions + transaction_items + sale_allocations into
// one row per transaction, with cost basis from the lot snapshots so margin
// is stable.
// ---------------------------------------------------------------------------

type SaleAllocation = {
  quantity: number;
  acquisition_cost_cents_snapshot: number | null;
  acquisition_currency_snapshot: string | null;
  consignor_split_pct_snapshot: number | null;
  consignor_chargeback_per_unit_snapshot: number | null;
};

// Effective cost for a single sale_allocation:
//   - Consignment (split_pct set): unit_price * qty * split/100 − chargeback * qty
//     i.e. what we owe the consignor for those units.
//   - Otherwise: literal acquisition_cost_cents_snapshot * qty.
// Returns null when neither path can be computed.
function allocCostCents(a: SaleAllocation, unitPriceCents: number): number | null {
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

type CardLite = {
  id: string;
  name: string | null;
  image_url: string | null;
  card_number: string | null;
};

type SalesItem = {
  id: string;
  side: "sold" | "bought" | "traded_in" | "traded_out";
  card_product_id: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity: number;
  unit_price_cents: number;
  card: CardLite | null;
  sale_allocations: SaleAllocation[];
};

type SalesTx = {
  id: string;
  status: string;
  currency: string;
  subtotal_cents: number;
  total_cents: number;
  notes: string | null;
  completed_at: string | null;
  source_provider: string | null;
  source_id: string | null;
  transaction_items: SalesItem[];
};

type Row = {
  tx: SalesTx;
  itemCount: number;
  totalQty: number;
  saleCents: number;
  costCents: number | null;
  marginCents: number | null;
  marginPct: number | null;
  primaryItem: SalesItem | null;
};

function gradeLabel(service: string | null, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

function sourceLabel(s: string | null): string {
  if (s === null) return "Manual";
  if (s === "csv_import") return "CSV";
  if (s === "shiny_sold") return "Shiny";
  return s;
}

function sourceBadgeCls(s: string | null): string {
  if (s === "csv_import")
    return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
  if (s === "shiny_sold")
    return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300";
  return "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
}

export default function SalesPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  const [txs, setTxs] = useState<SalesTx[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters — initialized from query string; pushed back via the effect
  // below. Lets the user share / bookmark a filtered view.
  const [sourceFilter, setSourceFilter] = useState<
    "all" | "manual" | "csv_import" | "shiny_sold"
  >(() => {
    const v = searchParams.get("source");
    return v === "manual" || v === "csv_import" || v === "shiny_sold" ? v : "all";
  });
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [dateFrom, setDateFrom] = useState<string>(
    () => searchParams.get("from") ?? "",
  );
  const [dateTo, setDateTo] = useState<string>(
    () => searchParams.get("to") ?? "",
  );

  useEffect(() => {
    const next = new URLSearchParams();
    if (sourceFilter !== "all") next.set("source", sourceFilter);
    if (search.trim()) next.set("q", search.trim());
    if (dateFrom) next.set("from", dateFrom);
    if (dateTo) next.set("to", dateTo);
    const qs = next.toString();
    const url = qs ? `${pathname}?${qs}` : pathname;
    if (url !== `${pathname}${window.location.search}`) {
      router.replace(url, { scroll: false });
    }
  }, [sourceFilter, search, dateFrom, dateTo, pathname, router]);

  type SortCol = "date" | "card" | "qty" | "sale" | "cost" | "margin" | "source";
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" } | null>(
    { col: "date", dir: "desc" },
  );
  const toggleSort = (col: SortCol) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  };

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .schema("ecom")
      .from("transactions")
      .select(
        `
          id, status, currency, subtotal_cents, total_cents, notes,
          completed_at, source_provider, source_id,
          transaction_items (
            id, side, card_product_id, grading_service, grade, quantity, unit_price_cents,
            sale_allocations ( quantity, acquisition_cost_cents_snapshot, acquisition_currency_snapshot,
              consignor_split_pct_snapshot, consignor_chargeback_per_unit_snapshot )
          )
        `,
      )
      .eq("account_id", activeAccountId)
      .eq("type", "order")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1000);

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const txsRaw = (data ?? []) as unknown as SalesTx[];

    // Fan out a single cards.products lookup for every card referenced
    const cardIds = Array.from(
      new Set(
        txsRaw.flatMap((t) =>
          t.transaction_items
            .map((i) => i.card_product_id)
            .filter((x): x is string => !!x),
        ),
      ),
    );
    let cardMap = new Map<string, CardLite>();
    if (cardIds.length > 0) {
      const { data: cardRows } = await supabase
        .schema("cards")
        .from("products")
        .select("id, name, image_url, card_number")
        .in("id", cardIds);
      cardMap = new Map(
        ((cardRows ?? []) as CardLite[]).map((c) => [c.id, c]),
      );
    }
    for (const t of txsRaw) {
      for (const it of t.transaction_items) {
        it.card = it.card_product_id
          ? (cardMap.get(it.card_product_id) ?? null)
          : null;
      }
    }
    setTxs(txsRaw);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: Row[] = useMemo(() => {
    return txs.map((tx) => {
      // Show every line on the transaction — sold + traded-in alike — so
      // mixed tickets surface the trade-in instead of hiding it. The cost /
      // margin math still keys off outbound items only (trade-ins have no
      // sale_allocations and aren't consuming inventory).
      const outboundItems = tx.transaction_items.filter(
        (i) => i.side === "sold" || i.side === "traded_out",
      );
      const isPureBuy = outboundItems.length === 0;
      const items = tx.transaction_items;
      const itemCount = items.length;
      const totalQty = items.reduce((s, i) => s + i.quantity, 0);
      const saleCents = tx.total_cents;
      let costCents: number | null = null;
      let anyCost = false;
      for (const it of items) {
        for (const a of it.sale_allocations ?? []) {
          const c = allocCostCents(a, it.unit_price_cents);
          if (c != null) {
            anyCost = true;
            costCents = (costCents ?? 0) + c;
          }
        }
      }
      if (!anyCost) {
        // No allocations = either no outbound items (pure buy: cost = 0,
        // margin = sale) or a sale where lots aren't yet allocated (cost
        // genuinely unknown). Distinguish: pure buys always have cost 0.
        costCents = isPureBuy ? 0 : null;
      }
      const marginCents = costCents != null ? saleCents - costCents : null;
      const marginPct =
        costCents != null && costCents > 0
          ? (marginCents! / costCents) * 100
          : null;
      // For the single-item collapsed view prefer an outbound item as the
      // "primary" card; only fall back to an inbound item on pure buys.
      const primaryItem = outboundItems[0] ?? items[0] ?? null;
      return {
        tx,
        itemCount,
        totalQty,
        saleCents,
        costCents,
        marginCents,
        marginPct,
        primaryItem,
      };
    });
  }, [txs]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sourceFilter !== "all") {
        const sp = r.tx.source_provider;
        if (sourceFilter === "manual" && sp !== null) return false;
        if (sourceFilter === "csv_import" && sp !== "csv_import") return false;
        if (sourceFilter === "shiny_sold" && sp !== "shiny_sold") return false;
      }
      if (dateFrom || dateTo) {
        const d = r.tx.completed_at;
        if (!d) return false;
        const iso = d.slice(0, 10);
        if (dateFrom && iso < dateFrom) return false;
        if (dateTo && iso > dateTo) return false;
      }
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const hay =
          r.primaryItem?.card?.name?.toLowerCase() ??
          r.primaryItem?.card?.card_number?.toLowerCase() ??
          "";
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, search, dateFrom, dateTo]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    const getKey = (r: Row): string | number | null => {
      switch (sort.col) {
        case "date":
          return r.tx.completed_at;
        case "card":
          return r.primaryItem?.card?.name?.toLowerCase() ?? "";
        case "qty":
          return r.totalQty;
        case "sale":
          return r.saleCents;
        case "cost":
          return r.costCents;
        case "margin":
          return r.marginCents;
        case "source":
          return r.tx.source_provider ?? "";
      }
    };
    return [...filteredRows].sort((a, b) => {
      const av = getKey(a);
      const bv = getKey(b);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return 0;
    });
  }, [filteredRows, sort]);

  const grand = useMemo(() => {
    let sale = 0;
    let cost = 0;
    let anyCost = false;
    for (const r of sortedRows) {
      sale += r.saleCents;
      if (r.costCents != null) {
        cost += r.costCents;
        anyCost = true;
      }
    }
    return {
      sale,
      cost: anyCost ? cost : null,
      margin: anyCost ? sale - cost : null,
    };
  }, [sortedRows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-gray-500 dark:text-gray-400">
        Loading sales…
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Sales
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Every completed order on this account — POS sales, Shiny imports,
            CSV imports.
          </p>
        </div>
        <Link
          href={`/${slug}/manage/sell`}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
        >
          New sale
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Search
            </label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Card name or number"
              className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Source
            </label>
            <select
              value={sourceFilter}
              onChange={(e) =>
                setSourceFilter(e.target.value as typeof sourceFilter)
              }
              className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="all">All</option>
              <option value="manual">Manual (POS)</option>
              <option value="csv_import">CSV imports</option>
              <option value="shiny_sold">Shiny imports</option>
            </select>
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              From
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              To
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </div>
          {(dateFrom || dateTo) && (
            <button
              type="button"
              onClick={() => {
                setDateFrom("");
                setDateTo("");
              }}
              className="self-end text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline pb-2"
            >
              Clear dates
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Summary strip */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap gap-6 text-sm">
        <Counter label="Sales" value={String(sortedRows.length)} />
        <Counter
          label="Revenue"
          value={formatPrice(grand.sale, sellerCurrency, rates ?? {}, sellerCurrency)}
        />
        <Counter
          label="Cost basis"
          value={
            grand.cost != null
              ? formatPrice(grand.cost, sellerCurrency, rates ?? {}, sellerCurrency)
              : "—"
          }
        />
        <Counter
          label="Margin"
          value={
            grand.margin != null
              ? formatPrice(grand.margin, sellerCurrency, rates ?? {}, sellerCurrency)
              : "—"
          }
          color={
            grand.margin != null
              ? grand.margin >= 0
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
              : undefined
          }
        />
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {sortedRows.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            {txs.length === 0
              ? "No completed sales yet."
              : "No sales match the current filters."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <SortTh col="date" align="left" sort={sort} onToggle={toggleSort}>Date</SortTh>
                  <th className="px-3 py-2 text-left"></th>
                  <SortTh col="card" align="left" sort={sort} onToggle={toggleSort}>Card</SortTh>
                  <th className="px-3 py-2 text-left">Grade</th>
                  <SortTh col="qty" align="right" sort={sort} onToggle={toggleSort}>Qty</SortTh>
                  <SortTh col="sale" align="right" sort={sort} onToggle={toggleSort}>Sale</SortTh>
                  <SortTh col="cost" align="right" sort={sort} onToggle={toggleSort}>Cost</SortTh>
                  <SortTh col="margin" align="right" sort={sort} onToggle={toggleSort}>Margin</SortTh>
                  <SortTh col="source" align="left" sort={sort} onToggle={toggleSort}>Source</SortTh>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {sortedRows.map((r) => {
                  const tx = r.tx;
                  const item = r.primaryItem;
                  const isMulti = r.itemCount > 1;
                  const isExpanded = expandedIds.has(tx.id);
                  return (
                    <Fragment key={tx.id}>
                    <tr className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/30">
                      <td className="px-3 py-3 whitespace-nowrap">
                        <Link
                          href={`/${slug}/manage/sales/${tx.id}`}
                          className="text-gray-700 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:underline"
                        >
                          {tx.completed_at
                            ? new Date(tx.completed_at).toLocaleDateString()
                            : "—"}
                        </Link>
                      </td>
                      <td className="px-3 py-3">
                        {!isMulti && item?.card?.image_url ? (
                          <ZoomableImage
                            src={item.card.image_url}
                            alt={item.card.name ?? ""}
                            className="w-10 h-14 object-contain rounded"
                          />
                        ) : (
                          <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                        {isMulti ? (
                          <button
                            type="button"
                            onClick={() => toggleExpanded(tx.id)}
                            className="flex items-center gap-1.5 font-medium text-left hover:text-red-600 dark:hover:text-red-400"
                            aria-expanded={isExpanded}
                          >
                            <span className="text-gray-400 dark:text-gray-500 text-xs leading-none w-3 inline-block">
                              {isExpanded ? "▼" : "▶"}
                            </span>
                            <span>{r.itemCount} items</span>
                          </button>
                        ) : (
                          <>
                            <p className="font-medium">
                              {item?.card?.name ?? "(unknown card)"}
                              {item?.card?.card_number && (
                                <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                                  #{item.card.card_number}
                                </span>
                              )}
                            </p>
                            {tx.notes && (
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                {tx.notes}
                              </p>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                        {isMulti
                          ? "—"
                          : gradeLabel(item?.grading_service ?? null, item?.grade ?? null)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums">
                        {r.totalQty}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap">
                        {formatPrice(r.saleCents, sellerCurrency, rates ?? {}, tx.currency)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.costCents != null
                          ? formatPrice(r.costCents, sellerCurrency, rates ?? {}, tx.currency)
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                        {r.marginCents != null ? (
                          <span
                            className={
                              r.marginCents >= 0
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }
                          >
                            {formatPrice(r.marginCents, sellerCurrency, rates ?? {}, tx.currency)}
                            {r.marginPct != null && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                ({r.marginPct >= 0 ? "+" : ""}
                                {r.marginPct.toFixed(0)}%)
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span
                          className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${sourceBadgeCls(tx.source_provider)}`}
                        >
                          {sourceLabel(tx.source_provider)}
                        </span>
                      </td>
                    </tr>
                    {isMulti && isExpanded && tx.transaction_items.map((it) => {
                      const isInbound =
                        it.side === "bought" || it.side === "traded_in";
                      const itemSaleCents = it.unit_price_cents * it.quantity;
                      let itemCostCents: number | null = null;
                      let anyCost = false;
                      for (const a of it.sale_allocations ?? []) {
                        const c = allocCostCents(a, it.unit_price_cents);
                        if (c != null) {
                          anyCost = true;
                          itemCostCents = (itemCostCents ?? 0) + c;
                        }
                      }
                      if (!anyCost) itemCostCents = null;
                      const itemMarginCents =
                        !isInbound && itemCostCents != null
                          ? itemSaleCents - itemCostCents
                          : null;
                      const itemMarginPct =
                        !isInbound &&
                        itemCostCents != null &&
                        itemCostCents > 0
                          ? (itemMarginCents! / itemCostCents) * 100
                          : null;
                      return (
                        <tr
                          key={it.id}
                          className="align-top bg-gray-50/60 dark:bg-gray-900/30"
                        >
                          <td className="px-3 py-2"></td>
                          <td className="px-3 py-2">
                            {it.card?.image_url ? (
                              <ZoomableImage
                                src={it.card.image_url}
                                alt={it.card.name ?? ""}
                                className="w-10 h-14 object-contain rounded"
                              />
                            ) : (
                              <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-gray-900 dark:text-gray-100">
                            <div className="flex items-center gap-2">
                              {isInbound && (
                                <span
                                  className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
                                  title="Card we took in (trade-in or buy)"
                                >
                                  Trade-in
                                </span>
                              )}
                              <p className="font-medium text-sm">
                                {it.card?.name ?? "(unknown card)"}
                                {it.card?.card_number && (
                                  <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                                    #{it.card.card_number}
                                  </span>
                                )}
                              </p>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-gray-600 dark:text-gray-400 text-sm">
                            {gradeLabel(it.grading_service, it.grade)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-sm">
                            {it.quantity}
                          </td>
                          <td
                            className={
                              isInbound
                                ? "px-3 py-2 text-right tabular-nums text-gray-500 dark:text-gray-400 whitespace-nowrap text-sm"
                                : "px-3 py-2 text-right tabular-nums text-gray-900 dark:text-gray-100 whitespace-nowrap text-sm"
                            }
                            title={
                              isInbound
                                ? "Trade-in value credited to the customer"
                                : undefined
                            }
                          >
                            {isInbound ? "−" : ""}
                            {formatPrice(itemSaleCents, sellerCurrency, rates ?? {}, tx.currency)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap text-sm">
                            {isInbound
                              ? "—"
                              : itemCostCents != null
                                ? formatPrice(itemCostCents, sellerCurrency, rates ?? {}, tx.currency)
                                : "—"}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap text-sm">
                            {isInbound ? (
                              "—"
                            ) : itemMarginCents != null ? (
                              <span
                                className={
                                  itemMarginCents >= 0
                                    ? "text-green-600 dark:text-green-400"
                                    : "text-red-600 dark:text-red-400"
                                }
                              >
                                {formatPrice(itemMarginCents, sellerCurrency, rates ?? {}, tx.currency)}
                                {itemMarginPct != null && (
                                  <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                                    ({itemMarginPct >= 0 ? "+" : ""}
                                    {itemMarginPct.toFixed(0)}%)
                                  </span>
                                )}
                              </span>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-3 py-2"></td>
                        </tr>
                      );
                    })}
                    </Fragment>
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

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`text-xl font-semibold ${color ?? "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </p>
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
