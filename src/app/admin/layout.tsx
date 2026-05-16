import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { NavMenu } from "./nav-menu";

export const dynamic = "force-dynamic";

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  { href: "/admin/jobs", label: "Jobs", icon: "⚡" },
  {
    label: "General",
    icon: "👥",
    children: [
      { href: "/admin/admins", label: "Admins", icon: "👤" },
      { href: "/admin/traders", label: "Traders", icon: "🤝" },
      { href: "/admin/settings", label: "Settings", icon: "⚙️" },
    ],
  },
  {
    label: "Communications",
    icon: "💬",
    children: [
      { href: "/admin/newsletter", label: "Newsletter", icon: "📧" },
      { href: "/admin/support", label: "Support", icon: "💭" },
    ],
  },
  {
    label: "Operations",
    icon: "📦",
    children: [
      { href: "/admin/orders", label: "Orders", icon: "🛒" },
      { href: "/admin/reconciliation", label: "Reconciliation", icon: "🔍" },
    ],
  },
  {
    label: "Products",
    icon: "🎴",
    children: [
      { href: "/admin/catalog", label: "Catalog", icon: "👁️" },
      { href: "/admin/products", label: "Products", icon: "🃏" },
      { href: "/admin/market", label: "Market", icon: "💰" },
      { href: "/admin/collections", label: "Collections", icon: "📦" },
      { href: "/admin/sync", label: "Sync", icon: "🔄" },
    ],
  },
  {
    label: "Shiny",
    icon: "📥",
    children: [
      { href: "/admin/import-brands", label: "Import Brands", icon: "🏷️" },
      { href: "/admin/import-products", label: "Import Products", icon: "💾" },
      { href: "/admin/import-collections", label: "Import Collections", icon: "📦" },
      { href: "/admin/import-accounts", label: "Import Accounts", icon: "👤" },
    ],
  },
  {
    label: "Analytics",
    icon: "📈",
    children: [
      { href: "/admin/analytics", label: "Analytics", icon: "📈" },
    ],
  },
];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white py-3 px-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">Admin Dashboard</h1>
            <p className="text-red-100 text-xs">Manage your OP Trader platform</p>
          </div>
          <Link
            href="/"
            className="px-3 py-1.5 bg-white text-red-600 hover:bg-gray-100 rounded-lg transition-colors text-xs font-semibold shadow-md"
          >
            Back to Site
          </Link>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen shrink-0">
          <nav className="p-3">
            <NavMenu items={adminNavItems} />
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const adminCheck = await isAdmin();

  if (!adminCheck) {
    redirect("/login?error_type=unauthorized&returnUrl=/admin");
  }

  return <AdminLayoutContent>{children}</AdminLayoutContent>;
}
