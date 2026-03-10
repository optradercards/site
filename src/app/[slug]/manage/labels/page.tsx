"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { formatPrice } from "@/lib/currency";
import { gradeLabel, type EcomListing } from "@/lib/pricing";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type LabelItem = {
  name: string;
  cardNumber: string | null;
  rarity: string | null;
  price: string;
  quantity: number;
};

// ---------------------------------------------------------------------------
// ZPL Generation
// ---------------------------------------------------------------------------

function zplSafe(str: string): string {
  return str.replace(/[^\x20-\x7E]/g, "");
}

function generateZPL(items: LabelItem[]): string {
  return items
    .map((item) => {
      // 40x15mm ≈ 320x120 dots at 203dpi
      const name = zplSafe(
        item.name.length > 28
          ? item.name.substring(0, 28) + ".."
          : item.name
      );
      const line2Parts = zplSafe(
        [item.cardNumber, item.rarity].filter(Boolean).join(" | ")
      );
      const price = zplSafe(item.price);
      return [
        "^XA",
        "^LT20",
        "^CF0,22",
        "^FO10,10^FD" + name + "^FS",
        "^CF0,20",
        "^FO10,38^FD" + line2Parts + "^FS",
        "^CF0,28",
        "^FO10,68^FD" + price + "^FS",
        "^PQ" + item.quantity,
        "^XZ",
      ].join("\n");
    })
    .join("\n");
}

// ---------------------------------------------------------------------------
// Labels Page
// ---------------------------------------------------------------------------

export default function LabelsPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();

  const [listings, setListings] = useState<EcomListing[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filters & sorting
  const [gradeFilter, setGradeFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name-asc");

  // ZPL output
  const [zplOutput, setZplOutput] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previews, setPreviews] = useState<string[]>([]);
  const [renderingPreviews, setRenderingPreviews] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // -------------------------------------------------------------------------
  // Data loading
  // -------------------------------------------------------------------------

  const loadData = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);

    const { data } = await supabase
      .schema("ecom")
      .from("listing_details")
      .select("*")
      .eq("account_id", activeAccountId);

    setListings((data ?? []) as EcomListing[]);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Seller's currency (all listings share the same account/currency)
  const sellerCurrency = listings[0]?.currency ?? "AUD";
  const fmt = (cents: number | null | undefined) =>
    formatPrice(cents ?? null, sellerCurrency, {}, sellerCurrency);

  // -------------------------------------------------------------------------
  // Rows with filtering & sorting
  // -------------------------------------------------------------------------

  const gradeOptions = useMemo(() => {
    const labels = new Set<string>();
    for (const listing of listings) {
      labels.add(gradeLabel(listing.grading_service, listing.grade));
    }
    return [...labels].sort();
  }, [listings]);

  const rows = useMemo(() => {
    let result = listings.map((listing) => ({ listing }));

    // Filter by grade
    if (gradeFilter !== "all") {
      result = result.filter(
        (r) =>
          gradeLabel(r.listing.grading_service, r.listing.grade) === gradeFilter
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "name-asc":
          return (a.listing.card_name ?? "").localeCompare(b.listing.card_name ?? "");
        case "name-desc":
          return (b.listing.card_name ?? "").localeCompare(a.listing.card_name ?? "");
        case "price-desc":
          return (b.listing.price_cents ?? 0) - (a.listing.price_cents ?? 0);
        case "price-asc":
          return (a.listing.price_cents ?? 0) - (b.listing.price_cents ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [listings, gradeFilter, sortBy]);

  // -------------------------------------------------------------------------
  // Selection
  // -------------------------------------------------------------------------

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(rows.map((r) => r.listing.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedCount = rows.filter((r) =>
    selectedIds.has(r.listing.id)
  ).length;

  // -------------------------------------------------------------------------
  // ZPL generation & export
  // -------------------------------------------------------------------------

  const toLabelItem = (r: (typeof rows)[number]): LabelItem => ({
    name: r.listing.title ?? r.listing.card_name ?? "Unknown",
    cardNumber: r.listing.card_number ?? null,
    rarity: r.listing.rarity ?? null,
    price: fmt(r.listing.price_cents),
    quantity: r.listing.quantity,
  });

  const handleGenerateLabels = async () => {
    const items = rows
      .filter((r) => selectedIds.has(r.listing.id))
      .map(toLabelItem);

    const zpl = generateZPL(items);
    setZplOutput(zpl);
    setCopied(false);
    setPreviews([]);
    setPreviewError(null);

    // Lazy-load renderer and generate previews
    setRenderingPreviews(true);
    try {
      const { ready } = await import("zpl-renderer-js");
      const { api } = await ready;
      // 40x15mm label, 8 dpmm = 203 DPI
      const images = await api.zplToBase64MultipleAsync(zpl, 40, 15, 8);
      setPreviews(images);
    } catch (e: unknown) {
      setPreviewError(
        e instanceof Error ? e.message : "Failed to render label previews"
      );
    } finally {
      setRenderingPreviews(false);
    }
  };

  const handleCopy = async () => {
    if (!zplOutput) return;
    await navigator.clipboard.writeText(zplOutput);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!zplOutput) return;
    const blob = new Blob([zplOutput], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "labels.zpl";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadRow = (r: (typeof rows)[number]) => {
    const zpl = generateZPL([toLabelItem(r)]);
    const blob = new Blob([zpl], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `label-${(r.listing.card_name ?? "item").replace(/[^a-zA-Z0-9]/g, "_")}.zpl`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="text-gray-500 dark:text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div>
      {/* Label Preview & Download */}
      {zplOutput && (
        <div
          className="mb-6 bg-white dark:bg-gray-800 rounded-lg shadow p-4"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Label Preview
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
              >
                Download .zpl
              </button>
              <button
                onClick={handleCopy}
                className="px-3 py-1.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
              >
                {copied ? "Copied!" : "Copy to Clipboard"}
              </button>
            </div>
          </div>

          {renderingPreviews && (
            <div className="text-sm text-gray-500 dark:text-gray-400 py-4">
              Rendering previews...
            </div>
          )}
          {previewError && (
            <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
              Preview error: {previewError}
            </div>
          )}
          {previews.length > 0 && (
            <div className="flex flex-wrap gap-3 mb-4">
              {previews.map((base64, i) => (
                <img
                  key={i}
                  src={`data:image/png;base64,${base64}`}
                  alt={`Label ${i + 1}`}
                  className="border border-gray-300 dark:border-gray-600 rounded"
                  style={{ height: 60 }}
                />
              ))}
            </div>
          )}

          <details>
            <summary className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase cursor-pointer select-none">
              ZPL Code
            </summary>
            <textarea
              readOnly
              value={zplOutput}
              rows={Math.min(20, zplOutput.split("\n").length + 1)}
              className="mt-2 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-3 py-2 text-sm font-mono text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            />
          </details>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">
            Send to printer: <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">copy /b labels.zpl \\.\USB001</code> (Windows) or open in Zebra Setup Utilities.
          </p>
        </div>
      )}

      {/* Selection Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <button
            onClick={handleGenerateLabels}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600"
          >
            Generate Labels ({selectedCount})
          </button>
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedCount} of {rows.length} selected
          </div>
          <button
            onClick={clearSelection}
            className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            Clear
          </button>
        </div>
      )}

      {/* Filters & Sort */}
      {rows.length > 0 && (
        <div className="flex flex-wrap items-end gap-4 mb-4">
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Grade
            </span>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="mt-1 block w-36 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="all">All Grades</option>
              {gradeOptions.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
              Sort By
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="mt-1 block w-48 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
            >
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="price-desc">Price (High-Low)</option>
              <option value="price-asc">Price (Low-High)</option>
            </select>
          </label>
        </div>
      )}

      {/* Table */}
      {rows.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
          No store listings found.
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-gray-700 text-gray-600 dark:text-gray-300 uppercase text-xs">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={
                      selectedCount === rows.length && rows.length > 0
                    }
                    onChange={() => {
                      if (selectedCount === rows.length) clearSelection();
                      else selectAll();
                    }}
                    className="rounded text-red-500 focus:ring-red-500"
                  />
                </th>
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Card</th>
                <th className="px-4 py-3">Number</th>
                <th className="px-4 py-3">Set</th>
                <th className="px-4 py-3">Rarity</th>
                <th className="px-4 py-3">Grade</th>
                <th className="px-4 py-3 text-right">Qty</th>
                <th className="px-4 py-3 text-right">Price</th>
                <th className="px-4 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
              {rows.map((r) => {
                const isSelected = selectedIds.has(r.listing.id);
                return (
                  <tr
                    key={r.listing.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelection(r.listing.id)}
                        className="rounded text-red-500 focus:ring-red-500"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {r.listing.image_url ? (
                        <img
                          src={r.listing.image_url}
                          alt={r.listing.card_name ?? ""}
                          className="w-10 h-14 object-contain rounded"
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-200 dark:bg-gray-600 rounded flex items-center justify-center text-xs text-gray-400">
                          {"\u2014"}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {r.listing.card_name ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.listing.card_number ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.listing.set_name ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {r.listing.rarity ?? "\u2014"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {gradeLabel(
                        r.listing.grading_service,
                        r.listing.grade
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                      {r.listing.quantity}
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">
                      {fmt(r.listing.price_cents)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDownloadRow(r)}
                        className="text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                        title="Download .zpl label"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-4 h-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                          />
                        </svg>
                      </button>
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
