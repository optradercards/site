import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import Link from 'next/link';
import ExportButton from '@/components/ExportButton';

export default async function NewsletterPage() {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    redirect('/login?error_type=unauthorized&returnUrl=/admin/newsletter');
  }

  const supabase = await createClient();

  // Fetch subscriber stats
  const [subscribedCount, unsubscribedCount, bouncedCount, complainedCount, eventsData] = await Promise.all([
    supabase
      .schema('newsletter')
      .from('subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'subscribed'),
    supabase
      .schema('newsletter')
      .from('subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'unsubscribed'),
    supabase
      .schema('newsletter')
      .from('subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'bounced'),
    supabase
      .schema('newsletter')
      .from('subscribers')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'complained'),
    supabase
      .schema('newsletter')
      .from('events')
      .select('*')
      .order('received_at', { ascending: false })
      .limit(20),
  ]);

  // Fetch recent subscribers
  const { data: recentSubscribers } = await supabase
    .schema('newsletter')
    .from('subscribers')
    .select('*')
    .eq('status', 'subscribed')
    .order('subscribed_at', { ascending: false })
    .limit(10);

  const stats = [
    { label: 'Subscribed', value: subscribedCount.count, color: 'bg-green-500' },
    { label: 'Unsubscribed', value: unsubscribedCount.count, color: 'bg-red-500' },
    { label: 'Bounced', value: bouncedCount.count, color: 'bg-yellow-500' },
    { label: 'Complained', value: complainedCount.count, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Newsletter Management</h1>
          <p className="text-gray-600 dark:text-gray-400">Manage subscriber list and track SendGrid events</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/newsletter/campaigns"
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Campaigns
          </Link>
          <ExportButton status="all" />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
            <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stat.value}</p>
            <div className={`${stat.color} h-1 rounded-full mt-4`} />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Subscribers */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recent Subscribers</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentSubscribers && recentSubscribers.length > 0 ? (
              recentSubscribers.map((subscriber) => (
                <div
                  key={subscriber.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100 text-sm">{subscriber.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(subscriber.subscribed_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-xs font-semibold">
                    Active
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">No subscribers yet</p>
            )}
          </div>
        </div>

        {/* Recent Events */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Recent Events</h2>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {eventsData.data && eventsData.data.length > 0 ? (
              eventsData.data.map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded text-sm">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">{event.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(event.received_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold ${
                      event.event_type === 'unsubscribe'
                        ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                        : event.event_type === 'bounce'
                        ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                        : event.event_type === 'complaint'
                        ? 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200'
                        : 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200'
                    }`}
                  >
                    {event.event_type}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-6">No events yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Webhook Setup Info */}
      <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
        <h3 className="text-lg font-bold text-blue-900 dark:text-blue-100 mb-2">SendGrid Webhook Configuration</h3>
        <p className="text-blue-800 dark:text-blue-200 text-sm mb-4">
          To track email events (unsubscribes, bounces, complaints), configure the SendGrid webhook:
        </p>
        <div className="bg-white dark:bg-gray-800 p-4 rounded border border-blue-200 dark:border-blue-700 font-mono text-sm text-gray-900 dark:text-gray-100 break-all">
          {typeof window !== 'undefined'
            ? `${window.location.origin.replace('https://', '').replace('http://', '')}.supabase.co/functions/v1/sendgrid-webhook`
            : 'your-project.supabase.co/functions/v1/sendgrid-webhook'}
        </div>
        <p className="text-blue-800 dark:text-blue-200 text-xs mt-2">
          In SendGrid Dashboard → Mail Settings → Event Webhook → HTTP POST URL, paste the URL above and select the events you want to track.
        </p>
        <p className="text-blue-800 dark:text-blue-200 text-xs mt-3 font-semibold">
          Note: Make sure to include your Supabase project URL (e.g., https://your-project.supabase.co/functions/v1/sendgrid-webhook)
        </p>
      </div>
    </div>
  );
}
