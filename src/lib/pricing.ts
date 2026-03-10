// Shared pricing types and helpers.
// Price computation is authoritative in the DB (ecom.computed_price_cents).
// These helpers are used for preview before listings exist and for shared lookups.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MarketData = {
  product_id: string;
  price_ungraded: number | null;
  price_psa_1: number | null;
  price_psa_2: number | null;
  price_psa_3: number | null;
  price_psa_4: number | null;
  price_psa_5: number | null;
  price_psa_6: number | null;
  price_psa_7: number | null;
  price_psa_8: number | null;
  price_psa_9: number | null;
  price_psa_10: number | null;
  price_psa_9_5: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
};

export type EcomListing = {
  id: string;
  account_id: string;
  status: string;
  quantity: number;
  currency: string;
  grading_service: string | null;
  grade: string | null;
  pricing_mode: "fixed" | "market";
  fixed_price_cents: number | null;
  market_multiplier: number | null;
  market_round_to: number | null;
  market_extra_cents: number | null;
  cost_cents: number | null;
  exchange_rate: number | null;
  price_cents: number | null;
  calculated_price_cents: number | null;
  market_price_cents: number | null;
  title: string | null;
  description: string | null;
  image_url: string | null;
  card_product_id: string;
  card_name: string;
  card_number: string | null;
  rarity: string | null;
  set_name: string;
  brand_name: string;
  brand_icon: string | null;
  seller_slug: string;
  seller_name: string;
  created_at: string;
  updated_at: string;
};

export type PricingConfig = {
  multiplier: number;
  roundTo: number;
  extraCents: number;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function gradeLabel(service: string | null, grade: string | null): string {
  if (!service || service === "ungraded") return "Ungraded";
  return `${service.toUpperCase()} ${grade ?? ""}`.trim();
}

export function resolveMarketValue(
  market: MarketData | undefined,
  service: string | null,
  grade: string | null
): number | null {
  if (!market) return null;
  if (!service || service === "ungraded") return market.price_ungraded;
  if (service === "psa") {
    if (grade === "10") return market.price_psa_10;
    if (grade === "9.5") return market.price_psa_9_5;
    if (grade === "9") return market.price_psa_9;
    if (grade === "8") return market.price_psa_8;
    if (grade === "7") return market.price_psa_7;
    if (grade === "6") return market.price_psa_6;
    if (grade === "5") return market.price_psa_5;
    if (grade === "4") return market.price_psa_4;
    if (grade === "3") return market.price_psa_3;
    if (grade === "2") return market.price_psa_2;
    if (grade === "1") return market.price_psa_1;
    return market.price_ungraded;
  }
  if (service === "bgs") return market.price_bgs;
  if (service === "cgc") return market.price_cgc;
  if (service === "sgc") return market.price_ungraded;
  return market.price_ungraded;
}

/**
 * Preview a market-mode price using the same formula as the DB function.
 * Used only for preview in bulk create before the listing exists in DB.
 * Result is in the seller's currency.
 *
 * Formula: ceil((max(costCents, marketValueUsd * exchangeRate) * multiplier + extraCents) / roundTo) * roundTo
 */
export function previewMarketPrice(
  costCents: number | null,
  marketValueUsd: number | null,
  exchangeRate: number,
  multiplier: number,
  extraCents: number,
  roundTo: number
): number | null {
  const marketConverted = Math.round((marketValueUsd ?? 0) * exchangeRate);
  const base = Math.max(costCents ?? 0, marketConverted);
  if (base === 0) return null;
  return Math.ceil((base * multiplier + extraCents) / roundTo) * roundTo;
}
