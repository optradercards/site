"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useAccountMembers } from "@/hooks/useAccountMembers";

// ---------------------------------------------------------------------------
// /[slug]/manage/admin/activity
//
// Trader-scoped activity log. Reads ecom.activity_log via the
// get_account_activity RPC. Any member of the trader account can view.
// Keyset pagination on occurred_at; filters on entity type and actor.
// ---------------------------------------------------------------------------

type EntityType =
  | "transaction"
  | "inventory_lot"
  | "listing"
  | "consignment_intake"
  | "contact"
  | "account_member";

type ChangedFields = Record<string, unknown> | null;

type ActivityRow = {
  id: string;
  entity_type: EntityType;
  entity_id: string;
  verb: string;
  changed_fields: ChangedFields;
  actor_user_id: string | null;
  actor_email: string | null;
  occurred_at: string;
};

const PAGE_SIZE = 50;

const ENTITY_LABELS: Record<EntityType, string> = {
  transaction: "Sales",
  inventory_lot: "Inventory",
  listing: "Listings",
  consignment_intake: "Intakes",
  contact: "Contacts",
  account_member: "Members",
};

const ENTITY_ICONS: Record<EntityType, string> = {
  transaction: "💰",
  inventory_lot: "📦",
  listing: "📋",
  consignment_intake: "📝",
  contact: "📇",
  account_member: "👥",
};

const ENTITY_ORDER: EntityType[] = [
  "transaction",
  "inventory_lot",
  "listing",
  "consignment_intake",
  "contact",
  "account_member",
];

function stripBackfilled(verb: string): { verb: string; backfilled: boolean } {
  if (verb.endsWith(".backfilled")) {
    return { verb: verb.slice(0, -".backfilled".length), backfilled: true };
  }
  return { verb, backfilled: false };
}

function verbLabel(verb: string): string {
  // "listing.archived" -> "Listing archived"
  const [domain, action] = verb.split(".");
  if (!action) return verb;
  const noun = domain.replace(/_/g, " ");
  const verbWord = action.replace(/_/g, " ");
  return `${noun.charAt(0).toUpperCase()}${noun.slice(1)} ${verbWord}`;
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diff = Math.max(0, now - then);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

function entityLinkHref(
  slug: string,
  entityType: EntityType,
  entityId: string,
): string | null {
  switch (entityType) {
    case "listing":
      return `/${slug}/manage/listings`;
    case "inventory_lot":
      return `/${slug}/manage/inventory/${entityId}`;
    case "consignment_intake":
      return `/${slug}/manage/consignment-intakes/${entityId}`;
    case "contact":
      return `/${slug}/manage/contacts`;
    case "transaction":
      return `/${slug}/manage/sales`;
    case "account_member":
      return `/${slug}/manage/members`;
    default:
      return null;
  }
}

function ChangeDiff({ changes }: { changes: ChangedFields }) {
  if (!changes || Object.keys(changes).length === 0) return null;
  const entries = Object.entries(changes);
  return (
    <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-3 gap-y-1 text-xs">
      {entries.map(([key, val]) => {
        const isDiff =
          val !== null &&
          typeof val === "object" &&
          !Array.isArray(val) &&
          "old" in (val as object) &&
          "new" in (val as object);
        return (
          <div key={key} className="contents">
            <dt className="font-mono text-gray-500 dark:text-gray-400">
              {key}
            </dt>
            {isDiff ? (
              <dd className="text-gray-700 dark:text-gray-200">
                <span className="line-through text-gray-400 dark:text-gray-500">
                  {formatVal((val as { old: unknown }).old)}
                </span>
                {" → "}
                <span className="font-medium">
                  {formatVal((val as { new: unknown }).new)}
                </span>
              </dd>
            ) : (
              <dd className="text-gray-700 dark:text-gray-200 font-medium">
                {formatVal(val)}
              </dd>
            )}
          </div>
        );
      })}
    </dl>
  );
}

function formatVal(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return JSON.stringify(v);
}

export default function ActivityPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId, isTrader } = useAccounts();
  const { data: members } = useAccountMembers(activeAccountId);

  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const [selectedEntities, setSelectedEntities] = useState<Set<EntityType>>(
    new Set(),
  );
  const [actorFilter, setActorFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (before: string | null) => {
      if (!activeAccountId) return;
      if (before === null) {
        setLoading(true);
        setExpanded(new Set());
      } else {
        setLoadingMore(true);
      }
      setError(null);

      const entityTypes =
        selectedEntities.size > 0 ? Array.from(selectedEntities) : null;

      const { data, error: rpcErr } = await supabase
        .schema("ecom")
        .rpc("get_account_activity", {
          p_account_id: activeAccountId,
          p_before: before,
          p_entity_types: entityTypes,
          p_actor: actorFilter || null,
          p_limit: PAGE_SIZE,
        });

      if (rpcErr) {
        setError(rpcErr.message);
        setLoading(false);
        setLoadingMore(false);
        return;
      }

      const newRows = (data ?? []) as ActivityRow[];
      setRows((prev) => (before === null ? newRows : [...prev, ...newRows]));
      setHasMore(newRows.length === PAGE_SIZE);
      setLoading(false);
      setLoadingMore(false);
    },
    [supabase, activeAccountId, selectedEntities, actorFilter],
  );

  useEffect(() => {
    load(null);
  }, [load]);

  const toggleEntity = (e: EntityType) => {
    setSelectedEntities((prev) => {
      const next = new Set(prev);
      if (next.has(e)) next.delete(e);
      else next.add(e);
      return next;
    });
  };

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const loadMore = () => {
    if (rows.length === 0) return;
    load(rows[rows.length - 1].occurred_at);
  };

  if (!isTrader) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
        Activity log is only available for trader accounts.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
          Activity
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Everything that happened to your sales, inventory, listings, intakes,
          contacts, and members.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {ENTITY_ORDER.map((e) => {
            const on = selectedEntities.has(e);
            return (
              <button
                key={e}
                type="button"
                onClick={() => toggleEntity(e)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  on
                    ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                }`}
              >
                <span>{ENTITY_ICONS[e]}</span>
                <span>{ENTITY_LABELS[e]}</span>
              </button>
            );
          })}
          {selectedEntities.size > 0 && (
            <button
              type="button"
              onClick={() => setSelectedEntities(new Set())}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
            >
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 text-sm">
          <label className="text-gray-600 dark:text-gray-400">Actor:</label>
          <select
            value={actorFilter}
            onChange={(e) => setActorFilter(e.target.value)}
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 px-2 py-1 text-sm"
          >
            <option value="">Anyone</option>
            {(members ?? []).map((m) => (
              <option key={m.user_id} value={m.user_id}>
                {m.name || m.email || m.user_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
          Loading…
        </div>
      ) : error ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center text-gray-500 dark:text-gray-400">
          No activity yet.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow divide-y divide-gray-100 dark:divide-gray-700">
          {rows.map((r) => {
            const link = entityLinkHref(slug, r.entity_type, r.entity_id);
            const hasDiff =
              r.changed_fields && Object.keys(r.changed_fields).length > 0;
            const isOpen = expanded.has(r.id);
            return (
              <div key={r.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="text-xl shrink-0" aria-hidden>
                    {ENTITY_ICONS[r.entity_type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        <span className="font-medium">
                          {verbLabel(stripBackfilled(r.verb).verb)}
                        </span>
                        {stripBackfilled(r.verb).backfilled && (
                          <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400 uppercase tracking-wide">
                            historical
                          </span>
                        )}
                        {link && (
                          <>
                            {" "}
                            <Link
                              href={link}
                              className="text-red-600 dark:text-red-400 hover:underline font-mono text-xs"
                            >
                              #{r.entity_id.slice(0, 8)}
                            </Link>
                          </>
                        )}
                      </div>
                      <div
                        className="text-xs text-gray-500 dark:text-gray-400 shrink-0"
                        title={new Date(r.occurred_at).toLocaleString()}
                      >
                        {relativeTime(r.occurred_at)}
                      </div>
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      by {r.actor_email ?? "System"}
                    </div>
                    {hasDiff && (
                      <>
                        <button
                          type="button"
                          onClick={() => toggleExpanded(r.id)}
                          className="mt-2 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
                        >
                          {isOpen ? "Hide details" : "Show details"}
                        </button>
                        {isOpen && <ChangeDiff changes={r.changed_fields} />}
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {hasMore && (
            <div className="p-4 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
