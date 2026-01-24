import { redirect } from "next/navigation";
import Link from "next/link";
import { isAdmin } from "@/lib/admin";
import { NavMenu } from "./nav-menu";

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  children?: NavItem[];
}

const adminNavItems: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: "📊" },
  {
    label: "Team Management",
    icon: "👥",
    children: [
      { href: "/admin/users", label: "Users", icon: "👤" },
      { href: "/admin/traders", label: "Traders", icon: "🤝" },
    ],
  },
  {
    label: "Catalog & Operations",
    icon: "📦",
    children: [
      { href: "/admin/products", label: "Products", icon: "📋" },
      { href: "/admin/orders", label: "Orders", icon: "🛒" },
    ],
  },
  {
    label: "Catalog",
    icon: "🎴",
    children: [{ href: "/admin/catalog", label: "Catalog Viewer", icon: "👁️" }],
  },
  {
    label: "Collectr",
    icon: "🧭",
    children: [
      {
        href: "/admin/collectr/import-brands",
        label: "Import Brands",
        icon: "🏷️",
      },
      {
        href: "/admin/collectr/import-cards",
        label: "Import Cards",
        icon: "🃏",
      },
    ],
  },
  {
    label: "Shiny",
    icon: "📥",
    children: [
      { href: "/admin/import/cards", label: "Import Cards", icon: "💾" },
      { href: "/admin/import/brands", label: "Import Brands/Sets", icon: "🏷️" },
    ],
  },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  {
    label: "Communications",
    icon: "💬",
    children: [
      { href: "/admin/newsletter", label: "Newsletter", icon: "📧" },
      { href: "/admin/support", label: "Support", icon: "💭" },
    ],
  },
  { href: "/admin/settings", label: "Settings", icon: "⚙️" },
];

function AdminLayoutContent({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white py-6 px-4 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-red-100 mt-1">Manage your OP Trader platform</p>
          </div>
          <Link
            href="/"
            className="px-4 py-2 bg-white text-red-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-semibold shadow-md"
          >
            ← Back to Site
          </Link>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 min-h-screen">
          <nav className="p-4">
            <ul className="space-y-1">
              <NavMenu items={adminNavItems} />
            </ul>
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
