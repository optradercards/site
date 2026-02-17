import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { LinkedAccountType } from "@/types/profile";

export interface ImportResult {
  success: boolean;
  platform: LinkedAccountType;
  stats: {
    // Collectr stats
    products_found?: number;
    products_matched?: number;
    products_imported?: number;
    // Shiny stats
    collections_imported?: number;
    collection_items_imported?: number;
    sold_items_imported?: number;
  };
  error?: string;
}

export function useImportAccount() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      platform: LinkedAccountType;
      handle: string;
      accountId: string;
    }): Promise<ImportResult> => {
      const { platform, handle, accountId } = params;

      // Best-effort: insert a "running" log row
      let logId: string | null = null;
      try {
        const { data: logRow } = await supabase
          .from("job_logs")
          .insert({
            account_id: accountId,
            platform,
            handle,
            status: "running",
          })
          .select("id")
          .single();
        logId = logRow?.id ?? null;
      } catch {
        // logging is best-effort — don't block the import
      }

      let result: ImportResult;

      if (platform === "collectr") {
        const { data, error } = await supabase.functions.invoke(
          "collectr-import-profile",
          { body: { showcase_id: handle } }
        );

        if (error) {
          result = { success: false, platform, stats: {}, error: error.message };
        } else if (!data.success) {
          result = {
            success: false,
            platform,
            stats: {},
            error: data.error || "Import failed",
          };
        } else {
          result = {
            success: true,
            platform,
            stats: {
              products_found: data.products_found,
              products_matched: data.products_matched,
              products_imported: data.products_imported,
            },
          };
        }
      } else {
        // Shiny
        const { data, error } = await supabase.functions.invoke(
          "shiny-import-collections",
          { body: { query: handle } }
        );

        if (error) {
          result = { success: false, platform, stats: {}, error: error.message };
        } else if (!data.success) {
          result = {
            success: false,
            platform,
            stats: {},
            error: data.error || "Import failed",
          };
        } else {
          result = {
            success: true,
            platform,
            stats: {
              collections_imported: data.stats?.collections_imported,
              collection_items_imported: data.stats?.collection_items_imported,
              sold_items_imported: data.stats?.sold_items_imported,
            },
          };
        }
      }

      // Best-effort: update the log row with outcome
      if (logId) {
        try {
          if (result.success) {
            await supabase
              .from("job_logs")
              .update({
                status: "completed",
                stats: result.stats,
                completed_at: new Date().toISOString(),
              })
              .eq("id", logId);
          } else {
            await supabase
              .from("job_logs")
              .update({
                status: "failed",
                error_message: result.error ?? "Unknown error",
                completed_at: new Date().toISOString(),
              })
              .eq("id", logId);
          }
        } catch {
          // best-effort
        }
      }

      return result;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["import-logs"] });
    },
  });
}
