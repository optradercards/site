import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Admin Dashboard - OP Trader",
  description: "Manage your OP Trader platform",
};

const adminSections = [
  { title: "Admins", description: "Manage platform admins and permissions", href: "/admin/admins", icon: "👤" },
  { title: "Traders", description: "Manage trader accounts", href: "/admin/traders", icon: "🤝" },
  { title: "Orders", description: "View and manage all orders", href: "/admin/orders", icon: "🛒" },
  { title: "Newsletter", description: "Manage newsletter campaigns", href: "/admin/newsletter", icon: "📧" },
  { title: "Support", description: "View and respond to support tickets", href: "/admin/support", icon: "💭" },
  { title: "Analytics", description: "View platform analytics and reports", href: "/admin/analytics", icon: "📈" },
  { title: "Settings", description: "Configure platform settings", href: "/admin/settings", icon: "⚙️" },
];

type DashboardStats = {
  total_users: number;
  total_users_delta_pct: number | null;
  total_orders: number;
  total_orders_delta_pct: number | null;
  active_traders: number;
  active_traders_delta_pct: number | null;
};

type ActivityRow = {
  activity_type: string;
  title: string;
  detail: string;
  occurred_at: string;
};

const numberFmt = new Intl.NumberFormat("en-US");

function formatDelta(delta: number | null): { label: string; positive: boolean } | null {
  if (delta === null || delta === undefined) return null;
  const positive = delta >= 0;
  return {
    label: `${positive ? "↑" : "↓"} ${Math.abs(delta)}% from last month`,
    positive,
  };
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.round((now - then) / 1000));
  if (diffSec < 60) return "just now";
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  const diffMo = Math.round(diffDay / 30);
  return `${diffMo} month${diffMo === 1 ? "" : "s"} ago`;
}

export default async function AdminDashboard() {
  const supabase = await createClient();

  const [statsResult, activityResult] = await Promise.all([
    supabase.rpc("admin_dashboard_stats"),
    supabase.rpc("admin_recent_activity", { p_limit: 8 }),
  ]);

  if (statsResult.error) {
    console.error("admin_dashboard_stats failed:", statsResult.error);
  }
  if (activityResult.error) {
    console.error("admin_recent_activity failed:", activityResult.error);
  }

  const stats: DashboardStats | null =
    (statsResult.data as DashboardStats[] | null)?.[0] ?? null;
  const activity: ActivityRow[] = (activityResult.data as ActivityRow[] | null) ?? [];

  const statCards = [
    {
      label: "Total Users",
      value: stats ? numberFmt.format(stats.total_users) : "—",
      delta: formatDelta(stats?.total_users_delta_pct ?? null),
    },
    {
      label: "Total Orders",
      value: stats ? numberFmt.format(stats.total_orders) : "—",
      delta: formatDelta(stats?.total_orders_delta_pct ?? null),
    },
    {
      label: "Active Traders",
      value: stats ? numberFmt.format(stats.active_traders) : "—",
      delta: formatDelta(stats?.active_traders_delta_pct ?? null),
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Welcome to Admin Dashboard
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Manage your OP Trader platform, users, traders, and more from here.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid md:grid-cols-3 gap-6">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-6"
          >
            <div className="text-gray-500 dark:text-gray-400 text-sm font-semibold mb-2">
              {card.label}
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {card.value}
            </div>
            {card.delta ? (
              <p
                className={`text-sm mt-2 ${
                  card.delta.positive ? "text-green-600" : "text-red-600"
                }`}
              >
                {card.delta.label}
              </p>
            ) : (
              <p className="text-sm mt-2 text-gray-400">No prior month data</p>
            )}
          </div>
        ))}
      </div>

      {/* Admin Sections */}
      <div>
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          Management Sections
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg transition-shadow p-6 group"
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">
                {section.icon}
              </div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-red-500 transition-colors">
                {section.title}
              </h4>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                {section.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h3>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No recent activity to show.
          </p>
        ) : (
          <div className="space-y-4">
            {activity.map((row, idx) => (
              <div
                key={`${row.activity_type}-${row.occurred_at}-${idx}`}
                className={`flex items-center justify-between ${
                  idx < activity.length - 1
                    ? "pb-4 border-b border-gray-200 dark:border-gray-700"
                    : ""
                }`}
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {row.title}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {row.detail}
                  </p>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {formatRelativeTime(row.occurred_at)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
