import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { TraderPlan } from "@/types/trader-plans";

export function useTraderPlan(accountId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["trader-plan", accountId],
    queryFn: async () => {
      if (!accountId) return null;

      const { data, error } = await supabase
        .from("traders")
        .select("*")
        .eq("account_id", accountId)
        .single();

      if (error && error.code !== "PGRST116") throw error;
      return (data as TraderPlan) ?? null;
    },
    enabled: !!accountId,
  });
}
