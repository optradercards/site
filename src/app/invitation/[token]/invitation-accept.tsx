"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

type State = "loading" | "valid" | "invalid" | "already_member" | "accepting" | "error";

interface LookupResult {
  active: boolean;
  account_name: string | null;
}

export function InvitationAccept() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { switchAccount, accounts } = useAccounts();

  const [state, setState] = useState<State>("loading");
  const [accountName, setAccountName] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        setHasSession(false);
        // Look up invite to show preview even for unauthenticated users
        const { data, error } = await supabase.rpc("lookup_invitation", {
          lookup_invitation_token: token,
        });
        if (error || !data || !data.active) {
          setState("invalid");
          setErrorMessage("This invitation has expired or is no longer valid.");
        } else {
          setAccountName(data.account_name);
          setState("valid");
        }
        return;
      }

      setHasSession(true);
      const { data, error } = await supabase.rpc("lookup_invitation", {
        lookup_invitation_token: token,
      });
      if (error || !data || !data.active) {
        setState("invalid");
        setErrorMessage("This invitation has expired or is no longer valid.");
      } else {
        setAccountName(data.account_name);
        setState("valid");
      }
    };

    init();
  }, [token]);

  const handleAccept = async () => {
    setState("accepting");
    const supabase = createClient();

    const { data, error } = await supabase.rpc("accept_invitation", {
      lookup_invitation_token: token,
    });

    if (error) {
      if (error.message?.toLowerCase().includes("already a member")) {
        setState("already_member");
        setErrorMessage("You're already a member of this team.");
      } else {
        setState("error");
        setErrorMessage(error.message || "Failed to accept invitation.");
      }
      return;
    }

    const { account_id, slug } = data as { account_id: string; account_role: string; slug: string };

    // Switch to the new account context
    if (account_id) {
      switchAccount(account_id);
    }

    router.push(`/${slug}/manage`);
  };

  const handleSignIn = () => {
    router.push(`/login?returnUrl=${encodeURIComponent(`/invitation/${token}`)}`);
  };

  if (state === "loading") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4" />
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-6" />
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>
    );
  }

  if (state === "invalid") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        <div className="text-4xl mb-4">⛔</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Invitation Expired
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {errorMessage || "This invitation link is no longer valid."}
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
        >
          Go Home
        </a>
      </div>
    );
  }

  if (state === "already_member") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        <div className="text-4xl mb-4">✅</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Already a Member
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          You're already a member of {accountName || "this team"}.
        </p>
        <a
          href="/"
          className="inline-block px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
        >
          Go to Dashboard
        </a>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          Something went wrong
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMessage}</p>
        <a
          href="/"
          className="inline-block px-6 py-2 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
        >
          Go Home
        </a>
      </div>
    );
  }

  // Valid invite — show accept or sign-in CTA
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 w-full max-w-md">
      <div className="text-center mb-6">
        <div className="text-4xl mb-3">🎉</div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          You've been invited!
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Join <span className="font-semibold text-gray-900 dark:text-white">{accountName}</span> on OP Trader
        </p>
      </div>

      {state === "accepting" ? (
        <div className="text-center py-4">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-500" />
          <p className="mt-2 text-gray-600 dark:text-gray-400">Joining team…</p>
        </div>
      ) : hasSession ? (
        <div className="space-y-3">
          <button
            onClick={handleAccept}
            className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            Accept Invitation
          </button>
          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            You'll be added as a member of {accountName}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-400 text-center mb-4">
            Sign in to your OP Trader account to accept this invitation.
          </p>
          <button
            onClick={handleSignIn}
            className="w-full px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
          >
            Sign in to Join
          </button>
          <a
            href={`/signup?returnUrl=${encodeURIComponent(`/invitation/${token}`)}`}
            className="block w-full text-center px-6 py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold rounded-lg transition-colors"
          >
            Create Account & Join
          </a>
        </div>
      )}
    </div>
  );
}
