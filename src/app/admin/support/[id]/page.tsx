"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { toast } from "sonner";
import {
  SupportTicketView,
  SupportMessageView,
  TicketStatus,
} from "@/types/support";

type Ticket = SupportTicketView;
type Message = SupportMessageView;

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClient();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [newStatus, setNewStatus] = useState<TicketStatus>("open");

  useEffect(() => {
    loadTicket();
    loadMessages();
  }, [params.id]);

  const loadTicket = async () => {
    try {
      const { data, error } = await supabase
        .from("support_tickets_view")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;
      setTicket(data as any);
      setNewStatus(data.status);
    } catch (error) {
      console.error("Error loading ticket:", error);
      toast.error("Failed to load ticket");
    } finally {
      setIsLoading(false);
    }
  };

  const loadMessages = async () => {
    try {
      const { data, error } = await supabase
        .from("support_messages_view")
        .select("*")
        .eq("ticket_id", params.id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data || []) as any);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const handleAddMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) {
      toast.error("Please enter a message");
      return;
    }

    setIsSending(true);
    try {
      const { data, error } = await supabase.rpc("add_ticket_message", {
        p_ticket_id: params.id,
        p_message: newMessage,
      });

      if (error) throw error;

      toast.success("Message added");
      setNewMessage("");
      loadMessages();
    } catch (error: any) {
      console.error("Error adding message:", error);
      toast.error(error.message || "Failed to add message");
    } finally {
      setIsSending(false);
    }
  };

  const handleStatusChange = async () => {
    if (newStatus === ticket?.status) return;

    try {
      const { error } = await supabase.rpc("update_ticket_status", {
        p_ticket_id: params.id,
        p_status: newStatus,
      });

      if (error) throw error;

      toast.success("Ticket status updated");
      loadTicket();
    } catch (error: any) {
      console.error("Error updating status:", error);
      toast.error(error.message || "Failed to update status");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-red-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">
            Loading ticket...
          </p>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400 mb-4">
          Ticket not found
        </p>
        <Link
          href="/admin/support"
          className="text-red-600 dark:text-red-400 hover:underline"
        >
          Back to tickets
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {ticket.subject}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">#{params.id}</p>
        </div>
        <Link
          href="/admin/support"
          className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          ← Back
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Description */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Description
            </h2>
            <p className="text-gray-700 dark:text-gray-300">
              {ticket.description}
            </p>
          </div>

          {/* Messages */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Messages
            </h2>
            <div className="space-y-4 mb-6">
              {messages.length === 0 ? (
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  No messages yet
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">
                          {msg.sender_name}
                        </span>
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            msg.sender_type === "admin"
                              ? "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                              : "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                          }`}
                        >
                          {msg.sender_type}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {new Date(msg.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {msg.message}
                    </p>
                  </div>
                ))
              )}
            </div>

            {/* Add message form */}
            <form
              onSubmit={handleAddMessage}
              className="border-t border-gray-200 dark:border-gray-700 pt-6"
            >
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your response..."
                rows={4}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-4"
              />
              <button
                type="submit"
                disabled={isSending}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {isSending ? "Sending..." : "Send Message"}
              </button>
            </form>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Status
            </h3>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value as TicketStatus)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 mb-3"
            >
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="waiting_customer">Waiting Customer</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
            {newStatus !== ticket.status && (
              <button
                onClick={handleStatusChange}
                className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
              >
                Update Status
              </button>
            )}
          </div>

          {/* Priority */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Priority
            </h3>
            <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 capitalize">
              {ticket.priority}
            </p>
          </div>

          {/* Customer */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Customer
            </h3>
            <div className="text-gray-900 dark:text-gray-100">
              <p className="font-medium">{ticket.customer_name}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {ticket.customer_email}
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                {ticket.account_id ? "Registered User" : "Guest"}
              </p>
            </div>
          </div>

          {/* Category */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Category
            </h3>
            <p className="text-gray-900 dark:text-gray-100">
              {ticket.category_name}
            </p>
          </div>

          {/* Timeline */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
              Timeline
            </h3>
            <div className="space-y-2 text-sm">
              <div>
                <p className="text-gray-500 dark:text-gray-400">Created</p>
                <p className="text-gray-900 dark:text-gray-100">
                  {new Date(ticket.created_at).toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-gray-500 dark:text-gray-400">Updated</p>
                <p className="text-gray-900 dark:text-gray-100">
                  {new Date(ticket.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
