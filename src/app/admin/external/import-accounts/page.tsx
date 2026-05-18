'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { usePipeline } from '@/hooks/usePipeline';

interface PreviewData {
  account_id: string;
  profile: {
    handle: string | null;
    display_name: string | null;
    avatar: string | null;
  };
}

export default function ImportAccountsPage() {
  const supabase = createClient();
  const { jobs, status: pipelineStatus, createPipeline } = usePipeline();

  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const importing = pipelineStatus === 'running';

  const handleSearch = async () => {
    const trimmed = query.trim();
    if (!trimmed) {
      setError('Please enter a URL, account ID, or @handle');
      return;
    }

    setSearching(true);
    setError(null);
    setPreview(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke(
        'shiny-fetch-accounts',
        { body: { query: trimmed } },
      );

      if (invokeError) {
        setError(invokeError.message || 'Search failed');
      } else if (data?.success) {
        setPreview({
          account_id: data.account_id,
          profile: data.profile,
        });
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
      const { data: acct } = await supabase.rpc("get_personal_account");
      if (!acct?.account_id) throw new Error("No account found");
      await createPipeline(acct.account_id, [
        {
          platform: 'shiny-accounts',
          handle: trimmed,
          payload: { query: trimmed },
        },
        {
          platform: 'shiny-collections',
          handle: trimmed,
          payload: { query: trimmed },
          dependsOn: [0],
        },
      ]);
      setPreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start import');
    }
  };

  const accountsJob = jobs.find((j) => j.platform === 'shiny-accounts');
  const collectionsJob = jobs.find((j) => j.platform === 'shiny-collections');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Import Accounts
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Search for a Shiny user and import their profile and collections.
        </p>
      </div>

      {/* Input */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <label
          htmlFor="query"
          className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
        >
          URL, Account ID, or @Handle
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
            placeholder="e.g. @optrdr, user@example.com, https://getshiny.io/@optrdr, or account ID"
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
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Preview
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Account: {preview.account_id}
            </p>
          </div>

          {/* Profile info */}
          <div className="flex items-center gap-4">
            {preview.profile.avatar && (
              <img
                src={preview.profile.avatar}
                alt={preview.profile.display_name || 'Avatar'}
                className="w-16 h-16 rounded-full object-cover border-2 border-gray-200 dark:border-gray-600"
              />
            )}
            <div>
              {preview.profile.display_name && (
                <div className="text-lg font-semibold text-gray-900 dark:text-white">
                  {preview.profile.display_name}
                </div>
              )}
              {preview.profile.handle && (
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  @{preview.profile.handle}
                </div>
              )}
            </div>
          </div>

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
              'Import Account & Collections'
            )}
          </button>
        </div>
      )}

      {/* Pipeline progress */}
      {jobs.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Pipeline
          </h3>
          {jobs.map((job) => {
            const label = job.platform === 'shiny-accounts' ? 'Account' : 'Collections';
            const statusColor =
              job.status === 'completed'
                ? 'text-green-600 dark:text-green-400'
                : job.status === 'failed'
                  ? 'text-red-600 dark:text-red-400'
                  : job.status === 'running'
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-gray-400 dark:text-gray-500';
            return (
              <div key={job.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-700 dark:text-gray-300">{label}</span>
                <span className={`font-medium ${statusColor}`}>{job.status}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* Success */}
      {pipelineStatus === 'completed' && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-6">
          <h3 className="text-green-800 dark:text-green-300 font-semibold mb-3">
            Import Successful
          </h3>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {accountsJob?.stats?.accounts_imported ?? 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Account
              </div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">
                {collectionsJob?.stats?.collection_items_imported ?? 0}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">
                Collection Items
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {(error || pipelineStatus === 'failed') && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h3 className="text-red-800 dark:text-red-300 font-semibold mb-1">
            {preview ? 'Import Failed' : error ? 'Search Failed' : 'Pipeline Failed'}
          </h3>
          <p className="text-sm text-red-700 dark:text-red-400">
            {error || jobs.find((j) => j.status === 'failed')?.error_message || 'Unknown error'}
          </p>
        </div>
      )}
    </div>
  );
}
