import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { LinkedAccountType, LinkedAccountRow } from "@/types/profile";

export function useLinkedAccounts(accountId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["linked-accounts", accountId],
    queryFn: async () => {
      if (!accountId) return [];
      const { data, error } = await supabase
        .from("linked_accounts")
        .select("*")
        .eq("account_id", accountId);
      if (error) throw error;
      return (data ?? []) as LinkedAccountRow[];
    },
    enabled: !!accountId,
  });
}

export function useLinkAccount() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      accountId: string;
      platform: LinkedAccountType;
      handle: string;
      platformAccountId?: string;
    }) => {
      const { error } = await supabase
        .from("linked_accounts")
        .insert({
          account_id: data.accountId,
          platform: data.platform,
          handle: data.handle,
          ...(data.platformAccountId && { platform_account_id: data.platformAccountId }),
        });

      if (error) {
        if (error.code === "23505") {
          throw new Error("This account is already linked");
        }
        throw error;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["linked-accounts", variables.accountId],
      });
    },
  });
}

export function useUnlinkAccount() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: { accountId: string; id: string }) => {
      const { error } = await supabase
        .from("linked_accounts")
        .delete()
        .eq("id", data.id);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["linked-accounts", variables.accountId],
      });
    },
  });
}
