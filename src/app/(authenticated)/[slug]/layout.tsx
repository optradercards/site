"use client";

import Link from "next/link";
import { usePathname, useParams } from "next/navigation";
import { useAccounts } from "@/contexts/AccountContext";

const accountLinks = [
  { href: "", label: "Dashboard", icon: "📊" },
  { href: "/store", label: "Store", icon: "🏪" },
  { href: "/unlisted", label: "Unlisted", icon: "🏷️" },
  { href: "/labels", label: "Labels", icon: "🖨️" },
  { href: "/accounts", label: "Accounts", icon: "🔗" },
  { href: "/settings/plan", label: "Plan", icon: "📋" },
  { href: "/settings/members", label: "Members", icon: "👥", dealerOnly: true },
  { href: "/settings/import-history", label: "Import History", icon: "📜" },
  { href: "/settings/support", label: "Support", icon: "🎧" },
];

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams();
  const slug = params?.slug as string;
  const { activeAccount, isDealer } = useAccounts();

  const visibleLinks = accountLinks.filter(
    (link) => !("dealerOnly" in link && link.dealerOnly) || isDealer
  );

  const accountLabel = activeAccount?.personal_account
    ? "My Collection"
    : activeAccount?.name || activeAccount?.slug || "Account";

  const resolvedLinks = visibleLinks.map((link) => ({
    ...link,
    href: `/${slug}${link.href}`,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 dark:text-gray-100">
          {accountLabel}
        </h1>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Sidebar Navigation */}
          <aside className="lg:w-64 shrink-0">
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 sticky top-4">
              <ul className="space-y-2">
                {resolvedLinks.map((link) => {
                  // Check if a more specific sibling link matches first
                  const moreSpecificMatch = resolvedLinks.some(
                    (other) =>
                      other.href !== link.href &&
                      other.href.startsWith(link.href + "/") &&
                      (pathname === other.href || pathname.startsWith(other.href + "/"))
                  );
                  const isActive =
                    link.href === `/${slug}`
                      ? pathname === `/${slug}`
                      : !moreSpecificMatch &&
                        (pathname === link.href || pathname.startsWith(link.href + "/"));
                  return (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                          isActive
                            ? "bg-red-500 text-white"
                            : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span className="text-xl">{link.icon}</span>
                        <span className="font-medium">{link.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </aside>

          {/* Main Content */}
          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </main>
    </div>
  );
}
