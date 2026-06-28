import { NextRequest, NextResponse } from "next/server";
import { computeChallengeResponse } from "@/lib/ebay/notifications";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// eBay Marketplace Account Deletion / Closure endpoint.
//
// This endpoint is MANDATORY: eBay will not activate a production keyset until
// it validates here, and it must keep responding or the keyset is throttled.
// Because we persist eBay user data, opting out is not an option — this must be
// a live, public HTTPS endpoint.
//
//   GET  — validation handshake. Replies to ?challenge_code=<code> with
//          { challengeResponse: sha256(challengeCode + verificationToken + endpoint) }.
//   POST — a real account-deletion notification: purge that eBay user's data
//          and acknowledge with a 2xx.

const verificationToken = process.env.EBAY_VERIFICATION_TOKEN || "";

// The endpoint URL eBay calls. MUST byte-for-byte match what's registered in
// the eBay developer portal (scheme + host + path, no trailing slash). Override
// via EBAY_DELETION_ENDPOINT when the public URL differs from the site URL
// (e.g. a tunnel during sandbox testing).
const endpointUrl =
  process.env.EBAY_DELETION_ENDPOINT ||
  `${process.env.NEXT_PUBLIC_SITE_URL || ""}/api/ebay/notifications/account-deletion`;

export async function GET(request: NextRequest) {
  const challengeCode = new URL(request.url).searchParams.get("challenge_code");
  if (!challengeCode) {
    return NextResponse.json({ error: "missing challenge_code" }, { status: 400 });
  }
  if (!verificationToken) {
    return NextResponse.json(
      { error: "EBAY_VERIFICATION_TOKEN not configured" },
      { status: 503 },
    );
  }
  const challengeResponse = computeChallengeResponse(
    challengeCode,
    verificationToken,
    endpointUrl,
  );
  return NextResponse.json({ challengeResponse }, { status: 200 });
}

export async function POST(request: NextRequest) {
  let payload: unknown = null;
  try {
    payload = await request.json();
  } catch {
    payload = null;
  }

  // Payload shape: { metadata, notification: { data: { username, userId, eiasToken } } }
  // (older docs nest it directly under `data`). Read both shapes defensively.
  const p = payload as
    | { notification?: { data?: Record<string, unknown> }; data?: Record<string, unknown> }
    | null;
  const data = p?.notification?.data ?? p?.data ?? {};
  const ebayUserId = typeof data.userId === "string" ? data.userId : undefined;
  const ebayUsername = typeof data.username === "string" ? data.username : undefined;

  // Best-effort purge. We always ACK with 2xx so eBay never marks the endpoint
  // down; failures are logged for follow-up. In Phase 0 the only eBay-keyed
  // data we hold is the seller's own marketplace_connections row — once order
  // import lands (Phase 1) this handler must also scrub imported buyer PII.
  try {
    const admin = createServiceRoleClient();
    if (admin && (ebayUserId || ebayUsername)) {
      const table = () =>
        admin.schema("ecom").from("marketplace_connections").delete().eq("marketplace", "ebay");
      if (ebayUserId) await table().eq("ebay_user_id", ebayUserId);
      if (ebayUsername) await table().eq("ebay_username", ebayUsername);
    }
  } catch (e) {
    console.error("eBay account-deletion purge failed:", e);
  }

  return new NextResponse(null, { status: 204 });
}
