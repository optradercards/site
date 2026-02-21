"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccounts } from "@/contexts/AccountContext";
import { useLinkedAccounts, useLinkAccount, useUnlinkAccount } from "@/hooks/useLinkedAccounts";
import { useJob } from "@/hooks/useJob";

function parseShinyInput(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?app\.getshiny\.io\/collection\/([A-Za-z0-9_-]+)/
  );
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

export default function AccountsPage() {
  const params = useParams();
  const slug = params?.slug as string;
  const { activeAccountId } = useAccounts();
  const { data: linkedAccounts } = useLinkedAccounts(activeAccountId);
  const linkAccount = useLinkAccount();
  const unlinkAccount = useUnlinkAccount();
  const { job, createJob, status, stats, error: jobError } = useJob();

  const [handleInput, setHandleInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const accounts = linkedAccounts ?? [];
  const shinyAccounts = accounts.filter((a) => a.platform === "shiny");

  const isRunning = status === "pending" || status === "running";
  const isDone = status === "completed" || status === "failed";

  async function handleImport(handle?: string) {
    const raw = handle ?? handleInput;
    const parsed = parseShinyInput(raw);
    if (!parsed || !activeAccountId) {
      setFormError("Please enter a Shiny handle or collection URL");
      return;
    }

    setFormError(null);
    setSubmitting(true);

    try {
      // Link the account if not already linked
      const alreadyLinked = shinyAccounts.some((a) => a.handle === parsed);
      if (!alreadyLinked) {
        await linkAccount.mutateAsync({
          accountId: activeAccountId,
          platform: "shiny",
          handle: parsed,
        });
      }

      // Create a job — the backend picks it up and processes it
      await createJob(activeAccountId, "shiny-collections", parsed, { query: parsed });
      setHandleInput("");
    } catch (err: any) {
      setFormError(err.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Accounts
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Link and import your trading card collection from Shiny
        </p>
      </div>

      {/* Previously linked Shiny accounts */}
      {shinyAccounts.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
            Linked Shiny Accounts
          </h3>
          <div className="space-y-3">
            {shinyAccounts.map((account) => (
              <div
                key={account.id}
                className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                    Shiny
                  </span>
                  <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                    {account.handle}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleImport(account.handle)}
                    disabled={isRunning || submitting}
                    className="px-4 py-2 text-sm bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium disabled:opacity-50"
                  >
                    Re-import
                  </button>
                  <button
                    type="button"
                    onClick={() => activeAccountId && unlinkAccount.mutate({ accountId: activeAccountId, id: account.id })}
                    disabled={unlinkAccount.isPending}
                    className="px-3 py-2 text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-1">
          {shinyAccounts.length > 0 ? "Import another account" : "Connect your Shiny account"}
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Enter your @handle or paste a collection URL from app.getshiny.io
        </p>

        <div className="flex gap-3">
          <input
            type="text"
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              const parsed = parseShinyInput(pasted);
              if (parsed !== pasted) {
                e.preventDefault();
                setHandleInput(parsed);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleImport();
            }}
            placeholder="@handle or app.getshiny.io/collection/..."
            className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
          <button
            type="button"
            onClick={() => handleImport()}
            disabled={!handleInput.trim() || isRunning || submitting}
            className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            Import
          </button>
        </div>

        {formError && (
          <p className="text-sm text-red-600 dark:text-red-400 mt-3">
            {formError}
          </p>
        )}
      </div>

      {/* Job progress */}
      {isRunning && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <svg
            className="animate-spin h-10 w-10 text-red-500 mx-auto mb-4"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
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
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {status === "pending" ? "Job queued..." : "Importing your collection..."}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            This may take a moment
          </p>
          {Object.keys(stats).length > 0 && (
            <div className="inline-block bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mt-4 space-y-1 text-sm text-left">
              {Object.entries(stats).map(([key, value]) => (
                <p key={key} className="text-gray-700 dark:text-gray-300">
                  {key.replace(/_/g, " ")}: {value}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Job complete */}
      {isDone && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
          {status === "completed" ? (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <svg
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Import Complete
              </h3>
              {Object.keys(stats).length > 0 && (
                <div className="inline-block bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-1 text-sm text-left">
                  {Object.entries(stats).map(([key, value]) => (
                    <p key={key} className="text-gray-700 dark:text-gray-300">
                      {key.replace(/_/g, " ")}: {value}
                    </p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 mb-3">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Import Failed
              </h3>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                {jobError || "Unknown error"}
              </p>
            </div>
          )}

          <div className="flex justify-center gap-3 mt-6">
            <Link
              href={`/${slug}/settings/import-history`}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
            >
              View History
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
