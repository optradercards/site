import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About OP Trader',
  description: 'Learn more about OP Trader, the premier marketplace for One Piece Trading Card Game collectors.',
};

export default function AboutPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl">
      <div className="mb-8">
        <Link href="/" className="text-red-500 hover:text-red-600 font-medium">
          ← Back to Home
        </Link>
      </div>

      <article className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 space-y-8">
        <div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            About OP Trader
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400">
            The Premier Marketplace for One Piece Trading Card Game Enthusiasts
          </p>
        </div>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Our Mission</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            OP Trader is dedicated to creating the ultimate marketplace experience for One Piece Trading Card Game collectors worldwide. We believe in connecting passionate collectors, providing a transparent platform for buying and selling cards, and fostering a vibrant community around the game.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">What We Offer</h2>
          <ul className="space-y-3 text-gray-700 dark:text-gray-300">
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>Browse & Discover:</strong> Explore cards from all sets with detailed information and pricing</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>Buy & Sell:</strong> Trade cards securely with other collectors in our trusted community</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>Manage Your Collection:</strong> Track your cards, monitor their value, and organize by rarity</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>Connect & Trade:</strong> Find other collectors and negotiate trades to complete your sets</span>
            </li>
            <li className="flex gap-3">
              <span className="text-red-500 font-bold">•</span>
              <span><strong>Stay Informed:</strong> Keep track of market trends and card valuations</span>
            </li>
          </ul>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Why Choose OP Trader?</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Specialized Community</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Built specifically for One Piece TCG enthusiasts who understand the game and its cards.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Transparent Pricing</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Clear pricing based on market demand and card condition without hidden fees.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Easy to Use</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Intuitive platform design makes buying, selling, and trading simple and enjoyable.
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
              <h3 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Secure Trading</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Protected transactions and verified users to ensure safe and fair trades.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Our Community</h2>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Whether you&apos;re a seasoned collector with complete sets or just starting your journey in the Grand Line, OP Trader is your trusted companion. We believe in the power of community and the shared passion that connects collectors around the world.
          </p>
          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
            Join thousands of collectors who are already discovering rare cards, completing their collections, and connecting with fellow enthusiasts on OP Trader.
          </p>
        </section>

        <section className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6 space-y-4">
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Get Started Today</h2>
          <p className="text-gray-700 dark:text-gray-300">
            Ready to build your collection or find that missing card? Create an account and start exploring the marketplace today.
          </p>
          <div className="flex gap-4 pt-4">
            <Link
              href="/signup"
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
            >
              Sign Up Now
            </Link>
            <Link
              href="/"
              className="px-6 py-3 border-2 border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium"
            >
              Browse Marketplace
            </Link>
          </div>
        </section>
      </article>
    </div>
  );
}
