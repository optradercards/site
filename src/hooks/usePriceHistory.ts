import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { PriceHistoryEntry } from "@/types/cardDetail";

export type PriceHistoryRange = "7d" | "30d" | "90d" | "all";

const RANGE_DAYS: Record<PriceHistoryRange, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

export function usePriceHistory(cardId: string, range: PriceHistoryRange) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["price-history", cardId, range],
    enabled: !!cardId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let q = supabase
        .schema("cards")
        .from("price_history")
        .select("*")
        .eq("product_id", cardId)
        .order("recorded_date", { ascending: false });

      const days = RANGE_DAYS[range];
      if (days != null) {
        const cutoff = new Date();
        cutoff.setUTCHours(0, 0, 0, 0);
        cutoff.setUTCDate(cutoff.getUTCDate() - days);
        q = q.gte("recorded_date", cutoff.toISOString().slice(0, 10));
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PriceHistoryEntry[];
    },
  });
}
