"use client";

import { useState } from "react";
import { useAccounts } from "@/contexts/AccountContext";
import {
  useAccountMembers,
  useAccountInvitations,
  useInviteMember,
  useRemoveMember,
  useDeleteInvitation,
} from "@/hooks/useAccountMembers";
import { useUser } from "@/contexts/UserContext";

export default function MembersSettingsPage() {
  const { user } = useUser();
  const { activeAccountId, isTrader } = useAccounts();
  const { data: members = [], isLoading: membersLoading } =
    useAccountMembers(activeAccountId);
  const { data: invitations = [], isLoading: invitationsLoading } =
    useAccountInvitations(activeAccountId);
  const inviteMember = useInviteMember();
  const removeMember = useRemoveMember();
  const deleteInvitation = useDeleteInvitation();

  const [inviteRole, setInviteRole] = useState("member");
  const [inviteEmail, setInviteEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);

  if (!isTrader) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Team Members
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Member management is available for Trader accounts. Switch to your
          trader account or create a trader account to access this feature.
        </p>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!activeAccountId) return;
    setActionError(null);
    setEmailNotice(null);
    setGeneratedToken(null);

    try {
      const result = await inviteMember.mutateAsync({
        accountId: activeAccountId,
        accountRole: inviteRole,
        email: inviteEmail,
      });
      if (result?.token) {
        setGeneratedToken(result.token);
      }
      if (result?.emailSent) {
        setEmailNotice(`Invitation emailed to ${inviteEmail.trim()}.`);
        setInviteEmail("");
      } else if (result?.emailError) {
        setEmailNotice(
          `Invitation link created, but email could not be sent: ${result.emailError}`,
        );
      }
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to create invitation."
      );
    }
  };

  const handleRemoveMember = async (userId: string, displayName: string) => {
    if (!activeAccountId) return;
    if (
      !window.confirm(
        `Remove ${displayName} from this team? They will lose access immediately.`
      )
    ) {
      return;
    }
    setActionError(null);
    try {
      await removeMember.mutateAsync({ accountId: activeAccountId, userId });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to remove member."
      );
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!activeAccountId) return;
    if (!window.confirm("Cancel this invitation? The link will stop working.")) {
      return;
    }
    setActionError(null);
    try {
      await deleteInvitation.mutateAsync({
        accountId: activeAccountId,
        invitationId,
      });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to cancel invitation."
      );
    }
  };

  const buildInviteUrl = (token: string) =>
    `${window.location.origin}/invitation/${token}`;

  const copyToken = async (token: string) => {
    try {
      await navigator.clipboard.writeText(buildInviteUrl(token));
      setCopiedToken(token);
      window.setTimeout(() => {
        setCopiedToken((prev) => (prev === token ? null : prev));
      }, 2000);
    } catch {
      setActionError("Could not copy to clipboard. Copy the link manually.");
    }
  };

  return (
    <div className="space-y-6">
      {actionError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm text-red-800 dark:text-red-300">
          {actionError}
        </div>
      )}

      {/* Members List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
          Team Members
        </h2>

        {membersLoading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-12 bg-gray-200 dark:bg-gray-700 rounded"
              />
            ))}
          </div>
        ) : members.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">No members yet.</p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {members.map((member) => {
              const displayName = member.name || member.email || "Unnamed";
              const isSelf = member.user_id === user?.id;
              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {displayName}
                      {isSelf && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          (you)
                        </span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {member.email}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                      {member.is_primary_owner ? "Owner" : member.account_role}
                    </span>
                    {!member.is_primary_owner && !isSelf && (
                      <button
                        onClick={() =>
                          handleRemoveMember(member.user_id, displayName)
                        }
                        disabled={removeMember.isPending}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                      >
                        {removeMember.isPending ? "Removing…" : "Remove"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Member */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Invite New Member
        </h3>

        <div className="grid gap-3 md:grid-cols-[2fr_1fr_auto] md:items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="teammate@example.com"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Role
            </label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="member">Member</option>
              <option value="owner">Owner</option>
            </select>
          </div>
          <button
            onClick={handleInvite}
            disabled={inviteMember.isPending}
            className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
          >
            {inviteMember.isPending
              ? "Working…"
              : inviteEmail.trim()
                ? "Send invite"
                : "Generate link"}
          </button>
        </div>
        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
          Leave email blank to generate a copy-paste link instead.
        </p>
        {emailNotice && (
          <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg text-sm text-blue-800 dark:text-blue-300">
            {emailNotice}
          </div>
        )}

        {generatedToken && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300 mb-2">
              Invite link generated. Share this with your team member (expires
              in 7 days):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border border-green-300 dark:border-green-700 truncate">
                {buildInviteUrl(generatedToken)}
              </code>
              <button
                onClick={() => copyToken(generatedToken)}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                {copiedToken === generatedToken ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Pending Invitations
        </h3>

        {invitationsLoading ? (
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ) : invitations.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            No pending invitations.
          </p>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between py-3 gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">
                    {invitation.account_role} invitation
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Created{" "}
                    {new Date(invitation.created_at).toLocaleDateString()} ·{" "}
                    {invitation.invitation_type === "one_time"
                      ? "one-time use"
                      : "7-day link"}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    onClick={() => copyToken(invitation.token)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {copiedToken === invitation.token ? "Copied!" : "Copy link"}
                  </button>
                  <button
                    onClick={() => handleCancelInvitation(invitation.id)}
                    disabled={deleteInvitation.isPending}
                    className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
