'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { toast } from 'sonner';
import DeleteCampaignButton from '@/components/DeleteCampaignButton';

type Campaign = {
  id: string;
  subject: string;
  from_name: string;
  from_email: string;
  preview_text: string;
  html_content: string;
  status: string;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  sent_at: string;
  created_at: string;
};

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [subscriberCount, setSubscriberCount] = useState(0);

  useEffect(() => {
    loadCampaign();
    loadSubscriberCount();
  }, [params.id]);

  const loadCampaign = async () => {
    try {
      const { data, error } = await supabase
        .schema('newsletter')
        .from('campaigns')
        .select('*')
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setCampaign(data);
    } catch (error) {
      console.error('Error loading campaign:', error);
      toast.error('Failed to load campaign');
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscriberCount = async () => {
    try {
      const { count } = await supabase
        .schema('newsletter')
        .from('subscribers')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'subscribed');

      setSubscriberCount(count || 0);
    } catch (error) {
      console.error('Error loading subscriber count:', error);
    }
  };

  const handleSend = async () => {
    if (!campaign) return;

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaign.id,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMessage = 'Failed to send campaign';
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();
      toast.success(result.message);
      setShowConfirm(false);
      loadCampaign();
    } catch (error: any) {
      console.error('Error sending campaign:', error);
      toast.error(error.message || 'Failed to send campaign');
    } finally {
      setIsSending(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-500"></div>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Campaign not found</p>
        <Link
          href="/admin/newsletter/campaigns"
          className="text-red-600 dark:text-red-400 hover:underline mt-4 inline-block"
        >
          Back to Campaigns
        </Link>
      </div>
    );
  }

  const successRate = campaign.total_recipients > 0
    ? ((campaign.successful_sends / campaign.total_recipients) * 100).toFixed(1)
    : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Campaign Details</h1>
          <p className="text-gray-600 dark:text-gray-400">{campaign.subject}</p>
        </div>
        <Link
          href="/admin/newsletter/campaigns"
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ← Back to Campaigns
        </Link>
      </div>

      {/* Campaign Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Status</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2 capitalize">{campaign.status}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Recipients</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{campaign.total_recipients || 0}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Success Rate</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{successRate}%</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Failed</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">{campaign.failed_sends || 0}</p>
        </div>
      </div>

      {/* Campaign Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Campaign Information</h2>
          <dl className="grid grid-cols-2 gap-4">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">From Name</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{campaign.from_name}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">From Email</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{campaign.from_email}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Created</dt>
              <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                {new Date(campaign.created_at).toLocaleString()}
              </dd>
            </div>
            {campaign.sent_at && (
              <div>
                <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Sent</dt>
                <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(campaign.sent_at).toLocaleString()}
                </dd>
              </div>
            )}
          </dl>
        </div>

        {campaign.preview_text && (
          <div>
            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Preview Text</dt>
            <dd className="mt-1 text-sm text-gray-900 dark:text-gray-100">{campaign.preview_text}</dd>
          </div>
        )}

        {/* Send Button */}
        {campaign.status === 'draft' && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700 flex gap-3">
            <Link
              href={`/admin/newsletter/campaigns/${campaign.id}/edit`}
              className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors"
            >
              Edit Campaign
            </Link>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={subscriberCount === 0}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-semibold rounded-lg transition-colors disabled:cursor-not-allowed"
            >
              Send to {subscriberCount} Subscribers
            </button>
            <DeleteCampaignButton
              campaignId={campaign.id}
              campaignSubject={campaign.subject}
              redirectAfterDelete="/admin/newsletter/campaigns"
              className="px-6 py-3 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-lg transition-colors"
            />
            {subscriberCount === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                No active subscribers to send to
              </p>
            )}
          </div>
        )}
      </div>

      {/* HTML Preview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Email Preview</h2>
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <iframe
            srcDoc={campaign.html_content}
            className="w-full h-96"
            title="Email preview"
            sandbox="allow-same-origin"
          />
        </div>
      </div>

      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Confirm Send</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you sure you want to send this campaign to {subscriberCount} subscribers? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={isSending}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSend}
                disabled={isSending}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
