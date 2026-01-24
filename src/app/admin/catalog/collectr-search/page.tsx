"use client";

import { useState } from "react";

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

const buildQuery = (params: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") q.set(key, value);
  });
  return q.toString();
};

export default function CollectrSearchPage() {
  const [filters, setFilters] = useState("");
  const [searchString, setSearchString] = useState("");
  const [limit, setLimit] = useState("50");
  const [offset, setOffset] = useState("0");
  const [collectionId, setCollectionId] = useState("");
  const [username, setUsername] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [showSets, setShowSets] = useState<boolean | null>(null);

  const runSearch = async () => {
    setLoading(true);
    setError(null);
    setResults([]);
    setShowSets(null);

    try {
      const qs = buildQuery({
        filters,
        searchString,
        limit,
        offset,
        collectionId,
        username,
      });
      const res = await fetch(`/functions/v1/collectr-fetch-search?${qs}`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`Request failed (${res.status}): ${body}`);
      }
      const data = await res.json();
      setResults(data?.data || []);
      setShowSets(typeof data?.showSets === "boolean" ? data.showSets : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run search");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Collectr Catalog Search
          </h1>
          <p className="text-slate-300">
            Query Collectr catalog via the Supabase edge function.
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
              <label className="text-sm text-slate-300">Limit</label>
              <input
                type="number"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm text-slate-300">Offset</label>
              <input
                type="number"
                value={offset}
                onChange={(e) => setOffset(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
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
                Username (UUID) (optional)
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full mt-1 rounded bg-slate-900 text-white border border-slate-700 px-3 py-2"
                placeholder="Overrides COLLECTR_USERNAME env"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={runSearch}
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
                  key={item.product_id}
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
        </div>
      </div>
    </div>
  );
}
