"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";

type Account = {
  account_id: string;
  name: string | null;
  slug: string | null;
  personal_account: boolean;
  account_role: string;
};

type AccountContextType = {
  activeAccountId: string | null;
  activeAccount: Account | null;
  accounts: Account[];
  personalAccount: Account | null;
  isTrader: boolean;
  isLoading: boolean;
  switchAccount: (accountId: string) => void;
};

const AccountContext = createContext<AccountContextType>({
  activeAccountId: null,
  activeAccount: null,
  accounts: [],
  personalAccount: null,
  isTrader: false,
  isLoading: true,
  switchAccount: () => {},
});

const ACTIVE_ACCOUNT_KEY = "optc-active-account-id";

export function AccountProvider({
  children,
  initialAccounts = [],
  initialActiveAccountId = null,
}: {
  children: React.ReactNode;
  initialAccounts?: Account[];
  initialActiveAccountId?: string | null;
}) {
  const { user } = useUser();
  const supabase = createClient();

  // Initial state intentionally avoids localStorage so SSR HTML matches
  // the first client render. localStorage hydration happens in a useEffect
  // below for non-slug routes that didn't receive an initialActiveAccountId.
  const [activeAccountId, setActiveAccountId] = useState<string | null>(
    initialActiveAccountId
  );

  const { data: accounts = initialAccounts, isLoading } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accounts");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    enabled: !!user,
    initialData: initialAccounts.length > 0 ? initialAccounts : undefined,
  });

  const personalAccount = useMemo(
    () => accounts.find((a) => a.personal_account) ?? null,
    [accounts]
  );

  // After hydration, fall back to localStorage when no server-resolved active
  // account was supplied (i.e. we're on a non-slug route like /account).
  // Skip if a slug-route already gave us an active account.
  useEffect(() => {
    if (initialActiveAccountId) return;
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(ACTIVE_ACCOUNT_KEY);
    if (stored && stored !== activeAccountId) {
      setActiveAccountId(stored);
    }
    // Run once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the resolved active account is invalid (account list changed, no match),
  // fall back to the personal account.
  useEffect(() => {
    if (accounts.length === 0) return;
    const validAccount = accounts.find((a) => a.account_id === activeAccountId);
    if (!validAccount && personalAccount) {
      setActiveAccountId(personalAccount.account_id);
      if (typeof window !== "undefined") {
        localStorage.setItem(ACTIVE_ACCOUNT_KEY, personalAccount.account_id);
      }
    }
  }, [accounts, activeAccountId, personalAccount]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.account_id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const switchAccount = useCallback((accountId: string) => {
    setActiveAccountId(accountId);
    if (typeof window !== "undefined") {
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
    }
  }, []);

  // Check if the active account is a trader (non-personal account = team = trader)
  const isTrader = useMemo(
    () => !!activeAccount && !activeAccount.personal_account,
    [activeAccount]
  );

  const value = useMemo(
    () => ({
      activeAccountId,
      activeAccount,
      accounts,
      personalAccount,
      isTrader,
      isLoading,
      switchAccount,
    }),
    [
      activeAccountId,
      activeAccount,
      accounts,
      personalAccount,
      isTrader,
      isLoading,
      switchAccount,
    ]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}

export function useAccounts() {
  return useContext(AccountContext);
}
