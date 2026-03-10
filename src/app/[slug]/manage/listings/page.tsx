"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { formatPrice, SUPPORTED_CURRENCIES } from "@/lib/currency";
import { gradeLabel, type EcomListing } from "@/lib/pricing";

// ---------------------------------------------------------------------------
// Store Page — shows ecom.listings (active listings)
// ---------------------------------------------------------------------------

export default function ListingsPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;

  const [listings, setListings] = useState<EcomListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting
  type SortKey = "card" | "set" | "grade" | "qty" | "cost" | "market" | "calculated" | "price" | "profit" | "status";
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // Inline editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState("");
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data } = await supabase
      .schema("ecom")
      .from("listing_details")
      .select("*")
      .eq("account_id", activeAccountId);

    setListings((data ?? []) as EcomListing[]);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seller's currency (all listings share the same account/currency)
  const sellerCurrency = listings[0]?.currency ?? "AUD";
  const currencySymbol =
    SUPPORTED_CURRENCIES.find((c) => c.code === sellerCurrency)?.symbol ?? "$";
  const fmt = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, sellerCurrency, {}, sellerCurrency);

  // Build rows
  const rows = useMemo(() => {
    return listings.map((listing) => {
      const profit =
        listing.price_cents != null && listing.cost_cents != null
          ? listing.price_cents - listing.cost_cents
          : null;
      return { listing, profit };
    });
  }, [listings]);

  // Sorted rows
  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const sorted = [...rows].sort((a, b) => {
      let av: string | number | null = null;
      let bv: string | number | null = null;
      switch (sortKey) {
        case "card":
          av = a.listing.card_name?.toLowerCase() ?? "";
          bv = b.listing.card_name?.toLowerCase() ?? "";
          break;
        case "set":
          av = a.listing.set_name?.toLowerCase() ?? "";
          bv = b.listing.set_name?.toLowerCase() ?? "";
          break;
        case "grade":
          av = gradeLabel(a.listing.grading_service, a.listing.grade).toLowerCase();
          bv = gradeLabel(b.listing.grading_service, b.listing.grade).toLowerCase();
          break;
        case "qty":
          av = a.listing.quantity;
          bv = b.listing.quantity;
          break;
        case "cost":
          av = a.listing.cost_cents ?? -Infinity;
          bv = b.listing.cost_cents ?? -Infinity;
          break;
        case "market":
          av = a.listing.market_price_cents ?? -Infinity;
          bv = b.listing.market_price_cents ?? -Infinity;
          break;
        case "calculated":
          av = a.listing.calculated_price_cents ?? -Infinity;
          bv = b.listing.calculated_price_cents ?? -Infinity;
          break;
        case "price":
          av = a.listing.price_cents ?? -Infinity;
          bv = b.listing.price_cents ?? -Infinity;
          break;
        case "profit":
          av = a.profit ?? -Infinity;
          bv = b.profit ?? -Infinity;
          break;
        case "status":
          av = a.listing.status;
          bv = b.listing.status;
          break;
      }
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (av < bv) return -1;
      if (av > bv) return 1;
      return 0;
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [rows, sortKey, sortDir]);

  // Summary totals
  const totals = useMemo(() => {
    let totalItems = 0;
    let totalCost = 0;
    let totalValue = 0;
    let totalProfit = 0;

    for (const r of rows) {
      const qty = r.listing.quantity;
      totalItems += qty;
      if (r.listing.cost_cents != null) totalCost += r.listing.cost_cents * qty;
      if (r.listing.price_cents != null) totalValue += r.listing.price_cents * qty;
      if (r.profit != null) totalProfit += r.profit * qty;
    }

    return { totalItems, totalCost, totalValue, totalProfit };
  }, [rows]);

  // Inline price edit handlers
  const startEditing = (listing: EcomListing) => {
    setEditingId(listing.id);
    const price =
      listing.pricing_mode === "fixed"
        ? listing.fixed_price_cents
        : listing.price_cents;
    setEditPrice(price != null ? (price / 100).toFixed(2) : "");
  };

  const savePrice = async (listingId: string) => {
    setSaving(true);
    const cents = Math.round(parseFloat(editPrice) * 100);
    if (isNaN(cents) || cents < 0) {
      setSaving(false);
      return;
    }

    await supabase
      .schema("ecom")
      .from("products")
      .update({
        pricing_mode: "fixed",
        fixed_price_cents: cents,
        price_cents: cents,
        market_multiplier: null,
        market_round_to: null,
        market_extra_cents: null,
      })
      .eq("id", listingId);

    setEditingId(null);
    setSaving(false);
    await loadData();
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">
          Loading store...
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header with link to unlisted */}
      <div className="flex items-center justify-between mb-6">
        <div />
        <Link
          href={`/${slug}/manage/unlisted`}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
        >
          Add Listings
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard label="Listings" value={String(totals.totalItems)} />
        <SummaryCard label="Total Cost" value={fmt(totals.totalCost)} />
        <SummaryCard label="Listing Value" value={fmt(totals.totalValue)} />
        <SummaryCard
          label="Profit"
          value={fmt(totals.totalProfit)}
          color={
            totals.totalProfit > 0
              ? "text-green-600 dark:text-green-400"
              : totals.totalProfit < 0
                ? "text-red-600 dark:text-red-400"
                : undefined
          }
        />
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No listings yet.{" "}
          <Link
            href={`/${slug}/manage/unlisted`}
            className="text-red-500 hover:text-red-600 font-medium"
          >
            Add your first listing
          </Link>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3"></th>
                <SortHeader label="Card" sortKey="card" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Set" sortKey="set" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Grade" sortKey="grade" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Qty" sortKey="qty" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Cost" sortKey="cost" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Market" sortKey="market" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <th className="px-4 py-3 text-right">Rate</th>
                <th className="px-4 py-3 text-center">Mode</th>
                <th className="px-4 py-3 text-right">Mult</th>
                <th className="px-4 py-3 text-right">Round</th>
                <th className="px-4 py-3 text-right">Extra</th>
                <SortHeader label="Calculated" sortKey="calculated" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Price" sortKey="price" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Profit" sortKey="profit" align="right" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
                <SortHeader label="Status" sortKey="status" align="left" activeSortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedRows.map((r) => {
                const isEditing = editingId === r.listing.id;

                return (
                  <tr
                    key={r.listing.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    {/* Image */}
                    <td className="px-4 py-3">
                      {r.listing.image_url ? (
                        <img
                          src={r.listing.image_url}
                          alt={r.listing.card_name ?? ""}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
                          {"\u2014"}
                        </div>
                      )}
                    </td>
                    {/* Card */}
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {r.listing.card_name ?? "\u2014"}
                    </td>
                    {/* Set */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.listing.set_name ?? "\u2014"}
                    </td>
                    {/* Grade */}
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(r.listing.grading_service, r.listing.grade)}
                    </td>
                    {/* Qty */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.listing.quantity}
                    </td>
                    {/* Cost */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.listing.cost_cents)}
                    </td>
                    {/* Market */}
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {fmt(r.listing.market_price_cents)}
                    </td>
                    {/* Exchange Rate */}
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                      {r.listing.exchange_rate != null
                        ? Number(r.listing.exchange_rate).toFixed(4)
                        : "\u2014"}
                    </td>
                    {/* Mode */}
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium ${
                        r.listing.pricing_mode === "fixed"
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                      }`}>
                        {r.listing.pricing_mode === "fixed" ? "Fixed" : "Mkt"}
                      </span>
                    </td>
                    {/* Multiplier */}
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                      {r.listing.pricing_mode === "market" && r.listing.market_multiplier != null
                        ? `${r.listing.market_multiplier}x`
                        : "\u2014"}
                    </td>
                    {/* Round */}
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                      {r.listing.pricing_mode === "market" && r.listing.market_round_to != null
                        ? fmt(r.listing.market_round_to)
                        : "\u2014"}
                    </td>
                    {/* Extra */}
                    <td className="px-4 py-3 text-right text-gray-500 dark:text-gray-400 tabular-nums">
                      {r.listing.pricing_mode === "market" && r.listing.market_extra_cents
                        ? fmt(r.listing.market_extra_cents)
                        : "\u2014"}
                    </td>
                    {/* Calculated */}
                    <td className={`px-4 py-3 text-right ${
                      r.listing.calculated_price_cents != null && r.listing.price_cents != null && r.listing.calculated_price_cents !== r.listing.price_cents
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-gray-400 dark:text-gray-500"
                    }`}>
                      {fmt(r.listing.calculated_price_cents)}
                    </td>
                    {/* Price — editable */}
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-gray-400 text-xs">{currencySymbol}</span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") savePrice(r.listing.id);
                              if (e.key === "Escape") cancelEditing();
                            }}
                            autoFocus
                            disabled={saving}
                            className="w-24 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                          <button
                            onClick={() => savePrice(r.listing.id)}
                            disabled={saving}
                            className="text-green-600 hover:text-green-700 text-xs font-medium"
                          >
                            {saving ? "..." : "Save"}
                          </button>
                          <button
                            onClick={cancelEditing}
                            className="text-gray-400 hover:text-gray-600 text-xs"
                          >
                            &times;
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEditing(r.listing)}
                          className="text-gray-900 dark:text-gray-100 hover:text-red-500 dark:hover:text-red-400 cursor-pointer"
                          title="Click to edit price"
                        >
                          {fmt(r.listing.price_cents)}
                        </button>
                      )}
                    </td>
                    {/* Profit */}
                    <td
                      className={`px-4 py-3 text-right font-medium ${
                        r.profit != null && r.profit > 0
                          ? "text-green-600 dark:text-green-400"
                          : r.profit != null && r.profit < 0
                            ? "text-red-600 dark:text-red-400"
                            : "text-gray-900 dark:text-gray-100"
                      }`}
                    >
                      {fmt(r.profit)}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          r.listing.status === "active"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                      >
                        {r.listing.status === "active" ? "Active" : "Draft"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  sortKey,
  align,
  activeSortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKey: string;
  align: "left" | "right";
  activeSortKey: string | null;
  sortDir: "asc" | "desc";
  onSort: (key: any) => void;
}) {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`px-4 py-3 cursor-pointer select-none hover:text-gray-900 dark:hover:text-gray-100 transition-colors ${
        align === "right" ? "text-right" : ""
      }`}
      onClick={() => onSort(sortKey)}
    >
      <span className="inline-flex items-center gap-1">
        {align === "right" && isActive && (
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
            {sortDir === "asc" ? (
              <path d="M6 2l4 5H2z" />
            ) : (
              <path d="M6 10l4-5H2z" />
            )}
          </svg>
        )}
        {label}
        {align === "left" && isActive && (
          <svg className="w-3 h-3 shrink-0" viewBox="0 0 12 12" fill="currentColor">
            {sortDir === "asc" ? (
              <path d="M6 2l4 5H2z" />
            ) : (
              <path d="M6 10l4-5H2z" />
            )}
          </svg>
        )}
      </span>
    </th>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${color ?? "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </div>
    </div>
  );
}
