'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { toast } from 'sonner';

export default function CreateCampaignPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    fromName: 'OP Trader',
    fromEmail: 'newsletter@optrader.cards',
    previewText: '',
    htmlContent: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSaveDraft = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .schema('newsletter')
        .from('campaigns')
        .insert({
          subject: formData.subject,
          from_name: formData.fromName,
          from_email: formData.fromEmail,
          preview_text: formData.previewText,
          html_content: formData.htmlContent,
          status: 'draft',
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success('Draft saved successfully!');
      router.push(`/admin/newsletter/campaigns/${data.id}`);
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error.message || 'Failed to save draft');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error('Please enter a test email address');
      return;
    }

    setIsSending(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Create a temporary campaign for testing
      const { data: campaign, error: campaignError } = await supabase
        .schema('newsletter')
        .from('campaigns')
        .insert({
          subject: formData.subject,
          from_name: formData.fromName,
          from_email: formData.fromEmail,
          preview_text: formData.previewText,
          html_content: formData.htmlContent,
          status: 'draft',
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      const response = await fetch('/api/admin/newsletter/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          campaignId: campaign.id,
          testEmail,
        }),
      });

      const contentType = response.headers.get('content-type');
      if (!response.ok) {
        let errorMessage = 'Failed to send test email';
        if (contentType?.includes('application/json')) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          console.error('Non-JSON error response:', text);
        }
        throw new Error(errorMessage);
      }

      toast.success(`Test email sent to ${testEmail}!`);
      setShowTestDialog(false);
      setTestEmail('');
    } catch (error: any) {
      console.error('Error sending test:', error);
      toast.error(error.message || 'Failed to send test email');
    } finally {
      setIsSending(false);
    }
  };

  const defaultTemplate = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formData.subject}</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f4f4f4; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(to right, #dc2626, #b91c1c); padding: 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 32px;">OP Trader</h1>
              <p style="color: #fee2e2; margin: 10px 0 0 0;">Trade smart, earn better</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="color: #1f2937; margin-top: 0;">Hello Trader!</h2>
              
              <p style="color: #4b5563; line-height: 1.6;">
                [Your newsletter content goes here]
              </p>
              
              <p style="color: #4b5563; line-height: 1.6;">
                Thanks for being part of the OP Trader community!
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://optrader.com" style="background-color: #dc2626; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Visit OP Trader</a>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 30px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0 0 10px 0;">
                OP Trader - Your One Piece TCG Marketplace
              </p>
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                <a href="{{unsubscribe_url}}" style="color: #9ca3af; text-decoration: underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">Create Campaign</h1>
          <p className="text-gray-600 dark:text-gray-400">Compose and send your newsletter</p>
        </div>
        <Link
          href="/admin/newsletter/campaigns"
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ← Back to Campaigns
        </Link>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
        {/* Campaign Details */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Subject Line *
            </label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="Your awesome subject line"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                From Name
              </label>
              <input
                type="text"
                name="fromName"
                value={formData.fromName}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                From Email
              </label>
              <input
                type="email"
                name="fromEmail"
                value={formData.fromEmail}
                onChange={handleChange}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              Preview Text
            </label>
            <input
              type="text"
              name="previewText"
              value={formData.previewText}
              onChange={handleChange}
              placeholder="Text shown in email client preview"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
              HTML Content *
            </label>
            <textarea
              name="htmlContent"
              value={formData.htmlContent}
              onChange={handleChange}
              placeholder="Paste your HTML email template here"
              rows={15}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-mono text-sm"
              required
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Use <code>{'{{unsubscribe_url}}'}</code> for the unsubscribe link
            </p>
            {!formData.htmlContent && (
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, htmlContent: defaultTemplate }))}
                className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Load default template
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSaveDraft}
            disabled={isLoading || !formData.subject || !formData.htmlContent}
            className="px-6 py-2 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            {isLoading ? 'Saving...' : 'Save Draft'}
          </button>

          <button
            onClick={() => setShowTestDialog(true)}
            disabled={!formData.subject || !formData.htmlContent}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
          >
            Send Test Email
          </button>
        </div>
      </div>

      {/* Test Email Dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Send Test Email</h3>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowTestDialog(false)}
                className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={isSending || !testEmail}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition-colors disabled:cursor-not-allowed"
              >
                {isSending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
