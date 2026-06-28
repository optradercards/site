import { createHash } from "crypto";

// eBay endpoint-validation handshake. Used by both the marketplace
// account-deletion endpoint and any future Notification API destination.
//
// eBay sends GET ?challenge_code=<code>; the endpoint must reply 200 with a
// JSON { challengeResponse } where challengeResponse is the SHA-256 HEX digest
// of (challengeCode + verificationToken + endpoint) concatenated IN THAT ORDER.
// The endpoint string must exactly match the URL registered with eBay.
export function computeChallengeResponse(
  challengeCode: string,
  verificationToken: string,
  endpoint: string,
): string {
  return createHash("sha256")
    .update(challengeCode)
    .update(verificationToken)
    .update(endpoint)
    .digest("hex");
}
