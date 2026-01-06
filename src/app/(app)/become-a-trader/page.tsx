import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Become a Trader - OP Trader",
  description: "Join the OP Trader network and start earning.",
};

export default function BecomeATraderPage() {
  return (
    <div className="container mx-auto px-4 py-12">
      <div className="space-y-8">
        {/* Hero Section */}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Become a Trader
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Join the OP Trader network and unlock new opportunities to grow your
            business and increase your revenue.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
            <div className="text-3xl font-bold text-red-500 mb-2">500+</div>
            <p className="text-gray-600 dark:text-gray-400">Active Traders</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
            <div className="text-3xl font-bold text-red-500 mb-2">$10M+</div>
            <p className="text-gray-600 dark:text-gray-400">Monthly Volume</p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
            <div className="text-3xl font-bold text-red-500 mb-2">15%</div>
            <p className="text-gray-600 dark:text-gray-400">Average Margin</p>
          </div>
        </div>

        {/* Trading Plans Overview */}
        <div>
          <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Choose Your Trading Plan
          </h2>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Collector
              </h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-4">
                Free
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                Perfect for individuals building personal collections
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-6">
                <li>✓ Personal collection management</li>
                <li>✓ Buy and sell cards</li>
                <li>✓ Track collection value</li>
                <li>✓ Transaction fees only</li>
              </ul>
              <a
                href="/signup?plan=collector"
                className="w-full block text-center py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded transition-colors"
              >
                Get Started
              </a>
            </div>

            <div className="bg-red-50 dark:bg-red-950 p-6 rounded-lg border-2 border-red-500 relative">
              <div className="absolute top-0 right-0 bg-red-500 text-white px-3 py-1 text-xs font-bold rounded-bl">
                Most Popular
              </div>
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Dealer
              </h3>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 mb-1">
                $49
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                /month + transaction fees
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                For businesses scaling their trading operation
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-6">
                <li>✓ Everything in Collector</li>
                <li>✓ Multiple collections</li>
                <li>✓ Business dashboard</li>
                <li>✓ Advanced analytics</li>
                <li>✓ Priority support</li>
              </ul>
              <a
                href="/become-a-trader/features?plan=dealer"
                className="w-full block text-center py-2 px-4 bg-red-500 hover:bg-red-600 text-white font-semibold rounded transition-colors"
              >
                Learn More
              </a>
            </div>

            <div className="bg-purple-50 dark:bg-purple-950 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-2">
                Dealer++
              </h3>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400 mb-1">
                $49+
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                /month + store fees
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-6">
                For businesses with retail locations
              </p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-6">
                <li>✓ Everything in Dealer</li>
                <li>✓ Point of Sale (POS) system</li>
                <li>✓ Multi-location management</li>
                <li>✓ Hardware support</li>
                <li>✓ Premium support</li>
              </ul>
              <a
                href="/contact"
                className="w-full block text-center py-2 px-4 bg-purple-500 hover:bg-purple-600 text-white font-semibold rounded transition-colors"
              >
                Contact Sales
              </a>
            </div>
          </div>
        </div>

        {/* Why Become a Trader */}
        <div>
          <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Why Become a Trader?
          </h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border-l-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">
                Competitive Pricing
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Access our best wholesale pricing and increase your margins with
                every transaction.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border-l-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">
                Dedicated Support
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get priority support from our success team to help you grow.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">
                Trading Tools
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use our advanced analytics and real-time data to make smarter
                trading decisions.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">
                Marketing Support
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Access marketing materials and co-op advertising to help you
                reach more customers.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="mb-6">
            Apply now to become a trader and start growing your business with OP
            Trader.
          </p>
          <button className="bg-white text-red-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded transition-colors">
            Apply Now
          </button>
        </div>

        {/* Navigation Links */}
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            href="/become-a-trader/features"
            className="block p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-red-500 transition-colors"
          >
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Features →
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Explore powerful features built for traders
            </p>
          </Link>
          <Link
            href="/become-a-trader/how-it-works"
            className="block p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-red-500 transition-colors"
          >
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              How It Works →
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Understand the trading process
            </p>
          </Link>
          <Link
            href="/become-a-trader/requirements"
            className="block p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-red-500 transition-colors"
          >
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">
              Requirements →
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check eligibility requirements
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
