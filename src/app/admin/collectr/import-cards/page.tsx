"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface SearchResult {
  product_id: string;
  product_name: string;
  image_url: string | null;
  catalog_category_name?: string;
  catalog_group?: string;
  catalog_group_id?: string;
  card_number?: string;
  rarity?: string;
  product_sub_type?: string;
  latest_price?: string;
  market_price_diff?: string;
  web_slug_group?: string;
  web_slug_category?: string;
}

export default function CollectrImportCardsPage() {
  const supabase = createClient();
  const [filters, setFilters] = useState("");
  const [searchString, setSearchString] = useState("");
  const [limit, setLimit] = useState("50");
  const [offset, setOffset] = useState("0");
  const [collectionId, setCollectionId] = useState("");
  const [language, setLanguage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showSets, setShowSets] = useState<boolean | null>(null);

  const getLimitValue = () => {
    const parsed = Number(limit);
    if (!Number.isFinite(parsed) || parsed <= 0) return 50;
    return parsed;
  };

  const getOffsetValue = () => {
    const parsed = Number(offset);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    return parsed;
  };

  const runSearch = async (override?: { offset?: number }) => {
    const effectiveLimit = getLimitValue();
    const effectiveOffset = override?.offset ?? getOffsetValue();
    setOffset(String(effectiveOffset));

    setLoading(true);
    setError(null);
    setResults([]);
    setShowSets(null);

    try {
      const { data, error } = await supabase.functions.invoke(
        "collectr-fetch-search",
        {
          body: {
            filters,
            searchString,
            limit: String(effectiveLimit),
            offset: String(effectiveOffset),
            collectionId,
            language,
          },
        },
      );

      if (error) {
        throw new Error(error.message || "Function invoke failed");
      }

      setResults(data?.data || []);
      setShowSets(typeof data?.showSets === "boolean" ? data.showSets : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run search");
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    const nextOffset = getOffsetValue() + getLimitValue();
    runSearch({ offset: nextOffset });
  };

  const handlePrev = () => {
    const prevOffset = Math.max(0, getOffsetValue() - getLimitValue());
    runSearch({ offset: prevOffset });
  };

  const currentPage = Math.floor(getOffsetValue() / getLimitValue()) + 1;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Collectr Import Cards
          </h1>
          <p className="text-slate-300">
            Search Collectr catalog via the Supabase edge function to import
            cards.
          </p>
        </div>

        {/* Form */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-300">
                Filters (category IDs, comma-separated)
              </label>
              <input
                value={filters}
                onChange={(e) => setFilters(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
                placeholder="e.g. 68"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Search String</label>
              <input
                value={searchString}
                onChange={(e) => setSearchString(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
                placeholder="Card name keywords"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">
                Collection ID (optional)
              </label>
              <input
                value={collectionId}
                onChange={(e) => setCollectionId(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
                placeholder="Scopes watchlist/owned flags"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">
                Language (optional)
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
              >
                <option value="">All</option>
                <option value="en">English</option>
                <option value="jp">Japanese</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => runSearch()}
              disabled={loading}
              className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                loading
                  ? "bg-slate-600 text-slate-300 cursor-not-allowed"
                  : "bg-blue-600 hover:bg-blue-700 text-white"
              }`}
            >
              {loading ? "Searching..." : "Search"}
            </button>
            {showSets !== null && (
              <div className="px-3 py-2 rounded bg-slate-700 text-slate-200 text-sm">
                showSets: {String(showSets)}
              </div>
            )}
          </div>

          {error && (
            <div className="text-red-300 bg-red-900/20 border border-red-700 rounded p-3">
              {error}
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-slate-800 border border-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white">
              Results ({results.length})
            </h2>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
          ) : results.length === 0 ? (
            <p className="text-slate-400">No results yet. Run a search.</p>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {results.map((item) => (
                <div
                  key={`${item.product_id}-${item.product_sub_type || ""}`}
                  className="flex gap-4 bg-slate-900 rounded-lg p-4 border border-slate-700"
                >
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.product_name}
                      className="w-16 h-16 rounded object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-white font-semibold truncate">
                        {item.product_name}
                      </h3>
                      {item.latest_price && (
                        <span className="text-slate-200 font-mono text-sm">
                          {item.latest_price}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-400 text-sm truncate">
                      {item.catalog_category_name || item.web_slug_category} •{" "}
                      {item.catalog_group || item.web_slug_group}
                    </p>
                    <p className="text-slate-500 text-xs">
                      #{item.card_number || "-"} • {item.rarity || "-"} •{" "}
                      {item.product_sub_type || "-"}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              onClick={handlePrev}
              disabled={loading || getOffsetValue() === 0}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600 ${
                loading || getOffsetValue() === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-slate-900 text-slate-200 hover:bg-slate-800"
              }`}
            >
              Previous
            </button>
            <button
              onClick={handleNext}
              disabled={loading || results.length === 0}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors border border-slate-600 ${
                loading || results.length === 0
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-slate-900 text-slate-200 hover:bg-slate-800"
              }`}
            >
              Next
            </button>
            <div className="text-slate-400 text-sm">
              Page {currentPage} • Offset {getOffsetValue()}
            </div>
            <label className="flex items-center gap-2 text-slate-300 text-sm">
              <span>Limit</span>
              <select
                value={limit}
                onChange={async (e) => {
                  setLimit(e.target.value);
                  setOffset("0");
                  await runSearch({ offset: 0 });
                }}
                className="rounded bg-slate-900 text-white border border-slate-700 px-2 py-1"
              >
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="100">100</option>
                <option value="200">200</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
