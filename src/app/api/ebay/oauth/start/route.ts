import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildAuthorizeUrl } from "@/lib/ebay/oauth";
import { ebayConfigured } from "@/lib/ebay/config";

// GET /api/ebay/oauth/start?accountId=<uuid>&returnTo=/<slug>/manage/marketplaces/ebay
//
// Vendor-initiated. Verifies the signed-in caller is a member of the target
// account, then stashes a CSRF nonce + the target account + return URL in an
// httpOnly cookie and redirects the browser to eBay's consent page. The cookie
// (not the URL) carries the account so it can't be tampered with; the nonce is
// echoed back via `state` and compared on the callback.
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const accountId = url.searchParams.get("accountId");
  const returnTo = url.searchParams.get("returnTo") || "/";

  if (!ebayConfigured()) {
    return NextResponse.json(
      { error: "eBay integration is not configured on this environment" },
      { status: 503 },
    );
  }
  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Membership check via RLS — the account must be visible to this user.
  const { data: account, error: accountErr } = await supabase
    .schema("basejump")
    .from("accounts")
    .select("id")
    .eq("id", accountId)
    .maybeSingle();
  if (accountErr) {
    return NextResponse.json({ error: accountErr.message }, { status: 500 });
  }
  if (!account) {
    return NextResponse.json(
      { error: "Account not found or you do not have access" },
      { status: 404 },
    );
  }

  const nonce = randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(nonce));
  res.cookies.set(
    "ebay_oauth",
    JSON.stringify({ nonce, accountId, returnTo }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax", // sent on the top-level GET redirect back from eBay
      path: "/",
      maxAge: 600,
    },
  );
  return res;
}
