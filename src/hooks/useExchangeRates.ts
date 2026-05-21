import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// Reads the cached rates in public.exchange_rates. Rows are refreshed
// daily by the refresh-exchange-rates edge function (pg_cron at 01:30
// UTC), so callers never round-trip to Shiny.
export function useExchangeRates() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exchange_rates")
        .select("currency_code, rate_from_usd");

      if (error) throw error;

      const rates: Record<string, number> = {};
      for (const r of (data ?? []) as Array<{
        currency_code: string;
        rate_from_usd: number;
      }>) {
        rates[r.currency_code.toLowerCase()] = Number(r.rate_from_usd);
      }
      return rates;
    },
    staleTime: 5 * 60 * 1000,
  });
}
