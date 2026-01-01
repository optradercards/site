'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';

function sanitizeNext(next: string | null): string {
  if (!next) return '/';
  if (!next.startsWith('/')) return '/';
  return next;
}

export default function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const next = sanitizeNext(searchParams.get('next'));
    const code = searchParams.get('code');

    if (!code) {
      router.replace(next);
      return;
    }

    supabase.auth.exchangeCodeForSession(code).then(({ error }) => {
      if (error) {
        setError(error.message);
        return;
      }

      router.replace(next);
    });
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-12 max-w-lg">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-3">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Signing you in…</h1>

          {error ? (
            <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-300">You can close this tab if you’re redirected.</p>
          )}
        </div>
      </main>
    </div>
  );
}
