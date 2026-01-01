import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();

    // Get the current user session to verify they're authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Check if user is admin
    const { data: isAdminData, error: adminError } = await supabase.rpc('is_admin');
    
    if (adminError || !isAdminData) {
      return new Response('Forbidden - Admin access required', { status: 403 });
    }

    // Get query params for filtering
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // 'all', 'subscribed', 'unsubscribed', 'bounced', 'complained'

    // Fetch subscribers based on filter
    let query = supabase
      .from('newsletter_subscribers')
      .select('email, status, subscribed_at, unsubscribed_at, created_at')
      .order('created_at', { ascending: false });

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: subscribers, error } = await query;

    if (error) {
      console.error('Error fetching subscribers:', error);
      return new Response('Error fetching subscribers', { status: 500 });
    }

    // Generate CSV
    const csvRows: string[] = [];
    
    // Header row
    csvRows.push('Email,Status,Subscribed At,Unsubscribed At,Created At');

    // Data rows
    if (subscribers) {
      for (const subscriber of subscribers) {
        const row = [
          subscriber.email,
          subscriber.status,
          subscriber.subscribed_at || '',
          subscriber.unsubscribed_at || '',
          subscriber.created_at || '',
        ];
        // Escape commas and quotes in fields
        const escapedRow = row.map(field => {
          const stringField = String(field);
          if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n')) {
            return `"${stringField.replace(/"/g, '""')}"`;
          }
          return stringField;
        });
        csvRows.push(escapedRow.join(','));
      }
    }

    const csv = csvRows.join('\n');
    const filename = `newsletter-subscribers-${status || 'all'}-${new Date().toISOString().split('T')[0]}.csv`;

    return new Response(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('Error in CSV export:', error);
    return new Response('Internal server error', { status: 500 });
  }
}
