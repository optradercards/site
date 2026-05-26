"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { applyMultiWordIlike } from "@/lib/search";

interface UserDetail {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  account_id: string | null;
  slug: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
}

interface CollectionItem {
  id: string;
  product_id: string;
  grading_service: string | null;
  grade: string | null;
  quantity: number | null;
  purchase_price_cents: number | null;
  purchase_price_currency: string | null;
  notes: string | null;
  created_at: string;
  products: {
    name: string;
    image_url: string | null;
    card_number: string | null;
    rarity: string | null;
  } | null;
  sets: { name: string | null } | null;
  brands: { name: string | null } | null;
}

interface ProductSearchRow {
  id: string;
  name: string;
  image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  set_name: string | null;
  brand_name: string | null;
}

const GRADING_OPTIONS = ["ungraded", "psa", "bgs", "cgc", "sgc"] as const;

export default function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const supabase = createClient();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadUser = useCallback(async () => {
    const { data, error: err } = await supabase.rpc("admin_get_user", {
      p_user_id: id,
    });
    if (err) {
      setError(err.message);
      setUser(null);
    } else {
      setUser((data?.[0] as UserDetail | undefined) ?? null);
    }
  }, [id, supabase]);

  const loadItems = useCallback(async (accountId: string | null) => {
    if (!accountId) {
      setItems([]);
      return;
    }
    const { data: rows, error: err } = await supabase
      .schema("cards")
      .from("collection_items")
      .select(
        "id, product_id, grading_service, grade, quantity, purchase_price_cents, purchase_price_currency, notes, created_at",
      )
      .eq("account_id", accountId)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      return;
    }

    // Second query: bulk fetch product display info via the
    // products_with_details view so we get name/set/brand in one go.
    const productIds = Array.from(new Set((rows ?? []).map((r) => r.product_id)));
    const productDetails = new Map<string, ProductSearchRow>();
    if (productIds.length > 0) {
      const { data: pd } = await supabase
        .schema("cards")
        .from("products_with_details")
        .select("id, name, image_url, card_number, rarity, set_name, brand_name")
        .in("id", productIds);
      for (const p of (pd ?? []) as ProductSearchRow[]) {
        productDetails.set(p.id, p);
      }
    }

    const flat: CollectionItem[] = (rows ?? []).map((r) => {
      const p = productDetails.get(r.product_id);
      return {
        ...r,
        products: p
          ? {
              name: p.name,
              image_url: p.image_url,
              card_number: p.card_number,
              rarity: p.rarity,
            }
          : null,
        sets: { name: p?.set_name ?? null },
        brands: { name: p?.brand_name ?? null },
      };
    });
    setItems(flat);
  }, [supabase]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadUser();
      setLoading(false);
    })();
  }, [loadUser]);

  useEffect(() => {
    if (user?.account_id) loadItems(user.account_id);
  }, [user, loadItems]);

  const handleRemove = async (itemId: string) => {
    if (!confirm("Remove this item from the user's collection?")) return;
    const { error: err } = await supabase
      .schema("cards")
      .rpc("admin_remove_collection_item", { p_item_id: itemId });
    if (err) {
      setError(err.message);
      return;
    }
    if (user?.account_id) loadItems(user.account_id);
  };

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/users"
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
        >
          ← Users
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : !user ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">User not found.</p>
      ) : (
        <>
          {/* User header */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {user.full_name || user.email}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 font-mono mt-1">
              {user.email}
            </p>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  Slug
                </div>
                <div className="font-mono">{user.slug ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  Created
                </div>
                <div>{new Date(user.created_at).toLocaleDateString()}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  Last sign-in
                </div>
                <div>
                  {user.last_sign_in_at
                    ? new Date(user.last_sign_in_at).toLocaleDateString()
                    : "never"}
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 dark:text-gray-400 uppercase">
                  Email confirmed
                </div>
                <div>{user.email_confirmed_at ? "yes" : "no"}</div>
              </div>
            </div>
          </div>

          {/* Add to collection */}
          {user.account_id ? (
            <ProductPicker
              accountId={user.account_id}
              onAdded={() => loadItems(user.account_id!)}
              onError={setError}
            />
          ) : (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-sm text-amber-700 dark:text-amber-400">
              No personal account linked to this user. Collection management
              is unavailable until they sign in for the first time.
            </div>
          )}

          {/* Collection */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Collection ({items.length})
              </h3>
            </div>
            {items.length === 0 ? (
              <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
                Empty.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2"></th>
                      <th className="px-4 py-2">Card</th>
                      <th className="px-4 py-2">Set / Brand</th>
                      <th className="px-4 py-2 whitespace-nowrap">Grade</th>
                      <th className="px-4 py-2 whitespace-nowrap">Qty</th>
                      <th className="px-4 py-2 whitespace-nowrap">Added</th>
                      <th className="px-4 py-2"></th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-700 dark:text-gray-300">
                    {items.map((it) => (
                      <tr
                        key={it.id}
                        className="border-b border-gray-100 dark:border-gray-700/50"
                      >
                        <td className="px-4 py-2">
                          {it.products?.image_url ? (
                            <img
                              src={it.products.image_url}
                              alt=""
                              className="w-8 h-12 object-contain"
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-2">
                          <div className="font-medium">
                            {it.products?.name ?? "—"}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {it.products?.card_number ?? ""}
                            {it.products?.rarity ? ` · ${it.products.rarity}` : ""}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs">
                          <div>{it.sets?.name ?? "—"}</div>
                          <div className="text-gray-500 dark:text-gray-400">
                            {it.brands?.name ?? ""}
                          </div>
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs">
                          {it.grading_service !== "ungraded" && it.grading_service
                            ? `${it.grading_service.toUpperCase()} ${it.grade ?? ""}`.trim()
                            : "Ungraded"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs">
                          {it.quantity ?? 1}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {new Date(it.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          <button
                            onClick={() => handleRemove(it.id)}
                            className="text-xs text-red-600 dark:text-red-400 hover:underline"
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ProductPicker({
  accountId,
  onAdded,
  onError,
}: {
  accountId: string;
  onAdded: () => void;
  onError: (msg: string) => void;
}) {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductSearchRow[]>([]);
  const [selected, setSelected] = useState<ProductSearchRow | null>(null);
  const [grading, setGrading] = useState<string>("ungraded");
  const [grade, setGrade] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const { data } = await applyMultiWordIlike(
        supabase
          .schema("cards")
          .from("products_with_details")
          .select("id, name, image_url, card_number, rarity, set_name, brand_name"),
        query,
        ["name", "card_number", "language"],
      ).limit(20);
      setResults((data ?? []) as ProductSearchRow[]);
      setSearching(false);
    }, 200);
    return () => clearTimeout(t);
  }, [query, supabase]);

  const handleAdd = async () => {
    if (!selected) return;
    setAdding(true);
    const { error: err } = await supabase
      .schema("cards")
      .rpc("admin_add_collection_item", {
        p_account_id: accountId,
        p_product_id: selected.id,
        p_grading_service: grading,
        p_grade: grade || null,
        p_quantity: quantity,
      });
    setAdding(false);
    if (err) {
      onError(err.message);
      return;
    }
    setSelected(null);
    setQuery("");
    setResults([]);
    setGrade("");
    setQuantity(1);
    onAdded();
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
        Add to collection
      </h3>
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSelected(null);
        }}
        placeholder="Search products by name…"
        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
      />

      {/* Search results dropdown */}
      {!selected && query.trim().length >= 2 && (
        <div className="mt-2 max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
          {searching ? (
            <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
              Searching…
            </p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-gray-500 dark:text-gray-400">
              No matches.
            </p>
          ) : (
            results.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
              >
                {r.image_url ? (
                  <img
                    src={r.image_url}
                    alt=""
                    className="w-8 h-12 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-8 h-12 shrink-0" />
                )}
                <div className="flex-1 min-w-0 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white truncate">
                    {r.name}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    {[r.brand_name, r.set_name, r.card_number, r.rarity]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {/* Selected product + add form */}
      {selected && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded-lg space-y-3">
          <div className="flex items-center gap-3">
            {selected.image_url && (
              <img
                src={selected.image_url}
                alt=""
                className="w-12 h-16 object-contain"
              />
            )}
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 dark:text-white">
                {selected.name}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {[selected.brand_name, selected.set_name, selected.card_number]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            </div>
            <button
              onClick={() => setSelected(null)}
              className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Change
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Grading
              </label>
              <select
                value={grading}
                onChange={(e) => setGrading(e.target.value)}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {GRADING_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {g === "ungraded" ? "Ungraded" : g.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Grade
              </label>
              <input
                type="text"
                value={grade}
                onChange={(e) => setGrade(e.target.value)}
                disabled={grading === "ungraded"}
                placeholder={grading === "ungraded" ? "—" : "10, 9.5, …"}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                Quantity
              </label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                className="w-full px-2 py-1.5 text-sm rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <button
              onClick={handleAdd}
              disabled={adding}
              className="px-4 py-1.5 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors"
            >
              {adding ? "Adding…" : "Add to collection"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
