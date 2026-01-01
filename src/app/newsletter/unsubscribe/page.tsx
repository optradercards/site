'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

function UnsubscribeContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'invalid'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handleUnsubscribe = async () => {
      if (!token) {
        setStatus('invalid');
        setMessage('Invalid or missing unsubscribe token.');
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc('unsubscribe_with_token', {
          p_token: token,
        });

        if (error) {
          console.error('Unsubscribe error:', error);
          setStatus('error');
          setMessage('An error occurred. Please try again later.');
          return;
        }

        if (data && data.length > 0) {
          const result = data[0];
          if (result.success) {
            setStatus('success');
            setMessage('You have been successfully unsubscribed from our newsletter.');
          } else {
            setStatus('error');
            setMessage(result.message || 'Unable to unsubscribe. The link may have expired.');
          }
        } else {
          setStatus('error');
          setMessage('Unable to process your request.');
        }
      } catch (err) {
        console.error('Exception during unsubscribe:', err);
        setStatus('error');
        setMessage('An unexpected error occurred.');
      }
    };

    handleUnsubscribe();
  }, [token]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Processing...
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we unsubscribe you from our newsletter.
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600 dark:text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Unsubscribed Successfully
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              We're sorry to see you go. If you change your mind, you can always subscribe again on our website.
            </p>
          </>
        )}

        {(status === 'error' || status === 'invalid') && (
          <>
            <div className="w-12 h-12 bg-red-100 dark:bg-red-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {status === 'invalid' ? 'Invalid Link' : 'Unable to Unsubscribe'}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {message}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              If you continue to receive emails, please contact our support team for assistance.
            </p>
          </>
        )}

        <Link
          href="/"
          className="inline-block px-6 py-3 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition-colors"
        >
          Back to Home
        </Link>

        {status === 'error' && (
          <Link
            href="/contact"
            className="inline-block ml-3 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-semibold rounded-lg transition-colors"
          >
            Contact Support
          </Link>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500 mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">Loading...</h1>
        </div>
      </div>
    }>
      <UnsubscribeContent />
    </Suspense>
  );
}
