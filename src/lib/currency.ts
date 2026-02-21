export const SUPPORTED_CURRENCIES = [
  { code: "USD", label: "USD ($)", symbol: "$" },
  { code: "AUD", label: "AUD (A$)", symbol: "A$" },
  { code: "EUR", label: "EUR (\u20ac)", symbol: "\u20ac" },
  { code: "GBP", label: "GBP (\u00a3)", symbol: "\u00a3" },
] as const;

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

  return symbol + converted.toFixed(2);
}
