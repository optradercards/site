"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useLinkedAccounts, useLinkAccount, useUnlinkAccount } from "@/hooks/useLinkedAccounts";
import { useImportAccount, type ImportResult } from "@/hooks/useImportAccount";
import { useAccounts } from "@/contexts/AccountContext";
import type { LinkedAccountType } from "@/types/profile";

/**
 * Parses a Shiny input value into a normalized handle or collection ID.
 */
function parseShinyInput(input: string): string {
  const trimmed = input.trim();
  const urlMatch = trimmed.match(
    /(?:https?:\/\/)?app\.getshiny\.io\/collection\/([A-Za-z0-9_-]+)/
  );
  if (urlMatch) return urlMatch[1];
  return trimmed;
}

/**
 * Parses a Collectr input value into a normalized showcase UUID.
 */
function parseCollectrInput(input: string): string {
  const trimmed = input.trim();
  const uuidMatch = trimmed.match(
    /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
  );
  if (uuidMatch) return uuidMatch[0];
  if (trimmed.startsWith("@")) return trimmed.slice(1);
  return trimmed;
}

type WizardStep = "closed" | "select-platform" | "enter-handle" | "importing" | "complete";

const PLATFORM_LABELS: Record<LinkedAccountType, string> = {
  shiny: "Shiny",
  collectr: "Collectr",
};

export default function LinkedAccountsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { activeAccountId, activeAccount } = useAccounts();
  const slug = activeAccount?.slug;
  const { data: linkedAccounts, isLoading: loading } = useLinkedAccounts(activeAccountId);
  const linkAccount = useLinkAccount();
  const unlinkAccount = useUnlinkAccount();
  const importAccount = useImportAccount();

  const [wizardStep, setWizardStep] = useState<WizardStep>("closed");
  const [selectedPlatform, setSelectedPlatform] = useState<LinkedAccountType | null>(null);
  const [handleInput, setHandleInput] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [wizardError, setWizardError] = useState<string | null>(null);
  const [reimporting, setReimporting] = useState<string | null>(null); // "platform:handle" key

  if (!user) {
    router.push("/login");
    return null;
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Linked Accounts
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">Loading…</p>
      </div>
    );
  }

  const accounts = linkedAccounts ?? [];

  function resetWizard() {
    setWizardStep("closed");
    setSelectedPlatform(null);
    setHandleInput("");
    setImportResult(null);
    setWizardError(null);
  }

  function handleSelectPlatform(platform: LinkedAccountType) {
    setSelectedPlatform(platform);
    setWizardStep("enter-handle");
  }

  function normalizeHandle(value: string): string {
    if (!selectedPlatform) return value;
    return selectedPlatform === "shiny"
      ? parseShinyInput(value)
      : parseCollectrInput(value);
  }

  async function handleSubmitHandle() {
    if (!selectedPlatform || !activeAccountId) return;

    const handle = normalizeHandle(handleInput);
    if (!handle) {
      setWizardError("Please enter a handle or URL");
      return;
    }

    setWizardError(null);
    setWizardStep("importing");

    try {
      // 1. Link the account
      await linkAccount.mutateAsync({
        accountId: activeAccountId,
        platform: selectedPlatform,
        handle,
      });

      // 2. Import collection
      const result = await importAccount.mutateAsync({
        platform: selectedPlatform,
        handle,
        accountId: activeAccountId,
      });

      setImportResult(result);
      setWizardStep("complete");
    } catch (err: any) {
      setImportResult(null);
      setWizardError(err.message || "Something went wrong");
      setWizardStep("complete");
    }
  }

  async function handleReimport(platform: LinkedAccountType, handle: string) {
    if (!activeAccountId) return;
    const key = `${platform}:${handle}`;
    setReimporting(key);
    try {
      await importAccount.mutateAsync({ platform, handle, accountId: activeAccountId });
    } finally {
      setReimporting(null);
    }
  }

  async function handleRemove(id: string) {
    if (!activeAccountId) return;
    await unlinkAccount.mutateAsync({ accountId: activeAccountId, id });
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
            Linked Accounts
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
            Connect your Shiny and Collectr accounts to import your collection
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/${slug}/settings/import-history`}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold text-sm"
          >
            Import History
          </Link>
          <button
            type="button"
            onClick={() => setWizardStep("select-platform")}
            className="px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors font-semibold text-sm"
          >
            Link Account
          </button>
        </div>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Existing linked accounts */}
      {accounts.length === 0 ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          No linked accounts yet. Click "Link Account" to get started.
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-700 rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                  {PLATFORM_LABELS[account.platform]}
                </span>
                <span className="text-sm text-gray-900 dark:text-gray-100 font-mono">
                  {account.handle}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleReimport(account.platform, account.handle)}
                  disabled={reimporting !== null}
                  className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {reimporting === `${account.platform}:${account.handle}` ? "Importing…" : "Re-import"}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(account.id)}
                  disabled={unlinkAccount.isPending}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wizard Modal */}
      {wizardStep !== "closed" && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
            {/* Select Platform */}
            {wizardStep === "select-platform" && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Link Account
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Select the platform to connect
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSelectPlatform("shiny")}
                    className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-500 dark:hover:border-red-500 transition-colors text-center"
                  >
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Shiny
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      getshiny.io
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectPlatform("collectr")}
                    className="p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg hover:border-red-500 dark:hover:border-red-500 transition-colors text-center"
                  >
                    <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                      Collectr
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      collectr.com
                    </p>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={resetWizard}
                  className="w-full px-4 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            )}

            {/* Enter Handle */}
            {wizardStep === "enter-handle" && selectedPlatform && (
              <div className="p-6 space-y-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    Connect {PLATFORM_LABELS[selectedPlatform]}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {selectedPlatform === "shiny"
                      ? "Enter your @handle or paste a collection URL"
                      : "Enter your @handle or paste a showcase URL"}
                  </p>
                </div>

                <input
                  type="text"
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                  onBlur={(e) => {
                    const parsed = normalizeHandle(e.target.value);
                    if (parsed !== e.target.value) setHandleInput(parsed);
                  }}
                  onPaste={(e) => {
                    const pasted = e.clipboardData.getData("text");
                    const parsed = normalizeHandle(pasted);
                    if (parsed !== pasted) {
                      e.preventDefault();
                      setHandleInput(parsed);
                    }
                  }}
                  placeholder={
                    selectedPlatform === "shiny"
                      ? "@handle or app.getshiny.io/collection/..."
                      : "@handle or collectr.com/showcase/..."
                  }
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  autoFocus
                />

                {wizardError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {wizardError}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHandleInput("");
                      setWizardError(null);
                      setWizardStep("select-platform");
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmitHandle}
                    disabled={!handleInput.trim()}
                    className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Connect & Import
                  </button>
                </div>
              </div>
            )}

            {/* Importing */}
            {wizardStep === "importing" && (
              <div className="p-6 space-y-4 text-center">
                <div className="flex justify-center">
                  <svg
                    className="animate-spin h-10 w-10 text-red-500"
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
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  Importing your collection...
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  This may take a moment
                </p>
              </div>
            )}

            {/* Complete */}
            {wizardStep === "complete" && (
              <div className="p-6 space-y-4">
                {importResult?.success ? (
                  <>
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
                      <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                        Import Complete
                      </h3>
                    </div>

                    <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-1 text-sm">
                      {importResult.platform === "collectr" ? (
                        <>
                          <p className="text-gray-700 dark:text-gray-300">
                            Products found: {importResult.stats.products_found ?? 0}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">
                            Products matched: {importResult.stats.products_matched ?? 0}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">
                            Products imported: {importResult.stats.products_imported ?? 0}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-gray-700 dark:text-gray-300">
                            Collections: {importResult.stats.collections_imported ?? 0}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">
                            Items: {importResult.stats.collection_items_imported ?? 0}
                          </p>
                          <p className="text-gray-700 dark:text-gray-300">
                            Sold items: {importResult.stats.sold_items_imported ?? 0}
                          </p>
                        </>
                      )}
                    </div>
                  </>
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
                      {wizardError ? "Something went wrong" : "Import Failed"}
                    </h3>
                    <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                      {wizardError || importResult?.error || "Unknown error"}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={resetWizard}
                  className="w-full px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
