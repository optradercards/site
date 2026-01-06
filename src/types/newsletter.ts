// Newsletter types extracted from database schema

export type SubscriberStatus =
  | "subscribed"
  | "unsubscribed"
  | "bounced"
  | "complained";

export type NewsletterEventType =
  | "unsubscribe"
  | "bounce"
  | "complaint"
  | "delivered"
  | "open"
  | "click"
  | "spamreport";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "sent"
  | "failed";

export type CampaignSendStatus =
  | "pending"
  | "sent"
  | "failed"
  | "bounced"
  | "opened"
  | "clicked";

export interface NewsletterSubscriber {
  email_id: string;
  status: SubscriberStatus;
  subscribed_at: string;
  unsubscribed_at: string | null;
  unsubscribe_token: string;
  created_at: string;
  updated_at: string;
}

export interface NewsletterEvent {
  id: string;
  email_id: string;
  event_type: NewsletterEventType;
  event_data: Record<string, any> | null;
  sendgrid_event_id: string | null;
  received_at: string;
  created_at: string;
}

export interface NewsletterCampaign {
  id: string;
  subject: string;
  from_name: string;
  from_email: string;
  preview_text: string | null;
  html_content: string;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  total_recipients: number;
  successful_sends: number;
  failed_sends: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterCampaignSend {
  campaign_id: string;
  email_id: string;
  status: CampaignSendStatus;
  sendgrid_message_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
}
