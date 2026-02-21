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
  isDealer: boolean;
  isLoading: boolean;
  switchAccount: (accountId: string) => void;
};

const AccountContext = createContext<AccountContextType>({
  activeAccountId: null,
  activeAccount: null,
  accounts: [],
  personalAccount: null,
  isDealer: false,
  isLoading: true,
  switchAccount: () => {},
});

const ACTIVE_ACCOUNT_KEY = "optc-active-account-id";

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const supabase = createClient();
  const [activeAccountId, setActiveAccountId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACTIVE_ACCOUNT_KEY);
  });

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["accounts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_accounts");
      if (error) throw error;
      return (data ?? []) as Account[];
    },
    enabled: !!user,
  });

  const personalAccount = useMemo(
    () => accounts.find((a) => a.personal_account) ?? null,
    [accounts]
  );

  // Default to personal account if no active account set or if the stored one is invalid
  useEffect(() => {
    if (accounts.length === 0) return;

    const validAccount = accounts.find((a) => a.account_id === activeAccountId);
    if (!validAccount && personalAccount) {
      setActiveAccountId(personalAccount.account_id);
      localStorage.setItem(ACTIVE_ACCOUNT_KEY, personalAccount.account_id);
    }
  }, [accounts, activeAccountId, personalAccount]);

  const activeAccount = useMemo(
    () => accounts.find((a) => a.account_id === activeAccountId) ?? null,
    [accounts, activeAccountId]
  );

  const switchAccount = useCallback((accountId: string) => {
    setActiveAccountId(accountId);
    localStorage.setItem(ACTIVE_ACCOUNT_KEY, accountId);
  }, []);

  // Check if the active account is a dealer (non-personal account = team = dealer)
  const isDealer = useMemo(
    () => !!activeAccount && !activeAccount.personal_account,
    [activeAccount]
  );

  const value = useMemo(
    () => ({
      activeAccountId,
      activeAccount,
      accounts,
      personalAccount,
      isDealer,
      isLoading,
      switchAccount,
    }),
    [
      activeAccountId,
      activeAccount,
      accounts,
      personalAccount,
      isDealer,
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
