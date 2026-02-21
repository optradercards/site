"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAccounts } from "@/contexts/AccountContext";
import { useUser } from "@/contexts/UserContext";
import AccountSwitcher from "@/components/AccountSwitcher";
import CurrencySwitcher from "@/components/CurrencySwitcher";
import UserMenu from "@/components/UserMenu";

export default function AppHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { activeAccount } = useAccounts();
  const { isAdmin } = useUser();

  const slug = activeAccount?.slug || "";
  const dashboardHref = slug ? `/${slug}` : "/";

  return (
    <header className="bg-gray-800 dark:bg-gray-950 text-white shadow-lg sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href={dashboardHref} className="shrink-0">
              <Image
                src="/logos/OP_Trader_FullLogo.png"
                alt="OP Trader"
                width={220}
                height={44}
                priority
                className="h-11 w-auto"
              />
            </Link>
            {isAdmin && (
              <Link
                href="/admin"
                className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors font-medium text-sm whitespace-nowrap"
              >
                Admin
              </Link>
            )}
            <div className="hidden lg:block">
              <AccountSwitcher />
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-4">
            <ul className="flex gap-2">
              <li>
                <Link
                  href={dashboardHref}
                  className="font-medium transition-colors px-4 py-2 rounded text-white hover:text-red-500 hover:bg-white hover:bg-opacity-10 whitespace-nowrap"
                >
                  Dashboard
                </Link>
              </li>
            </ul>

            <CurrencySwitcher />
            <UserMenu />
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-white hover:text-red-500 transition-colors"
            aria-label="Toggle menu"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              {isMobileMenuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-4 pb-4 border-t border-gray-700">
            <div className="mt-4 px-2">
              <AccountSwitcher />
            </div>

            <ul className="space-y-2 mt-4">
              <li>
                <Link
                  href={dashboardHref}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block font-medium transition-colors px-4 py-2 rounded text-white hover:text-red-500 hover:bg-white hover:bg-opacity-10"
                >
                  Dashboard
                </Link>
              </li>
            </ul>

            <div className="mt-4 px-2">
              <CurrencySwitcher />
            </div>

            <div className="mt-4">
              <UserMenu
                mobile
                onNavigate={() => setIsMobileMenuOpen(false)}
              />
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
