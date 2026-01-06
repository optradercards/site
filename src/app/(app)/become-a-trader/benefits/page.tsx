import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Benefits - Become a Trader - OP Trader",
  description: "Learn about the benefits of becoming an OP Trader.",
};

export default function BenefitsPage() {
  const benefits = [
    {
      category: "Financial",
      items: [
        {
          title: "Wholesale Pricing",
          desc: "Access exclusive wholesale rates for maximum margins",
        },
        {
          title: "Commission Program",
          desc: "Earn additional commissions on volume and referrals",
        },
        {
          title: "Fast Payouts",
          desc: "Receive payments within 24 hours of transaction settlement",
        },
        {
          title: "Volume Discounts",
          desc: "Better pricing as your order volume increases",
        },
      ],
    },
    {
      category: "Operational",
      items: [
        {
          title: "Inventory Management",
          desc: "Automated tracking and stock level optimization",
        },
        {
          title: "Order Automation",
          desc: "Batch orders and auto-reordering for efficiency",
        },
        {
          title: "Integration Support",
          desc: "Easy API integration with your existing systems",
        },
        {
          title: "Real-Time Data",
          desc: "Live analytics and market insights for decision making",
        },
      ],
    },
    {
      category: "Marketing & Growth",
      items: [
        {
          title: "Marketing Materials",
          desc: "Professional templates, graphics, and campaigns",
        },
        {
          title: "Brand Building",
          desc: "White-label options available for select partners",
        },
        {
          title: "Lead Generation",
          desc: "Referral program and customer matching tools",
        },
        {
          title: "Training & Webinars",
          desc: "Regular training on products, market trends, and best practices",
        },
      ],
    },
    {
      category: "Support & Partnership",
      items: [
        {
          title: "Dedicated Manager",
          desc: "Personal account manager to support your growth",
        },
        {
          title: "Priority Support",
          desc: "24/5 priority support team for urgent issues",
        },
        {
          title: "Community Network",
          desc: "Connect with other traders for best practice sharing",
        },
        {
          title: "Exclusive Events",
          desc: "Invitations to trader conferences and networking events",
        },
      ],
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
            Trader Benefits
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            Discover the comprehensive benefits of joining the OP Trader
            network.
          </p>
        </div>

        {/* Benefits by Category */}
        <div className="space-y-8">
          {benefits.map((category) => (
            <div key={category.category}>
              <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
                {category.category} Benefits
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                {category.items.map((item) => (
                  <div
                    key={item.title}
                    className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg border-l-4 border-red-500"
                  >
                    <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {item.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div>
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Trader vs Non-Trader
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-900">
                  <th className="px-4 py-3 text-left font-semibold">Feature</th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Retailers
                  </th>
                  <th className="px-4 py-3 text-center font-semibold">
                    Traders
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-3">Wholesale Pricing</td>
                  <td className="px-4 py-3 text-center">❌</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-3">Dedicated Account Manager</td>
                  <td className="px-4 py-3 text-center">❌</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-3">Priority Support</td>
                  <td className="px-4 py-3 text-center">❌</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-3">API Access</td>
                  <td className="px-4 py-3 text-center">❌</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr className="border-b border-gray-200 dark:border-gray-800">
                  <td className="px-4 py-3">Marketing Support</td>
                  <td className="px-4 py-3 text-center">❌</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Commission Program</td>
                  <td className="px-4 py-3 text-center">❌</td>
                  <td className="px-4 py-3 text-center">✓</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Success Stories Teaser */}
        <div className="bg-green-50 dark:bg-green-950 p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Trader Success
          </h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Our traders see an average of 40% higher margins and 3x faster
            growth compared to non-trader retailers.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">40%</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Higher Margins
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">3x</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Faster Growth
              </p>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-600 mb-2">95%</div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Retention Rate
              </p>
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">
            Unlock These Benefits Today
          </h2>
          <p className="mb-6">
            Join 500+ successful traders and start experiencing the OP Trader
            difference.
          </p>
          <button className="bg-white text-red-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded transition-colors">
            Apply Now
          </button>
        </div>
      </div>
    </div>
  );
}
