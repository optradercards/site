"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { useProfile } from "@/hooks/useProfile";
import { formatPrice } from "@/lib/currency";
import { gradeLabel, resolveMarketValue, type MarketData } from "@/lib/pricing";
import CardCell from "@/components/CardCell";

// ---------------------------------------------------------------------------
// Inventory list — one row per ecom.inventory_lot
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

type InventoryRow = {
  lot_id: string;
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
  consignor_split_pct: number | null;
  consignor_acceptance:
    | "not_applicable"
    | "pending"
    | "accepted"
    | "disputed"
    | "rejected"
    | null;
  consignment_intake_id: string | null;
  product_name: string | null;
  image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  set_name: string | null;
  brand_name: string | null;
  price_ungraded: number | null;
  price_psa_1: number | null;
  price_psa_2: number | null;
  price_psa_3: number | null;
  price_psa_4: number | null;
  price_psa_5: number | null;
  price_psa_6: number | null;
  price_psa_7: number | null;
  price_psa_8: number | null;
  price_psa_9: number | null;
  price_psa_10: number | null;
  price_psa_9_5: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
};

type LotStatus = {
  lot_id: string;
  quantity_in_grading: number;
};

type ListingKey = {
  card_product_id: string | null;
  custom_product_id: string | null;
  grading_service: string | null;
  grade: string | null;
};

type GroupRow = {
  id: string;
  name: string;
};

type GroupItemLink = {
  group_id: string;
  lot_id: string;
};

function listingKey(
  cardId: string | null,
  customId: string | null,
  service: string | null,
  grade: string | null,
): string {
  return `${cardId ?? ""}|${customId ?? ""}|${service ?? ""}|${grade ?? ""}`;
}

export default function InventoryPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const searchParams = useSearchParams();
  const purchaseIdFilter = searchParams?.get("purchase_id") ?? null;
  const sourceParam = searchParams?.get("source") ?? null;

  const { data: profileData } = useProfile();
  const { data: exchangeRates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";
  const rates = exchangeRates ?? {};

  const fmtCost = (cents: number | null | undefined, srcCurrency: string | null) =>
    formatPrice(
      cents ?? null,
      sellerCurrency,
      rates,
      (srcCurrency ?? sellerCurrency).toUpperCase(),
    );

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [lotStatuses, setLotStatuses] = useState<Map<string, number>>(new Map());
  const [listedKeys, setListedKeys] = useState<Set<string>>(new Set());
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [groupLinks, setGroupLinks] = useState<GroupItemLink[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | AcquisitionSource>(() => {
    if (
      sourceParam &&
      (ACQUISITION_SOURCES as readonly string[]).includes(sourceParam)
    ) {
      return sourceParam as AcquisitionSource;
    }
    return "all";
  });
  const [consignedOnly, setConsignedOnly] = useState(false);
  const [listedMode, setListedMode] = useState<"all" | "listed" | "unlisted">("all");

  type SortCol = "card" | "grade" | "qty" | "cost" | "market" | "source";
  const [sort, setSort] = useState<{ col: SortCol; dir: "asc" | "desc" } | null>(
    null,
  );
  const toggleSort = (col: SortCol) => {
    setSort((prev) => {
      if (!prev || prev.col !== col) return { col, dir: "asc" };
      if (prev.dir === "asc") return { col, dir: "desc" };
      return null;
    });
  };

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    let query = supabase
      .schema("ecom")
      .from("vendor_inventory_summary")
      .select("*")
      .eq("account_id", activeAccountId)
      .order("acquired_at", { ascending: false });

    if (purchaseIdFilter) {
      // The summary view doesn't expose purchase_id, so filter via inventory_lots
      // separately. Fetch ids first.
      const { data: lotIds } = await supabase
        .schema("ecom")
        .from("inventory_lots")
        .select("id")
        .eq("account_id", activeAccountId)
        .eq("purchase_id", purchaseIdFilter);
      const ids = (lotIds ?? []).map((r) => r.id);
      if (ids.length === 0) {
        setRows([]);
        setLotStatuses(new Map());
        setListedKeys(new Set());
        setGroups([]);
        setGroupLinks([]);
        setLoading(false);
        return;
      }
      query = query.in("lot_id", ids);
    }

    const { data: invData } = await query;
    const lots = (invData ?? []) as InventoryRow[];
    setRows(lots);

    if (lots.length === 0) {
      setLotStatuses(new Map());
      setListedKeys(new Set());
      setGroups([]);
      setGroupLinks([]);
      setLoading(false);
      return;
    }

    const lotIds = lots.map((l) => l.lot_id);

    const [statusRes, listingsRes, groupsRes, linksRes] = await Promise.all([
      supabase
        .schema("ecom")
        .from("inventory_lot_status")
        .select("lot_id, quantity_in_grading")
        .in("lot_id", lotIds),
      supabase
        .schema("ecom")
        .from("listings")
        .select("card_product_id, custom_product_id, grading_service, grade")
        .eq("account_id", activeAccountId)
        .neq("status", "archived"),
      supabase
        .schema("ecom")
        .from("inventory_groups")
        .select("id, name")
        .eq("account_id", activeAccountId),
      supabase
        .schema("ecom")
        .from("inventory_group_items")
        .select("group_id, lot_id")
        .in("lot_id", lotIds),
    ]);

    const statusMap = new Map<string, number>();
    for (const s of (statusRes.data ?? []) as LotStatus[]) {
      statusMap.set(s.lot_id, s.quantity_in_grading ?? 0);
    }
    setLotStatuses(statusMap);

    const keys = new Set<string>();
    for (const l of (listingsRes.data ?? []) as ListingKey[]) {
      keys.add(
        listingKey(l.card_product_id, l.custom_product_id, l.grading_service, l.grade),
      );
    }
    setListedKeys(keys);

    setGroups((groupsRes.data ?? []) as GroupRow[]);
    setGroupLinks((linksRes.data ?? []) as GroupItemLink[]);

    setLoading(false);
  }, [supabase, activeAccountId, purchaseIdFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const groupNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of groups) m.set(g.id, g.name);
    return m;
  }, [groups]);

  const groupsByLot = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const link of groupLinks) {
      const name = groupNameById.get(link.group_id);
      if (!name) continue;
      const list = m.get(link.lot_id) ?? [];
      list.push(name);
      m.set(link.lot_id, list);
    }
    return m;
  }, [groupLinks, groupNameById]);

  const filteredRows = useMemo(() => {
    return rows.filter((r) => {
      if (sourceFilter !== "all" && r.acquisition_source !== sourceFilter) return false;
      if (consignedOnly && r.acquisition_source !== "consignment") return false;
      if (search.trim()) {
        const needle = search.trim().toLowerCase();
        const hay = `${r.product_name ?? ""} ${r.set_name ?? ""} ${r.card_number ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      if (listedMode !== "all") {
        const isListed = listedKeys.has(
          listingKey(r.card_product_id, r.custom_product_id, r.grading_service, r.grade),
        );
        if (listedMode === "listed" && !isListed) return false;
        if (listedMode === "unlisted" && isListed) return false;
      }
      return true;
    });
  }, [rows, sourceFilter, consignedOnly, search, listedMode, listedKeys]);

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows;
    const dir = sort.dir === "asc" ? 1 : -1;
    const marketUsdFor = (r: InventoryRow): number | null =>
      resolveMarketValue(
        {
          product_id: r.card_product_id ?? "",
          price_ungraded: r.price_ungraded,
          price_psa_1: r.price_psa_1,
          price_psa_2: r.price_psa_2,
          price_psa_3: r.price_psa_3,
          price_psa_4: r.price_psa_4,
          price_psa_5: r.price_psa_5,
          price_psa_6: r.price_psa_6,
          price_psa_7: r.price_psa_7,
          price_psa_8: r.price_psa_8,
          price_psa_9: r.price_psa_9,
          price_psa_10: r.price_psa_10,
          price_psa_9_5: r.price_psa_9_5,
          price_bgs: r.price_bgs,
          price_cgc: r.price_cgc,
        } as MarketData,
        r.grading_service,
        r.grade,
      );
    const getKey = (r: InventoryRow): string | number | null => {
      switch (sort.col) {
        case "card":
          return (r.product_name ?? "").toLowerCase();
        case "grade":
          return gradeLabel(r.grading_service, r.grade).toLowerCase();
        case "qty":
          return r.quantity_remaining;
        case "cost":
          return r.acquisition_cost_cents;
        case "market":
          return marketUsdFor(r);
        case "source":
          return r.acquisition_source;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading inventory...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          {purchaseIdFilter && (
            <Link
              href={`/${slug}/manage/inventory`}
              className="text-sm text-red-500 hover:text-red-600"
            >
              &larr; Clear purchase filter
            </Link>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/${slug}/manage/admin/import-sales`}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Import sales (CSV)
          </Link>
          <Link
            href={`/${slug}/manage/inventory/receive?mode=purchase`}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
          >
            Record purchase
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <label className="block flex-1 min-w-[200px]">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Search
            </span>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Card name, set, number"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Source
            </span>
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value as typeof sourceFilter)}
              className="mt-1 block w-44 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="all">All sources</option>
              {ACQUISITION_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Listing
            </span>
            <select
              value={listedMode}
              onChange={(e) => setListedMode(e.target.value as typeof listedMode)}
              className="mt-1 block w-44 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="all">All</option>
              <option value="listed">Currently listed</option>
              <option value="unlisted">Not listed</option>
            </select>
          </label>
          <label className="inline-flex items-center gap-2 pb-2">
            <input
              type="checkbox"
              checked={consignedOnly}
              onChange={(e) => setConsignedOnly(e.target.checked)}
              className="rounded text-red-500 focus:ring-red-500"
            />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              Consigned only
            </span>
          </label>
        </div>
      </div>

      {/* Table */}
      {filteredRows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          {rows.length === 0
            ? "No inventory lots yet."
            : "No lots match the current filters."}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3"></th>
                <SortTh col="card" align="left" sort={sort} onToggle={toggleSort}>Card</SortTh>
                <SortTh col="grade" align="left" sort={sort} onToggle={toggleSort}>Grade</SortTh>
                <SortTh col="qty" align="right" sort={sort} onToggle={toggleSort}>Qty</SortTh>
                <SortTh col="cost" align="right" sort={sort} onToggle={toggleSort}>Cost / unit</SortTh>
                <SortTh col="market" align="right" sort={sort} onToggle={toggleSort}>Market ref</SortTh>
                <SortTh col="source" align="left" sort={sort} onToggle={toggleSort}>Source</SortTh>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Groups</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {sortedRows.map((r) => {
                const marketUsd = resolveMarketValue(
                  {
                    product_id: r.card_product_id ?? "",
                    price_ungraded: r.price_ungraded,
                    price_psa_1: r.price_psa_1,
                    price_psa_2: r.price_psa_2,
                    price_psa_3: r.price_psa_3,
                    price_psa_4: r.price_psa_4,
                    price_psa_5: r.price_psa_5,
                    price_psa_6: r.price_psa_6,
                    price_psa_7: r.price_psa_7,
                    price_psa_8: r.price_psa_8,
                    price_psa_9: r.price_psa_9,
                    price_psa_10: r.price_psa_10,
                    price_psa_9_5: r.price_psa_9_5,
                    price_bgs: r.price_bgs,
                    price_cgc: r.price_cgc,
                  } as MarketData,
                  r.grading_service,
                  r.grade,
                );
                const inGrading = lotStatuses.get(r.lot_id) ?? 0;
                const isListed = listedKeys.has(
                  listingKey(r.card_product_id, r.custom_product_id, r.grading_service, r.grade),
                );
                const lotGroups = groupsByLot.get(r.lot_id) ?? [];

                return (
                  <tr
                    key={r.lot_id}
                    className="align-top hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      {r.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={r.image_url}
                          alt={r.product_name ?? ""}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
                          {"—"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <CardCell
                        cardProductId={r.card_product_id}
                        name={r.product_name}
                        cardNumber={r.card_number}
                        setName={r.set_name}
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(r.grading_service, r.grade)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums align-top">
                      <div className="text-gray-900 dark:text-gray-100">
                        {r.quantity_remaining}
                      </div>
                      {r.quantity_acquired !== r.quantity_remaining && (
                        <div className="text-xs text-gray-400">
                          of {r.quantity_acquired}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                      {fmtCost(r.acquisition_cost_cents, r.acquisition_currency)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100 tabular-nums">
                      {marketUsd != null
                        ? formatPrice(marketUsd, sellerCurrency, rates, "USD")
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium">
                        {r.acquisition_source.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {isListed && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                            Listed
                          </span>
                        )}
                        {inGrading > 0 && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                            {inGrading} grading
                          </span>
                        )}
                        {r.acquisition_source === "consignment" && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
                            Consigned
                          </span>
                        )}
                        {r.consignor_acceptance === "pending" && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                            title="Awaiting consignor confirmation"
                          >
                            Awaiting confirmation
                          </span>
                        )}
                        {r.consignor_acceptance === "disputed" && (
                          <span
                            className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            title="Consignor disputed this lot"
                          >
                            Disputed
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div className="flex flex-wrap gap-1">
                        {lotGroups.length === 0 ? (
                          <span className="text-gray-400">{"—"}</span>
                        ) : (
                          lotGroups.map((g) => (
                            <span
                              key={g}
                              className="inline-flex items-center px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            >
                              {g}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/${slug}/manage/inventory/${r.lot_id}`}
                        className="text-sm font-medium text-red-500 hover:text-red-600"
                      >
                        Edit
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
      className={`px-4 py-3 ${align === "right" ? "text-right" : "text-left"}`}
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
