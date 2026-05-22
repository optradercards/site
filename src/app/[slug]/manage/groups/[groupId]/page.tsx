"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { gradeLabel } from "@/lib/pricing";
import CardCell from "@/components/CardCell";
import ZoomableImage from "@/components/ZoomableImage";

// ---------------------------------------------------------------------------
// Group detail — meta edit + two-pane lot assignment
// ---------------------------------------------------------------------------

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_featured: boolean;
};

type LotSummary = {
  lot_id: string;
  card_product_id: string | null;
  product_name: string | null;
  image_url: string | null;
  set_name: string | null;
  card_number: string | null;
  grading_service: string | null;
  grade: string | null;
  quantity_remaining: number;
};

type GroupItem = {
  lot_id: string;
  sort_order: number;
};

export default function GroupDetailPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;
  const groupId = params?.groupId as string;

  const [group, setGroup] = useState<GroupRow | null>(null);
  const [items, setItems] = useState<GroupItem[]>([]);
  const [allLots, setAllLots] = useState<LotSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Edit form state
  const [name, setName] = useState("");
  const [slugInput, setSlugInput] = useState("");
  const [description, setDescription] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [isFeatured, setIsFeatured] = useState(false);

  // Pending additions/removals are applied immediately (no batch save needed)
  const [addSearch, setAddSearch] = useState("");

  const loadData = useCallback(async () => {
    if (!activeAccountId || !groupId) return;
    setLoading(true);

    const { data: g, error: gErr } = await supabase
      .schema("ecom")
      .from("inventory_groups")
      .select("id, name, slug, description, sort_order, is_featured")
      .eq("id", groupId)
      .eq("account_id", activeAccountId)
      .maybeSingle();

    if (gErr || !g) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    const row = g as GroupRow;
    setGroup(row);
    setName(row.name);
    setSlugInput(row.slug);
    setDescription(row.description ?? "");
    setSortOrder(row.sort_order);
    setIsFeatured(row.is_featured);

    const [itemsRes, lotsRes] = await Promise.all([
      supabase
        .schema("ecom")
        .from("inventory_group_items")
        .select("lot_id, sort_order")
        .eq("group_id", groupId)
        .order("sort_order"),
      supabase
        .schema("ecom")
        .from("vendor_inventory_summary")
        .select(
          "lot_id, card_product_id, product_name, image_url, set_name, card_number, grading_service, grade, quantity_remaining",
        )
        .eq("account_id", activeAccountId)
        .order("product_name"),
    ]);

    setItems((itemsRes.data ?? []) as GroupItem[]);
    setAllLots((lotsRes.data ?? []) as LotSummary[]);
    setLoading(false);
  }, [supabase, activeAccountId, groupId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const lotsById = useMemo(() => {
    const m = new Map<string, LotSummary>();
    for (const l of allLots) m.set(l.lot_id, l);
    return m;
  }, [allLots]);

  const inGroupIds = useMemo(() => new Set(items.map((i) => i.lot_id)), [items]);

  const inGroupOrdered = useMemo(
    () =>
      items
        .map((i) => ({ item: i, lot: lotsById.get(i.lot_id) }))
        .filter((x): x is { item: GroupItem; lot: LotSummary } => !!x.lot),
    [items, lotsById],
  );

  const candidates = useMemo(() => {
    const needle = addSearch.trim().toLowerCase();
    return allLots.filter((l) => {
      if (inGroupIds.has(l.lot_id)) return false;
      if (!needle) return true;
      const hay = `${l.product_name ?? ""} ${l.set_name ?? ""} ${l.card_number ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [allLots, inGroupIds, addSearch]);

  const saveMeta = async () => {
    if (!group) return;
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .schema("ecom")
      .from("inventory_groups")
      .update({
        name,
        slug: slugInput,
        description: description.trim() || null,
        sort_order: sortOrder,
        is_featured: isFeatured,
      })
      .eq("id", group.id);
    if (e) {
      setError(
        e.code === "23505" ? "Slug already exists for this account" : e.message,
      );
    }
    setSaving(false);
    await loadData();
  };

  const addLot = async (lotId: string) => {
    if (!group) return;
    const maxOrder = items.reduce((m, i) => Math.max(m, i.sort_order), -1);
    await supabase
      .schema("ecom")
      .from("inventory_group_items")
      .insert({ group_id: group.id, lot_id: lotId, sort_order: maxOrder + 1 });
    await loadData();
  };

  const removeLot = async (lotId: string) => {
    if (!group) return;
    await supabase
      .schema("ecom")
      .from("inventory_group_items")
      .delete()
      .eq("group_id", group.id)
      .eq("lot_id", lotId);
    await loadData();
  };

  const move = async (lotId: string, direction: "up" | "down") => {
    if (!group) return;
    const idx = items.findIndex((i) => i.lot_id === lotId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= items.length) return;

    const a = items[idx];
    const b = items[swapIdx];

    // Swap sort_order values
    await supabase
      .schema("ecom")
      .from("inventory_group_items")
      .update({ sort_order: b.sort_order })
      .eq("group_id", group.id)
      .eq("lot_id", a.lot_id);
    await supabase
      .schema("ecom")
      .from("inventory_group_items")
      .update({ sort_order: a.sort_order })
      .eq("group_id", group.id)
      .eq("lot_id", b.lot_id);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading group...</div>
      </div>
    );
  }

  if (notFound || !group) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
        <p className="text-gray-700 dark:text-gray-300">Group not found.</p>
        <Link
          href={`/${slug}/manage/groups`}
          className="inline-block mt-4 text-sm font-medium text-red-500 hover:text-red-600"
        >
          &larr; Back to groups
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/${slug}/manage/groups`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to groups
        </Link>
      </div>

      {/* Meta */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Group details
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Slug">
            <input
              type="text"
              value={slugInput}
              onChange={(e) => setSlugInput(e.target.value)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 font-mono"
            />
          </Field>
          <Field label="Sort order">
            <input
              type="number"
              step="1"
              value={sortOrder}
              onChange={(e) => setSortOrder(parseInt(e.target.value, 10) || 0)}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <div className="flex items-end">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                className="rounded text-red-500 focus:ring-red-500"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Featured on storefront
              </span>
            </label>
          </div>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
        </div>

        {error && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            onClick={saveMeta}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save details"}
          </button>
        </div>
      </div>

      {/* Two-pane lot assignment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* In group */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            In this group ({inGroupOrdered.length})
          </h3>
          {inGroupOrdered.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              No lots assigned.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {inGroupOrdered.map(({ lot }, idx) => (
                <li key={lot.lot_id} className="py-2 flex items-center gap-2">
                  {lot.image_url ? (
                    <ZoomableImage
                      src={lot.image_url}
                      alt={lot.product_name ?? ""}
                      className="w-8 h-11 object-contain rounded"
                    />
                  ) : (
                    <div className="w-8 h-11 bg-gray-200 dark:bg-gray-600 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <CardCell
                      cardProductId={lot.card_product_id}
                      name={lot.product_name}
                      cardNumber={lot.card_number}
                      setName={lot.set_name}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {gradeLabel(lot.grading_service, lot.grade)}
                      {" · qty "}
                      {lot.quantity_remaining}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => move(lot.lot_id, "up")}
                      disabled={idx === 0}
                      className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                      aria-label="Move up"
                    >
                      &uarr;
                    </button>
                    <button
                      onClick={() => move(lot.lot_id, "down")}
                      disabled={idx === inGroupOrdered.length - 1}
                      className="px-1 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 disabled:opacity-30"
                      aria-label="Move down"
                    >
                      &darr;
                    </button>
                    <button
                      onClick={() => removeLot(lot.lot_id)}
                      className="px-1 text-gray-400 hover:text-red-500"
                      aria-label="Remove"
                    >
                      &times;
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add lots */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Add lots
          </h3>
          <input
            type="text"
            value={addSearch}
            onChange={(e) => setAddSearch(e.target.value)}
            placeholder="Search your inventory..."
            className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 mb-4"
          />
          {candidates.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
              {addSearch ? "No matches." : "All lots already in group."}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700 max-h-[60vh] overflow-y-auto">
              {candidates.slice(0, 50).map((lot) => (
                <li key={lot.lot_id} className="py-2 flex items-center gap-2">
                  {lot.image_url ? (
                    <ZoomableImage
                      src={lot.image_url}
                      alt={lot.product_name ?? ""}
                      className="w-8 h-11 object-contain rounded"
                    />
                  ) : (
                    <div className="w-8 h-11 bg-gray-200 dark:bg-gray-600 rounded" />
                  )}
                  <div className="flex-1 min-w-0">
                    <CardCell
                      cardProductId={lot.card_product_id}
                      name={lot.product_name}
                      cardNumber={lot.card_number}
                      setName={lot.set_name}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                      {gradeLabel(lot.grading_service, lot.grade)}
                      {" · qty "}
                      {lot.quantity_remaining}
                    </p>
                  </div>
                  <button
                    onClick={() => addLot(lot.lot_id)}
                    className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded hover:bg-red-600"
                  >
                    Add
                  </button>
                </li>
              ))}
              {candidates.length > 50 && (
                <li className="py-2 text-xs text-gray-400 text-center">
                  {candidates.length - 50} more — refine the search.
                </li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
