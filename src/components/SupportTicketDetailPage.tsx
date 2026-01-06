"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { useUser } from "@/contexts/UserContext";
import { useProfile } from "@/hooks/useProfile";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type ReplyFormData = {
  message: string;
};

type TicketDetail = {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  category_name: string | null;
};

type Message = {
  id: string;
  message: string;
  created_at: string;
  is_staff: boolean;
  sender_name: string | null;
};

export default function SupportTicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params?.id as string;
  const { user } = useUser();
  const { data: profileData } = useProfile();
  const supabase = createClient();

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [ticket, setTicket] = useState<TicketDetail | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ReplyFormData>({
    defaultValues: {
      message: "",
    },
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (ticketId) {
      fetchTicketData();
    }
  }, [user, ticketId, router]);

  const fetchTicketData = async () => {
    try {
      setLoading(true);

      if (!profileData?.account.account_id) {
        setError("Account not found");
        return;
      }

      // Fetch ticket details
      const { data: ticketData, error: ticketError } = await supabase
        .from("support_tickets")
        .select(
          `
          id,
          subject,
          description,
          status,
          priority,
          created_at,
          updated_at,
          account_id,
          support_categories (
            name
          )
        `
        )
        .eq("id", ticketId)
        .eq("account_id", profileData.account.account_id)
        .single();

      if (ticketError) throw ticketError;

      if (!ticketData) {
        setError("Ticket not found");
        return;
      }

      setTicket({
        id: ticketData.id,
        subject: ticketData.subject,
        description: ticketData.description,
        status: ticketData.status,
        priority: ticketData.priority,
        created_at: ticketData.created_at,
        updated_at: ticketData.updated_at,
        category_name: (ticketData.support_categories as any)?.name || null,
      });

      // Fetch messages/replies
      const { data: messagesData, error: messagesError } = await supabase
        .from("support_messages")
        .select(
          `
          id,
          message,
          created_at,
          account_id
        `
        )
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (messagesError) throw messagesError;

      // Format messages - mark if from staff or customer
      const formattedMessages =
        messagesData?.map((msg: any) => ({
          id: msg.id,
          message: msg.message,
          created_at: msg.created_at,
          is_staff: msg.account_id !== profileData.account.account_id,
          sender_name:
            msg.account_id === profileData.account.account_id
              ? "You"
              : "Support Team",
        })) || [];

      setMessages(formattedMessages);
    } catch (err) {
      console.error("Error fetching ticket:", err);
      setError("Failed to load ticket details");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: ReplyFormData) => {
    setError(null);
    setMessage(null);
    setSubmitting(true);

    if (!profileData?.account.account_id) {
      setError("Account not found");
      setSubmitting(false);
      return;
    }

    try {
      const { error: insertError } = await supabase
        .from("support_messages")
        .insert({
          ticket_id: ticketId,
          account_id: profileData.account.account_id,
          message: data.message,
        });

      if (insertError) throw insertError;

      setMessage("Reply sent successfully");
      reset();
      await fetchTicketData(); // Refresh messages
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      console.error("Error sending reply:", err);
      setError("Failed to send reply");
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "in_progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
      case "waiting_customer":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
      case "closed":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getPriorityBadgeColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300";
      case "medium":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      case "low":
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Support Ticket
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Loading…
        </p>
      </div>
    );
  }

  if (!user || !ticket) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <p className="text-red-600 dark:text-red-400">
          {error || "Ticket not found"}
        </p>
        <Link
          href="/settings/support"
          className="inline-block mt-4 text-red-500 hover:text-red-600"
        >
          ← Back to Support
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link
        href="/settings/support"
        className="inline-flex items-center text-red-500 hover:text-red-600 font-medium"
      >
        ← Back to Support Tickets
      </Link>

      {/* Ticket Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
              {ticket.subject}
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600 dark:text-gray-400">
              {ticket.category_name && <span>📁 {ticket.category_name}</span>}
              <span>
                Created{" "}
                {new Date(ticket.created_at).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusBadgeColor(
                ticket.status
              )}`}
            >
              {ticket.status.replace("_", " ")}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${getPriorityBadgeColor(
                ticket.priority
              )}`}
            >
              {ticket.priority}
            </span>
          </div>
        </div>

        <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Description
          </h3>
          <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
            {ticket.description}
          </p>
        </div>
      </div>

      {/* Messages/Replies */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
          Conversation
        </h3>

        {messages.length === 0 ? (
          <p className="text-gray-600 dark:text-gray-400 text-sm py-4">
            No replies yet. Add a reply below to continue the conversation.
          </p>
        ) : (
          <div className="space-y-4 mb-6">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`p-4 rounded-lg ${
                  msg.is_staff
                    ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500"
                    : "bg-gray-50 dark:bg-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                    {msg.sender_name}
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(msg.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <p className="text-gray-900 dark:text-gray-100 whitespace-pre-wrap">
                  {msg.message}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Reply Form */}
        {ticket.status !== "closed" && ticket.status !== "resolved" && (
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="border-t border-gray-200 dark:border-gray-700 pt-6"
          >
            <h4 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-3">
              Add a Reply
            </h4>
            <div className="space-y-4">
              <div className="space-y-1">
                <textarea
                  id="message"
                  rows={4}
                  {...register("message", {
                    required: "Message is required",
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
                  placeholder="Type your reply here..."
                />
                {errors.message && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.message.message}
                  </p>
                )}
              </div>

              {error && (
                <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                  {error}
                </div>
              )}

              {message && (
                <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
              >
                {submitting ? "Sending…" : "Send Reply"}
              </button>
            </div>
          </form>
        )}

        {(ticket.status === "closed" || ticket.status === "resolved") && (
          <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              This ticket is {ticket.status}. To continue the conversation,
              please create a new support ticket.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
