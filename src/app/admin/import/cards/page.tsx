"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Brand {
  id: string;
  source_id: string;
  name: string;
  icon?: string;
}

interface Group {
  id: string;
  name: string;
  brand_id: string;
  logo?: string;
}

interface Set {
  id: string;
  name: string;
  brand_id: string;
  group_id?: string;
  logo?: string;
}

interface ShinyProduct {
  id: string;
  se: string;
  na: string;
  im: string;
  pc: string;
  tc: string;
  fl: number;
  pu: number;
  uch?: number;
  uchp?: number;
  mp: boolean;
  lp?: number;
}

interface SearchResult {
  brands: any[];
  sets: any[];
  items: ShinyProduct[];
}

interface ImportStats {
  brands_imported: number;
  sets_imported: number;
  products_imported: number;
  errors: string[];
}

export default function CardImportPage() {
  const supabase = createClient();

  // Data state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search state
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Brand filter state
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [filteredBrands, setFilteredBrands] = useState<string[]>([]);

  // Modal state
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [modalBrand, setModalBrand] = useState<string>("");
  const [modalSelectedSets, setModalSelectedSets] = useState(
    new Set<string>(),
  );

  // Selection state
  const [selectedProducts, setSelectedProducts] = useState(
    new Set<string>(),
  );

  // Import state
  const [importing, setImporting] = useState(false);
  const [importStats, setImportStats] = useState<ImportStats | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoadingData(true);
    setLoadError(null);

    try {
      const [brandsRes, groupsRes, setsRes] = await Promise.all([
        supabase.from("trading_card_brands").select("*").order("name"),
        supabase.from("trading_card_groups").select("*").order("name"),
        supabase.from("trading_card_sets").select("*").order("name"),
      ]);

      if (brandsRes.error) throw brandsRes.error;
      if (groupsRes.error) throw groupsRes.error;
      if (setsRes.error) throw setsRes.error;

      const loadedBrands = brandsRes.data || [];
      setBrands(loadedBrands);
      setGroups(groupsRes.data || []);
      setSets(setsRes.data || []);

      // Select all brands by default
      setFilteredBrands(loadedBrands.map((b) => b.id));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoadingData(false);
    }
  };

  const toggleBrandFilter = (brandId: string) => {
    setFilteredBrands((prev) => {
      if (prev.includes(brandId)) {
        // Don't allow deselecting the last brand
        if (prev.length === 1) {
          return prev;
        }
        return prev.filter((id) => id !== brandId);
      }
      return [...prev, brandId];
    });
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    // Always require at least one brand (should always be true now)
    if (filteredBrands.length === 0) return;

    setSearching(true);
    setSearchError(null);
    setSearchResults(null);
    setSelectedProducts(new Set());

    try {
      // Build query string manually
      const queryParams = new URLSearchParams();
      if (searchQuery) queryParams.set("searchQuery", searchQuery);
      if (filteredBrands.length > 0) {
        // Convert our brand UUIDs to source IDs for the Shiny API
        const shinyBrandIds = filteredBrands
          .map((uuid) => brands.find((b) => b.id === uuid)?.source_id)
          .filter(Boolean) as string[];
        if (shinyBrandIds.length > 0) {
          queryParams.set("filteredBrands", shinyBrandIds.join(","));
        }
      }
      queryParams.set("page", "1");
      queryParams.set("sortBy", "relevance");

      // Get the user's session token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Use fetch directly since supabase.functions.invoke doesn't support GET with query params well
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/shiny-fetch-search?${queryParams.toString()}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token || ""}`,
            "Content-Type": "application/json",
            apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
          },
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Search failed: ${response.status} ${errorText}`);
      }

      const result = await response.json();

      // Check if there's an error in the response
      if (result.error) {
        setSearchError(result.error);
      } else {
        // Response is the raw Shiny API data
        setSearchResults(result);
      }
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSearching(false);
    }
  };

  const toggleProductSelection = (productId: string) => {
    setSelectedProducts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const selectAllProducts = () => {
    if (searchResults) {
      setSelectedProducts(new Set(searchResults.items.map((p) => p.id)));
    }
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
  };

  const handleImport = async () => {
    if (!searchResults || selectedProducts.size === 0) {
      setImportError("No products selected");
      return;
    }

    setImporting(true);
    setImportError(null);
    setImportStats(null);

    try {
      // Just send the product IDs - the import function will fetch full details
      const productIds = Array.from(selectedProducts);

      const { data, error } = await supabase.functions.invoke(
        "shiny-import-cards",
        {
          body: { productIds },
        },
      );

      if (error) {
        setImportError(error.message || "Import failed");
      } else if (data.success) {
        setImportStats(data.stats);
        // Clear selection after successful import
        setSelectedProducts(new Set());
      } else {
        setImportError(data.error || "Import failed");
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setImporting(false);
    }
  };

  const applySetFilters = () => {
    // Apply the selected sets from modal to search
    setShowFilterModal(false);
    // Trigger search with these sets
    if (modalSelectedSets.size > 0) {
      // Convert set IDs to brand filters
      const setList = Array.from(modalSelectedSets);
      const brandSet = new Set(
        setList
          .map((setId) => {
            const set = sets.find((s) => s.id === setId);
            return set?.brand_id;
          })
          .filter(Boolean) as string[],
      );
      setFilteredBrands(Array.from(brandSet));
    }
  };

  const modalBrandGroups = modalBrand
    ? groups.filter((g) => g.brand_id === modalBrand)
    : [];
  const modalBrandSets = modalBrand
    ? sets.filter((s) => s.brand_id === modalBrand)
    : [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-5xl font-bold bg-gradient-to-r from-gray-900 via-purple-900 to-blue-900 dark:from-white dark:via-purple-200 dark:to-blue-200 bg-clip-text text-transparent mb-3">
          Import Trading Cards
        </h1>
        <p className="text-gray-600 dark:text-slate-400 text-lg">
          Search for cards and import them into your database
        </p>
      </div>

      {/* Search Section */}
      <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-700/50 p-8 shadow-lg">
        <form onSubmit={handleSearch}>
          <div>
            <label className="block text-gray-900 dark:text-white font-semibold mb-3">
              Search Query
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for cards (optional - will search within selected brands)"
                className="flex-1 px-6 py-4 bg-gray-50 dark:bg-slate-800/50 border-2 border-gray-300 dark:border-slate-700/50 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
              />
              <button
                type="submit"
                disabled={searching || filteredBrands.length === 0}
                className="px-8 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:from-gray-400 disabled:to-gray-400 dark:disabled:from-slate-700 dark:disabled:to-slate-700 text-white font-bold py-4 rounded-xl transition-all disabled:cursor-not-allowed text-lg whitespace-nowrap"
              >
                {searching ? "Searching..." : "Search"}
              </button>
              <button
                type="button"
                onClick={() => setShowFilterModal(true)}
                className="px-6 py-4 bg-gray-100 dark:bg-slate-800/50 hover:bg-gray-200 dark:hover:bg-slate-700/50 border-2 border-gray-300 dark:border-slate-700/50 hover:border-gray-400 dark:hover:border-slate-600 text-gray-900 dark:text-white font-semibold rounded-xl transition-all whitespace-nowrap"
              >
                Filter by Sets
              </button>
            </div>
          </div>
        </form>

        {searchError && (
          <div className="mt-6 bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4">
            <p className="text-red-800 dark:text-red-200">{searchError}</p>
          </div>
        )}
      </div>

      {/* Brand Filters */}
      {!loadingData && brands.length > 0 && (
        <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-700/50 p-6 shadow-lg">
          <h3 className="text-gray-900 dark:text-white font-bold text-lg mb-4">
            Filter by Brands
          </h3>
          <div className="flex flex-wrap gap-3">
            {brands.map((brand) => (
              <button
                key={brand.id}
                onClick={() => toggleBrandFilter(brand.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 transition-all ${
                  filteredBrands.includes(brand.id)
                    ? "bg-purple-100 dark:bg-purple-900/50 border-purple-500 text-purple-900 dark:text-white"
                    : "bg-gray-50 dark:bg-slate-800/30 border-gray-300 dark:border-slate-700/50 text-gray-700 dark:text-slate-300 hover:border-gray-400 dark:hover:border-slate-600"
                }`}
              >
                {brand.icon && (
                  <img
                    src={brand.icon}
                    alt={brand.name}
                    className="w-6 h-6 object-contain"
                  />
                )}
                <span className="font-medium">{brand.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search Results */}
      {searchResults &&
        searchResults.items &&
        searchResults.items.length > 0 && (
          <>
            <div className="bg-white dark:bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-gray-200 dark:border-slate-700/50 p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <span className="text-gray-600 dark:text-slate-300">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {selectedProducts.size}
                    </span>{" "}
                    of{" "}
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {searchResults.items.length}
                    </span>{" "}
                    products selected
                  </span>
                  <button
                    onClick={selectAllProducts}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    Select All
                  </button>
                  <button
                    onClick={clearSelection}
                    className="text-sm text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                  >
                    Clear
                  </button>
                </div>
                <button
                  onClick={handleImport}
                  disabled={importing || selectedProducts.size === 0}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 dark:disabled:bg-slate-600 text-white font-semibold py-3 px-8 rounded-xl transition-all disabled:cursor-not-allowed"
                >
                  {importing
                    ? "Importing..."
                    : `Import ${selectedProducts.size} Selected`}
                </button>
              </div>
            </div>

            {importStats && (
              <div className="bg-green-50 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-xl p-6">
                <p className="text-green-800 dark:text-green-100 font-semibold mb-3">
                  ✓ Import Successful
                </p>
                <div className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <span className="text-green-700 dark:text-green-200">
                      Brands:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {importStats.brands_imported}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-200">
                      Sets:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {importStats.sets_imported}
                    </span>
                  </div>
                  <div>
                    <span className="text-green-700 dark:text-green-200">
                      Products:
                    </span>{" "}
                    <span className="text-gray-900 dark:text-white font-semibold">
                      {importStats.products_imported}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {importError && (
              <div className="bg-red-50 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-xl p-4">
                <p className="text-red-800 dark:text-red-200">{importError}</p>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {searchResults.items.map((product) => {
                const set = searchResults.sets.find((s) => s.id === product.se);
                const brand = searchResults.brands.find(
                  (b) => b.id === set?.br,
                );
                const isSelected = selectedProducts.has(product.id);

                // Get region code from set language
                const getRegionCode = (language: string) => {
                  const regionMap: Record<string, string> = {
                    Japanese: "JP",
                    English: "EN",
                    Korean: "KR",
                    Chinese: "CN",
                    French: "FR",
                    German: "DE",
                    Italian: "IT",
                    Spanish: "ES",
                    Portuguese: "PT",
                  };
                  return (
                    regionMap[language] ||
                    language.substring(0, 2).toUpperCase()
                  );
                };

                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProductSelection(product.id)}
                    className={`bg-white dark:bg-slate-800/40 rounded-xl p-4 border-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-blue-500 ring-2 ring-blue-500/50"
                        : "border-gray-200 dark:border-slate-700/50 hover:border-gray-300 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      {product.im && (
                        <img
                          src={product.im}
                          alt={product.na}
                          className="w-full h-32 object-contain mb-3 rounded"
                        />
                      )}
                      <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-1 truncate">
                        {product.na}
                      </h3>
                      <div className="flex items-center gap-2 mb-1">
                        {brand && (
                          <p className="text-gray-600 dark:text-slate-400 text-xs">
                            {brand.na}
                          </p>
                        )}
                        {set?.la && (
                          <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-semibold rounded">
                            {getRegionCode(set.la)}
                          </span>
                        )}
                      </div>
                      {set && (
                        <p className="text-gray-500 dark:text-slate-500 text-xs truncate mb-2">
                          {set.na}
                        </p>
                      )}

                      {/* Price */}
                      {product.pu && product.pu > 0 && (
                        <div className="mb-2">
                          <span className="text-green-600 dark:text-green-400 font-bold text-lg">
                            ${(product.pu / 100).toFixed(2)}
                          </span>
                        </div>
                      )}

                      <div className="flex items-center gap-3 text-xs flex-wrap">
                        {product.pc && (
                          <span className="text-gray-500 dark:text-slate-400">
                            #{product.pc}
                          </span>
                        )}
                        {product.fl > 0 && (
                          <span className="text-blue-600 dark:text-blue-400">
                            👥 {product.fl}
                          </span>
                        )}
                        {product.mp && (
                          <span className="text-yellow-600 dark:text-yellow-400">
                            ⭐ Premium
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {searchResults.items.length === 0 && (
              <div className="bg-white dark:bg-slate-900/50 rounded-xl p-12 text-center">
                <p className="text-gray-600 dark:text-slate-400">
                  No products found. Try a different search.
                </p>
              </div>
            )}
          </>
        )}

      {/* No results message */}
      {searchResults &&
        (!searchResults.items || searchResults.items.length === 0) && (
          <div className="bg-white dark:bg-slate-900/50 rounded-xl p-12 text-center">
            <p className="text-gray-600 dark:text-slate-400">
              No products found. Try a different search.
            </p>
          </div>
        )}

      {/* Filter Modal */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl border-2 border-gray-300 dark:border-slate-700 max-w-4xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-slate-700">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Filter by Sets
              </h2>
              <button
                onClick={() => setShowFilterModal(false)}
                className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-white transition-colors flex items-center justify-center"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div>
                <label className="block text-gray-900 dark:text-white font-semibold mb-3">
                  Select Brand
                </label>
                <select
                  value={modalBrand}
                  onChange={(e) => {
                    setModalBrand(e.target.value);
                    setModalSelectedSets(new Set());
                  }}
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-slate-800 border-2 border-gray-300 dark:border-slate-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select a brand...</option>
                  {brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>
                      {brand.name}
                    </option>
                  ))}
                </select>
              </div>

              {modalBrand && modalBrandGroups.length > 0 && (
                <div className="space-y-4">
                  {modalBrandGroups.map((group) => {
                    const groupSets = modalBrandSets.filter(
                      (s) => s.group_id === group.id,
                    );
                    if (groupSets.length === 0) return null;

                    return (
                      <div
                        key={group.id}
                        className="bg-gray-50 dark:bg-slate-800/50 rounded-xl p-4"
                      >
                        <h3 className="text-gray-900 dark:text-white font-bold mb-3 flex items-center gap-2">
                          {group.logo && (
                            <img
                              src={group.logo}
                              alt={group.name}
                              className="w-6 h-6 object-contain"
                            />
                          )}
                          {group.name}
                        </h3>
                        <div className="space-y-2">
                          {groupSets.map((set) => (
                            <label
                              key={set.id}
                              className="flex items-center gap-3 p-3 bg-white dark:bg-slate-700/30 hover:bg-gray-100 dark:hover:bg-slate-700/50 rounded-lg cursor-pointer transition-all"
                            >
                              <input
                                type="checkbox"
                                checked={modalSelectedSets.has(set.id)}
                                onChange={() => {
                                  const newSets = new Set(modalSelectedSets);
                                  if (newSets.has(set.id)) {
                                    newSets.delete(set.id);
                                  } else {
                                    newSets.add(set.id);
                                  }
                                  setModalSelectedSets(newSets);
                                }}
                                className="w-4 h-4 rounded accent-purple-500"
                              />
                              {set.logo && (
                                <img
                                  src={set.logo}
                                  alt={set.name}
                                  className="w-5 h-5 object-contain"
                                />
                              )}
                              <span className="text-gray-900 dark:text-white text-sm">
                                {set.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-slate-700 flex justify-end gap-3">
              <button
                onClick={() => setShowFilterModal(false)}
                className="px-6 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white font-semibold rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={applySetFilters}
                disabled={modalSelectedSets.size === 0}
                className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-gray-400 dark:disabled:bg-slate-700 text-white font-semibold rounded-xl transition-colors disabled:cursor-not-allowed"
              >
                Apply Filters ({modalSelectedSets.size} sets)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
