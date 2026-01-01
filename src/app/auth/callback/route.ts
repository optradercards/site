import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const returnUrl = requestUrl.searchParams.get('returnUrl') || '/';
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // Handle error from Supabase
  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(errorDescription || error)}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
        requestUrl.origin,
      ),
    );
  }

  // Exchange code for session
  if (code) {
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      console.error('Failed to exchange code for session:', exchangeError);
      return NextResponse.redirect(
        new URL(
          `/login?error=${encodeURIComponent('Failed to complete sign in. Please try again.')}${returnUrl ? `&returnUrl=${encodeURIComponent(returnUrl)}` : ''}`,
          requestUrl.origin,
        ),
      );
    }

    // Successfully authenticated, redirect to return URL
    return NextResponse.redirect(new URL(returnUrl, requestUrl.origin));
  }

  // No code or error, redirect to login
  return NextResponse.redirect(new URL(`/login${returnUrl ? `?returnUrl=${encodeURIComponent(returnUrl)}` : ''}`, requestUrl.origin));
}