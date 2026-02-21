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

interface Stats {
  brands: number;
  setLists: number;
  groups: number;
  sets: number;
  products: number;
}

export default function CatalogPage() {
  const supabase = createClient();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [setLists, setSetLists] = useState<SetList[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sets, setSets] = useState<CardSet[]>([]);
  const [stats, setStats] = useState<Stats>({
    brands: 0,
    setLists: 0,
    groups: 0,
    sets: 0,
    products: 0,
  });
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
        supabase.schema("cards").from("brands").select("*").order("name"),
        supabase.schema("cards").from("set_lists").select("*").order("name"),
        supabase
          .schema("cards")
          .from("groups")
          .select("*")
          .order("sort_position", { nullsFirst: false })
          .order("name"),
        supabase.schema("cards").from("sets").select("*").order("name"),
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

      // Load counts
      const [brandsCount, setListsCount, groupsCount, setsCount, cardsCount] =
        await Promise.all([
          supabase
            .schema("cards")
            .from("brands")
            .select("*", { count: "exact", head: true }),
          supabase
            .schema("cards")
            .from("set_lists")
            .select("*", { count: "exact", head: true }),
          supabase
            .schema("cards")
            .from("groups")
            .select("*", { count: "exact", head: true }),
          supabase
            .schema("cards")
            .from("sets")
            .select("*", { count: "exact", head: true }),
          supabase
            .schema("cards")
            .from("products")
            .select("*", { count: "exact", head: true }),
        ]);

      setStats({
        brands: brandsCount.count ?? 0,
        setLists: setListsCount.count ?? 0,
        groups: groupsCount.count ?? 0,
        sets: setsCount.count ?? 0,
        products: cardsCount.count ?? 0,
      });
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

  const statCards = [
    { label: "Brands", value: stats.brands },
    { label: "Set Lists", value: stats.setLists },
    { label: "Groups", value: stats.groups },
    { label: "Sets", value: stats.sets },
    { label: "Products", value: stats.products },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Catalog
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Browse brands, set lists, groups, and sets
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {statCards.map((stat) => (
          <div
            key={stat.label}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4"
          >
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stat.label}
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {loading ? "..." : stat.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-12 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Loading catalog...
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={loadData}
            className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Catalog Browser */}
      {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Brand Selector */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 sticky top-8">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                Brands
              </h3>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {brands.length === 0 ? (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No brands imported
                  </p>
                ) : (
                  brands.map((brand) => (
                    <button
                      key={brand.id}
                      onClick={() => {
                        setSelectedBrand(brand.id);
                        setExpandedSetLists(new Set());
                        setExpandedGroups(new Set());
                      }}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                        selectedBrand === brand.id
                          ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 font-medium"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
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
              <div className="space-y-4">
                {/* Brand Header */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
                  <div className="flex items-center gap-4">
                    {selectedBrandData.icon_url && (
                      <img
                        src={selectedBrandData.icon_url}
                        alt={selectedBrandData.name}
                        className="w-16 h-16 object-contain rounded-lg bg-gray-50 dark:bg-gray-700 p-2"
                      />
                    )}
                    <div>
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                        {selectedBrandData.name}
                      </h3>
                      <div className="flex gap-4 text-sm mt-1">
                        <span className="text-gray-500 dark:text-gray-400">
                          {brandSetLists.length} set lists
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {brandGroups.length} groups
                        </span>
                        <span className="text-gray-500 dark:text-gray-400">
                          {brandSets.length} sets
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Set Lists */}
                {brandSetLists.length > 0 ? (
                  <div className="space-y-3">
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
                          className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                        >
                          <button
                            onClick={() => toggleSetList(setList.id)}
                            className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {setList.logo_url && (
                                <img
                                  src={setList.logo_url}
                                  alt={setList.name}
                                  className="w-10 h-10 object-contain rounded bg-gray-50 dark:bg-gray-700 p-0.5"
                                />
                              )}
                              <div className="text-left">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {setList.name}
                                </h4>
                                <div className="flex gap-2 text-xs mt-0.5">
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {setListGroups.length} groups
                                  </span>
                                  <span className="text-gray-500 dark:text-gray-400">
                                    {setListSets.length} sets
                                  </span>
                                </div>
                              </div>
                            </div>
                            <span
                              className={`text-sm text-gray-400 transition-transform ${isSetListExpanded ? "rotate-180" : ""}`}
                            >
                              ▼
                            </span>
                          </button>

                          {isSetListExpanded && (
                            <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700 space-y-3">
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
                                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                                  >
                                    <button
                                      onClick={() => toggleGroup(group.id)}
                                      className="w-full px-3 py-2 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                    >
                                      <div className="flex items-center gap-2">
                                        <h5 className="text-sm font-medium text-gray-900 dark:text-white">
                                          {group.name}
                                        </h5>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {groupSets.length} sets
                                        </span>
                                      </div>
                                      <span
                                        className={`text-xs text-gray-400 transition-transform ${isGroupExpanded ? "rotate-180" : ""}`}
                                      >
                                        ▼
                                      </span>
                                    </button>

                                    {isGroupExpanded &&
                                      groupSets.length > 0 && (
                                        <div className="px-3 py-2 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700 space-y-1">
                                          {groupSets.map((set) => (
                                            <div
                                              key={set.id}
                                              className="flex items-center gap-2 p-1.5 rounded text-sm text-gray-700 dark:text-gray-300"
                                            >
                                              {set.logo_url && (
                                                <img
                                                  src={set.logo_url}
                                                  alt={set.name}
                                                  className="w-6 h-6 object-contain rounded bg-gray-100 dark:bg-gray-600 flex-shrink-0"
                                                />
                                              )}
                                              {set.name}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                  </div>
                                );
                              })}

                              {setListSets.filter((s) => !s.group_id).length >
                                0 && (
                                <div className="mt-2 space-y-1">
                                  <h5 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                    Sets without group
                                  </h5>
                                  {setListSets
                                    .filter((s) => !s.group_id)
                                    .map((set) => (
                                      <div
                                        key={set.id}
                                        className="flex items-center gap-2 p-1.5 rounded text-sm text-gray-700 dark:text-gray-300"
                                      >
                                        {set.logo_url && (
                                          <img
                                            src={set.logo_url}
                                            alt={set.name}
                                            className="w-6 h-6 object-contain rounded bg-gray-100 dark:bg-gray-600 flex-shrink-0"
                                          />
                                        )}
                                        {set.name}
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
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      No set lists for this brand
                    </p>
                  </div>
                )}

                {/* Groups without Set List */}
                {brandGroups.filter((g) => !g.set_list_id).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Groups (no set list)
                    </h4>
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
                            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                          >
                            <button
                              onClick={() => toggleGroup(group.id)}
                              className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {group.name}
                                </h4>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {groupSets.length} sets
                                </span>
                              </div>
                              <span
                                className={`text-sm text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                              >
                                ▼
                              </span>
                            </button>

                            {isExpanded && groupSets.length > 0 && (
                              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700 space-y-1">
                                {groupSets.map((set) => (
                                  <div
                                    key={set.id}
                                    className="flex items-center gap-2 p-1.5 rounded text-sm text-gray-700 dark:text-gray-300"
                                  >
                                    {set.logo_url && (
                                      <img
                                        src={set.logo_url}
                                        alt={set.name}
                                        className="w-6 h-6 object-contain rounded bg-gray-100 dark:bg-gray-600 flex-shrink-0"
                                      />
                                    )}
                                    {set.name}
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
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Other Sets
                    </h4>
                    <div className="space-y-1">
                      {brandSets
                        .filter((s) => !s.group_id && !s.set_list_id)
                        .map((set) => (
                          <div
                            key={set.id}
                            className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                          >
                            {set.logo_url && (
                              <img
                                src={set.logo_url}
                                alt={set.name}
                                className="w-8 h-8 object-contain rounded bg-gray-50 dark:bg-gray-700 flex-shrink-0"
                              />
                            )}
                            <p className="text-sm text-gray-700 dark:text-gray-300">
                              {set.name}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Select a brand to view details
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
