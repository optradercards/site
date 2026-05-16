"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import {
  useLookupInvitation,
  useAcceptInvitation,
} from "@/hooks/useAccountMembers";

const ACTIVE_ACCOUNT_KEY = "optc-active-account-id";

type Props = {
  token: string;
};

export default function InvitationAcceptClient({ token }: Props) {
  const router = useRouter();
  const { user } = useUser();
  const lookup = useLookupInvitation(token);
  const accept = useAcceptInvitation();
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const returnUrl = `/invitation/${token}`;

  const handleAccept = async () => {
    setAcceptError(null);
    try {
      const result = await accept.mutateAsync(token);
      if (typeof window !== "undefined" && result.account_id) {
        localStorage.setItem(ACTIVE_ACCOUNT_KEY, result.account_id);
      }
      const target = result.slug ? `/${result.slug}/manage` : "/";
      router.push(target);
    } catch (err) {
      setAcceptError(
        err instanceof Error
          ? err.message
          : "Could not accept this invitation. Please try again."
      );
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-lg">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-5">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Team Invitation
        </h1>

        {lookup.isLoading && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Checking invitation…
          </p>
        )}

        {lookup.isError && !user && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Sign in or create an account to view and accept this invitation.
            </p>
            <div className="flex gap-3">
              <Link
                href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
              >
                Sign in
              </Link>
              <Link
                href={`/signup?returnUrl=${encodeURIComponent(returnUrl)}`}
                className="px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold rounded-lg transition-colors"
              >
                Create account
              </Link>
            </div>
          </div>
        )}

        {lookup.isError && user && (
          <p className="text-sm text-red-600 dark:text-red-400">
            We couldn&apos;t verify this invitation. The link may be invalid or
            expired.
          </p>
        )}

        {lookup.data && !lookup.data.active && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              This invitation is no longer valid. Invitations expire after 24
              hours, and one-time links can only be used once.
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Ask the team owner to send you a new invite link.
            </p>
          </div>
        )}

        {lookup.data?.active && (
          <div className="space-y-4">
            <p className="text-gray-700 dark:text-gray-300">
              You&apos;ve been invited to join{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {lookup.data.account_name ?? "a team"}
              </span>
              {lookup.data.account_role && (
                <>
                  {" "}as{" "}
                  <span className="font-semibold text-gray-900 dark:text-white">
                    {lookup.data.account_role}
                  </span>
                </>
              )}
              .
            </p>

            {!user ? (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Sign in or create an account to accept the invitation. We
                  will bring you back here automatically.
                </p>
                <div className="flex gap-3">
                  <Link
                    href={`/login?returnUrl=${encodeURIComponent(returnUrl)}`}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    href={`/signup?returnUrl=${encodeURIComponent(returnUrl)}`}
                    className="px-4 py-2 border border-red-500 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 font-semibold rounded-lg transition-colors"
                  >
                    Create account
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Signed in as{" "}
                  <span className="text-gray-900 dark:text-white">
                    {user.email}
                  </span>
                  .
                </p>
                <button
                  onClick={handleAccept}
                  disabled={accept.isPending}
                  className="px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors"
                >
                  {accept.isPending ? "Joining…" : "Accept invitation"}
                </button>
                {acceptError && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {acceptError}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
