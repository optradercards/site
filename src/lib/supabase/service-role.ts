import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role Supabase client. Bypasses RLS and exposes auth admin APIs.
// NEVER import this from client components. Server-side only.
//
// Returns null if SUPABASE_SERVICE_ROLE_KEY is not configured so callers can
// gracefully degrade (e.g. skip sending an invite email but still save the
// contact + invite row).

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
