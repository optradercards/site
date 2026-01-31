'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface SyncStats {
  brands?: number;
  groups?: number;
  sets?: number;
  products?: number;
  history_synced?: number;
  purchases_synced?: number;
  errors?: string[];
}

export default function CatalogSyncPage() {
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [catalogStats, setCatalogStats] = useState<SyncStats | null>(null);
  const [historyStats, setHistoryStats] = useState<SyncStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  async function runCatalogSync() {
    setCatalogLoading(true);
    setError(null);
    setCatalogStats(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shiny-sync-catalog', {
        body: {},
      });

      if (fnError) throw new Error(fnError.message);
      setCatalogStats(data.stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCatalogLoading(false);
    }
  }

  async function runHistorySync() {
    setHistoryLoading(true);
    setError(null);
    setHistoryStats(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('shiny-sync-history', {
        body: {},
      });

      if (fnError) throw new Error(fnError.message);
      setHistoryStats(data.stats);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setHistoryLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Catalog Sync</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Sync card catalog data from Shiny API. Daily sync runs automatically at 3am UTC.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Catalog Sync Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Full Catalog Sync
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Fetches all brands, groups, sets, and product items from Shiny API.
            Triggers auto-sync to cards schema.
          </p>

          <button
            onClick={runCatalogSync}
            disabled={catalogLoading}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
          >
            {catalogLoading ? 'Syncing...' : 'Run Catalog Sync'}
          </button>

          {catalogStats && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">Sync complete</p>
              <p>Brands: {catalogStats.brands ?? 0}</p>
              <p>Groups: {catalogStats.groups ?? 0}</p>
              <p>Sets: {catalogStats.sets ?? 0}</p>
              <p>Products: {catalogStats.products ?? 0}</p>
              {catalogStats.errors && catalogStats.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    {catalogStats.errors.length} error(s)
                  </p>
                  <ul className="text-xs text-gray-500 mt-1 max-h-32 overflow-y-auto">
                    {catalogStats.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History Sync Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Price History Sync
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Fetches price history and recent purchases for all products.
            This is expensive — run on-demand or weekly.
          </p>

          <button
            onClick={runHistorySync}
            disabled={historyLoading}
            className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-800 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
          >
            {historyLoading ? 'Syncing...' : 'Run History Sync'}
          </button>

          {historyStats && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">Sync complete</p>
              <p>History conditions: {historyStats.history_synced ?? 0}</p>
              <p>Recent purchases: {historyStats.purchases_synced ?? 0}</p>
              {historyStats.errors && historyStats.errors.length > 0 && (
                <div className="mt-2">
                  <p className="text-amber-600 dark:text-amber-400 font-medium">
                    {historyStats.errors.length} error(s)
                  </p>
                  <ul className="text-xs text-gray-500 mt-1 max-h-32 overflow-y-auto">
                    {historyStats.errors.slice(0, 10).map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
