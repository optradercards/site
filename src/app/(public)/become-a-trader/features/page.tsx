import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Features - Become a Trader - OP Trader",
  description: "Discover the features and tools available to OP Traders.",
};

export default function FeaturesPage() {
  const features = [
    {
      title: "Wholesale Pricing",
      description:
        "Access wholesale rates exclusive to our network for maximum profitability.",
      icon: "💰",
    },
    {
      title: "Real-Time Analytics",
      description:
        "Track market trends, inventory levels, and sales performance with advanced dashboards.",
      icon: "📊",
    },
    {
      title: "Inventory Management",
      description:
        "Manage your stock efficiently with automated inventory tracking and alerts.",
      icon: "📦",
    },
    {
      title: "Customer Portal",
      description:
        "Give your customers direct access to products with a branded portal.",
      icon: "🌐",
    },
    {
      title: "Payment Processing",
      description:
        "Secure, fast payment processing with multiple options and instant settlements.",
      icon: "💳",
    },
    {
      title: "Order Management",
      description:
        "Streamlined order processing, fulfillment, and tracking for your customers.",
      icon: "📋",
    },
    {
      title: "Marketing Materials",
      description:
        "Professional marketing assets, graphics, and campaign templates to grow your sales.",
      icon: "📢",
    },
    {
      title: "Dedicated Support",
      description:
        "Priority support team available to help you succeed and scale your business.",
      icon: "👥",
    },
    {
      title: "API Access",
      description:
        "Integrate with your existing systems using our comprehensive API.",
      icon: "⚙️",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="mb-8">
        <Link
          href="/become-a-trader"
          className="text-red-500 hover:text-red-600 font-medium"
        >
          ← Back
        </Link>
      </div>

      <div className="space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Trader Features
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Powerful tools and features designed to help your business thrive.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg hover:shadow-lg transition-shadow"
            >
              <div className="text-4xl mb-3">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-2 text-gray-800 dark:text-gray-100">
                {feature.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-blue-50 dark:bg-blue-950 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Complete Business Solution
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Our platform combines everything you need to run a successful
            trading operation. From pricing and inventory to customer management
            and analytics, we&apos;ve got you covered.
          </p>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li>
              ✓ All-in-one platform eliminates the need for multiple systems
            </li>
            <li>✓ Scalable infrastructure that grows with your business</li>
            <li>✓ Mobile-optimized for on-the-go management</li>
            <li>✓ Regular updates and new features added monthly</li>
          </ul>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Experience These Features</h2>
          <p className="mb-6">
            Ready to access all these powerful tools? Apply to become a trader
            today.
          </p>
          <button className="bg-white text-red-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded transition-colors">
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
