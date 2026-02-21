"use client";

import { useState } from "react";
import { useAccounts } from "@/contexts/AccountContext";
import {
  useAccountMembers,
  useAccountInvitations,
  useInviteMember,
  useRemoveMember,
} from "@/hooks/useAccountMembers";
import { useUser } from "@/contexts/UserContext";

export default function MembersSettingsPage() {
  const { user } = useUser();
  const { activeAccountId, isDealer, activeAccount } = useAccounts();
  const { data: members = [], isLoading: membersLoading } =
    useAccountMembers(activeAccountId);
  const { data: invitations = [], isLoading: invitationsLoading } =
    useAccountInvitations(activeAccountId);
  const inviteMember = useInviteMember();
  const removeMember = useRemoveMember();

  const [inviteRole, setInviteRole] = useState("member");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  if (!isDealer) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Team Members
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Member management is available for Dealer accounts. Switch to your
          dealer account or create a dealer account to access this feature.
        </p>
      </div>
    );
  }

  const handleInvite = async () => {
    if (!activeAccountId) return;

    try {
      const result = await inviteMember.mutateAsync({
        accountId: activeAccountId,
        accountRole: inviteRole,
      });
      if (result?.token) {
        setGeneratedToken(result.token);
      }
    } catch {
      // Error is handled by the mutation state
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!activeAccountId) return;
    await removeMember.mutateAsync({ accountId: activeAccountId, userId });
  };

  const copyToken = (token: string) => {
    const inviteUrl = `${window.location.origin}/invitation/${token}`;
    navigator.clipboard.writeText(inviteUrl);
  };

  return (
    <div className="space-y-6">
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
            {members.map((member) => (
              <div
                key={member.user_id}
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {member.name || "Unnamed"}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {member.email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                    {member.is_primary_owner ? "Owner" : member.account_role}
                  </span>
                  {!member.is_primary_owner &&
                    member.user_id !== user?.id && (
                      <button
                        onClick={() => handleRemoveMember(member.user_id)}
                        disabled={removeMember.isPending}
                        className="text-xs text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
                      >
                        Remove
                      </button>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Invite Member */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-4">
          Invite New Member
        </h3>

        <div className="flex items-end gap-3">
          <div className="flex-1">
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
            className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors"
          >
            {inviteMember.isPending ? "Generating..." : "Generate Invite Link"}
          </button>
        </div>

        {inviteMember.isError && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">
            Failed to create invitation. Please try again.
          </p>
        )}

        {generatedToken && (
          <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-300 mb-2">
              Invite link generated! Share this with your team member (expires
              in 24 hours):
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-xs bg-white dark:bg-gray-800 p-2 rounded border border-green-300 dark:border-green-700 truncate">
                {window.location.origin}/invitation/{generatedToken}
              </code>
              <button
                onClick={() => copyToken(generatedToken)}
                className="px-3 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
              >
                Copy
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
                className="flex items-center justify-between py-3"
              >
                <div>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {invitation.account_role} invitation
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Created{" "}
                    {new Date(invitation.created_at).toLocaleDateString()} |{" "}
                    {invitation.invitation_type}
                  </p>
                </div>
                <button
                  onClick={() => copyToken(invitation.token)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Copy Link
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
