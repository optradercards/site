import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens } from "@/lib/ebay/oauth";
import { getEbayUser } from "@/lib/ebay/identity";
import { EBAY_ENV, EBAY_SCOPES } from "@/lib/ebay/config";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

type OAuthCookie = { nonce: string; accountId: string; returnTo: string };

// GET /api/ebay/oauth/callback — eBay redirects here after consent (the RuName's
// accept URL points at this route). Verifies the CSRF nonce, exchanges the code
// for tokens, persists them via the upsert_ebay_connection RPC (tokens land in
// Vault), and redirects the vendor back to the connection page.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  let parsed: OAuthCookie | null = null;
  try {
    const raw = request.cookies.get("ebay_oauth")?.value;
    parsed = raw ? (JSON.parse(raw) as OAuthCookie) : null;
  } catch {
    parsed = null;
  }

  const fail = (msg: string) => {
    const dest = new URL(parsed?.returnTo || "/", siteUrl);
    dest.searchParams.set("ebay_error", msg);
    const r = NextResponse.redirect(dest);
    r.cookies.delete("ebay_oauth");
    return r;
  };

  if (oauthError) return fail(oauthError);
  if (!code || !state || !parsed) return fail("missing_code_or_state");
  if (state !== parsed.nonce) return fail("state_mismatch");

  // Caller must still be signed in (membership is enforced inside the RPC).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("not_authenticated");

  let tokens;
  try {
    tokens = await exchangeCodeForTokens(code);
  } catch (e) {
    return fail(e instanceof Error ? e.message : "token_exchange_failed");
  }

  // Best-effort: read the seller's username (non-fatal, often blank in sandbox).
  const who = await getEbayUser(tokens.access_token);

  const nowMs = Date.now();
  const accessExpiresAt = new Date(nowMs + tokens.expires_in * 1000).toISOString();
  const refreshExpiresAt = new Date(
    nowMs + tokens.refresh_token_expires_in * 1000,
  ).toISOString();

  const { error: rpcErr } = await supabase
    .schema("ecom")
    .rpc("upsert_ebay_connection", {
      p_account_id: parsed.accountId,
      p_environment: EBAY_ENV,
      p_ebay_user_id: who?.userId ?? null,
      p_ebay_username: who?.username ?? null,
      p_scopes: EBAY_SCOPES.join(" "),
      p_access_token: tokens.access_token,
      p_access_token_expires_at: accessExpiresAt,
      p_refresh_token: tokens.refresh_token,
      p_refresh_token_expires_at: refreshExpiresAt,
    });
  if (rpcErr) return fail(rpcErr.message);

  const dest = new URL(parsed.returnTo || "/", siteUrl);
  dest.searchParams.set("ebay_connected", "1");
  const r = NextResponse.redirect(dest);
  r.cookies.delete("ebay_oauth");
  return r;
}
