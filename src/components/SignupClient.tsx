'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { type AuthError, type Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

type SignupFormData = {
  email: string;
  firstName: string;
};

export default function SignupClient() {
  const searchParams = useSearchParams();
  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<SignupFormData>({
    defaultValues: {
      email: '',
      firstName: ''
    }
  });
  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Prefill email from query parameter if redirected from login
    const emailParam = searchParams.get('email');
    if (emailParam) {
      setValue('email', emailParam);
    }

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
  }, [searchParams, setValue]);

  const normalizeError = (err: AuthError | null) => {
    if (!err) return null;
    return err.message;
  };

  const onSubmit = async (data: SignupFormData) => {
    setError(null);
    setMessage(null);

    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : undefined;

      const { error } = await supabase.auth.signInWithOtp({
        email: data.email,
        options: {
          emailRedirectTo: redirectTo,
          shouldCreateUser: true,
          data: {
            first_name: data.firstName.trim(),
          },
        },
      });
      if (error) {
        setError(normalizeError(error));
        return;
      }

      setMessage('Check your email to finish creating your account.');
    } catch {
      setError('An unexpected error occurred. Please try again.');
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
        <h1 className="text-4xl font-bold mb-6 text-gray-800 dark:text-gray-100">Sign Up</h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-4">
          {session ? (
            <>
              <div className="space-y-1">
                <p className="text-gray-800 dark:text-gray-100 font-semibold">You&apos;re signed in.</p>
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
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Already have an account?{' '}
                <Link href="/login" className="text-red-500 hover:text-red-600 font-medium">
                  Sign in
                </Link>
              </p>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="firstName">
                    First name
                  </label>
                  <input
                    id="firstName"
                    type="text"
                    autoComplete="given-name"
                    {...register('firstName', {
                      required: 'First name is required',
                      minLength: { value: 1, message: 'First name must not be empty' }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    placeholder="Your first name"
                  />
                  {errors.firstName && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errors.firstName.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-200" htmlFor="email">
                    Email
                  </label>
                  <input
                    id="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    {...register('email', {
                      required: 'Email is required',
                      minLength: { value: 4, message: 'Email must be at least 4 characters' },
                      pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Please enter a valid email' }
                    })}
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                    placeholder="you@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600 dark:text-red-400">{errors.email.message}</p>
                  )}
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
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {isSubmitting ? 'Please wait…' : 'Email me a sign-up link'}
                </button>
              </form>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
