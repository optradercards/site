"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface TokenStatus {
  configured: boolean;
  length?: number;
  preview?: string;
  updated_at?: string;
  local_id?: string | null;
  has_refresh_token?: boolean;
  account_id?: string | null;
}

export default function ShinySettingsPage() {
  const supabase = createClient();
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [newToken, setNewToken] = useState("");
  const [showToken, setShowToken] = useState(false);

  const loadStatus = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      "get_shiny_auth_token_preview"
    );
    if (error) {
      toast.error(`Failed to load: ${error.message}`);
      setStatus(null);
    } else {
      setStatus(data as TokenStatus);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleCreate = async () => {
    if (
      status?.configured &&
      !confirm(
        "This will mint a fresh anonymous user in Shiny's Firebase project and replace the current stored credentials. Continue?"
      )
    ) {
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke(
      "shiny-create-anonymous-user",
      { body: {} }
    );
    if (error) {
      toast.error(`Create failed: ${error.message}`);
    } else if (!data?.success) {
      toast.error(`Create failed: ${data?.error ?? "unknown error"}`);
    } else {
      toast.success(
        `Created anonymous user ${data.local_id} — token valid for ${Math.round(data.expires_in_seconds / 60)} min`
      );
      await loadStatus();
    }
    setCreating(false);
  };

  const handleSave = async () => {
    const trimmed = newToken.trim();
    if (!trimmed) {
      toast.error("Token cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_shiny_credentials", {
      p_token: trimmed,
    });
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success("Token saved");
      setNewToken("");
      setShowToken(false);
      await loadStatus();
    }
    setSaving(false);
  };

  const handleClear = async () => {
    if (
      !confirm(
        "Remove the Shiny auth token + refresh token + local_id? Workers will revert to unauthenticated calls."
      )
    ) {
      return;
    }
    setClearing(true);
    const { error } = await supabase.rpc("clear_shiny_auth_token");
    if (error) {
      toast.error(`Clear failed: ${error.message}`);
    } else {
      toast.success("Credentials cleared");
      await loadStatus();
    }
    setClearing(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Shiny Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Configure auth credentials used by edge functions when calling the
          Shiny API.
        </p>
      </div>

      {/* Current Status */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Current Credentials
        </h3>

        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : status?.configured ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Configured
              </span>
              <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                {status.preview}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {status.length} chars
              </span>
              {status.has_refresh_token && (
                <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  + refresh token
                </span>
              )}
            </div>
            {status.local_id && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Firebase localId:{" "}
                <span className="font-mono">{status.local_id}</span>
              </p>
            )}
            {status.updated_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Last updated:{" "}
                {new Date(status.updated_at).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Not configured
          </span>
        )}
      </div>

      {/* Create New Anonymous User */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Create New Anonymous User
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Mints a fresh anonymous Firebase Auth user in the Shiny project
          (<code className="font-mono text-xs">shiny-f23ff</code>) — same flow
          a fresh app install uses. Stores the resulting{" "}
          <code className="font-mono text-xs">idToken</code>,{" "}
          <code className="font-mono text-xs">refreshToken</code>, and{" "}
          <code className="font-mono text-xs">localId</code> in Vault.
        </p>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {creating ? "Creating…" : "Create New User"}
        </button>
      </div>

      {/* Manual Token */}
      <details className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 group">
        <summary className="cursor-pointer text-lg font-semibold text-gray-900 dark:text-white">
          Set Token Manually
        </summary>
        <div className="mt-4 space-y-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Paste an existing Firebase{" "}
            <code className="font-mono">idToken</code> for the{" "}
            <code className="font-mono">shiny-f23ff</code> project. Useful if
            you&apos;ve captured one from the app and want to test against a
            specific user.
          </p>
          <div className="flex gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={newToken}
              onChange={(e) => setNewToken(e.target.value)}
              placeholder="Paste Firebase idToken…"
              autoComplete="off"
              className="flex-1 px-4 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !newToken.trim()}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save Token"}
          </button>
        </div>
      </details>

      {/* Clear */}
      {status?.configured && (
        <div className="flex justify-end">
          <button
            onClick={handleClear}
            disabled={clearing}
            className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-white dark:bg-gray-800 border border-red-300 dark:border-red-800 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
          >
            {clearing ? "Clearing…" : "Clear All Credentials"}
          </button>
        </div>
      )}

      {/* Info */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-sm text-blue-900 dark:text-blue-200">
        <p>
          <strong>Stored in Supabase Vault</strong> (encrypted at rest). Edge
          functions retrieve the idToken server-side via{" "}
          <code className="font-mono mx-0.5 px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-xs">
            public.get_secret(&apos;shiny_auth_token&apos;)
          </code>{" "}
          and forward it as{" "}
          <code className="font-mono mx-0.5 px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-xs">
            x-shiny-authtoken
          </code>{" "}
          on Shiny API requests.
        </p>
        <p className="mt-2 text-xs">
          idTokens expire after 1 hour. Future work: workers can auto-refresh
          using the stored <code className="font-mono">refreshToken</code> via
          the Firebase Secure Token Service before each call.
        </p>
      </div>

      <CollectrSection />
    </div>
  );
}

function CollectrSection() {
  const supabase = createClient();
  const [status, setStatus] = useState<TokenStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [minting, setMinting] = useState(false);
  const [token, setToken] = useState("");
  const [accountId, setAccountId] = useState("");
  const [showToken, setShowToken] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc(
      "get_collectr_auth_token_preview",
    );
    if (error) {
      toast.error(`Failed to load Collectr status: ${error.message}`);
      setStatus(null);
    } else {
      setStatus(data as TokenStatus);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const handleMint = async () => {
    if (
      status?.configured &&
      !confirm(
        "This will mint a fresh anonymous Collectr account and replace the current stored credentials. Continue?",
      )
    ) {
      return;
    }
    setMinting(true);
    const { data, error } = await supabase.functions.invoke(
      "collectr-create-anonymous-user",
      { body: {} },
    );
    if (error) {
      toast.error(`Mint failed: ${error.message}`);
    } else if (!data?.success) {
      toast.error(`Mint failed: ${data?.error ?? "unknown error"}`);
    } else {
      toast.success(`Minted Collectr account ${data.account_id}`);
      await load();
    }
    setMinting(false);
  };

  const handleSave = async () => {
    const t = token.trim();
    if (!t) {
      toast.error("Token cannot be empty");
      return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("set_collectr_credentials", {
      p_token: t,
      p_account_id: accountId.trim() || null,
    });
    if (error) {
      toast.error(`Save failed: ${error.message}`);
    } else {
      toast.success("Collectr credentials saved");
      setToken("");
      setAccountId("");
      setShowToken(false);
      await load();
    }
    setSaving(false);
  };

  const handleClear = async () => {
    if (
      !confirm(
        "Remove the Collectr auth token + account id? All Collectr edge functions will fail until you set a new one.",
      )
    ) {
      return;
    }
    setClearing(true);
    const { error } = await supabase.rpc("clear_collectr_auth_token");
    if (error) {
      toast.error(`Clear failed: ${error.message}`);
    } else {
      toast.success("Collectr credentials cleared");
      await load();
    }
    setClearing(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Collectr Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Auth token + account UUID used by collectr-fetch-cards,
          collectr-sync-history, and collectr-reconcile.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Current status
        </h3>
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : !status?.configured ? (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            No Collectr token configured. Edge env vars will be used as a
            fallback during the migration window — paste a token here to
            switch over to Vault-managed storage.
          </p>
        ) : (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">Token:</span>
              <code className="font-mono bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded">
                {status.preview}
              </code>
              <span className="text-xs text-gray-400">
                ({status.length} chars)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">
                Account id:
              </span>
              <code className="font-mono text-xs">
                {status.account_id ?? "—"}
              </code>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 dark:text-gray-400">
                Updated:
              </span>
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {status.updated_at
                  ? new Date(status.updated_at).toLocaleString()
                  : "—"}
              </span>
            </div>
            <div className="pt-2">
              <button
                onClick={handleClear}
                disabled={clearing}
                className="px-3 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
              >
                {clearing ? "Clearing…" : "Clear credentials"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Mint anonymous account
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Calls Collectr&apos;s public <code className="font-mono">POST /accounts</code>{" "}
          endpoint to provision a fresh anonymous user, then stores the
          returned token + account UUID into Vault. No manual capture
          required. The minted token has no expiry per the published
          spec.
        </p>
        <button
          onClick={handleMint}
          disabled={minting}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg"
        >
          {minting ? "Minting…" : "Mint anonymous account"}
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-700 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Update credentials
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Auth token
          </label>
          <div className="flex gap-2">
            <input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Paste Collectr authorization header value…"
              className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="px-3 py-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded"
            >
              {showToken ? "Hide" : "Show"}
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Captured from a Collectr API request&apos;s{" "}
            <code className="font-mono">authorization</code> header. No
            refresh flow yet — re-paste when expired.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Account id (UUID)
          </label>
          <input
            type="text"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            placeholder="e.g. 0f0c7b43-76b9-4f9c-a710-1975a940cc71"
            className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-xs"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Optional. Used as the <code className="font-mono">username</code>{" "}
            query param on{" "}
            <code className="font-mono">/catalog/products/&#123;id&#125;</code>{" "}
            (token is scoped to this account). Leave blank to keep the
            existing one.
          </p>
        </div>

        <button
          onClick={handleSave}
          disabled={saving || !token.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 disabled:bg-red-300 rounded-lg"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
