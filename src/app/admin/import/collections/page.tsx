'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useJob } from '@/hooks/useJob';

interface CollectionItem {
  id: string;
  product_id: string;
  name: string | null;
  image_url: string | null;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
  group_id: string | null;
  grade_type: string | null;
  grade_state: string | null;
  quantity: number;
  cost_price: number | null;
  cost_currency: string | null;
  market_price: number | null;
}

interface SoldItem {
  id: string;
  product_id: string;
  name: string | null;
  image_url: string | null;
  grade_type: string | null;
  grade_state: string | null;
  quantity: number;
  sale_price: number | null;
  sale_currency: string | null;
}

interface PreviewData {
  account_id: string;
  profile: {
    handle: string | null;
    display_name: string | null;
    avatar: string | null;
  };
  collections: { id: string; name: string }[];
  items: CollectionItem[];
  sold_items: SoldItem[];
  counts: {
    collections: number;
    collection_items: number;
    sold_items: number;
  };
}

function formatPrice(cents: number | null, currency: string | null): string {
  if (cents == null) return '—';
  const symbol = currency?.toLowerCase() === 'aud' ? 'A$' : '$';
  return `${symbol}${(cents / 100).toFixed(2)}`;
}

function formatGrade(type: string | null, state: string | null): string {
  if (!type && !state) return '—';
  if (type === 'ungraded') return state?.toUpperCase() ?? 'Ungraded';
  return [type?.toUpperCase(), state?.toUpperCase()].filter(Boolean).join(' ');
}

export default function ImportCollectionsPage() {
  const supabase = createClient();
  const { createJob, status: jobStatus, stats: jobStats, error: jobError } = useJob();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'collection' | 'sold'>('collection');
  const importing = jobStatus === 'pending' || jobStatus === 'running';

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Please enter a URL, collection ID, or @handle');
      return;
    }

    setSearching(true);
    setError(null);
    setPreview(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'shiny-fetch-collections',
        { body: { query: trimmed } },
      );

      if (invokeError) {
        setError(invokeError.message || 'Search failed');
      } else if (data?.success) {
        setPreview(data);
      } else {
        setError(data?.error || 'Search failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setSearching(false);
    }
  };

  const handleImport = async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setError(null);

    try {
      await createJob('shiny-collections', trimmed, { query: trimmed });
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import');
    }
  };

  // Group items by collection
  const groupedItems = preview
    ? preview.collections.map((col) => ({
        ...col,
        items: preview.items.filter((i) => i.group_id === col.id),
      }))
    : [];
  const ungroupedItems = preview
    ? preview.items.filter((i) => !i.group_id)
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Import Collections
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search for a Shiny user, preview their data, then import.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <label
          htmlFor="query"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          URL, Collection ID, or @Handle
        </label>
        <div className="flex gap-3">
          <input
            id="query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !searching && !importing) handleSearch();
            }}
            placeholder="e.g. @optrdr, user@example.com, https://getshiny.io/@optrdr, or collection ID"
            className="flex-1 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
            disabled={searching || importing}
          />
          <button
            onClick={handleSearch}
            disabled={searching || importing || !query.trim()}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {searching ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          {/* Profile header */}
          <div className="flex items-center gap-4">
            {preview.profile.avatar && (
              <img
                src={preview.profile.avatar}
                alt=""
                className="w-12 h-12 rounded-full"
              />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {preview.profile.display_name || preview.profile.handle || 'Unknown'}
              </h3>
              {preview.profile.handle && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  @{preview.profile.handle}
                </p>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {preview.account_id}
            </p>
          </div>

          {/* Counts */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {preview.counts.collections}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Collections
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {preview.counts.collection_items}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Collection Items
              </div>
            </div>
            <div className="text-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {preview.counts.sold_items}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Sold Items
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('collection')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'collection'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Collection ({preview.counts.collection_items})
            </button>
            <button
              onClick={() => setActiveTab('sold')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'sold'
                  ? 'border-red-500 text-red-600 dark:text-red-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              Sold ({preview.counts.sold_items})
            </button>
          </div>

          {/* Collection items tab */}
          {activeTab === 'collection' && (
            <div className="space-y-4">
              {groupedItems.map((group) =>
                group.items.length > 0 ? (
                  <div key={group.id}>
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {group.name} ({group.items.length})
                    </h4>
                    <ItemTable items={group.items} />
                  </div>
                ) : null,
              )}
              {ungroupedItems.length > 0 && (
                <div>
                  {groupedItems.some((g) => g.items.length > 0) && (
                    <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ungrouped ({ungroupedItems.length})
                    </h4>
                  )}
                  <ItemTable items={ungroupedItems} />
                </div>
              )}
              {preview.items.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No collection items.
                </p>
              )}
            </div>
          )}

          {/* Sold items tab */}
          {activeTab === 'sold' && (
            <div>
              {preview.sold_items.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                        <th className="py-2 pr-4">Item</th>
                        <th className="py-2 px-4">Grade</th>
                        <th className="py-2 px-4 text-right">Qty</th>
                        <th className="py-2 pl-4 text-right">Sale Price</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700 dark:text-gray-300">
                      {preview.sold_items.map((item) => (
                        <tr
                          key={item.id}
                          className="border-b border-gray-100 dark:border-gray-700/50"
                        >
                          <td className="py-2 pr-4">
                            <div className="flex items-center gap-3">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt=""
                                  className="w-8 h-8 rounded object-cover"
                                />
                              )}
                              <span className="truncate max-w-[200px]">
                                {item.name ?? item.product_id}
                              </span>
                            </div>
                          </td>
                          <td className="py-2 px-4 text-xs">
                            {formatGrade(item.grade_type, item.grade_state)}
                          </td>
                          <td className="py-2 px-4 text-right">{item.quantity}</td>
                          <td className="py-2 pl-4 text-right">
                            {formatPrice(item.sale_price, item.sale_currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No sold items.
                </p>
              )}
            </div>
          )}

          {/* Import button */}
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {importing ? (
              <span className="flex items-center justify-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Importing...
              </span>
            ) : (
              `Import ${preview.counts.collections} collections, ${preview.counts.collection_items} items, ${preview.counts.sold_items} sold items`
            )}
          </button>
        </div>
      )}

      {/* Success */}
      {jobStatus === 'completed' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-green-800 dark:text-green-300 font-semibold mb-3">
            Import Successful
          </h3>
          {jobStats.account_id && (
            <p className="text-xs text-green-600 dark:text-green-400 mb-3">
              Account: {jobStats.account_id}
            </p>
          )}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {jobStats.collections_imported ?? 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Collections
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {jobStats.collection_items_imported ?? 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Collection Items
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {jobStats.sold_items_imported ?? 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Sold Items
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {(error || (jobStatus === 'failed' && jobError)) && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-300 font-semibold mb-1">
            {preview ? 'Import Failed' : 'Search Failed'}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">
            {error || jobError}
          </p>
        </div>
      )}
    </div>
  );
}

function ItemTable({ items }: { items: CollectionItem[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
            <th className="py-2 pr-4">Item</th>
            <th className="py-2 px-4">Set</th>
            <th className="py-2 px-4">Grade</th>
            <th className="py-2 px-4 text-right">Qty</th>
            <th className="py-2 px-4 text-right">Cost</th>
            <th className="py-2 pl-4 text-right">Value</th>
          </tr>
        </thead>
        <tbody className="text-gray-700 dark:text-gray-300">
          {items.map((item) => (
            <tr
              key={item.id}
              className="border-b border-gray-100 dark:border-gray-700/50"
            >
              <td className="py-2 pr-4">
                <div className="flex items-center gap-3">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt=""
                      className="w-8 h-8 rounded object-cover"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="truncate max-w-[200px]">
                      {item.name ?? item.product_id}
                    </div>
                    {item.card_number && (
                      <div className="text-xs text-gray-400">
                        {item.card_number}
                        {item.rarity && ` · ${item.rarity}`}
                      </div>
                    )}
                  </div>
                </div>
              </td>
              <td className="py-2 px-4 text-xs truncate max-w-[150px]">
                {item.set_name ?? '—'}
              </td>
              <td className="py-2 px-4 text-xs">
                {formatGrade(item.grade_type, item.grade_state)}
              </td>
              <td className="py-2 px-4 text-right">{item.quantity}</td>
              <td className="py-2 px-4 text-right">
                {formatPrice(item.cost_price, item.cost_currency)}
              </td>
              <td className="py-2 pl-4 text-right">
                {formatPrice(item.market_price, 'aud')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
