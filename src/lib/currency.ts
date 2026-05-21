import type { SupabaseClient } from "@supabase/supabase-js";

export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "USD ($)", symbol: "$" },
  { code: "AUD", label: "AUD (A$)", symbol: "A$" },
  { code: "EUR", label: "EUR (\u20ac)", symbol: "\u20ac" },
  { code: "GBP", label: "GBP (\u00a3)", symbol: "\u00a3" },
] as const;

// Reads cached USD->currency rates from public.exchange_rates (refreshed
// daily by the refresh-exchange-rates edge function). Server-side
// callers used to invoke the exchange-rates edge function on every
// request, which round-tripped to Shiny; this hits the local table
// instead. Returns an empty object on failure so callers degrade to
// "show prices in source currency" rather than crashing.
export async function fetchExchangeRates(
  supabase: SupabaseClient,
): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from("exchange_rates")
      .select("currency_code, rate_from_usd");
    const rates: Record<string, number> = {};
    for (const r of (data ?? []) as Array<{
      currency_code: string;
      rate_from_usd: number;
    }>) {
      rates[r.currency_code.toLowerCase()] = Number(r.rate_from_usd);
    }
    return rates;
  } catch {
    return {};
  }
}

export function formatPrice(
  cents: number | null,
  currency: string,
  rates: Record<string, number>,
  sourceCurrency: string = "USD",
): string {
  if (cents == null) return "\u2014";

  const from = sourceCurrency.toLowerCase();
  const to = currency.toLowerCase();

  let converted: number;
  if (from === to) {
    converted = cents / 100;
  } else {
    const fromRate = from === "usd" ? 1 : (rates[from] ?? 1);
    const toRate = to === "usd" ? 1 : (rates[to] ?? 1);
    converted = (cents / 100) * (toRate / fromRate);
  }

  const info = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
  const symbol = info?.symbol ?? "$";

  const formatted = converted.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return symbol + formatted;
}
