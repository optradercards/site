import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Become a Dealer - OP Trader',
  description: 'Join the OP Trader dealer network and start earning.',
};

export default function BecomeADealerPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <Link href="/" className="text-red-500 hover:text-red-600 font-medium">
          ← Back to Home
        </Link>
      </div>

      <div className="space-y-8">
        {/* Hero Section */}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            Become a Dealer
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Join the OP Trader dealer network and unlock new opportunities to grow your business and increase your revenue.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid md:grid-cols-3 gap-6">
          <div className="bg-gray-50 dark:bg-gray-900 p-6 rounded-lg">
            <div className="text-3xl font-bold text-red-500 mb-2">500+</div>
            <p className="text-gray-600 dark:text-gray-400">Active Dealers</p>
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

        {/* Why Become a Dealer */}
        <div>
          <h2 className="text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">Why Become a Dealer?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border-l-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">Competitive Pricing</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Access our best wholesale pricing and increase your margins with every transaction.
              </p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-6 rounded-lg border-l-4 border-blue-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">Dedicated Support</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get priority support from our dealer success team to help you grow.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">Trading Tools</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Use our advanced analytics and real-time data to make smarter trading decisions.
              </p>
            </div>
            <div className="bg-green-50 dark:bg-green-950 p-6 rounded-lg border-l-4 border-green-500">
              <h3 className="font-semibold text-lg mb-2 text-gray-800 dark:text-gray-100">Marketing Support</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Access marketing materials and co-op advertising to help you reach more customers.
              </p>
            </div>
          </div>
        </div>

        {/* CTA Section */}
        <div className="bg-gradient-to-r from-red-500 to-red-600 text-white p-8 rounded-lg">
          <h2 className="text-2xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="mb-6">
            Apply now to become a dealer and start growing your business with OP Trader.
          </p>
          <button className="bg-white text-red-600 hover:bg-gray-100 font-semibold px-8 py-3 rounded transition-colors">
            Apply Now
          </button>
        </div>

        {/* Navigation Links */}
        <div className="grid md:grid-cols-3 gap-4">
          <Link href="/become-a-dealer/features" className="block p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-red-500 transition-colors">
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Features →</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Explore powerful features built for dealers
            </p>
          </Link>
          <Link href="/become-a-dealer/how-it-works" className="block p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-red-500 transition-colors">
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">How It Works →</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Understand the dealer process
            </p>
          </Link>
          <Link href="/become-a-dealer/requirements" className="block p-4 border border-gray-200 dark:border-gray-800 rounded hover:border-red-500 transition-colors">
            <div className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Requirements →</div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Check eligibility requirements
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
