import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";

export interface JobLog {
  id: string;
  account_id: string;
  platform: "shiny" | "collectr" | "shiny-brands" | "shiny-cards" | "shiny-collections" | "shiny-accounts";
  handle: string;
  status: "pending" | "running" | "completed" | "failed";
  stats: Record<string, number>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useJobLogs() {
  const { user } = useUser();
  const supabase = createClient();

  return useQuery({
    queryKey: ["job-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_logs")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data ?? []) as JobLog[];
    },
    enabled: !!user,
  });
}
