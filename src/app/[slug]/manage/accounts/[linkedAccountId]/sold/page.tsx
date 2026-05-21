"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";

// ---------------------------------------------------------------------------
// /[slug]/manage/accounts/[linkedAccountId]/sold
//
// Shiny sold items reconciliation view. v2 model:
//   matched           → a matching inventory_lot exists with enough qty.
//                       Import writes a completed sale against that lot.
//   no_lot            → no matching lot. User clicks per-row "Create lot"
//                       which writes a purchase+lot from Shiny's cost basis;
//                       the next refresh flips the row to matched.
//   imported          → sale already written. Idempotent — re-runs no-op.
//   no_catalog_match  → Shiny product not in our cards catalog. Run a
//                       collection import first.
// "Import N matched" only writes sales against matched rows.
// ---------------------------------------------------------------------------

type PreviewStatus =
  | "matched"
  | "no_lot"
  | "conflict"
  | "imported"
  | "no_catalog_match";

type MatchedLot = {
  lot_id: string;
  acquisition_cost_cents: number | null;
  acquisition_currency: string;
  acquired_at: string;
  quantity_remaining_before: number;
};

type PreviewRow = {
  source_id: string;
  shiny_product_item_id: string;
  card_product_id: string | null;
  card_name: string;
  card_image_url: string | null;
  card_number: string | null;
  grading_service: string;
  grade: string | null;
  quantity: number;
  purchase_cents: number;
  purchase_currency: string;
  sale_cents: number;
  sale_currency: string;
  marketplace: string | null;
  sold_date: string | null;
  status: PreviewStatus;
  matched_lot: MatchedLot | null;
};

type PreviewResponse = {
  ok: true;
  counts: {
    total: number;
    matched: number;
    no_lot: number;
    conflict: number;
    imported: number;
    no_catalog_match: number;
  };
  items: PreviewRow[];
};

type ImportResponse = {
  ok: true;
  created: number;
  skipped_imported: number;
  skipped_no_lot: number;
  skipped_no_match: number;
  errors: string[];
};

const STATUS_ORDER: Record<PreviewStatus, number> = {
  matched: 0,
  no_lot: 1,
  conflict: 2,
  no_catalog_match: 3,
  imported: 4,
};

function statusBadge(status: PreviewStatus) {
  const map: Record<PreviewStatus, { label: string; cls: string }> = {
    matched: {
      label: "Matched",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    no_lot: {
      label: "No lot",
      cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    },
    conflict: {
      label: "Conflict",
      cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
    },
    imported: {
      label: "Imported",
      cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    },
    no_catalog_match: {
      label: "No catalog",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
  };
  const { label, cls } = map[status];
  return (
    <span
      className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${cls}`}
    >
      {label}
    </span>
  );
}

function gradeLabel(service: string, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return grade ? `${service.toUpperCase()} ${grade}` : service.toUpperCase();
}

export default function ShinySoldImportPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const linkedAccountId = params?.linkedAccountId as string;
  const supabase = useMemo(() => createClient(), []);
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [creatingLotId, setCreatingLotId] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<ImportResponse | null>(null);

  type FilterKey = "all" | PreviewStatus;
  const [filter, setFilter] = useState<FilterKey>("all");

  const invokeShinySold = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error: invErr } = await supabase.functions.invoke(
        "shiny-sold",
        { body },
      );
      if (invErr) {
        const ctx = (invErr as unknown as { context?: Response }).context;
        if (ctx && typeof ctx.text === "function") {
          try {
            const text = await ctx.text();
            try {
              const parsed = JSON.parse(text);
              throw new Error(parsed.error ?? text);
            } catch {
              throw new Error(text);
            }
          } catch (parseErr) {
            if (parseErr instanceof Error) throw parseErr;
          }
        }
        throw invErr;
      }
      const respBody = data as { error?: string } & Record<string, unknown>;
      if (respBody && respBody.error) throw new Error(respBody.error);
      return respBody;
    },
    [supabase],
  );

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const body = (await invokeShinySold({
        mode: "preview",
        linked_account_id: linkedAccountId,
      })) as unknown as PreviewResponse;
      setPreview(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview");
    } finally {
      setLoading(false);
    }
  }, [invokeShinySold, linkedAccountId]);

  useEffect(() => {
    if (linkedAccountId) void fetchPreview();
  }, [linkedAccountId, fetchPreview]);

  const runImport = async () => {
    setImporting(true);
    setError(null);
    setLastImport(null);
    try {
      const body = (await invokeShinySold({
        mode: "import",
        linked_account_id: linkedAccountId,
      })) as unknown as ImportResponse;
      setLastImport(body);
      await fetchPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const createLot = async (sourceId: string) => {
    setCreatingLotId(sourceId);
    setError(null);
    try {
      await invokeShinySold({
        mode: "create_lot",
        linked_account_id: linkedAccountId,
        source_id: sourceId,
      });
      await fetchPreview();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create lot");
    } finally {
      setCreatingLotId(null);
    }
  };

  const sortedItems = useMemo(() => {
    const items = preview?.items ?? [];
    return [...items].sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status],
    );
  }, [preview]);

  const filteredItems = useMemo(() => {
    if (filter === "all") return sortedItems;
    return sortedItems.filter((i) => i.status === filter);
  }, [sortedItems, filter]);

  const canImport = (preview?.counts.matched ?? 0) > 0 && !importing;

  return (
    <div>
      <div className="mb-4">
        <Link
          href={`/${slug}/manage/accounts`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to accounts
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Shiny sold items
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Cards you&rsquo;ve marked as sold on Shiny. Items matched to an
        existing inventory lot can be imported as completed sales (which
        decrement the lot). For items without a matching lot, click{" "}
        <em>Create lot</em> to seed a purchase + lot from Shiny&rsquo;s cost
        basis first, then re-run the import.
      </p>

      {/* Summary + actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex flex-wrap gap-6 text-sm">
          <Counter label="Total" value={preview?.counts.total ?? 0} />
          <Counter
            label="Matched"
            value={preview?.counts.matched ?? 0}
            color="text-green-600 dark:text-green-400"
          />
          <Counter
            label="No lot"
            value={preview?.counts.no_lot ?? 0}
            color="text-amber-600 dark:text-amber-400"
          />
          <Counter
            label="No catalog"
            value={preview?.counts.no_catalog_match ?? 0}
            color="text-red-600 dark:text-red-400"
          />
          <Counter
            label="Imported"
            value={preview?.counts.imported ?? 0}
            color="text-gray-500 dark:text-gray-400"
          />
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={fetchPreview}
            disabled={loading || importing}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
          <button
            type="button"
            onClick={runImport}
            disabled={!canImport}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {importing
              ? "Importing…"
              : `Import ${preview?.counts.matched ?? 0} matched`}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {lastImport && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          Recorded {lastImport.created} sale{lastImport.created === 1 ? "" : "s"}.
          {lastImport.skipped_imported > 0 &&
            ` Skipped ${lastImport.skipped_imported} already imported.`}
          {lastImport.skipped_no_lot > 0 &&
            ` Skipped ${lastImport.skipped_no_lot} without a matching lot.`}
          {lastImport.skipped_no_match > 0 &&
            ` Skipped ${lastImport.skipped_no_match} without a catalog match.`}
          {lastImport.errors.length > 0 && (
            <details className="mt-1">
              <summary className="cursor-pointer">
                {lastImport.errors.length} error
                {lastImport.errors.length === 1 ? "" : "s"}
              </summary>
              <ul className="mt-1 list-disc list-inside text-xs">
                {lastImport.errors.map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Filter
        </span>
        {(
          ["all", "matched", "no_lot", "conflict", "no_catalog_match", "imported"] as const
        ).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={
              filter === f
                ? "px-2.5 py-1 text-xs font-semibold rounded bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "px-2.5 py-1 text-xs font-medium rounded text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }
          >
            {f === "all"
              ? "All"
              : f === "matched"
                ? "Matched"
                : f === "no_lot"
                  ? "No lot"
                  : f === "conflict"
                    ? "Conflict"
                    : f === "no_catalog_match"
                      ? "No catalog"
                      : "Imported"}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading && !preview ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            Loading sold items from Shiny…
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            {preview && preview.counts.total === 0
              ? "No sold items found on this Shiny account."
              : "No items match this filter."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left"></th>
                  <th className="px-3 py-2 text-left">Card</th>
                  <th className="px-3 py-2 text-left">Grade</th>
                  <th className="px-3 py-2 text-right">Qty</th>
                  <th className="px-3 py-2 text-right">Cost basis</th>
                  <th className="px-3 py-2 text-right">Sold for</th>
                  <th className="px-3 py-2 text-left">Marketplace</th>
                  <th className="px-3 py-2 text-left">Sold</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filteredItems.map((item) => (
                  <tr key={item.source_id} className="align-top">
                    <td className="px-3 py-3">
                      {item.card_image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.card_image_url}
                          alt={item.card_name}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                      <p className="font-medium">
                        {item.card_name}
                        {item.card_number && (
                          <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                            #{item.card_number}
                          </span>
                        )}
                      </p>
                      {item.matched_lot && (
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                          Lot {item.matched_lot.lot_id.slice(0, 8)} ·{" "}
                          {item.matched_lot.quantity_remaining_before} on hand
                          {item.matched_lot.acquisition_cost_cents != null && (
                            <>
                              {" "}· cost{" "}
                              {formatPrice(
                                item.matched_lot.acquisition_cost_cents,
                                sellerCurrency,
                                rates ?? {},
                                item.matched_lot.acquisition_currency,
                              )}
                            </>
                          )}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(item.grading_service, item.grade)}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatPrice(
                        item.purchase_cents,
                        sellerCurrency,
                        rates ?? {},
                        item.purchase_currency,
                      )}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatPrice(
                        item.sale_cents,
                        sellerCurrency,
                        rates ?? {},
                        item.sale_currency,
                      )}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 capitalize">
                      {item.marketplace ?? "—"}
                    </td>
                    <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                      {item.sold_date ?? "—"}
                    </td>
                    <td className="px-3 py-3">{statusBadge(item.status)}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      {item.status === "no_lot" && item.card_product_id && (
                        <button
                          type="button"
                          onClick={() => createLot(item.source_id)}
                          disabled={creatingLotId === item.source_id}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded disabled:opacity-50"
                        >
                          {creatingLotId === item.source_id
                            ? "Creating…"
                            : "Create lot"}
                        </button>
                      )}
                    </td>
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

function Counter({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p
        className={`text-xl font-semibold ${color ?? "text-gray-900 dark:text-gray-100"}`}
      >
        {value}
      </p>
    </div>
  );
}
