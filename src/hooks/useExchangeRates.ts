import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useExchangeRates() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["exchange-rates"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("exchange-rates");

      if (error) throw error;
      if (!data?.success) throw new Error("Failed to fetch exchange rates");

      return data.rates as Record<string, number>;
    },
    staleTime: 5 * 60 * 1000,
  });
}
