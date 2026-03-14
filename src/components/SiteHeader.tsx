"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";
import SearchBar from "@/components/SearchBar";


export default function SiteHeader() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = createClient();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  // Close account dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
    }
    if (isAccountOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isAccountOpen]);

  const displayName =
    user?.user_metadata?.full_name ||
    user?.email?.split("@")[0] ||
    "Account";

  return (
    <header className="bg-gray-800 dark:bg-gray-950 text-white shadow-lg sticky top-0 z-50">
      {/* Top Bar - hidden on mobile */}
      <div className="hidden md:block bg-gray-900 dark:bg-black border-b border-gray-700 dark:border-gray-800">
        <div className="container mx-auto px-4 flex items-center justify-between py-1.5 text-xs">
          <div className="flex items-center gap-1">
            {user ? (
              <div ref={accountRef} className="relative">
                <button
                  onClick={() => setIsAccountOpen(!isAccountOpen)}
                  className="text-gray-300 hover:text-white transition-colors font-medium inline-flex items-center gap-1"
                >
                  Hi, {displayName}
                  <svg
                    className={`w-3 h-3 transition-transform ${isAccountOpen ? "rotate-180" : ""}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {isAccountOpen && (
                  <div className="absolute left-0 mt-1.5 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 py-1 text-sm">
                    <Link
                      href="/settings/profile"
                      onClick={() => setIsAccountOpen(false)}
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Profile Settings
                    </Link>
                    <Link
                      href="/settings/addresses"
                      onClick={() => setIsAccountOpen(false)}
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Addresses
                    </Link>
                    <Link
                      href="/settings/security"
                      onClick={() => setIsAccountOpen(false)}
                      className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Security
                    </Link>
                    <div className="border-t border-gray-200 dark:border-gray-700 my-1" />
                    <button
                      onClick={async () => {
                        setIsAccountOpen(false);
                        await supabase.auth.signOut();
                        router.push("/");
                      }}
                      className="block w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Link
                href="/login"
                className="text-gray-300 hover:text-white transition-colors font-medium"
              >
                Sign in
              </Link>
            )}
            <span className="text-gray-600 mx-1">|</span>
            <Link
              href="/become-a-trader"
              className="text-gray-300 hover:text-white transition-colors font-medium"
            >
              Start Trading
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={user ? "/become-a-trader" : "/login"}
              className="text-gray-300 hover:text-white transition-colors"
            >
              Sell
            </Link>
            <span className="text-gray-600">|</span>
            <Link
              href={user ? "/watchlist" : "/login"}
              className="text-gray-300 hover:text-white transition-colors"
            >
              Watchlist
            </Link>
            <span className="text-gray-600">|</span>
            {user ? (
              <Link
                href="/settings/profile"
                className="text-gray-300 hover:text-white transition-colors"
              >
                My OP Trader
              </Link>
            ) : (
              <Link
                href="/login"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Sign In
              </Link>
            )}
            <span className="text-gray-600">|</span>
            <Link
              href={user ? "/notifications" : "/login"}
              className="text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              Notifications
            </Link>
            <span className="text-gray-600">|</span>
            <Link
              href={user ? "/cart" : "/login"}
              className="text-gray-300 hover:text-white transition-colors inline-flex items-center gap-1"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              Cart
            </Link>
          </div>
        </div>
      </div>

      {/* Main header row */}
      <div className="container mx-auto px-4 py-3 md:py-5">
        <div className="flex items-center gap-4 md:gap-6">
          <Link href="/" className="shrink-0">
            <Image
              src="/logos/OP_Trader_FullLogo.png"
              alt="OP Trader"
              width={220}
              height={44}
              priority
              className="h-8 md:h-11 w-auto"
            />
          </Link>

          {/* Search bar - desktop inline */}
          <div className="hidden md:flex flex-1">
            <SearchBar />
          </div>

          {/* Mobile action icons */}
          <div className="flex md:hidden items-center gap-2 ml-auto">
            <Link
              href={user ? "/notifications" : "/login"}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              aria-label="Notifications"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </Link>
            <Link
              href={user ? "/cart" : "/login"}
              className="p-2 text-gray-300 hover:text-white transition-colors"
              aria-label="Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
            </Link>
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 text-white hover:text-red-500 transition-colors"
              aria-label="Toggle menu"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {isMobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile search row - always visible */}
        <div className="md:hidden container mx-auto py-4">
          <SearchBar />
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-gray-700 bg-gray-800 dark:bg-gray-950">

          {/* Mobile Navigation Links */}
          <nav className="container mx-auto px-4 pb-4">
            <ul className="space-y-1 mt-2">
              {user ? (
                <>
                  <li className="px-3 py-2 text-sm text-gray-400 font-medium">
                    Hi, {displayName}
                  </li>
                  <li>
                    <Link
                      href="/settings/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      My OP Trader
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings/profile"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Profile Settings
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings/addresses"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Addresses
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/settings/security"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Security
                    </Link>
                  </li>
                </>
              ) : (
                <li>
                  <Link
                    href="/login"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                  >
                    Sign In
                  </Link>
                </li>
              )}

              <li className="border-t border-gray-700 my-2" />

              <li>
                <Link
                  href="/become-a-trader"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Start Trading
                </Link>
              </li>
              <li>
                <Link
                  href={user ? "/become-a-trader" : "/login"}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Sell
                </Link>
              </li>
              <li>
                <Link
                  href={user ? "/watchlist" : "/login"}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="block px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                >
                  Watchlist
                </Link>
              </li>

              {user && (
                <>
                  <li className="border-t border-gray-700 my-2" />
                  <li>
                    <button
                      onClick={async () => {
                        setIsMobileMenuOpen(false);
                        await supabase.auth.signOut();
                        router.push("/");
                      }}
                      className="block w-full text-left px-3 py-2.5 rounded-lg text-gray-200 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      Sign Out
                    </button>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>
      )}
    </header>
  );
}
