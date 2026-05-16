'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useJob } from '@/hooks/useJob';
import { usePipeline, type PipelineStep } from '@/hooks/usePipeline';

interface SyncStats {
  brands?: number;
  groups?: number;
  sets?: number;
  products?: number;
  history_synced?: number;
  purchases_synced?: number;
  errors?: string[];
}

interface CatalogProgress {
  phase: 'brands' | 'pages' | 'queueing' | 'done';
  brand_index: number;
  brand_total: number;
  brand_name: string | null;
  page: number;
  products_found: number;
  batches_queued: number;
}

const CATALOG_BATCH_SIZE = 50;
const CATALOG_MAX_PAGES_PER_BRAND = 200; // safety cap; bump if any brand exceeds this

export default function CatalogSyncPage() {
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [priceLoading, setPriceLoading] = useState(false);
  const [catalogStats, setCatalogStats] = useState<SyncStats | null>(null);
  const [catalogProgress, setCatalogProgress] = useState<CatalogProgress | null>(null);
  const [historyStats, setHistoryStats] = useState<SyncStats | null>(null);
  const [priceResult, setPriceResult] = useState<{ count: number; ratesUpdated?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();
  const imageJob = useJob();
  const { createPipeline } = usePipeline();

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
    setCatalogProgress({
      phase: 'brands',
      brand_index: 0,
      brand_total: 0,
      brand_name: null,
      page: 0,
      products_found: 0,
      batches_queued: 0,
    });

    try {
      // 1. Enumerate available brands from shiny.
      const { data: brandsResp, error: brandsErr } = await supabase.functions.invoke(
        'shiny-fetch-brands'
      );
      if (brandsErr) throw new Error(brandsErr.message);
      const brands: Array<{ id: string; na?: string; name?: string }> = Array.isArray(brandsResp)
        ? brandsResp
        : (brandsResp?.data ?? brandsResp?.brands ?? []);
      if (brands.length === 0) throw new Error('No brands returned from Shiny');

      // 2. Paginate /product-search per brand, collecting product IDs.
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const headers = {
        Authorization: `Bearer ${session?.access_token ?? ''}`,
        'Content-Type': 'application/json',
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '',
      };

      const allProductIds = new Set<string>();

      for (let bi = 0; bi < brands.length; bi++) {
        const brand = brands[bi];
        const brandName = brand.name ?? brand.na ?? brand.id;
        setCatalogProgress((p) => ({
          ...(p as CatalogProgress),
          phase: 'pages',
          brand_index: bi + 1,
          brand_total: brands.length,
          brand_name: brandName,
          page: 0,
        }));

        for (let page = 1; page <= CATALOG_MAX_PAGES_PER_BRAND; page++) {
          const params = new URLSearchParams({
            filteredBrands: brand.id,
            page: String(page),
            sortBy: 'relevance',
          });
          const res = await fetch(
            `${supabaseUrl}/functions/v1/shiny-fetch-cards?${params.toString()}`,
            { method: 'GET', headers }
          );
          if (!res.ok) {
            throw new Error(
              `shiny-fetch-cards failed (${res.status}) for brand ${brandName} page ${page}`
            );
          }
          const body = await res.json();
          const items: Array<{ id?: string }> =
            body?.items ?? body?.data?.items ?? body?.products ?? [];

          if (items.length === 0) break;

          for (const it of items) {
            if (it?.id) allProductIds.add(it.id);
          }

          setCatalogProgress((p) => ({
            ...(p as CatalogProgress),
            page,
            products_found: allProductIds.size,
          }));
        }
      }

      if (allProductIds.size === 0) {
        throw new Error('No products discovered across brands');
      }

      // 3. Build the pipeline: chained shiny-cards → shiny-history per batch.
      setCatalogProgress((p) => ({ ...(p as CatalogProgress), phase: 'queueing' }));

      const productIds = Array.from(allProductIds);
      const batches: string[][] = [];
      for (let i = 0; i < productIds.length; i += CATALOG_BATCH_SIZE) {
        batches.push(productIds.slice(i, i + CATALOG_BATCH_SIZE));
      }

      const steps: PipelineStep[] = [];
      let prevCardIdx = -1;
      for (const batch of batches) {
        const cardIdx = steps.length;
        steps.push({
          platform: 'shiny-cards',
          handle: `${batch.length} cards`,
          payload: { productIds: batch },
          ...(prevCardIdx >= 0 ? { dependsOn: [prevCardIdx] } : {}),
        });
        const histIdx = steps.length;
        steps.push({
          platform: 'shiny-history',
          handle: `${batch.length} history`,
          payload: { card_ids: batch },
          dependsOn: [cardIdx],
        });
        prevCardIdx = cardIdx;
      }

      const { data: acct } = await supabase.rpc('get_personal_account');
      if (!acct?.account_id) throw new Error('No account found');
      await createPipeline(acct.account_id, steps);

      setCatalogProgress((p) => ({
        ...(p as CatalogProgress),
        phase: 'done',
        batches_queued: batches.length,
      }));
      setCatalogStats({
        brands: brands.length,
        products: productIds.length,
      });
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
            Walks every brand on Shiny, paginates all products, and queues
            import jobs for each batch (50 cards per job, chained card →
            history). Watch progress under Admin → Jobs once queued.
          </p>

          <button
            onClick={runCatalogSync}
            disabled={catalogLoading}
            className="w-full px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
          >
            {catalogLoading ? 'Discovering…' : 'Run Catalog Sync'}
          </button>

          {catalogProgress && catalogLoading && (
            <div className="mt-4 space-y-1 text-sm">
              {catalogProgress.phase === 'brands' && (
                <p className="text-gray-700 dark:text-gray-300">Loading brands…</p>
              )}
              {catalogProgress.phase === 'pages' && (
                <>
                  <p className="text-gray-700 dark:text-gray-300">
                    Brand {catalogProgress.brand_index} / {catalogProgress.brand_total}
                    {catalogProgress.brand_name ? ` — ${catalogProgress.brand_name}` : ''}
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Page {catalogProgress.page} · {catalogProgress.products_found} products found
                  </p>
                </>
              )}
              {catalogProgress.phase === 'queueing' && (
                <p className="text-gray-700 dark:text-gray-300">
                  Queueing jobs for {catalogProgress.products_found} products…
                </p>
              )}
            </div>
          )}

          {catalogStats && !catalogLoading && (
            <div className="mt-4 space-y-1 text-sm">
              <p className="text-green-600 dark:text-green-400 font-medium">
                Queued
              </p>
              <p>Brands walked: {catalogStats.brands ?? 0}</p>
              <p>Products discovered: {catalogStats.products ?? 0}</p>
              {catalogProgress?.batches_queued ? (
                <p>Batches queued: {catalogProgress.batches_queued}</p>
              ) : null}
              <p className="text-xs text-gray-500 mt-2">
                Watch them run under Admin → Jobs.
              </p>
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
