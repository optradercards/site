"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccounts } from "@/contexts/AccountContext";
import CreateDealerModal from "@/components/CreateDealerModal";

export default function AccountSwitcher() {
  const { activeAccount, accounts, switchAccount, personalAccount, isDealer } =
    useAccounts();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [showDealerModal, setShowDealerModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  if (!activeAccount || accounts.length === 0) return null;

  const teamAccounts = accounts.filter((a) => !a.personal_account);
  const displayName = activeAccount.personal_account
    ? "My Collection"
    : activeAccount.name || activeAccount.slug || "Dealer Account";

  const handleSwitch = (account: typeof activeAccount) => {
    if (!account) return;
    switchAccount(account.account_id);
    setIsOpen(false);
    if (account.slug) {
      router.push(`/${account.slug}`);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
          {activeAccount.personal_account
            ? "P"
            : (activeAccount.name || activeAccount.slug || "D")[0].toUpperCase()}
        </div>
        <span className="truncate max-w-[140px]">{displayName}</span>
        <svg
          className={`w-4 h-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1 w-64 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Personal
            </p>
          </div>

          {/* Personal account */}
          {personalAccount && (
            <button
              onClick={() => handleSwitch(personalAccount)}
              className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                activeAccount.account_id === personalAccount.account_id
                  ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                  : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
              }`}
            >
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center text-gray-600 dark:text-gray-300 text-sm font-bold shrink-0">
                P
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">My Collection</p>
                {personalAccount.slug && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                    /{personalAccount.slug}
                  </p>
                )}
              </div>
              {activeAccount.account_id === personalAccount.account_id && (
                <svg
                  className="w-4 h-4 text-red-500 shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              )}
            </button>
          )}

          {/* Dealer accounts */}
          {teamAccounts.length > 0 && (
            <>
              <div className="px-3 py-2 border-t border-b border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dealer Accounts
                </p>
              </div>

              {teamAccounts.map((account) => (
                <button
                  key={account.account_id}
                  onClick={() => handleSwitch(account)}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-3 ${
                    activeAccount.account_id === account.account_id
                      ? "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 text-sm font-bold shrink-0">
                    {(account.name || account.slug || "D")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">
                      {account.name || account.slug}
                    </p>
                    {account.slug && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        /{account.slug}
                      </p>
                    )}
                  </div>
                  {activeAccount.account_id === account.account_id && (
                    <svg
                      className="w-4 h-4 text-red-500 shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </button>
              ))}
            </>
          )}

          {/* Create Dealer Account */}
          {!isDealer && (
            <button
              onClick={() => {
                setIsOpen(false);
                setShowDealerModal(true);
              }}
              className="w-full text-left px-3 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center gap-3 border-t border-gray-200 dark:border-gray-700"
            >
              <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-600 dark:text-red-400 text-sm font-bold shrink-0">
                +
              </div>
              Create a Dealer Account
            </button>
          )}
        </div>
      )}

      <CreateDealerModal
        isOpen={showDealerModal}
        onClose={() => setShowDealerModal(false)}
      />
    </div>
  );
}
