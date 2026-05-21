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

// /[slug]/manage/admin/import-groups — bulk-create ecom.purchases from a CSV
// of "groups" (e.g. Shiny binder collections). Idempotent on
// (account_id, source_provider='shiny_group', source_id=external_id).

type CsvRow = {
  external_id: string | null;
  name: string;
  purchased_at: string | null; // YYYY-MM-DD
  total_cents: number | null;
  currency: string;
  notes: string | null;
};

type PreviewStatus = "new" | "imported" | "invalid";

type PreviewRow = CsvRow & {
  row_index: number;
  status: PreviewStatus;
  error: string | null;
};

const TEMPLATE = [
  ["external_id", "name", "purchased_at", "total_price", "currency", "notes"],
  ["shiny-abc123", "09/01/26 $5500 Wolli Binder", "2026-01-09", "5500.00", "AUD", ""],
];

function downloadTemplate() {
  const csv = Papa.unparse(TEMPLATE);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-groups-template.csv";
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

function parseCsv(file: File): Promise<CsvRow[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const rows: CsvRow[] = results.data.map((r) => ({
            external_id: emptyStr(r.external_id),
            name: (emptyStr(r.name) ?? "").trim(),
            purchased_at: emptyStr(r.purchased_at),
            total_cents: parseDollarsToCents(r.total_price),
            currency: (emptyStr(r.currency) ?? "AUD").toUpperCase(),
            notes: emptyStr(r.notes),
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
    new: {
      label: "New",
      cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    },
    imported: {
      label: "Imported",
      cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300",
    },
    invalid: {
      label: "Invalid",
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

export default function ImportGroupsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();
  const { data: profileData } = useProfile();
  const { data: rates } = useExchangeRates();
  const sellerCurrency = profileData?.profile?.default_currency ?? "AUD";

  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [existingIds, setExistingIds] = useState<Set<string>>(new Set());
  const [existingNames, setExistingNames] = useState<Set<string>>(new Set());
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const refreshExisting = useCallback(async () => {
    if (!activeAccountId) return;
    const { data } = await supabase
      .schema("ecom")
      .from("inventory_groups")
      .select("name")
      .eq("account_id", activeAccountId);
    setExistingIds(new Set());
    setExistingNames(
      new Set(
        ((data ?? []) as { name: string | null }[])
          .map((r) => (r.name ?? "").trim().toLowerCase())
          .filter((s) => s.length > 0),
      ),
    );
  }, [supabase, activeAccountId]);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setNotice(null);
    setParsing(true);
    setFileName(file.name);
    try {
      const rows = await parseCsv(file);
      setCsvRows(rows);
      await refreshExisting();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse CSV");
    } finally {
      setParsing(false);
    }
  };

  const preview: PreviewRow[] = useMemo(() => {
    if (!csvRows) return [];
    return csvRows.map((r, i) => {
      let status: PreviewStatus = "new";
      let err: string | null = null;
      if (!r.name) err = "name is required";
      if (err) status = "invalid";
      else if (existingNames.has(r.name.trim().toLowerCase()))
        status = "imported";
      return { ...r, row_index: i, status, error: err };
    });
  }, [csvRows, existingIds]);

  const counts = useMemo(() => {
    const c = { total: preview.length, new: 0, imported: 0, invalid: 0 };
    for (const p of preview) c[p.status]++;
    return c;
  }, [preview]);

  const runImport = async () => {
    if (!activeAccountId) return;
    const toImport = preview.filter((p) => p.status === "new");
    if (toImport.length === 0) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    let created = 0;
    let skipped = 0;
    const errors: string[] = [];
    for (const row of toImport) {
      const total = row.total_cents ?? 0;
      const slug = row.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || `group-${row.row_index + 1}`;
      const descParts: string[] = [];
      if (row.purchased_at) descParts.push(`Acquired ${row.purchased_at}`);
      if (total > 0) descParts.push(`Total ${(total / 100).toFixed(2)} ${row.currency}`);
      if (row.external_id) descParts.push(`shiny:${row.external_id}`);
      if (row.notes) descParts.push(row.notes);
      const { error: pErr } = await supabase
        .schema("ecom")
        .from("inventory_groups")
        .insert({
          account_id: activeAccountId,
          name: row.name,
          slug,
          description: descParts.join(" · ") || null,
        });
      if (pErr) {
        if (pErr.code === "23505") skipped++;
        else errors.push(`${row.name}: ${pErr.message}`);
        continue;
      }
      created++;
    }
    await refreshExisting();
    setImporting(false);
    if (errors.length > 0) setError(errors.join("; "));
    setNotice(
      `Created ${created} purchase${created === 1 ? "" : "s"}` +
        (skipped > 0 ? `; skipped ${skipped} already imported.` : "."),
    );
  };

  const canImport = counts.new > 0 && !importing;

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
        Import inventory groups
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Upload a CSV of group names (e.g. your Shiny binders) — each new row
        becomes an <code>ecom.inventory_groups</code> entry you can use to
        tag lots from <code>/manage/groups</code>. Rows whose name already
        exists on this account are marked Imported and skipped. Date,
        total, and external id are folded into the group&rsquo;s description.
      </p>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
            Groups CSV
          </label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={handleFile}
            className="block w-full text-sm text-gray-900 dark:text-gray-100 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 dark:file:bg-gray-700 dark:file:text-gray-200 hover:file:bg-gray-200 dark:hover:file:bg-gray-600"
          />
          {fileName && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {fileName}
              {csvRows && ` — ${csvRows.length} rows`}
              {parsing && " — parsing…"}
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

      {csvRows && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-5 mb-6 flex flex-wrap items-center gap-6 text-sm">
          <Counter label="Total" value={counts.total} />
          <Counter
            label="New"
            value={counts.new}
            color="text-green-600 dark:text-green-400"
          />
          <Counter
            label="Imported"
            value={counts.imported}
            color="text-gray-500 dark:text-gray-400"
          />
          <Counter
            label="Invalid"
            value={counts.invalid}
            color="text-red-600 dark:text-red-400"
          />
          <div className="ml-auto">
            <button
              type="button"
              onClick={runImport}
              disabled={!canImport}
              className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
            >
              {importing ? "Importing…" : `Import ${counts.new} new`}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded text-green-700 dark:text-green-300 text-sm">
          {notice}
        </div>
      )}

      {csvRows && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {preview.length === 0 ? (
            <div className="p-6 text-sm text-gray-500 text-center">
              CSV is empty.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                  <tr>
                    <th className="px-3 py-2 text-left">#</th>
                    <th className="px-3 py-2 text-left">Name</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Total</th>
                    <th className="px-3 py-2 text-left">External id</th>
                    <th className="px-3 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {preview.map((r) => (
                    <tr key={r.row_index} className="align-top">
                      <td className="px-3 py-3 text-xs text-gray-500 tabular-nums">
                        {r.row_index + 1}
                      </td>
                      <td className="px-3 py-3 text-gray-900 dark:text-gray-100">
                        {r.name || "—"}
                        {r.error && (
                          <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                            {r.error}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 text-gray-600 dark:text-gray-400 whitespace-nowrap">
                        {r.purchased_at ?? "—"}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300 whitespace-nowrap">
                        {r.total_cents != null
                          ? formatPrice(
                              r.total_cents,
                              sellerCurrency,
                              rates ?? {},
                              r.currency,
                            )
                          : "—"}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500 dark:text-gray-400 font-mono">
                        {r.external_id ?? "—"}
                      </td>
                      <td className="px-3 py-3">{statusBadge(r.status)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
