"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useUser } from "@/contexts/UserContext";
import { useProfile } from "@/hooks/useProfile";
import { useAccounts } from "@/contexts/AccountContext";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type SupportFormData = {
  category: string;
  subject: string;
  description: string;
};

type Ticket = {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  category_name: string | null;
};

type Category = {
  id: string;
  name: string;
  description: string | null;
};

export default function SupportSettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const { data: profileData } = useProfile();
  const { activeAccount } = useAccounts();
  const slug = activeAccount?.slug;
  const supabase = createClient();

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupportFormData>({
    defaultValues: {
      category: "",
      subject: "",
      description: "",
    },
  });

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    // Fetch categories once
    fetchCategories();
  }, [user, router]);

  useEffect(() => {
    // Fetch tickets when account_id becomes available
    if (profileData?.account.account_id) {
      fetchTickets();
    }
  }, [profileData?.account.account_id]);

  const fetchCategories = async () => {
    try {
      const { data: categoriesData, error: categoriesError } = await supabase
        .schema("support")
        .from("categories")
        .select("*")
        .order("name");

      if (categoriesError) throw categoriesError;
      setCategories(categoriesData || []);
    } catch (err) {
      console.error("Error fetching categories:", err);
    }
  };

  const fetchTickets = async () => {
    try {
      setLoading(true);

      const { data: ticketsData, error: ticketsError } = await supabase
        .schema("support")
        .from("tickets")
        .select(
          `
          id,
          subject,
          status,
          priority,
          created_at,
          category_id,
          categories (
            name
          )
        `
        )
        .eq("account_id", profileData!.account.account_id)
        .order("created_at", { ascending: false });

      if (ticketsError) throw ticketsError;

      const formattedTickets =
        ticketsData?.map((ticket: any) => ({
          id: ticket.id,
          subject: ticket.subject,
          status: ticket.status,
          priority: ticket.priority,
          created_at: ticket.created_at,
          category_name: ticket.categories?.name || null,
        })) || [];

      setTickets(formattedTickets);
    } catch (err) {
      console.error("Error fetching tickets:", err);
      setError("Failed to load support tickets");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SupportFormData) => {
    setError(null);
    setMessage(null);
    setSubmitting(true);

    if (!profileData?.account.account_id) {
      setError("Account not found");
      setSubmitting(false);
      return;
    }

    try {
      // Use RPC function to create ticket
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "create_support_ticket",
        {
          p_subject: data.subject,
          p_description: data.description,
          p_category_id: data.category || null,
        }
      );

      if (rpcError) throw rpcError;

      // RPC returns a table result - check the first row
      const result = Array.isArray(rpcData) ? rpcData[0] : rpcData;
      if (!result?.success) {
        throw new Error(result?.message || "Failed to create ticket");
      }

      setMessage("Support ticket created successfully! We'll respond soon.");
      reset();
      console.log(
        "[SupportSettingsPage] Ticket created, refreshing tickets silently"
      );
      await fetchTickets(); // Refresh tickets list
      setTimeout(() => {
        setIsModalOpen(false);
        setMessage(null);
      }, 2000);
    } catch (err: any) {
      console.error("Error creating support ticket:", err);
      setError(err.message || "Failed to create support ticket");
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
          Support
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Loading…
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      {/* Support Tickets List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Support Tickets
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              View and manage your support requests
            </p>
          </div>
          <button
            onClick={() => {
              setIsModalOpen(true);
              setError(null);
              setMessage(null);
            }}
            className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
          >
            + New Ticket
          </button>
        </div>

        {tickets.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              You haven't submitted any support tickets yet.
            </p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors font-medium"
            >
              Create Your First Ticket
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => (
              <Link
                key={ticket.id}
                href={`/${slug}/settings/support/${ticket.id}`}
                className="block border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4 mb-2">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    {ticket.subject}
                  </h4>
                  <div className="flex gap-2 shrink-0">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getStatusBadgeColor(
                        ticket.status
                      )}`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${getPriorityBadgeColor(
                        ticket.priority
                      )}`}
                    >
                      {ticket.priority}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                  {ticket.category_name && (
                    <span>📁 {ticket.category_name}</span>
                  )}
                  <span>
                    🕒{" "}
                    {new Date(ticket.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Modal for Creating New Ticket */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                  Contact Support
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                  Submit a support ticket and we'll get back to you as soon as
                  possible
                </p>
              </div>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setError(null);
                  setMessage(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
              <div className="space-y-1">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  htmlFor="category"
                >
                  Category
                </label>
                <select
                  id="category"
                  {...register("category")}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                >
                  <option value="">Select a category (optional)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                      {category.description && ` - ${category.description}`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  htmlFor="subject"
                >
                  Subject
                </label>
                <input
                  id="subject"
                  type="text"
                  {...register("subject", {
                    required: "Subject is required",
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  placeholder="Brief description of your issue"
                />
                {errors.subject && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.subject.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  htmlFor="description"
                >
                  Description
                </label>
                <textarea
                  id="description"
                  rows={6}
                  {...register("description", {
                    required: "Description is required",
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 resize-none"
                  placeholder="Provide detailed information about your issue..."
                />
                {errors.description && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.description.message}
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

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setError(null);
                    setMessage(null);
                  }}
                  className="flex-1 px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
                >
                  {submitting ? "Submitting…" : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
