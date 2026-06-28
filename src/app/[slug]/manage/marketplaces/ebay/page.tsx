"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

type Connection = {
  id: string;
  ebay_username: string | null;
  ebay_user_id: string | null;
  status: string;
  environment: string;
  scopes: string | null;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
  connected_at: string;
  last_error: string | null;
};

export default function EbayMarketplacePage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();
  const params = useParams();
  const slug = params?.slug as string;

  const [connection, setConnection] = useState<Connection | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    const { data, error: loadErr } = await supabase
      .schema("ecom")
      .from("marketplace_connections")
      .select(
        "id, ebay_username, ebay_user_id, status, environment, scopes, access_token_expires_at, refresh_token_expires_at, connected_at, last_error",
      )
      .eq("account_id", activeAccountId)
      .eq("marketplace", "ebay")
      .maybeSingle();
    if (loadErr) setError(loadErr.message);
    setConnection((data as Connection) ?? null);
    setLoading(false);

    // Surface the OAuth round-trip result the callback put in the URL, then
    // strip the params so a refresh doesn't re-show the banner. Done here
    // (post-mount, after hydration) to stay hydration-safe.
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get("ebay_connected")) setNotice("eBay account connected.");
      const err = sp.get("ebay_error");
      if (err) setError(`eBay connection failed: ${decodeURIComponent(err)}`);
      if (sp.get("ebay_connected") || err) {
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, [supabase, activeAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = () => {
    if (!activeAccountId) return;
    const returnTo = `/${slug}/manage/marketplaces/ebay`;
    window.location.href = `/api/ebay/oauth/start?accountId=${encodeURIComponent(
      activeAccountId,
    )}&returnTo=${encodeURIComponent(returnTo)}`;
  };

  const disconnect = async () => {
    if (!connection) return;
    if (
      !confirm(
        "Disconnect this eBay account? Listings already on eBay are not removed, but OP Trader will stop syncing them.",
      )
    )
      return;
    setBusy(true);
    setError(null);
    setNotice(null);
    const res = await fetch("/api/ebay/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId: connection.id }),
    });
    const json = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(json.error || "Disconnect failed");
      return;
    }
    setNotice("eBay account disconnected.");
    setConnection(null);
  };

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">eBay</h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Connect your eBay seller account so OP Trader can list your inventory on eBay and import
          your eBay sales back into your store.
        </p>
      </div>

      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
          {notice}
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow dark:border-gray-700 dark:bg-gray-800">
        {loading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : connection ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Connected
              </span>
              {connection.environment === "sandbox" && (
                <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  Sandbox
                </span>
              )}
              {connection.status !== "connected" && (
                <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                  {connection.status}
                </span>
              )}
              {connection.ebay_username && (
                <span className="font-mono text-sm text-gray-700 dark:text-gray-300">
                  {connection.ebay_username}
                </span>
              )}
            </div>

            <dl className="grid grid-cols-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
              <dt>Connected</dt>
              <dd className="text-right text-gray-700 dark:text-gray-300">
                {new Date(connection.connected_at).toLocaleString()}
              </dd>
              {connection.refresh_token_expires_at && (
                <>
                  <dt>Re-consent needed by</dt>
                  <dd className="text-right text-gray-700 dark:text-gray-300">
                    {new Date(connection.refresh_token_expires_at).toLocaleDateString()}
                  </dd>
                </>
              )}
            </dl>

            {connection.last_error && (
              <p className="text-xs text-red-600 dark:text-red-400">
                Last sync error: {connection.last_error}
              </p>
            )}

            <div className="flex justify-end pt-2">
              <button
                onClick={disconnect}
                disabled={busy}
                className="rounded border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:bg-gray-800 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                {busy ? "Disconnecting…" : "Disconnect"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <span className="inline-block rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Not connected
            </span>
            <p className="text-sm text-gray-600 dark:text-gray-300">
              You&apos;ll be taken to eBay to grant OP Trader permission to manage your listings and
              read your orders. You can disconnect at any time.
            </p>
            <button
              onClick={connect}
              disabled={!activeAccountId}
              className="rounded bg-red-500 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Connect eBay
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
