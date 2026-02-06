'use client';

import Link from 'next/link';

export default function HeroSection() {
  const trackCTA = (ctaName: string) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'cta_click', {
        cta_name: ctaName,
        section: 'hero'
      });
    }
    console.log(`[Analytics] CTA clicked: ${ctaName}`);
  };

  return (
    <section
      id="home"
      className="bg-gradient-to-br from-red-600 via-red-500 to-blue-600 text-white py-20 md:py-28 text-center relative overflow-hidden"
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute inset-0" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}></div>
      </div>

      <div className="container mx-auto px-4 relative z-10">
        {/* Main Headline */}
        <h1 className="text-5xl md:text-7xl font-bold mb-4 tracking-wide">
          FIND. BUY. TRADE. COLLECT.
        </h1>

        {/* Subtext */}
        <p className="text-xl md:text-2xl mb-4 font-medium opacity-95">
          Australia&apos;s Premier TCG Marketplace
        </p>

        {/* Multi-game Support */}
        <div className="flex flex-wrap justify-center gap-3 mb-10">
          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
            🎴 Pokémon
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
            🏴‍☠️ One Piece
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
            ⚔️ Yu-Gi-Oh!
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
            🃏 Magic: The Gathering
          </span>
          <span className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium">
            + More
          </span>
        </div>

        {/* CTAs */}
        <div className="flex gap-4 justify-center flex-wrap">
          <Link
            href="/#marketplace"
            onClick={() => trackCTA('search_cards')}
            className="bg-white text-red-600 px-8 py-4 rounded-xl font-bold text-lg hover:transform hover:-translate-y-1 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            Search Cards
          </Link>
          <Link
            href="/#marketplace"
            onClick={() => trackCTA('browse_sets')}
            className="bg-transparent border-2 border-white text-white px-8 py-4 rounded-xl font-bold text-lg hover:bg-white hover:text-red-600 hover:transform hover:-translate-y-1 transition-all flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            Browse Sets
          </Link>
          <Link
            href="/become-a-trader"
            onClick={() => trackCTA('start_selling')}
            className="bg-yellow-400 text-gray-900 px-8 py-4 rounded-xl font-bold text-lg hover:bg-yellow-300 hover:transform hover:-translate-y-1 transition-all shadow-lg hover:shadow-xl flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Start Selling
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-14 grid grid-cols-3 max-w-2xl mx-auto gap-8">
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold">10K+</div>
            <div className="text-sm opacity-80">Active Listings</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold">500+</div>
            <div className="text-sm opacity-80">Verified Sellers</div>
          </div>
          <div className="text-center">
            <div className="text-3xl md:text-4xl font-bold">5K+</div>
            <div className="text-sm opacity-80">Happy Collectors</div>
          </div>
        </div>
      </div>
    </section>
  );
}
