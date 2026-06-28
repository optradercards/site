// eBay environment + endpoints. Sandbox vs production is selected via EBAY_ENV
// (defaults to production). Credentials come from env so nothing is hardcoded.
//
// The exact OAuth scope strings and token lifetimes are confirmed empirically
// during the Phase 0 sandbox spike — eBay echoes neither in a way we depend on,
// so we persist the requested scopes and the expires_in values it returns.

export type EbayEnv = "sandbox" | "production";

export const EBAY_ENV: EbayEnv =
  process.env.EBAY_ENV === "sandbox" ? "sandbox" : "production";

const ENDPOINTS = {
  sandbox: {
    authorize: "https://auth.sandbox.ebay.com/oauth2/authorize",
    token: "https://api.sandbox.ebay.com/identity/v1/oauth2/token",
    api: "https://api.sandbox.ebay.com",
  },
  production: {
    authorize: "https://auth.ebay.com/oauth2/authorize",
    token: "https://api.ebay.com/identity/v1/oauth2/token",
    api: "https://api.ebay.com",
  },
} as const;

export const ebayEndpoints = ENDPOINTS[EBAY_ENV];

// OAuth scopes for a per-vendor seller connection. Scope identifiers are the
// same across environments (only the authorize/token hosts differ).
//   - sell.inventory   → create/manage inventory items, offers, listings
//   - sell.account     → read/manage business (selling) policies
//   - sell.fulfillment → read orders (sales import)
//   - commerce.identity.readonly → read the seller's eBay username/identity
export const EBAY_SCOPES = [
  "https://api.ebay.com/oauth/api_scope",
  "https://api.ebay.com/oauth/api_scope/sell.inventory",
  "https://api.ebay.com/oauth/api_scope/sell.account",
  "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  "https://api.ebay.com/oauth/api_scope/commerce.identity.readonly",
];

export const ebayConfig = {
  env: EBAY_ENV,
  clientId: process.env.EBAY_CLIENT_ID ?? "",
  clientSecret: process.env.EBAY_CLIENT_SECRET ?? "",
  // eBay expects the RuName (redirect URL name) as the `redirect_uri` value,
  // NOT the literal callback URL. The RuName maps to your accept/decline URLs
  // in the eBay developer portal.
  ruName: process.env.EBAY_RU_NAME ?? "",
  // Shared secret for the marketplace-account-deletion endpoint handshake.
  verificationToken: process.env.EBAY_VERIFICATION_TOKEN ?? "",
};

// True once the minimum OAuth credentials are present. The connect UI/route
// degrade gracefully (503) when this is false rather than bouncing the vendor
// to a broken eBay page.
export function ebayConfigured(): boolean {
  return Boolean(ebayConfig.clientId && ebayConfig.clientSecret && ebayConfig.ruName);
}
