// Support ticket status types
export type TicketStatus =
  | "open"
  | "in_progress"
  | "waiting_customer"
  | "resolved"
  | "closed";

// Support ticket priority types
export type TicketPriority = "low" | "medium" | "high" | "urgent";

// Sender type for messages
export type MessageSenderType = "admin" | "customer";

// Support ticket type (from support.tickets table)
export interface SupportTicket {
  id: string;
  account_id: string | null;
  email_id: string | null;
  category_id: string | null;
  subject: string;
  description: string | null;
  status: TicketStatus;
  priority: TicketPriority;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

// Support ticket view type (from support.tickets_view)
export interface SupportTicketView extends SupportTicket {
  category_name: string | null;
  assigned_to_name: string | null;
  customer_name: string | null;
  message_count: number;
  last_message_at: string | null;
  last_message_text: string | null;
  last_message_sender_type: MessageSenderType | null;
}

// Support message type (from support.messages table)
export interface SupportMessage {
  id: string;
  ticket_id: string;
  account_id: string | null;
  email_id: string | null;
  message: string;
  attachments: any[];
  created_at: string;
}

// Support message view type (from support.messages_view)
export interface SupportMessageView extends SupportMessage {
  sender_type: MessageSenderType;
  sender_email: string | null;
  sender_name: string;
  ticket_subject: string;
  ticket_status: TicketStatus;
  ticket_account_id: string | null;
  ticket_email_id: string | null;
}

// Support category type
export interface SupportCategory {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}
