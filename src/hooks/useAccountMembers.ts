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
  invitation_type: "one_time" | "24_hour";
  created_at: string;
  token: string;
};

export type InvitationLookup = {
  active: boolean;
  account_name: string | null;
  account_slug: string | null;
  account_role: string | null;
};

export type AcceptInvitationResult = {
  account_id: string;
  account_role: string;
  slug: string | null;
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
      invitationType = "24_hour",
      email,
    }: {
      accountId: string;
      accountRole: string;
      invitationType?: "one_time" | "24_hour";
      email?: string;
    }) => {
      const trimmedEmail = email?.trim() || null;
      const { data, error } = await supabase.rpc("create_invitation", {
        account_id: accountId,
        account_role: accountRole,
        invitation_type: invitationType,
        invitation_email: trimmedEmail,
      });
      if (error) throw error;

      const result = data as { id: string; token: string; email: string | null };

      // If an email was provided, dispatch the invitation email. Failures here
      // should not roll back the invitation — the link can still be shared
      // manually. Surface as a warning instead.
      let emailSent = false;
      let emailError: string | null = null;
      if (trimmedEmail) {
        const { data: sendData, error: sendError } =
          await supabase.functions.invoke("send-invitation-email", {
            body: { invitation_id: result.id },
          });
        if (sendError) {
          // FunctionsHttpError swallows the body; try to read it back so we
          // can surface SendGrid / config errors instead of a generic message.
          let detail = sendError.message;
          const ctx = (sendError as { context?: Response }).context;
          if (ctx && typeof ctx.json === "function") {
            try {
              const body = await ctx.json();
              if (body?.error) detail = body.error;
            } catch {
              // ignore
            }
          }
          emailError = detail;
        } else if (!sendData?.success) {
          emailError = sendData?.error ?? "Failed to send email";
        } else {
          emailSent = true;
        }
      }

      return { ...result, emailSent, emailError };
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["account-invitations", variables.accountId],
      });
    },
  });
}

export function useDeleteInvitation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({
      invitationId,
    }: {
      accountId: string;
      invitationId: string;
    }) => {
      const { error } = await supabase.rpc("delete_invitation", {
        invitation_id: invitationId,
      });
      if (error) throw error;
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

export function useLookupInvitation(token: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["invitation-lookup", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("lookup_invitation", {
        lookup_invitation_token: token,
      });
      if (error) throw error;
      return data as InvitationLookup;
    },
    enabled: !!token,
    retry: false,
  });
}

export function useAcceptInvitation() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (token: string) => {
      const { data, error } = await supabase.rpc("accept_invitation", {
        lookup_invitation_token: token,
      });
      if (error) throw error;
      return data as AcceptInvitationResult;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
