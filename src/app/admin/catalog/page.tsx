'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Brand {
  id: string;
  name: string;
  icon?: string;
  icon_dark?: string;
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
  logo_dark?: string;
}

export default function CatalogPage() {
  const supabase = createClient();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [sets, setSets] = useState<Set[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      const [brandsRes, groupsRes, setsRes] = await Promise.all([
        supabase.from('trading_card_brands').select('*').order('name'),
        supabase.from('trading_card_groups').select('*').order('name'),
        supabase.from('trading_card_sets').select('*').order('name'),
      ]);

      if (brandsRes.error) throw new Error(`Brands: ${brandsRes.error.message}`);
      if (groupsRes.error) throw new Error(`Groups: ${groupsRes.error.message}`);
      if (setsRes.error) throw new Error(`Sets: ${setsRes.error.message}`);

      setBrands(brandsRes.data || []);
      setGroups(groupsRes.data || []);
      setSets(setsRes.data || []);

      if (brandsRes.data && brandsRes.data.length > 0) {
        setSelectedBrand(brandsRes.data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load catalog');
    } finally {
      setLoading(false);
    }
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
              <p className="text-slate-300 mt-6 text-lg font-medium">Loading catalog...</p>
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
                          setExpandedGroups(new Set());
                        }}
                        className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all text-sm font-medium ${
                          selectedBrand === brand.id
                            ? 'bg-purple-900/50 border-purple-500 text-white'
                            : 'bg-slate-800/30 border-slate-700/50 text-slate-300 hover:bg-slate-800/50 hover:border-slate-600'
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
                      {selectedBrandData.icon && (
                        <img
                          src={selectedBrandData.icon}
                          alt={selectedBrandData.name}
                          className="w-20 h-20 object-contain rounded-xl bg-slate-900/50 p-2"
                        />
                      )}
                      <div>
                        <h2 className="text-3xl font-bold text-white mb-2">
                          {selectedBrandData.name}
                        </h2>
                        <div className="flex gap-4 text-sm">
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

                  {/* Groups and Sets */}
                  {brandGroups.length > 0 ? (
                    <div className="space-y-4">
                      {brandGroups.map((group) => {
                        const groupSets = brandSets.filter((s) => s.group_id === group.id);
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
                                {group.logo && (
                                  <img
                                    src={group.logo}
                                    alt={group.name}
                                    className="w-12 h-12 object-contain rounded-lg bg-slate-900/50 p-1"
                                  />
                                )}
                                <h3 className="text-lg font-bold text-white">
                                  {group.name}
                                </h3>
                                <span className="text-xs bg-purple-500/20 text-purple-300 px-3 py-1 rounded-full">
                                  {groupSets.length} sets
                                </span>
                              </div>
                              <span className={`text-2xl text-purple-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
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
                                    {set.logo && (
                                      <img
                                        src={set.logo}
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
                  ) : (
                    <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
                      <p className="text-slate-400">No groups for this brand</p>
                    </div>
                  )}

                  {/* Sets without groups */}
                  {brandSets.filter((s) => !s.group_id).length > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-bold text-white">Other Sets</h3>
                      <div className="space-y-3">
                        {brandSets
                          .filter((s) => !s.group_id)
                          .map((set) => (
                            <div
                              key={set.id}
                              className="flex items-center gap-4 p-4 bg-slate-800/40 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 transition-colors"
                            >
                              {set.logo && (
                                <img
                                  src={set.logo}
                                  alt={set.name}
                                  className="w-12 h-12 object-contain rounded-lg bg-slate-900/50 p-1 flex-shrink-0"
                                />
                              )}
                              <p className="text-white text-sm font-medium">{set.name}</p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/50 backdrop-blur-sm rounded-2xl border border-slate-700/50 p-12 text-center">
                  <p className="text-slate-400">Select a brand to view details</p>
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
