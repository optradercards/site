// eBay OAuth 2.0 (Authorization Code grant) — per-vendor seller connection.
// All calls are server-side only (they use the client secret).

import { ebayConfig, ebayEndpoints, EBAY_SCOPES } from "./config";

function basicAuth(): string {
  return Buffer.from(`${ebayConfig.clientId}:${ebayConfig.clientSecret}`).toString("base64");
}

// Build the consent URL the vendor is redirected to. `state` is an opaque CSRF
// nonce we verify against an httpOnly cookie on the callback.
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: ebayConfig.clientId,
    redirect_uri: ebayConfig.ruName, // RuName, not the literal URL
    response_type: "code",
    scope: EBAY_SCOPES.join(" "),
    state,
  });
  return `${ebayEndpoints.authorize}?${params.toString()}`;
}

export interface EbayTokenResponse {
  access_token: string;
  expires_in: number; // access token lifetime, seconds (~7200)
  refresh_token: string;
  refresh_token_expires_in: number; // refresh token lifetime, seconds (~47304000 ≈ 18 months)
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<EbayTokenResponse> {
  const res = await fetch(ebayEndpoints.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: ebayConfig.ruName,
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`eBay token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as EbayTokenResponse;
}

export interface EbayRefreshResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  // Note: eBay does NOT return a new refresh_token on refresh. The original
  // refresh token stays valid until its own ~18-month expiry, at which point
  // the vendor must re-consent.
}

export async function refreshAccessToken(refreshToken: string): Promise<EbayRefreshResponse> {
  const res = await fetch(ebayEndpoints.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_SCOPES.join(" "),
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`eBay token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as EbayRefreshResponse;
}

// Application token (client_credentials grant). Not tied to any seller — used
// for app-level reads like the Taxonomy API (category trees + item aspects).
// Cached in-process until shortly before expiry. Confirmed lifetime: 7200s.
let appTokenCache: { token: string; exp: number } | null = null;

export async function getApplicationToken(): Promise<string> {
  if (appTokenCache && appTokenCache.exp - Date.now() > 60_000) {
    return appTokenCache.token;
  }
  const res = await fetch(ebayEndpoints.token, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth()}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "https://api.ebay.com/oauth/api_scope",
    }).toString(),
  });
  if (!res.ok) {
    throw new Error(`eBay application token failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  appTokenCache = { token: data.access_token, exp: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}
