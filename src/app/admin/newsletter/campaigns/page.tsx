import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { isAdmin } from '@/lib/admin';
import Link from 'next/link';
import DeleteCampaignButton from '@/components/DeleteCampaignButton';

export default async function CampaignsPage() {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    redirect('/login?error_type=unauthorized&returnUrl=/admin/newsletter/campaigns');
  }

  const supabase = await createClient();

  const { data: campaigns } = await supabase
    .schema('newsletter')
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200';
      case 'sending':
        return 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200';
      case 'draft':
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
      case 'failed':
        return 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Newsletter Campaigns</h1>
          <p className="text-gray-600 dark:text-gray-400">Create and manage your newsletter campaigns</p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin/newsletter"
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            ← Back to Subscribers
          </Link>
          <Link
            href="/admin/newsletter/campaigns/create"
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
          >
            Create Campaign
          </Link>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {campaigns && campaigns.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Recipients
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Success Rate
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {campaigns.map((campaign) => {
                const successRate = campaign.total_recipients > 0
                  ? ((campaign.successful_sends / campaign.total_recipients) * 100).toFixed(1)
                  : '0';

                return (
                  <tr key={campaign.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        {campaign.subject}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        From: {campaign.from_name}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(campaign.status)}`}>
                        {campaign.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                      {campaign.total_recipients || 0}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 dark:text-gray-100">
                        {successRate}%
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {campaign.successful_sends || 0} sent, {campaign.failed_sends || 0} failed
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                      {new Date(campaign.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex gap-3">
                        {campaign.status === 'draft' && (
                          <>
                            <Link
                              href={`/admin/newsletter/campaigns/${campaign.id}/edit`}
                              className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                            >
                              Edit
                            </Link>
                            <DeleteCampaignButton
                              campaignId={campaign.id}
                              campaignSubject={campaign.subject}
                            />
                          </>
                        )}
                        <Link
                          href={`/admin/newsletter/campaigns/${campaign.id}`}
                          className="text-red-600 dark:text-red-400 hover:underline text-sm font-medium"
                        >
                          View Details
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400 mb-4">No campaigns yet</p>
            <Link
              href="/admin/newsletter/campaigns/create"
              className="inline-block px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
            >
              Create Your First Campaign
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
