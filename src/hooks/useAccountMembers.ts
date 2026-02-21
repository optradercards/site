import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

type AccountMember = {
  user_id: string;
  account_role: string;
  name: string | null;
  email: string | null;
  is_primary_owner: boolean;
};

type AccountInvitation = {
  id: string;
  account_role: string;
  invitation_type: string;
  created_at: string;
  token: string;
};

export function useAccountMembers(accountId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["account-members", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_account_members", {
        account_id: accountId,
      });
      if (error) throw error;
      return (data ?? []) as AccountMember[];
    },
    enabled: !!accountId,
  });
}

export function useAccountInvitations(accountId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["account-invitations", accountId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_account_invitations", {
        account_id: accountId,
      });
      if (error) throw error;
      return (data ?? []) as AccountInvitation[];
    },
    enabled: !!accountId,
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      accountRole,
    }: {
      accountId: string;
      accountRole: string;
    }) => {
      const { data, error } = await supabase.rpc("create_invitation", {
        account_id: accountId,
        account_role: accountRole,
        invitation_type: "24_hour",
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["account-invitations", variables.accountId],
      });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      accountId,
      userId,
    }: {
      accountId: string;
      userId: string;
    }) => {
      const { error } = await supabase.rpc("remove_account_member", {
        account_id: accountId,
        user_id: userId,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["account-members", variables.accountId],
      });
    },
  });
}
