"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useCart, useCartCount, useRemoveFromCart } from "@/hooks/useCart";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";
import SearchBar from "@/components/SearchBar";


export default function SiteHeader() {
  const { user } = useUser();
  const router = useRouter();
  const supabase = createClient();
  const { data: cartCount } = useCartCount();
  const { data: cartItems } = useCart();
  const { data: rates } = useExchangeRates();
  const removeFromCart = useRemoveFromCart();
  const [isAccountOpen, setIsAccountOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const cartRef = useRef<HTMLDivElement>(null);

  const displayCurrency = "AUD";
  const fmtPrice = (cents: number | null, sourceCurrency: string) =>
    formatPrice(cents, displayCurrency, rates ?? {}, sourceCurrency);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setIsAccountOpen(false);
      }
      if (cartRef.current && !cartRef.current.contains(e.target as Node)) {
        setIsCartOpen(false);
      }
    }
    if (isAccountOpen || isCartOpen) {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [isAccountOpen, isCartOpen]);

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
            <div ref={cartRef} className="relative">
              <button
                onClick={() => {
                  if (!user) { router.push("/login"); return; }
                  setIsCartOpen(!isCartOpen);
                  setIsAccountOpen(false);
                }}
                className="text-gray-300 hover:text-white transition-colors font-medium inline-flex items-center gap-1 relative"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                </svg>
                Cart
                {!!cartCount && cartCount > 0 && (
                  <span className="absolute -top-2 -right-3 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {cartCount > 9 ? "9+" : cartCount}
                  </span>
                )}
              </button>
              {isCartOpen && (
                <div className="absolute right-0 mt-1.5 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50 text-sm">
                  {!cartItems || cartItems.length === 0 ? (
                    <div className="p-6 text-center">
                      <svg className="w-10 h-10 mx-auto text-gray-300 dark:text-gray-600 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
                      </svg>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">Your cart is empty</p>
                    </div>
                  ) : (
                    <>
                      <div className="max-h-72 overflow-y-auto">
                        {cartItems.slice(0, 5).map((item) => (
                          <div key={item.id} className="flex gap-3 p-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                            <Link
                              href={`/listing/${item.product_id}`}
                              onClick={() => setIsCartOpen(false)}
                              className="shrink-0"
                            >
                              <div className="w-10 h-14 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden">
                                {item.image_url ? (
                                  <img src={item.image_url} alt={item.title} className="w-full h-full object-contain" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                  </div>
                                )}
                              </div>
                            </Link>
                            <div className="flex-1 min-w-0">
                              <Link
                                href={`/listing/${item.product_id}`}
                                onClick={() => setIsCartOpen(false)}
                                className="text-xs font-medium text-gray-800 dark:text-gray-200 hover:text-red-500 transition-colors line-clamp-1"
                              >
                                {item.title}
                              </Link>
                              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                Qty: {item.quantity}
                              </p>
                              <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                                {fmtPrice(item.price_cents != null ? item.price_cents * item.quantity : null, item.currency)}
                              </p>
                            </div>
                            <button
                              onClick={() => removeFromCart.mutate(item.id)}
                              className="shrink-0 text-gray-400 hover:text-red-500 transition-colors self-start mt-0.5"
                              aria-label="Remove"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                      {cartItems.length > 5 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-1.5 border-t border-gray-100 dark:border-gray-700">
                          +{cartItems.length - 5} more {cartItems.length - 5 === 1 ? "item" : "items"}
                        </p>
                      )}
                      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex items-center justify-between mb-2.5">
                          <span className="text-xs text-gray-500 dark:text-gray-400">Subtotal</span>
                          <span className="text-sm font-bold text-gray-900 dark:text-gray-100">
                            A${((cartItems.reduce((sum, item) => {
                              if (item.price_cents == null) return sum;
                              const from = item.currency.toLowerCase();
                              const fromRate = from === "usd" ? 1 : (rates?.[from] ?? 1);
                              const toRate = rates?.["aud"] ?? 1;
                              return sum + (item.price_cents * item.quantity * toRate) / fromRate;
                            }, 0)) / 100).toFixed(2)}
                          </span>
                        </div>
                        <Link
                          href="/cart"
                          onClick={() => setIsCartOpen(false)}
                          className="block w-full py-2 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-xs text-center"
                        >
                          View Cart ({cartCount})
                        </Link>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
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
              className="p-2 text-gray-300 hover:text-white transition-colors relative"
              aria-label="Cart"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              {!!cartCount && cartCount > 0 && (
                <span className="absolute top-0.5 right-0 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
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
