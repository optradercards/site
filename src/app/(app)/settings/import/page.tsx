'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ImportRecord {
  id: string;
  collectr_showcase_id: string;
  status: string;
  products_found: number;
  products_matched: number;
  products_imported: number;
  error_message: string | null;
  created_at: string;
  completed_at: string | null;
}

export default function ImportPage() {
  const [showcaseUrl, setShowcaseUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    products_found: number;
    products_matched: number;
    products_imported: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imports, setImports] = useState<ImportRecord[]>([]);

  const supabase = createClient();

  const loadImports = useCallback(async () => {
    const { data } = await supabase
      .schema('cards')
      .from('collectr_imports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) setImports(data as ImportRecord[]);
  }, [supabase]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  function parseShowcaseId(input: string): string | null {
    // Try UUID directly
    const uuidMatch = input.match(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
    );
    return uuidMatch ? uuidMatch[0] : null;
  }

  async function handleImport() {
    const showcaseId = parseShowcaseId(showcaseUrl);
    if (!showcaseId) {
      setError('Could not find a valid showcase ID in the URL. Please paste a Collectr showcase URL or UUID.');
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke(
        'collectr-import-profile',
        { body: { showcase_id: showcaseId } }
      );

      if (fnError) throw new Error(fnError.message);

      if (data.success) {
        setResult({
          success: true,
          products_found: data.products_found,
          products_matched: data.products_matched,
          products_imported: data.products_imported,
        });
        setShowcaseUrl('');
        loadImports();
      } else {
        throw new Error(data.error || 'Import failed');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Import Collection
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Import your card collection from Collectr by pasting your showcase URL.
        </p>
      </div>

      {/* Import Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Collectr Showcase URL
        </label>
        <div className="flex gap-3">
          <input
            type="text"
            value={showcaseUrl}
            onChange={(e) => setShowcaseUrl(e.target.value)}
            placeholder="https://collectr.com/showcase/5c9ed2db-83c7-4d1f-876f-2fc1b71964c1"
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400"
          />
          <button
            onClick={handleImport}
            disabled={loading || !showcaseUrl.trim()}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium whitespace-nowrap"
          >
            {loading ? 'Importing...' : 'Import'}
          </button>
        </div>

        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        {result && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <p className="font-medium text-green-700 dark:text-green-400">Import complete</p>
            <div className="mt-2 text-sm text-green-600 dark:text-green-300 space-y-1">
              <p>Products found: {result.products_found}</p>
              <p>Products matched: {result.products_matched}</p>
              <p>Products imported: {result.products_imported}</p>
            </div>
          </div>
        )}
      </div>

      {/* Previous Imports */}
      {imports.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
            Previous Imports
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Found</th>
                  <th className="pb-2 pr-4">Matched</th>
                  <th className="pb-2">Imported</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {imports.map((imp) => (
                  <tr key={imp.id} className="border-b border-gray-100 dark:border-gray-700/50">
                    <td className="py-2 pr-4">
                      {new Date(imp.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          imp.status === 'completed'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : imp.status === 'failed'
                              ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        }`}
                      >
                        {imp.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4">{imp.products_found}</td>
                    <td className="py-2 pr-4">{imp.products_matched}</td>
                    <td className="py-2">{imp.products_imported}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
