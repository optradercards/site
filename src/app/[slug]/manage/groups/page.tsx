"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

// ---------------------------------------------------------------------------
// Groups list + inline create.
// ---------------------------------------------------------------------------

type GroupRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_featured: boolean;
};

type GroupItemRow = {
  group_id: string;
};

function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export default function GroupsPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;

  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [itemCounts, setItemCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [newDescription, setNewDescription] = useState("");
  const [newFeatured, setNewFeatured] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Inline edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{ name: string; sort_order: number }>(
    { name: "", sort_order: 0 },
  );
  const [savingId, setSavingId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data } = await supabase
      .schema("ecom")
      .from("inventory_groups")
      .select("id, name, slug, description, sort_order, is_featured")
      .eq("account_id", activeAccountId)
      .order("sort_order")
      .order("name");

    const list = (data ?? []) as GroupRow[];
    setGroups(list);

    if (list.length > 0) {
      const ids = list.map((g) => g.id);
      const { data: items } = await supabase
        .schema("ecom")
        .from("inventory_group_items")
        .select("group_id")
        .in("group_id", ids);
      const counts = new Map<string, number>();
      for (const r of (items ?? []) as GroupItemRow[]) {
        counts.set(r.group_id, (counts.get(r.group_id) ?? 0) + 1);
      }
      setItemCounts(counts);
    } else {
      setItemCounts(new Map());
    }

    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Auto-derive slug from name unless user manually edited it
  const effectiveSlug = useMemo(
    () => (slugTouched ? newSlug : slugify(newName)),
    [slugTouched, newSlug, newName],
  );

  const handleCreate = async () => {
    if (!activeAccountId) return;
    if (!newName.trim() || !effectiveSlug) {
      setCreateError("Name and slug are required");
      return;
    }
    setCreating(true);
    setCreateError(null);

    const maxOrder = groups.reduce((m, g) => Math.max(m, g.sort_order), -1);

    const { error } = await supabase
      .schema("ecom")
      .from("inventory_groups")
      .insert({
        account_id: activeAccountId,
        name: newName.trim(),
        slug: effectiveSlug,
        description: newDescription.trim() || null,
        is_featured: newFeatured,
        sort_order: maxOrder + 1,
      });

    if (error) {
      setCreateError(
        error.code === "23505" ? "Slug already exists for this account" : error.message,
      );
      setCreating(false);
      return;
    }

    setNewName("");
    setNewSlug("");
    setSlugTouched(false);
    setNewDescription("");
    setNewFeatured(false);
    setCreating(false);
    await loadData();
  };

  const startEdit = (g: GroupRow) => {
    setEditingId(g.id);
    setEditDraft({ name: g.name, sort_order: g.sort_order });
  };

  const saveEdit = async (id: string) => {
    setSavingId(id);
    await supabase
      .schema("ecom")
      .from("inventory_groups")
      .update({
        name: editDraft.name,
        sort_order: editDraft.sort_order,
      })
      .eq("id", id);
    setEditingId(null);
    setSavingId(null);
    await loadData();
  };

  const toggleFeatured = async (g: GroupRow) => {
    await supabase
      .schema("ecom")
      .from("inventory_groups")
      .update({ is_featured: !g.is_featured })
      .eq("id", g.id);
    await loadData();
  };

  const handleDelete = async (g: GroupRow) => {
    if (!confirm(`Delete group "${g.name}"? Lot links will be removed.`)) return;
    await supabase.schema("ecom").from("inventory_groups").delete().eq("id", g.id);
    await loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading groups...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Create form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          New group
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Name *">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. Vintage Pokemon"
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
          <Field label="Slug *">
            <input
              type="text"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugTouched(true);
                setNewSlug(slugify(e.target.value));
              }}
              placeholder="vintage-pokemon"
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500 font-mono"
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              rows={2}
              className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </Field>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={newFeatured}
              onChange={(e) => setNewFeatured(e.target.checked)}
              className="rounded text-red-500 focus:ring-red-500"
            />
            <span className="text-gray-700 dark:text-gray-300">
              Featured (shown publicly on storefront)
            </span>
          </label>
          <button
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {creating ? "Creating..." : "Create group"}
          </button>
        </div>
        {createError && (
          <div className="mt-3 p-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
            {createError}
          </div>
        )}
      </div>

      {/* List */}
      {groups.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No groups yet.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3 text-right">Lots</th>
                <th className="px-4 py-3 text-right">Sort</th>
                <th className="px-4 py-3 text-center">Featured</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3 text-right"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {groups.map((g) => {
                const isEditing = editingId === g.id;
                const count = itemCounts.get(g.id) ?? 0;
                return (
                  <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                          className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                        />
                      ) : (
                        <Link
                          href={`/${slug}/manage/groups/${g.id}`}
                          className="hover:text-red-500"
                        >
                          {g.name}
                        </Link>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs font-mono text-gray-500 dark:text-gray-400">
                      {g.slug}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-200 tabular-nums">
                      {count}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {isEditing ? (
                        <input
                          type="number"
                          step="1"
                          value={editDraft.sort_order}
                          onChange={(e) =>
                            setEditDraft({
                              ...editDraft,
                              sort_order: parseInt(e.target.value, 10) || 0,
                            })
                          }
                          className="w-16 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-right text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                        />
                      ) : (
                        <span className="text-gray-700 dark:text-gray-200 tabular-nums">
                          {g.sort_order}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={g.is_featured}
                        onChange={() => toggleFeatured(g)}
                        className="rounded text-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400 text-xs max-w-xs">
                      <span className="line-clamp-2">{g.description ?? "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => saveEdit(g.id)}
                            disabled={savingId === g.id}
                            className="text-sm font-medium text-green-600 hover:text-green-700 mr-3"
                          >
                            {savingId === g.id ? "..." : "Save"}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-sm text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEdit(g)}
                            className="text-sm font-medium text-red-500 hover:text-red-600 mr-3"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(g)}
                            className="text-sm text-gray-500 hover:text-red-600"
                          >
                            Delete
                          </button>
                        </>
                      )}
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
