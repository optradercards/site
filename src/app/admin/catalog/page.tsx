"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface Brand {
  id: string;
  name: string;
  icon_url?: string;
  icon_dark_url?: string;
}

interface SetList {
  id: string;
  name: string;
  brand_id: string;
  logo_url?: string;
  logo_dark_url?: string;
}

interface Group {
  id: string;
  name: string;
  brand_id: string;
  set_list_id?: string;
  sort_position?: number;
}

interface CardSet {
  id: string;
  name: string;
  brand_id: string;
  group_id?: string;
  set_list_id?: string;
  logo_url?: string;
  logo_dark_url?: string;
}

export default function CatalogPage() {
  const supabase = createClient();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [expandedSetLists, setExpandedSetLists] = useState<Set<string>>(
    new Set(),
  );
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [brandsRes, setListsRes, groupsRes, setsRes] = await Promise.all([
        supabase.from("trading_card_brands").select("*").order("name"),
        supabase.from("trading_card_set_lists").select("*").order("name"),
        supabase
          .from("trading_card_groups")
          .select("*")
          .order("sort_position", { nullsFirst: false })
          .order("name"),
        supabase.from("trading_card_sets").select("*").order("name"),
      ]);

      if (brandsRes.error)
        throw new Error(`Brands: ${brandsRes.error.message}`);
      if (setListsRes.error)
        throw new Error(`Set Lists: ${setListsRes.error.message}`);
      if (groupsRes.error)
        throw new Error(`Groups: ${groupsRes.error.message}`);
      if (setsRes.error) throw new Error(`Sets: ${setsRes.error.message}`);

      setBrands(brandsRes.data || []);
      setSetLists(setListsRes.data || []);
      setGroups(groupsRes.data || []);
      setSets(setsRes.data || []);

      if (brandsRes.data && brandsRes.data.length > 0) {
        setSelectedBrand(brandsRes.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load catalog");
    } finally {
      setLoading(false);
    }
  };

  const toggleSetList = (setListId: string) => {
    const newExpanded = new Set(expandedSetLists);
    if (newExpanded.has(setListId)) {
      newExpanded.delete(setListId);
    } else {
      newExpanded.add(setListId);
    }
    setExpandedSetLists(newExpanded);
  };

  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId);
    } else {
      newExpanded.add(groupId);
    }
    setExpandedGroups(newExpanded);
  };

  const selectedBrandData = brands.find((b) => b.id === selectedBrand);
  const brandSetLists = selectedBrand
    ? setLists.filter((sl) => sl.brand_id === selectedBrand)
    : [];
  const brandGroups = selectedBrand
    ? groups.filter((g) => g.brand_id === selectedBrand)
    : [];
  const brandSets = selectedBrand
    ? sets.filter((s) => s.brand_id === selectedBrand)
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-12">
          <h1 className="text-5xl font-bold bg-gradient-to-r from-white via-purple-200 to-blue-200 bg-clip-text text-transparent mb-3">
            Trading Card Catalog
          </h1>
          <p className="text-slate-400 text-lg">
            Browse all imported brands, groups, and card sets
          </p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl shadow-2xl p-12 border border-slate-700/50 text-center">
            <div className="inline-block">
              <div className="relative">
                <div className="animate-spin rounded-full h-16 w-16 border-4 border-slate-700"></div>
                <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-purple-500 absolute top-0 left-0"></div>
              </div>
              <p className="text-slate-300 mt-6 text-lg font-medium">
                Loading catalog...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-950/50 backdrop-blur-sm border-2 border-red-500/50 rounded-2xl p-6 shadow-lg shadow-red-900/20">
            <p className="text-red-200">{error}</p>
            <button
              onClick={loadData}
              className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Catalog */}
        {!loading && !error && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            {/* Brand Selector */}
            <div className="lg:col-span-1">
              <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-6 shadow-2xl sticky top-8">
                <h2 className="text-lg font-bold text-white mb-4">Brands</h2>
                <div className="space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar">
                  {brands.length === 0 ? (
                    <p className="text-slate-500 text-sm">No brands imported</p>
                  ) : (
                    brands.map((brand) => (
                      <button
                        key={brand.id}
                        onClick={() => {
                          setSelectedBrand(brand.id);
                          setExpandedSetLists(new Set());
                          setExpandedGroups(new Set());
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                          selectedBrand === brand.id
                            ? "bg-purple-900/50 border-purple-500 text-white"
                            : "bg-slate-800/30 border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600"
                        }`}
                      >
                        {brand.name}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="lg:col-span-3">
              {selectedBrandData ? (
                <div className="space-y-6">
                  {/* Brand Header */}
                  <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-8 shadow-2xl">
                    <div className="flex items-center gap-6">
                      {selectedBrandData.icon_url && (
                        <img
                          src={selectedBrandData.icon_url}
                          alt={selectedBrandData.name}
                          className="w-20 h-20 object-contain rounded-xl bg-slate-900/50 p-2"
                        />
                      )}
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                          {selectedBrandData.name}
                        </h2>
                        <div className="flex gap-4 text-sm">
                          <span className="text-cyan-300">
                            {brandSetLists.length} set lists
                          </span>
                          <span className="text-purple-300">
                            {brandGroups.length} groups
                          </span>
                          <span className="text-blue-300">
                            {brandSets.length} sets
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Set Lists */}
                  {brandSetLists.length > 0 ? (
                    <div className="space-y-4">
                      {brandSetLists.map((setList) => {
                        const setListGroups = brandGroups.filter(
                          (g) => g.set_list_id === setList.id,
                        );
                        const setListSets = brandSets.filter(
                          (s) => s.set_list_id === setList.id,
                        );
                        const isSetListExpanded = expandedSetLists.has(
                          setList.id,
                        );

                        return (
                          <div
                            key={setList.id}
                            className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-cyan-700/30 shadow-xl overflow-hidden"
                          >
                            <button
                              onClick={() => toggleSetList(setList.id)}
                              className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                            >
                              <div className="flex items-center gap-4">
                                {setList.logo_url && (
                                  <img
                                    src={setList.logo_url}
                                    alt={setList.name}
                                    className="w-14 h-14 object-contain rounded-lg bg-slate-900/50 p-1"
                                  />
                                )}
                                <div className="text-left">
                                  <h3 className="text-lg font-bold text-white">
                                    {setList.name}
                                  </h3>
                                  <div className="flex gap-3 text-xs mt-1">
                                    <span className="bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">
                                      {setListGroups.length} groups
                                    </span>
                                    <span className="bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                                      {setListSets.length} sets
                                    </span>
                                  </div>
                                </div>
                              </div>
                              <span
                                className={`text-2xl text-cyan-400 transition-transform ${isSetListExpanded ? "rotate-180" : ""}`}
                              >
                                ▼
                              </span>
                            </button>

                            {isSetListExpanded && (
                              <div className="px-6 py-4 bg-slate-800/20 border-t border-slate-700/50 space-y-4">
                                {/* Groups within Set List */}
                                {setListGroups.map((group) => {
                                  const groupSets = brandSets.filter(
                                    (s) => s.group_id === group.id,
                                  );
                                  const isGroupExpanded = expandedGroups.has(
                                    group.id,
                                  );

                                  return (
                                    <div
                                      key={group.id}
                                      className="bg-slate-800/40 rounded-xl border border-slate-700/50 overflow-hidden"
                                    >
                                      <button
                                        onClick={() => toggleGroup(group.id)}
                                        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors"
                                      >
                                        <div className="flex items-center gap-3">
                                          <h4 className="text-md font-semibold text-white">
                                            {group.name}
                                          </h4>
                                          <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">
                                            {groupSets.length} sets
                                          </span>
                                        </div>
                                        <span
                                          className={`text-lg text-purple-400 transition-transform ${isGroupExpanded ? "rotate-180" : ""}`}
                                        >
                                          ▼
                                        </span>
                                      </button>

                                      {isGroupExpanded &&
                                        groupSets.length > 0 && (
                                          <div className="px-4 py-3 bg-slate-900/30 border-t border-slate-700/50 space-y-2">
                                            {groupSets.map((set) => (
                                              <div
                                                key={set.id}
                                                className="flex items-center gap-3 p-2 bg-slate-800/60 rounded-lg border border-slate-700/30 hover:bg-slate-800/80 transition-colors"
                                              >
                                                {set.logo_url && (
                                                  <img
                                                    src={set.logo_url}
                                                    alt={set.name}
                                                    className="w-8 h-8 object-contain rounded bg-slate-900/50 p-0.5 flex-shrink-0"
                                                  />
                                                )}
                                                <p className="text-white text-sm">
                                                  {set.name}
                                                </p>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                    </div>
                                  );
                                })}

                                {/* Sets directly in Set List (no group) */}
                                {setListSets.filter((s) => !s.group_id).length >
                                  0 && (
                                  <div className="mt-4 space-y-2">
                                    <h4 className="text-sm font-medium text-slate-400 mb-2">
                                      Sets without group
                                    </h4>
                                    {setListSets
                                      .filter((s) => !s.group_id)
                                      .map((set) => (
                                        <div
                                          key={set.id}
                                          className="flex items-center gap-3 p-2 bg-slate-800/60 rounded-lg border border-slate-700/30"
                                        >
                                          {set.logo_url && (
                                            <img
                                              src={set.logo_url}
                                              alt={set.name}
                                              className="w-8 h-8 object-contain rounded bg-slate-900/50 p-0.5 flex-shrink-0"
                                            />
                                          )}
                                          <p className="text-white text-sm">
                                            {set.name}
                                          </p>
                                        </div>
                                      ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
                      <p className="text-slate-400">
                        No set lists for this brand
                      </p>
                    </div>
                  )}

                  {/* Groups without Set List */}
                  {brandGroups.filter((g) => !g.set_list_id).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">
                        Groups (no set list)
                      </h3>
                      {brandGroups
                        .filter((g) => !g.set_list_id)
                        .map((group) => {
                          const groupSets = brandSets.filter(
                            (s) => s.group_id === group.id,
                          );
                          const isExpanded = expandedGroups.has(group.id);

                          return (
                            <div
                              key={group.id}
                              className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 shadow-xl overflow-hidden"
                            >
                              <button
                                onClick={() => toggleGroup(group.id)}
                                className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-800/30 transition-colors"
                              >
                                <div className="flex items-center gap-4">
                                  <h3 className="text-lg font-bold text-white">
                                    {group.name}
                                  </h3>
                                  <span className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                                    {groupSets.length} sets
                                  </span>
                                </div>
                                <span
                                  className={`text-2xl text-purple-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                >
                                  ▼
                                </span>
                              </button>

                              {isExpanded && groupSets.length > 0 && (
                                <div className="px-6 py-4 bg-slate-800/20 border-t border-slate-700/50 space-y-3">
                                  {groupSets.map((set) => (
                                    <div
                                      key={set.id}
                                      className="flex items-center gap-4 p-3 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors"
                                    >
                                      {set.logo_url && (
                                        <img
                                          src={set.logo_url}
                                          alt={set.name}
                                          className="w-10 h-10 object-contain rounded-lg bg-slate-900/50 p-1 flex-shrink-0"
                                        />
                                      )}
                                      <p className="text-white text-sm font-medium">
                                        {set.name}
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  )}

                  {/* Sets without group or set list */}
                  {brandSets.filter((s) => !s.group_id && !s.set_list_id)
                    .length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">
                        Other Sets
                      </h3>
                      <div className="space-y-3">
                        {brandSets
                          .filter((s) => !s.group_id && !s.set_list_id)
                          .map((set) => (
                            <div
                              key={set.id}
                              className="flex items-center gap-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors"
                            >
                              {set.logo_url && (
                                <img
                                  src={set.logo_url}
                                  alt={set.name}
                                  className="w-12 h-12 object-contain rounded-lg bg-slate-900/50 p-1 flex-shrink-0"
                                />
                              )}
                              <p className="text-white text-sm font-medium">
                                {set.name}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
                  <p className="text-slate-400">
                    Select a brand to view details
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100, 116, 139, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100, 116, 139, 0.7);
        }
      `}</style>
    </div>
  );
}
