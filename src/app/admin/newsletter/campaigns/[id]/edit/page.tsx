"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { toast } from "sonner";

type Campaign = {
  id: string;
  subject: string;
  from_name: string;
  from_email: string;
  preview_text: string;
  html_content: string;
  status: string;
};

export default function EditCampaignPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmail, setTestEmail] = useState("");

  const [formData, setFormData] = useState({
    subject: "",
    fromName: "",
    fromEmail: "",
    previewText: "",
    htmlContent: "",
  });

  useEffect(() => {
    loadCampaign();
  }, [params.id]);

  const loadCampaign = async () => {
    try {
      const { data, error } = await supabase
        .from("newsletter_campaigns")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;

      // Only allow editing draft campaigns
      if (data.status !== "draft") {
        toast.error("Only draft campaigns can be edited");
        router.push(`/admin/newsletter/campaigns/${params.id}`);
        return;
      }

      setFormData({
        subject: data.subject,
        fromName: data.from_name,
        fromEmail: data.from_email,
        previewText: data.preview_text || "",
        htmlContent: data.html_content,
      });
    } catch (error) {
      console.error("Error loading campaign:", error);
      toast.error("Failed to load campaign");
      router.push("/admin/newsletter/campaigns");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("newsletter_campaigns")
        .update({
          subject: formData.subject,
          from_name: formData.fromName,
          from_email: formData.fromEmail,
          preview_text: formData.previewText,
          html_content: formData.htmlContent,
        })
        .eq("id", params.id);

      if (error) throw error;

      toast.success("Campaign updated successfully!");
      router.push(`/admin/newsletter/campaigns/${params.id}`);
    } catch (error) {
      console.error("Error updating campaign:", error);
      toast.error("Failed to update campaign");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendTest = async () => {
    if (!testEmail) {
      toast.error("Please enter a test email address");
      return;
    }

    setIsSendingTest(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const response = await fetch("/api/admin/newsletter/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          campaignId: params.id,
          testEmail: testEmail,
        }),
      });

      const contentType = response.headers.get("content-type");
      if (!response.ok) {
        let errorMessage = "Failed to send test email";
        if (contentType?.includes("application/json")) {
          const error = await response.json();
          errorMessage = error.error || errorMessage;
        } else {
          const text = await response.text();
          console.error("Non-JSON error response:", text);
        }
        throw new Error(errorMessage);
      }

      toast.success("Test email sent successfully!");
      setShowTestDialog(false);
      setTestEmail("");
    } catch (error: any) {
      console.error("Error sending test:", error);
      toast.error(error.message || "Failed to send test email");
    } finally {
      setIsSendingTest(false);
    }
  };

  const insertDefaultTemplate = () => {
    setFormData({
      ...formData,
      htmlContent: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${formData.subject || "Newsletter"}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 600px;
      margin: 0 auto;
      padding: 20px;
    }
    .header {
      text-align: center;
      padding: 20px 0;
      border-bottom: 2px solid #e5e7eb;
    }
    .content {
      padding: 30px 0;
    }
    .footer {
      text-align: center;
      padding: 20px 0;
      border-top: 2px solid #e5e7eb;
      font-size: 12px;
      color: #6b7280;
    }
    a {
      color: #dc2626;
      text-decoration: none;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #dc2626;
      color: white;
      text-decoration: none;
      border-radius: 6px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>OP Trader Newsletter</h1>
  </div>
  
  <div class="content">
    <h2>Your Headline Here</h2>
    <p>Your content goes here...</p>
    
    <a href="#" class="button">Call to Action</a>
    
    <p>More content...</p>
  </div>
  
  <div class="footer">
    <p>© ${new Date().getFullYear()} OP Trader. All rights reserved.</p>
    <p><a href="{{unsubscribe_url}}">Unsubscribe</a> from this newsletter</p>
  </div>
</body>
</html>`,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading campaign...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Edit Campaign
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Update your newsletter campaign
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href={`/admin/newsletter/campaigns/${params.id}`}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            onClick={() => setShowTestDialog(true)}
            disabled={isSaving}
            className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            Send Test
          </button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subject Line *
            </label>
            <input
              type="text"
              required
              value={formData.subject}
              onChange={(e) =>
                setFormData({ ...formData, subject: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="Your amazing newsletter subject"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Name *
              </label>
              <input
                type="text"
                required
                value={formData.fromName}
                onChange={(e) =>
                  setFormData({ ...formData, fromName: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="OP Trader"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                From Email *
              </label>
              <input
                type="email"
                required
                value={formData.fromEmail}
                onChange={(e) =>
                  setFormData({ ...formData, fromEmail: e.target.value })
                }
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                placeholder="newsletter@optrader.cards"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Preview Text
            </label>
            <input
              type="text"
              value={formData.previewText}
              onChange={(e) =>
                setFormData({ ...formData, previewText: e.target.value })
              }
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="This text appears in the email preview..."
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              This text appears in the email client preview pane
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                Email Content (HTML) *
              </label>
              <button
                type="button"
                onClick={insertDefaultTemplate}
                className="text-sm text-red-600 dark:text-red-400 hover:underline"
              >
                Insert Default Template
              </button>
            </div>
            <textarea
              required
              value={formData.htmlContent}
              onChange={(e) =>
                setFormData({ ...formData, htmlContent: e.target.value })
              }
              rows={20}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              placeholder="<html>...</html>"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Use{" "}
              <code className="bg-gray-100 dark:bg-gray-700 px-1 rounded">
                {"{{unsubscribe_url}}"}
              </code>{" "}
              to include the unsubscribe link
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3">
          <Link
            href={`/admin/newsletter/campaigns/${params.id}`}
            className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSaving}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving..." : "Update Campaign"}
          </button>
        </div>
      </form>

      {/* Test Email Dialog */}
      {showTestDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Send Test Email
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Send a test email to verify how your campaign looks
            </p>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowTestDialog(false);
                  setTestEmail("");
                }}
                disabled={isSendingTest}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendTest}
                disabled={isSendingTest || !testEmail}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSendingTest ? "Sending..." : "Send Test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
