import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/admin";
import Link from "next/link";

export default async function AdminTicketsPage() {
  const adminCheck = await isAdmin();
  if (!adminCheck) {
    redirect("/login?error_type=unauthorized&returnUrl=/admin/support");
  }

  const supabase = await createClient();

  const { data: tickets, error } = await supabase
    .schema("support")
    .from("tickets_view")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching tickets:", error);
  }

  // Fetch emails for each ticket using the secure RPC
  const ticketsWithEmails = await Promise.all(
    (tickets || []).map(async (ticket) => {
      const { data: emailData } = await supabase
        .rpc("get_ticket_email", { p_ticket_id: ticket.id })
        .single();
      return {
        ...ticket,
        customer_email: (emailData as { email?: string })?.email || null,
      };
    })
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case "open":
        return "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200";
      case "in_progress":
        return "bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200";
      case "waiting_customer":
        return "bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200";
      case "resolved":
        return "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200";
      case "closed":
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200";
      default:
        return "bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low":
        return "text-gray-500 dark:text-gray-400";
      case "medium":
        return "text-blue-500 dark:text-blue-400";
      case "high":
        return "text-orange-500 dark:text-orange-400";
      case "urgent":
        return "text-red-500 dark:text-red-400";
      default:
        return "text-gray-500 dark:text-gray-400";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Support Tickets
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage customer support requests
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {ticketsWithEmails && ticketsWithEmails.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Subject
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Priority
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
              {ticketsWithEmails.map((ticket: any) => (
                <tr
                  key={ticket.id}
                  className="hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {ticket.subject}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      #{ticket.id.slice(0, 8)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {ticket.customer_email || "N/A"}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-100">
                    {ticket.category_name}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                        ticket.status
                      )}`}
                    >
                      {ticket.status.replace("_", " ")}
                    </span>
                  </td>
                  <td
                    className={`px-6 py-4 text-sm font-medium ${getPriorityColor(
                      ticket.priority
                    )}`}
                  >
                    {ticket.priority}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                    {new Date(ticket.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/support/${ticket.id}`}
                      className="text-red-600 dark:text-red-400 hover:underline text-sm font-medium"
                    >
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No support tickets yet
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
