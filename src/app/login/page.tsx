'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { type AuthError, type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type Mode = 'sign-in' | 'sign-up';

type FormState = {
  email: string;
  firstName: string;
};

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('sign-in');
  const [form, setForm] = useState<FormState>({ email: '', firstName: '' });
  const [session, setSession] = useState<Session | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const isValid = useMemo(() => {
    return form.email.trim().length > 3;
  }, [form.email]);

  useEffect(() => {
    let isMounted = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!isMounted) return;
      if (error) {
        setError(error.message);
        return;
      }
      setSession(data.session ?? null);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      isMounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const normalizeError = (err: AuthError | null) => {
    if (!err) return null;
    return err.message;
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (!isValid) {
      setError('Please enter a valid email.');
      return;
    }

    setIsSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/login`;

      const { error } = await supabase.auth.signInWithOtp({
        email: form.email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: mode === 'sign-up',
          data:
            mode === 'sign-up'
              ? {
                  first_name: form.firstName.trim() || undefined,
                }
              : undefined,
        },
      });
      if (error) {
        setError(normalizeError(error));
        return;
      }

      if (mode === 'sign-in') {
        setMessage('Check your email for a sign-in link.');
      } else {
        setMessage('Check your email to finish creating your account.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSignOut = async () => {
    setError(null);
    setMessage(null);
    const { error } = await supabase.auth.signOut();
    if (error) {
      setError(error.message);
      return;
    }
    setMessage('Signed out.');
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-12 max-w-lg">
        <div className="mb-6">
          <Link href="/" className="text-sm text-gray-600 dark:text-gray-300 hover:text-red-500 transition-colors">
            Back to Home
          </Link>
        </div>
        <h1 className="text-4xl font-bold mb-6 text-gray-800 dark:text-gray-100">Login</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
          {session ? (
            <>
              <div className="space-y-1">
                <p className="text-gray-800 dark:text-gray-100 font-semibold">You’re signed in.</p>
                <p className="text-sm text-gray-600 dark:text-gray-300">{session.user.email}</p>
              </div>

              {error ? (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                  {error}
                </div>
              ) : null}

              {message ? (
                <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                  {message}
                </div>
              ) : null}

              <button
                type="button"
                onClick={onSignOut}
                className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white hover:bg-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-200 transition-colors font-semibold"
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-in');
                    setError(null);
                    setMessage(null);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    mode === 'sign-in'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-950'
                  }`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('sign-up');
                    setError(null);
                    setMessage(null);
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
                    mode === 'sign-up'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-950'
                  }`}
                >
                  Sign up
                </button>
              </div>

              <form onSubmit={onSubmit} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                {mode === 'sign-up' ? (
                  <>
                    <div className="space-y-1">
                      <label
                        className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                        htmlFor="firstName"
                      >
                        First name
                      </label>
                      <input
                        id="firstName"
                        type="text"
                        autoComplete="given-name"
                        value={form.firstName}
                        onChange={(e) => setForm((prev) => ({ ...prev, firstName: e.target.value }))}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                        placeholder="Your first name"
                      />
                    </div>
                  </>
                ) : null}

                {error ? (
                  <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                    {message}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {isSubmitting ? 'Please wait…' : mode === 'sign-in' ? 'Email me a sign-in link' : 'Email me a sign-up link'}
                </button>
              </form>
            </>
          )}
        </div>

      </main>
    </div>
  );
}
