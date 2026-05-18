"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "collections" | "items" | "history";

interface Stats {
  collections: number;
  wishlists: number;
  items: number;
  forSale: number;
  valueSnapshots: number;
}

interface Collection {
  id: string;
  name: string | null;
  source_provider: string | null;
  source_account_id: string | null;
  is_wishlist: boolean;
  created_at: string;
}

interface CollectionItem {
  id: string;
  product_id: string;
  collection_id: string;
  grading_service: string | null;
  grade: string | null;
  purchase_price_cents: number | null;
  purchase_price_currency: string | null;
  purchase_date: string | null;
  current_value_cents: number | null;
  quantity: number | null;
  is_wishlist: boolean | null;
  is_for_sale: boolean | null;
  notes: string | null;
  created_at: string;
  product_name?: string | null;
  collection_name?: string | null;
}

interface ValueHistory {
  id: string;
  account_id: string;
  snapshot_date: string;
  total_value_cents: number | null;
  graded_value_cents: number | null;
  ungraded_value_cents: number | null;
  total_cards: number | null;
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

const PAGE_SIZE = 50;

export default function CollectionsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [valueHistory, setValueHistory] = useState<ValueHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      const cards = supabase.schema("cards");
      const head = { count: "exact" as const, head: true };
      const [collections, wishlists, items, forSale, valueHistory] =
        await Promise.all([
          cards.from("collections").select("*", head),
          cards.from("collections").select("*", head).eq("is_wishlist", true),
          cards.from("collection_items").select("*", head),
          cards
            .from("collection_items")
            .select("*", head)
            .eq("is_for_sale", true),
          cards.from("collection_value_history").select("*", head),
        ]);
      setStats({
        collections: collections.count ?? 0,
        wishlists: wishlists.count ?? 0,
        items: items.count ?? 0,
        forSale: forSale.count ?? 0,
        valueSnapshots: valueHistory.count ?? 0,
      });
    })();
  }, [supabase]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    const from = page * PAGE_SIZE;
    const to = (page + 1) * PAGE_SIZE - 1;

    if (tab === "collections") {
      const { data } = await supabase
        .schema("cards")
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false })
        .range(from, to);
      const rows = (data ?? []) as Collection[];
      setCollections(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } else if (tab === "items") {
      const { data } = await supabase
        .schema("cards")
        .from("collection_items")
        .select(
          `id, product_id, collection_id, grading_service, grade,
           purchase_price_cents, purchase_price_currency, purchase_date,
           current_value_cents, quantity, is_wishlist, is_for_sale, notes,
           created_at,
           product:products(name),
           collection:collections(name)`
        )
        .order("created_at", { ascending: false })
        .range(from, to);
      const rows = (data ?? []).map((r: unknown) => {
        const row = r as CollectionItem & {
          product?: { name?: string } | null;
          collection?: { name?: string } | null;
        };
        return {
          ...row,
          product_name: row.product?.name ?? null,
          collection_name: row.collection?.name ?? null,
        } as CollectionItem;
      });
      setItems(rows);
      setHasMore(rows.length === PAGE_SIZE);
    } else {
      const { data } = await supabase
        .schema("cards")
        .from("collection_value_history")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .range(from, to);
      const rows = (data ?? []) as ValueHistory[];
      setValueHistory(rows);
      setHasMore(rows.length === PAGE_SIZE);
    }

    setLoading(false);
  }, [tab, page, supabase]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  // Reset page when tab changes
  useEffect(() => {
    setPage(0);
  }, [tab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "collections", label: "Collections" },
    { key: "items", label: "Items" },
    { key: "history", label: "Value History" },
  ];

  const currentRowCount =
    tab === "collections"
      ? collections.length
      : tab === "items"
        ? items.length
        : valueHistory.length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Collections
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Collections, items, and value history
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: "Collections", value: stats?.collections },
          { label: "Wishlists", value: stats?.wishlists },
          { label: "Items", value: stats?.items },
          { label: "For Sale", value: stats?.forSale },
          { label: "Value Snapshots", value: stats?.valueSnapshots },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {stat.value == null ? "…" : stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Tab Bar */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.key
                ? "bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : tab === "collections" ? (
          collections.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
              No collections found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Source Provider</th>
                    <th className="px-4 py-3">Source Account</th>
                    <th className="px-4 py-3">Wishlist</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {collections.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-4 py-2 font-medium">
                        {row.name ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {row.source_provider ?? "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs max-w-[200px] truncate">
                        {row.source_account_id ?? "—"}
                      </td>
                      <td className="px-4 py-2">
                        {row.is_wishlist ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            Wishlist
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : tab === "items" ? (
          items.length === 0 ? (
            <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
              No collection items found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3">Card</th>
                    <th className="px-4 py-3">Collection</th>
                    <th className="px-4 py-3">Grading</th>
                    <th className="px-4 py-3">Grade</th>
                    <th className="px-4 py-3">Purchase</th>
                    <th className="px-4 py-3">Purchase Date</th>
                    <th className="px-4 py-3">Current Value</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Flags</th>
                    <th className="px-4 py-3">Notes</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-4 py-2 max-w-[220px] truncate">
                        {row.product_name ?? (
                          <span className="font-mono text-xs text-gray-400">
                            {row.product_id}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 max-w-[160px] truncate">
                        {row.collection_name ?? (
                          <span className="font-mono text-xs text-gray-400">
                            {row.collection_id}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2 capitalize">
                        {row.grading_service ?? "—"}
                      </td>
                      <td className="px-4 py-2">{row.grade ?? "—"}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {formatPrice(row.purchase_price_cents)}
                        {row.purchase_price_currency &&
                          row.purchase_price_currency !== "USD" && (
                            <span className="ml-1 text-[10px] text-gray-400">
                              {row.purchase_price_currency}
                            </span>
                          )}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {row.purchase_date
                          ? new Date(row.purchase_date).toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.current_value_cents)}
                      </td>
                      <td className="px-4 py-2">{row.quantity ?? "—"}</td>
                      <td className="px-4 py-2 whitespace-nowrap">
                        {row.is_wishlist && (
                          <span className="inline-block px-1.5 py-0.5 mr-1 rounded text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                            wish
                          </span>
                        )}
                        {row.is_for_sale && (
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                            for sale
                          </span>
                        )}
                        {!row.is_wishlist && !row.is_for_sale && "—"}
                      </td>
                      <td
                        className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 max-w-[160px] truncate"
                        title={row.notes ?? undefined}
                      >
                        {row.notes ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : valueHistory.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No value history found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3">Account ID</th>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Total Value</th>
                  <th className="px-4 py-3">Graded</th>
                  <th className="px-4 py-3">Ungraded</th>
                  <th className="px-4 py-3">Cards</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {valueHistory.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="px-4 py-2 font-mono text-xs max-w-[120px] truncate">
                      {row.account_id}
                    </td>
                    <td className="px-4 py-2">
                      {new Date(row.snapshot_date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(row.total_value_cents)}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(row.graded_value_cents)}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(row.ungraded_value_cents)}
                    </td>
                    <td className="px-4 py-2">{row.total_cards ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && currentRowCount > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Page {page + 1}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
