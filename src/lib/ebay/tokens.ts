// Server-side eBay access-token accessor with proactive refresh.
//
// Mirrors the Shiny `getShinyAuthHeader` pattern but per-vendor: reads the
// stored token blob via the service-role-only get_ebay_tokens RPC, and if the
// access token is within REFRESH_WINDOW of expiry, exchanges the refresh token
// for a new one and persists it via store_refreshed_ebay_tokens.
//
// SERVER ONLY — uses the service-role client. Never import from a client
// component. Returns null when the connection is missing, the refresh token has
// itself expired (vendor must re-consent), or the service role isn't configured.

import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { refreshAccessToken } from "./oauth";

// Refresh when the access token expires within this window (2 min), matching
// the Shiny helper's headroom.
const REFRESH_WINDOW_MS = 120_000;

interface EbayTokenBlob {
  access_token: string;
  refresh_token: string;
  connection_id: string;
  account_id: string;
  environment: string;
  status: string;
  access_token_expires_at: string | null;
  refresh_token_expires_at: string | null;
}

export async function getEbayAccessToken(connectionId: string): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data, error } = await admin
    .schema("ecom")
    .rpc("get_ebay_tokens", { p_connection_id: connectionId });
  if (error || !data) return null;

  const tokens = data as EbayTokenBlob;
  if (!tokens.access_token || !tokens.refresh_token) return null;

  // Still comfortably valid → use as-is.
  const expMs = tokens.access_token_expires_at
    ? Date.parse(tokens.access_token_expires_at)
    : 0;
  if (expMs && expMs - Date.now() > REFRESH_WINDOW_MS) {
    return tokens.access_token;
  }

  // Refresh. eBay does not rotate the refresh token, so we pass null and the
  // RPC keeps the stored one.
  try {
    const refreshed = await refreshAccessToken(tokens.refresh_token);
    const newExpiry = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
    const { error: storeErr } = await admin
      .schema("ecom")
      .rpc("store_refreshed_ebay_tokens", {
        p_connection_id: connectionId,
        p_access_token: refreshed.access_token,
        p_access_token_expires_at: newExpiry,
        p_refresh_token: null,
        p_refresh_token_expires_at: null,
      });
    if (storeErr) {
      // Non-fatal: we still have a usable token for the current call.
      console.error("store_refreshed_ebay_tokens failed:", storeErr.message);
    }
    return refreshed.access_token;
  } catch (e) {
    const msg = e instanceof Error ? e.message : "refresh failed";
    console.error("eBay token refresh failed:", msg);
    // Refresh token likely expired → flag the connection for re-consent.
    await admin
      .schema("ecom")
      .from("marketplace_connections")
      .update({ status: "expired", last_error: msg })
      .eq("id", connectionId);
    return null;
  }
}
