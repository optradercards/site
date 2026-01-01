import { createClient as createBrowserClient } from './supabase/client';
import { createClient as createServerClient } from './supabase/server';

export async function isAdmin(): Promise<boolean> {
  try {
    // Server-side (cookies)
    if (typeof window === 'undefined') {
      const supabase = await createServerClient();
      const { data, error } = await supabase.rpc('is_admin');
      if (error) throw error;
      return data === true;
    }
    
    // Client-side (browser)
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      console.warn('No active session found for admin check.');
      return false;
    }

    const { data, error } = await supabase.rpc('is_admin');
    if (error) throw error;
    return data === true;
  } catch (error) {
    console.error('Error checking admin status:', error);
    return false;
  }
}

export async function getCurrentUser() {
  try {
    // Server-side
    if (typeof window === 'undefined') {
      const supabase = await createServerClient();
      const { data: { session } } = await supabase.auth.getSession();
      return session?.user ?? null;
    }
    
    // Client-side
    const supabase = createBrowserClient();
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}
