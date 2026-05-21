"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Papa from "papaparse";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { useProfile } from "@/hooks/useProfile";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";

// ---------------------------------------------------------------------------
// /[slug]/manage/admin/import-sales
//
// Generic completed-sales importer from a CSV. Parses client-side with
// papaparse, posts the rows to the sales-import edge function for catalog
// + lot matching, then for matched rows writes the sale (transaction +
// transaction_item + sale_allocation, lot decrement). Per-row "Create lot"
// covers items not yet in inventory.
//
// Idempotency: when the CSV has an `external_id` column, re-uploads of the
// same row no-op via the (account_id, source_provider='csv_import',
// source_id=external_id) unique index.
// ---------------------------------------------------------------------------

type ParsedRow = {
  external_id: string | null;
  card_product_id: string | null;
  card_number: string | null;
  set_name: string | null;
  card_name: string | null;
  grading_service: string;
  grade: string | null;
  quantity: number;
  sale_cents: number;
  sale_currency: string;
  sold_date: string | null;
  marketplace: string | null;
  notes: string | null;
  purchase_cents: number | null;
  purchase_currency: string | null;
};

type PreviewStatus =
  | "matched"
  | "no_lot"
  | "imported"
  | "no_catalog_match"
  | "invalid";

type MatchedLot = {
  lot_id: string;
  acquisition_cost_cents: number | null;
  acquisition_currency: string;
  acquired_at: string;
  quantity_remaining_before: number;
};

type PreviewRow = ParsedRow & {
  row_index: number;
  resolved_card_product_id: string | null;
  resolved_card_name: string | null;
  resolved_card_image_url: string | null;
  resolved_card_number: string | null;
  status: PreviewStatus;
  matched_lot: MatchedLot | null;
  error: string | null;
};

type PreviewResponse = {
  ok: true;
  counts: {
    total: number;
    matched: number;
    no_lot: number;
    imported: number;
    no_catalog_match: number;
    invalid: number;
  };
  items: PreviewRow[];
};

type ImportResponse = {
  ok: true;
  created: number;
  skipped_imported: number;
  skipped_no_lot: number;
  skipped_no_match: number;
  skipped_invalid: number;
  errors: string[];
};

const STATUS_ORDER: Record<PreviewStatus, number> = {
  matched: 0,
  no_lot: 1,
  no_catalog_match: 2,
  invalid: 3,
  imported: 4,
};

const TEMPLATE = [
  [
    "external_id",
    "card_product_id",
    "card_number",
    "set_name",
    "card_name",
    "grading_service",
    "grade",
    "quantity",
    "sale_price",
    "sale_currency",
    "sold_date",
    "marketplace",
    "notes",
    "purchase_price",
    "purchase_currency",
  ],
  [
    "shiny-abc123",
    "",
    "OP01-120",
    "Romance Dawn",
    "Shanks (Serialized Championship 2023)",
    "ungraded",
    "",
    "1",
    "150.00",
    "AUD",
    "2026-02-15",
    "ebay",
    "Sold to a friend",
    "100.00",
    "AUD",
  ],
];

function downloadTemplate() {
  const csv = Papa.unparse(TEMPLATE);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "sales-import-template.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function parseDollarsToCents(v: string | null | undefined): number | null {
  if (v == null) return null;
  const s = String(v).replace(/[$,\s]/g, "");
  if (s === "") return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100);
}

function emptyStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function parseCsv(file: File): Promise<ParsedRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows: ParsedRow[] = results.data.map((r) => ({
            external_id: emptyStr(r.external_id),
            card_product_id: emptyStr(r.card_product_id),
            card_number: emptyStr(r.card_number),
            set_name: emptyStr(r.set_name),
            card_name: emptyStr(r.card_name),
            grading_service: (emptyStr(r.grading_service) ?? "ungraded").toLowerCase(),
            grade: emptyStr(r.grade),
            quantity: Number(r.quantity) || 0,
            sale_cents: parseDollarsToCents(r.sale_price) ?? 0,
            sale_currency: (emptyStr(r.sale_currency) ?? "AUD").toUpperCase(),
            sold_date: emptyStr(r.sold_date),
            marketplace: emptyStr(r.marketplace),
            notes: emptyStr(r.notes),
            purchase_cents: parseDollarsToCents(r.purchase_price),
            purchase_currency: emptyStr(r.purchase_currency),
          }));
          resolve(rows);
        } catch (err) {
          reject(err);
        }
      },
      error: (err) => reject(err),
    });
  });
}

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
    no_catalog_match: {
      label: "No catalog",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    invalid: {
      label: "Invalid",
      cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    },
    imported: {
      label: "Imported",
      cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
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

export default function ImportSalesPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  const [parsedRows, setParsedRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [creatingIdx, setCreatingIdx] = useState<number | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [lastImport, setLastImport] = useState<ImportResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  type FilterKey = "all" | PreviewStatus;
  const [filter, setFilter] = useState<FilterKey>("all");

  const invoke = useCallback(
    async (body: Record<string, unknown>) => {
      const { data, error: invErr } = await supabase.functions.invoke(
        "sales-import",
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLastImport(null);
    setPreview(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const rows = await parseCsv(file);
      setParsedRows(rows);
      if (rows.length > 0 && activeAccountId) {
        await runPreview(rows);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  const runPreview = async (rows: ParsedRow[]) => {
    if (!activeAccountId) return;
    setPreviewing(true);
    setError(null);
    try {
      const body = (await invoke({
        mode: "preview",
        account_id: activeAccountId,
        rows,
      })) as unknown as PreviewResponse;
      setPreview(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setPreviewing(false);
    }
  };

  const runImport = async () => {
    if (!parsedRows || !activeAccountId) return;
    setImporting(true);
    setError(null);
    setLastImport(null);
    try {
      const body = (await invoke({
        mode: "import",
        account_id: activeAccountId,
        rows: parsedRows,
      })) as unknown as ImportResponse;
      setLastImport(body);
      await runPreview(parsedRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const createLot = async (item: PreviewRow) => {
    if (!activeAccountId) return;
    setCreatingIdx(item.row_index);
    setError(null);
    try {
      await invoke({
        mode: "create_lot",
        account_id: activeAccountId,
        row: item,
      });
      if (parsedRows) await runPreview(parsedRows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create lot");
    } finally {
      setCreatingIdx(null);
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
          href={`/${slug}/manage/inventory`}
          className="text-sm text-red-500 hover:text-red-600"
        >
          &larr; Back to inventory
        </Link>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Import sales from CSV
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upload a spreadsheet of completed sales. Each row is matched to a
        card in our catalog and to an existing inventory lot; matched rows
        become completed sales in OP Trader. Rows without a matching lot
        can be seeded with a per-row <em>Create lot</em> action when the
        CSV includes a purchase price.
      </p>

      {/* Upload + template */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            CSV file
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
          />
          {fileName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {fileName}
              {parsedRows && ` — ${parsedRows.length} rows`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={downloadTemplate}
          className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600"
        >
          Download template
        </button>
      </div>

      {/* Counts + import action */}
      {preview && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <Counter label="Total" value={preview.counts.total} />
            <Counter
              label="Matched"
              value={preview.counts.matched}
              color="text-green-600 dark:text-green-400"
            />
            <Counter
              label="No lot"
              value={preview.counts.no_lot}
              color="text-amber-600 dark:text-amber-400"
            />
            <Counter
              label="No catalog"
              value={preview.counts.no_catalog_match}
              color="text-red-600 dark:text-red-400"
            />
            <Counter
              label="Invalid"
              value={preview.counts.invalid}
              color="text-red-600 dark:text-red-400"
            />
            <Counter
              label="Imported"
              value={preview.counts.imported}
              color="text-gray-500 dark:text-gray-400"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button
              type="button"
              onClick={() => parsedRows && runPreview(parsedRows)}
              disabled={previewing || importing || !parsedRows}
              className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            >
              {previewing ? "Refreshing…" : "Refresh"}
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={!canImport}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {importing
                ? "Importing…"
                : `Import ${preview.counts.matched} matched`}
            </button>
          </div>
        </div>
      )}

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
          {lastImport.skipped_invalid > 0 &&
            ` Skipped ${lastImport.skipped_invalid} invalid row${
              lastImport.skipped_invalid === 1 ? "" : "s"
            }.`}
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

      {preview && (
        <>
          {/* Filter */}
          <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Filter
            </span>
            {(
              [
                "all",
                "matched",
                "no_lot",
                "no_catalog_match",
                "invalid",
                "imported",
              ] as const
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
                      : f === "no_catalog_match"
                        ? "No catalog"
                        : f === "invalid"
                          ? "Invalid"
                          : "Imported"}
              </button>
            ))}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            {filteredItems.length === 0 ? (
              <div className="p-6 text-sm text-gray-500 text-center">
                No rows match this filter.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                    <tr>
                      <th className="px-3 py-2 text-left">#</th>
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
                      <tr key={item.row_index} className="align-top">
                        <td className="px-3 py-3 text-xs text-gray-500 tabular-nums">
                          {item.row_index + 1}
                        </td>
                        <td className="px-3 py-3">
                          {item.resolved_card_image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.resolved_card_image_url}
                              alt={item.resolved_card_name ?? ""}
                              className="w-10 h-14 object-contain rounded"
                            />
                          ) : (
                            <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded" />
                          )}
                        </td>
                        <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                          <p className="font-medium">
                            {item.resolved_card_name ?? item.card_name ?? "(unknown card)"}
                            {(item.resolved_card_number ?? item.card_number) && (
                              <span className="ml-1 text-xs font-normal text-gray-500 dark:text-gray-400">
                                #{item.resolved_card_number ?? item.card_number}
                              </span>
                            )}
                          </p>
                          {item.set_name && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {item.set_name}
                            </p>
                          )}
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
                          {item.error && (
                            <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                              {item.error}
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
                          {item.purchase_cents != null
                            ? formatPrice(
                                item.purchase_cents,
                                sellerCurrency,
                                rates ?? {},
                                item.purchase_currency ?? item.sale_currency,
                              )
                            : "—"}
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
                          {item.status === "no_lot" &&
                            item.resolved_card_product_id &&
                            item.purchase_cents != null && (
                              <button
                                type="button"
                                onClick={() => createLot(item)}
                                disabled={creatingIdx === item.row_index}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-gray-800 hover:bg-gray-900 rounded disabled:opacity-50"
                              >
                                {creatingIdx === item.row_index
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
        </>
      )}

      {parsing && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Parsing CSV…
        </p>
      )}
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
