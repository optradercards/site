"use client";

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface CollectrItem {
  id?: string;                     // Unique per-variant row id
  product_id?: string;             // Canonical product id (shared across variants)
  product_name?: string;
  catalog_group?: string;          // Collectr's "set"
  catalog_category_name?: string;  // Collectr's "brand"
  image_url?: string;
  card_number?: string;
  product_sub_type?: string;       // "Foil" | "Normal" | …
  rarity?: string;
  // Collectr returns market price as a string ("0.05") or sometimes as a
  // number. We render conditionally; if it isn't on the row at all the
  // column just shows "—".
  market_price?: string | number | null;
  price?: string | number | null;
}

function formatCollectrPrice(item: CollectrItem): string {
  const raw = item.market_price ?? item.price;
  if (raw == null || raw === "") return "—";
  // String form might already include "$" or whitespace; strip and re-format.
  const cleaned = String(raw).replace(/[^\d.-]/g, "");
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return String(raw);
  return `$${n.toFixed(2)}`;
}

// The id we use for both React keys and the import source_id. Prefer
// the row id; fall back to product_id + variant if it isn't returned;
// final fallback handled at render time with the row index.
function rowId(item: CollectrItem): string | null {
  if (item.id) return item.id;
  if (item.product_id) {
    return item.product_sub_type
      ? `${item.product_id}:${item.product_sub_type}`
      : item.product_id;
  }
  return null;
}

interface QueuedJob {
  job_id: string;
  item_count: number;
}

interface MatchMaps {
  brandByLower: Map<string, { id: string; name: string }>;
  // key = `${brand_id}::${lower set name}`
  setByBrandAndLower: Map<string, { id: string; name: string }>;
}

export default function SearchCollectrPage() {
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [items, setItems] = useState<CollectrItem[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [queuedJob, setQueuedJob] = useState<QueuedJob | null>(null);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [matches, setMatches] = useState<MatchMaps>({
    brandByLower: new Map(),
    setByBrandAndLower: new Map(),
  });

  const runSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setItems([]);
    setSelected(new Set());
    setQueuedJob(null);
    setQueueError(null);
    try {
      const { data, error } = await supabase.functions.invoke(
        "collectr-fetch-cards",
        {
          method: "GET",
          headers: { searchstring: query.trim() }, // placeholder, body below
        },
      );
      // Edge fns invoked via supabase-js don't support query strings
      // easily; fall through to a direct fetch with the session token.
      let payload = data;
      if (error || !payload) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const url = new URL(
          process.env.NEXT_PUBLIC_SUPABASE_URL +
            "/functions/v1/collectr-fetch-cards",
        );
        url.searchParams.set("searchString", query.trim());
        url.searchParams.set("limit", "30");
        const res = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${session?.access_token ?? ""}`,
          },
        });
        const txt = await res.text();
        if (!res.ok) throw new Error(`Search failed: ${res.status} ${txt}`);
        payload = JSON.parse(txt);
      }
      if (payload?.error) throw new Error(payload.error);
      setItems((payload?.items ?? []) as CollectrItem[]);
      setMatches({ brandByLower: new Map(), setByBrandAndLower: new Map() });
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }, [query, supabase]);

  // After results land, look up which brands/sets already exist so the
  // table can show a "match" vs "new" badge per row. cards.brands is
  // tiny so we fetch the whole table; sets are scoped to the matched
  // brand_ids to keep the payload bounded.
  useEffect(() => {
    if (items.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data: brands } = await supabase
        .schema("cards")
        .from("brands")
        .select("id, name");
      if (cancelled) return;
      const brandByLower = new Map<string, { id: string; name: string }>();
      for (const b of (brands ?? []) as Array<{ id: string; name: string }>) {
        brandByLower.set(b.name.toLowerCase(), b);
      }

      const neededBrandIds = new Set<string>();
      const neededSetLowerNames = new Set<string>();
      for (const item of items) {
        const bn = item.catalog_category_name?.toLowerCase();
        const sn = item.catalog_group?.toLowerCase();
        if (bn && brandByLower.has(bn)) neededBrandIds.add(brandByLower.get(bn)!.id);
        if (sn) neededSetLowerNames.add(sn);
      }

      const setByBrandAndLower = new Map<string, { id: string; name: string }>();
      if (neededBrandIds.size > 0) {
        const { data: sets } = await supabase
          .schema("cards")
          .from("sets")
          .select("id, name, brand_id")
          .in("brand_id", [...neededBrandIds]);
        for (const s of (sets ?? []) as Array<{
          id: string;
          name: string;
          brand_id: string;
        }>) {
          const lower = s.name.toLowerCase();
          if (neededSetLowerNames.has(lower)) {
            setByBrandAndLower.set(`${s.brand_id}::${lower}`, {
              id: s.id,
              name: s.name,
            });
          }
        }
      }

      if (!cancelled) setMatches({ brandByLower, setByBrandAndLower });
    })();
    return () => {
      cancelled = true;
    };
  }, [items, supabase]);

  const toggleAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(
        new Set(items.map(rowId).filter((id): id is string => !!id)),
      );
    }
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const runImport = async () => {
    if (selected.size === 0) return;
    setImporting(true);
    setQueuedJob(null);
    setQueueError(null);

    const targets = items
      .map((item) => ({ item, rid: rowId(item) }))
      .filter(
        (x): x is { item: CollectrItem; rid: string } =>
          x.rid !== null && selected.has(x.rid),
      );

    const collectr_items = targets.map(({ item, rid }) => ({
      collectr_id: rid,
      product_name: item.product_name,
      catalog_category_name: item.catalog_category_name,
      catalog_group: item.catalog_group,
      image_url: item.image_url ?? null,
      card_number: item.card_number ?? null,
      product_sub_type: item.product_sub_type ?? null,
    }));

    const { data, error } = await supabase
      .schema("jobs")
      .from("job_logs")
      .insert({
        platform: "collectr-cards",
        status: "pending",
        payload: { collectr_items },
        handle: `${collectr_items.length} Collectr items`,
      })
      .select("id")
      .single();

    if (error || !data) {
      setQueueError(error?.message ?? "Failed to queue job");
    } else {
      setQueuedJob({
        job_id: (data as { id: string }).id,
        item_count: collectr_items.length,
      });
    }
    setImporting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Search Collectr
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search Collectr&apos;s catalog and import selected results into
          cards.products. Already-imported Collectr ids are skipped (return
          the existing product).
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") runSearch();
          }}
          placeholder="Search Collectr by card name…"
          className="flex-1 max-w-xl px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
        />
        <button
          onClick={runSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg transition-colors"
        >
          {searching ? "Searching…" : "Search"}
        </button>
      </div>

      {searchError && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {searchError}
        </div>
      )}

      {items.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {items.length} result{items.length === 1 ? "" : "s"} ·{" "}
              {selected.size} selected
            </div>
            <div className="flex gap-2">
              <button
                onClick={toggleAll}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {selected.size === items.length ? "Clear" : "Select all"}
              </button>
              <button
                onClick={runImport}
                disabled={importing || selected.size === 0}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded"
              >
                {importing ? "Queueing…" : `Import ${selected.size}`}
              </button>
            </div>
          </div>

          {queuedJob && (
            <div className="p-3 rounded-lg border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-sm">
              <div className="font-medium text-green-800 dark:text-green-300 mb-1">
                Queued — {queuedJob.item_count} item
                {queuedJob.item_count === 1 ? "" : "s"} sent to the
                collectr-cards worker.
              </div>
              <div className="text-xs text-green-700 dark:text-green-400">
                Job id:{" "}
                <Link
                  href={`/admin/jobs`}
                  className="font-mono underline hover:no-underline"
                >
                  {queuedJob.job_id}
                </Link>
                {" — "}
                watch progress on{" "}
                <Link href="/admin/jobs" className="underline hover:no-underline">
                  /admin/jobs
                </Link>
                .
              </div>
            </div>
          )}
          {queueError && (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-400">
              {queueError}
            </div>
          )}

          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-3 py-2 w-8"></th>
                  <th className="px-3 py-2 w-12"></th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Set</th>
                  <th className="px-3 py-2">Brand</th>
                  <th className="px-3 py-2 whitespace-nowrap">Card #</th>
                  <th className="px-3 py-2 whitespace-nowrap">Rarity</th>
                  <th className="px-3 py-2 whitespace-nowrap text-right">Price</th>
                  <th className="px-3 py-2 whitespace-nowrap">Collectr id</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {items.map((item, idx) => {
                  const rid = rowId(item);
                  const brandLower = item.catalog_category_name?.toLowerCase();
                  const setLower = item.catalog_group?.toLowerCase();
                  const matchedBrand = brandLower
                    ? matches.brandByLower.get(brandLower)
                    : null;
                  const matchedSet =
                    matchedBrand && setLower
                      ? matches.setByBrandAndLower.get(
                          `${matchedBrand.id}::${setLower}`,
                        )
                      : null;
                  return (
                    <tr
                      key={rid ?? `row-${idx}`}
                      className="border-b border-gray-100 dark:border-gray-700/50"
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          disabled={!rid}
                          checked={rid ? selected.has(rid) : false}
                          onChange={() => rid && toggle(rid)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="w-8 h-12 object-contain"
                          />
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {item.product_name ?? "—"}
                        </div>
                        {item.product_sub_type && (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {item.product_sub_type}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{item.catalog_group ?? "—"}</span>
                          {item.catalog_group && (
                            <MatchBadge matched={!!matchedSet} />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div className="flex items-center gap-1.5">
                          <span>{item.catalog_category_name ?? "—"}</span>
                          {item.catalog_category_name && (
                            <MatchBadge matched={!!matchedBrand} />
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {item.card_number ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {item.rarity ?? "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-right tabular-nums text-gray-900 dark:text-gray-100">
                        {formatCollectrPrice(item)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-[10px] text-gray-500 dark:text-gray-400">
                        {rid ? rid.slice(0, 12) + "…" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!searching && items.length === 0 && !searchError && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Enter a query above to search Collectr.
        </p>
      )}
    </div>
  );
}

function MatchBadge({ matched }: { matched: boolean }) {
  return matched ? (
    <span
      title="Existing row in cards.* will be reused"
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    >
      match
    </span>
  ) : (
    <span
      title="No matching row — a new one will be created on import"
      className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
    >
      new
    </span>
  );
}
