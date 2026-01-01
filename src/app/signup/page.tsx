import { Suspense } from 'react';
import SignupClient from '@/components/SignupClient';

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <main className="container mx-auto px-4 py-12 max-w-lg">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-3">
              <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Sign Up</h1>
              <p className="text-sm text-gray-600 dark:text-gray-300">Loading…</p>
            </div>
          </main>
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}

