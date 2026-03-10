import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Become a Trader - OP Trader",
  description: "Join the OP Trader network and start earning.",
};

export default function TraderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const traderNavItems = [
    { href: "/become-a-trader", label: "Overview" },
    { href: "/become-a-trader/features", label: "Features" },
    { href: "/become-a-trader/how-it-works", label: "How It Works" },
    { href: "/become-a-trader/benefits", label: "Benefits" },
    { href: "/become-a-trader/requirements", label: "Requirements" },
  ];

  return (
    <div>
      {/* Trader Navigation */}
      <nav className="bg-gray-100 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="flex gap-8 overflow-x-auto py-4">
            {traderNavItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap text-sm font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 transition-colors pb-2 border-b-2 border-transparent hover:border-red-500"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </nav>

      {/* Page Content */}
      {children}
    </div>
  );
}
