'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useJob } from '@/hooks/useJob';

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
  const [priceLoading, setPriceLoading] = useState(false);
  const [catalogStats, setCatalogStats] = useState<SyncStats | null>(null);
  const [historyStats, setHistoryStats] = useState<SyncStats | null>(null);
  const [priceResult, setPriceResult] = useState<{ count: number; ratesUpdated?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const imageJob = useJob();

  async function runImageResync() {
    try {
      setError(null);
      const { data: acct } = await supabase.rpc("get_personal_account");
      if (!acct?.account_id) throw new Error("No account found");

      const jobId = await imageJob.createJob(
        acct.account_id,
        "resync-images",
        "image-resync",
        {}
      );

      await supabase.functions.invoke("run-job", {
        body: { job_id: jobId },
      });
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function runPriceRefresh() {
    setPriceLoading(true);
    setError(null);
    setPriceResult(null);

    try {
      // 1. Fetch live exchange rates
      const { data: ratesData, error: ratesError } = await supabase.functions.invoke("exchange-rates");
      if (ratesError) throw new Error(ratesError.message);
      if (!ratesData?.success) throw new Error("Failed to fetch exchange rates");
      const rates = ratesData.rates as Record<string, number>;

      // 2. Update exchange_rate on all non-USD active products
      const { data: products, error: fetchErr } = await supabase
        .schema("ecom")
        .from("products")
        .select("id, currency")
        .eq("status", "active")
        .neq("currency", "USD");

      if (fetchErr) throw new Error(fetchErr.message);

      let ratesUpdated = 0;
      for (const product of products ?? []) {
        const rate = rates[product.currency.toLowerCase()];
        if (rate != null) {
          const { error: upErr } = await supabase
            .schema("ecom")
            .from("products")
            .update({ exchange_rate: rate })
            .eq("id", product.id);
          if (!upErr) ratesUpdated++;
        }
      }

      // 3. Recalculate price_cents from computed function
      const { data, error: rpcError } = await supabase
        .schema("ecom")
        .rpc("refresh_prices");

      if (rpcError) throw new Error(rpcError.message);
      const count = data?.[0]?.updated_count ?? data?.updated_count ?? 0;
      setPriceResult({ count, ratesUpdated });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setPriceLoading(false);
    }
  }

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

        {/* Image Resync Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Image Resync
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Copies external images to Supabase storage for all products and brands
            that still have non-storage URLs.
          </p>

          <button
            onClick={runImageResync}
            disabled={imageJob.status === 'running' || imageJob.status === 'pending'}
            className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
          >
            {imageJob.status === 'running'
              ? 'Syncing Images...'
              : imageJob.status === 'pending'
                ? 'Starting...'
                : 'Run Image Resync'}
          </button>

          {imageJob.status === 'running' && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-blue-600 dark:text-blue-400 font-medium">In progress...</p>
              {imageJob.stats.total != null && (
                <>
                  <p>Products to sync: {imageJob.stats.total}</p>
                  <p>Synced: {imageJob.stats.synced ?? 0}</p>
                  {imageJob.stats.failed > 0 && (
                    <p className="text-amber-600">Failed: {imageJob.stats.failed}</p>
                  )}
                </>
              )}
            </div>
          )}

          {imageJob.status === 'completed' && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">Resync complete</p>
              <p>Products synced: {imageJob.stats.synced ?? 0} / {imageJob.stats.total ?? 0}</p>
              {imageJob.stats.failed > 0 && (
                <p className="text-amber-600">Failed: {imageJob.stats.failed}</p>
              )}
              {imageJob.stats.brands_synced != null && (
                <p>Brands synced: {imageJob.stats.brands_synced} / {imageJob.stats.brands_total ?? 0}</p>
              )}
            </div>
          )}

          {imageJob.status === 'failed' && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-red-600 dark:text-red-400 font-medium">Resync failed</p>
              {imageJob.error && (
                <p className="text-xs text-gray-500">{imageJob.error}</p>
              )}
            </div>
          )}
        </div>

        {/* Price Refresh Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Refresh Prices
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Recalculates price_cents from market data for all active listings.
            Run after a catalog sync or market data update.
          </p>

          <button
            onClick={runPriceRefresh}
            disabled={priceLoading}
            className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
          >
            {priceLoading ? 'Refreshing...' : 'Refresh Prices'}
          </button>

          {priceResult && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">Refresh complete</p>
              {priceResult.ratesUpdated != null && (
                <p>Exchange rates updated: {priceResult.ratesUpdated} products</p>
              )}
              <p>Prices recalculated: {priceResult.count} listings</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
