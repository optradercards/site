"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface CardRow {
  id: string;
  name: string;
  card_number: string | null;
  rarity: string | null;
  set_name: string | null;
  brand_name: string | null;
  image_url: string | null;
  ungraded_price: number | null;
  psa_10_price: number | null;
  follower_count: number | null;
}

function formatPrice(cents: number | null): string {
  return cents == null ? "—" : "$" + (cents / 100).toFixed(2);
}

export default function ProductsPage() {
  const supabase = createClient();
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 50;

  const loadCards = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .schema("cards")
      .from("products_with_details")
      .select("*")
      .range(page * pageSize, (page + 1) * pageSize - 1)
      .order("name");

    if (search.trim()) {
      query = query.ilike("name", `%${search.trim()}%`);
    }

    const { data, error } = await query;

    if (!error) {
      setCards((data ?? []) as CardRow[]);
      setHasMore((data ?? []).length === pageSize);
    }
    setLoading(false);
  }, [page, search, supabase]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

  useEffect(() => {
    setPage(0);
  }, [search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Products
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Browse all products in the catalog
        </p>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search products by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : cards.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No products found.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3">Image</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Card #</th>
                  <th className="px-4 py-3">Rarity</th>
                  <th className="px-4 py-3">Set</th>
                  <th className="px-4 py-3">Brand</th>
                  <th className="px-4 py-3">Ungraded</th>
                  <th className="px-4 py-3">PSA 10</th>
                  <th className="px-4 py-3">Followers</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {cards.map((card) => (
                  <tr
                    key={card.id}
                    className="border-b border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="px-4 py-2">
                      {card.image_url ? (
                        <img
                          src={card.image_url}
                          alt={card.name}
                          className="w-8 h-8 object-contain rounded"
                        />
                      ) : (
                        <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded" />
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium">
                      <Link
                        href={`/products/${card.id}`}
                        className="text-red-500 hover:text-red-600 hover:underline"
                      >
                        {card.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2">{card.card_number ?? "—"}</td>
                    <td className="px-4 py-2">
                      {card.rarity ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                          {card.rarity}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-2">{card.set_name ?? "—"}</td>
                    <td className="px-4 py-2">{card.brand_name ?? "—"}</td>
                    <td className="px-4 py-2">
                      {formatPrice(card.ungraded_price)}
                    </td>
                    <td className="px-4 py-2">
                      {formatPrice(card.psa_10_price)}
                    </td>
                    <td className="px-4 py-2">
                      {card.follower_count ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && cards.length > 0 && (
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
