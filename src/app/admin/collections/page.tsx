"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

type Tab = "collections" | "items" | "history";

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
  grading_company: string | null;
  grade: string | null;
  purchase_price: number | null;
  current_value: number | null;
  quantity: number | null;
  created_at: string;
}

interface ValueHistory {
  id: string;
  account_id: string;
  snapshot_date: string;
  total_value: number | null;
  graded_value: number | null;
  ungraded_value: number | null;
  total_cards: number | null;
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

export default function CollectionsPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("collections");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [valueHistory, setValueHistory] = useState<ValueHistory[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTab = useCallback(async () => {
    setLoading(true);

    if (tab === "collections") {
      const { data } = await supabase
        .schema("cards")
        .from("collections")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setCollections((data ?? []) as Collection[]);
    } else if (tab === "items") {
      const { data } = await supabase
        .schema("cards")
        .from("collection_items")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setItems((data ?? []) as CollectionItem[]);
    } else {
      const { data } = await supabase
        .schema("cards")
        .from("collection_value_history")
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(100);
      setValueHistory((data ?? []) as ValueHistory[]);
    }

    setLoading(false);
  }, [tab, supabase]);

  useEffect(() => {
    loadTab();
  }, [loadTab]);

  const tabs: { key: Tab; label: string }[] = [
    { key: "collections", label: "Collections" },
    { key: "items", label: "Items" },
    { key: "history", label: "Value History" },
  ];

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
                    <th className="px-4 py-3">Purchase Price</th>
                    <th className="px-4 py-3">Current Value</th>
                    <th className="px-4 py-3">Qty</th>
                    <th className="px-4 py-3">Created</th>
                  </tr>
                </thead>
                <tbody className="text-gray-700 dark:text-gray-300">
                  {items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-4 py-2 font-mono text-xs max-w-[200px] truncate">
                        {row.product_id}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs max-w-[200px] truncate">
                        {row.collection_id}
                      </td>
                      <td className="px-4 py-2">
                        {row.grading_company ?? "—"}
                      </td>
                      <td className="px-4 py-2">{row.grade ?? "—"}</td>
                      <td className="px-4 py-2">
                        {formatPrice(row.purchase_price)}
                      </td>
                      <td className="px-4 py-2">
                        {formatPrice(row.current_value)}
                      </td>
                      <td className="px-4 py-2">{row.quantity ?? "—"}</td>
                      <td className="px-4 py-2 text-xs text-gray-500 dark:text-gray-400">
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
                      {formatPrice(row.total_value)}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(row.graded_value)}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(row.ungraded_value)}
                    </td>
                    <td className="px-4 py-2">{row.total_cards ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
