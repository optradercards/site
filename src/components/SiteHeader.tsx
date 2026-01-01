'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

const navItems: Array<{ href: string; label: string }> = [
  { href: '/', label: 'Home' },
  { href: '/#marketplace', label: 'Marketplace' },
  { href: '/#collection', label: 'My Collection' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
  { href: '/become-a-dealer', label: 'Become a Dealer' },
];

export default function SiteHeader() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (isMounted) {
        setSession(newSession);
      }
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    router.push('/');
  };

  return (
    <header className="bg-gray-800 dark:bg-gray-950 text-white shadow-lg sticky top-0 z-50">
      <nav className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center flex-wrap gap-4">
          <Link href="/" className="shrink-0">
            <Image
              src="/logos/OP_Trader_FullLogo.png"
              alt="OP Trader"
              width={220}
              height={44}
              priority
              className="h-11 w-auto"
            />
          </Link>

          <div className="flex items-center gap-4">
            <ul className="flex gap-2 md:gap-4 flex-wrap">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="font-medium transition-colors px-4 py-2 rounded text-white hover:text-red-500 hover:bg-white hover:bg-opacity-10"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>

            <div className="flex gap-2 items-center">
              {session ? (
                <div className="relative">
                  <button
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 transition-colors font-semibold text-white"
                    aria-label="User menu"
                  >
                    {session.user.email?.[0]?.toUpperCase() || 'U'}
                  </button>
                  
                  {isDropdownOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50">
                      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                          {session.user.email}
                        </p>
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Logout
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="px-4 py-2 text-white hover:text-red-500 transition-colors font-medium"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/signup"
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                  >
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
