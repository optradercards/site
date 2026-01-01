import { createClient } from '@/lib/supabase/client';

export async function subscribeToNewsletter(email: string): Promise<{
  success: boolean;
  message: string;
}> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase.rpc('subscribe_to_newsletter', {
      p_email: email.toLowerCase(),
    });

    if (error) {
      console.error('Newsletter subscription error:', error);
      // Handle specific error cases
      if (error.message.includes('duplicate')) {
        return {
          success: false,
          message: 'This email is already subscribed.',
        };
      }
      return {
        success: false,
        message: error.message || 'Failed to subscribe. Please try again.',
      };
    }

    // RPC returns an array with one row containing success, message, and subscriber_id
    if (data && data.length > 0 && data[0].success) {
      return {
        success: true,
        message: data[0].message || 'Thanks for subscribing!',
      };
    }

    return {
      success: false,
      message: data?.[0]?.message || 'Failed to subscribe. Please try again.',
    };
  } catch (error) {
    console.error('Newsletter subscription error:', error);
    return {
      success: false,
      message: 'An unexpected error occurred. Please try again.',
    };
  }
}
