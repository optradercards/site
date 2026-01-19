'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ImportIndexPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to cards import as the default
    router.replace('/admin/import/cards');
  }, [router]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-8">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white mb-4">Redirecting...</h1>
        <p className="text-slate-300">Taking you to the import page...</p>
      </div>
    </div>
  );
}
