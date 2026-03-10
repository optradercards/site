"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { useAccounts } from "@/contexts/AccountContext";

interface NavItem {
  href?: string;
  label: string;
  icon: string;
  exact?: boolean;
  children?: NavItem[];
}

function NavLink({
  href,
  icon,
  label,
  exact,
  slug,
}: {
  href: string;
  icon: string;
  label: string;
  exact?: boolean;
  slug: string;
}) {
  const pathname = usePathname();
  const resolved = `/${slug}${href}`;
  const isActive = exact
    ? pathname === resolved
    : pathname === resolved || pathname.startsWith(resolved + "/");

  return (
    <li>
      <Link
        href={resolved}
        className={`flex items-center gap-2.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
          isActive
            ? "bg-red-50 text-red-700 font-medium dark:bg-red-900/20 dark:text-red-400"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-200"
        }`}
      >
        <span className="text-base leading-none">{icon}</span>
        <span>{label}</span>
      </Link>
    </li>
  );
}

function NavSection({ item, slug }: { item: NavItem; slug: string }) {
  return (
    <li>
      <div className="px-3 pt-4 pb-1 text-xs font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {item.label}
      </div>
      {item.children && (
        <ul className="space-y-0.5">
          {item.children.map((child) => (
            <NavLink
              key={child.href}
              href={child.href!}
              icon={child.icon}
              label={child.label}
              exact={child.exact}
              slug={slug}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function buildNavItems(isDealer: boolean): NavItem[] {
  const items: NavItem[] = [
    { href: "/manage", label: "Overview", icon: "📊", exact: true },
  ];

  if (isDealer) {
    items.push({
      label: "Store",
      icon: "🏪",
      children: [
        { href: "/manage/listings", label: "Listings", icon: "🏪" },
        { href: "/manage/unlisted", label: "Add Listings", icon: "🏷️" },
        { href: "/manage/labels", label: "Labels", icon: "🖨️" },
      ],
    });
  }

  const settingsChildren: NavItem[] = [
    { href: "/manage/accounts", label: "Accounts", icon: "🔗" },
    { href: "/manage/plan", label: "Plan", icon: "📋" },
    { href: "/manage/support", label: "Support", icon: "🎧" },
  ];
  if (isDealer) {
    settingsChildren.splice(1, 0, {
      href: "/manage/members",
      label: "Members",
      icon: "👥",
    });
  }
  items.push({
    label: "Settings",
    icon: "⚙️",
    children: settingsChildren,
  });

  return items;
}

export default function ManageNav({
  children,
}: {
  children: React.ReactNode;
}) {
  const params = useParams();
  const slug = params?.slug as string;
  const { activeAccount, isDealer } = useAccounts();

  const accountLabel = activeAccount?.personal_account
    ? "My Collection"
    : activeAccount?.name || activeAccount?.slug || "Account";

  const navItems = buildNavItems(isDealer);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
            {accountLabel}
          </h1>
          <Link
            href={`/${slug}`}
            target="_blank"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shrink-0"
          >
            Public View
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          <aside className="lg:w-56 shrink-0">
            <nav className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3 sticky top-4">
              <ul className="space-y-0.5">
                {navItems.map((item) =>
                  item.children && item.children.length > 0 ? (
                    <NavSection key={item.label} item={item} slug={slug} />
                  ) : (
                    <NavLink
                      key={item.href}
                      href={item.href!}
                      icon={item.icon}
                      label={item.label}
                      exact={item.exact}
                      slug={slug}
                    />
                  )
                )}
              </ul>
            </nav>
          </aside>

          <div className="flex-1 min-w-0">{children}</div>
        </div>
      </div>
    </div>
  );
}
