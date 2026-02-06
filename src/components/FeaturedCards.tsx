'use client';

import { sampleCards } from '@/data/sampleCards';
import Link from 'next/link';

export default function FeaturedCards() {
  // Select featured cards (top 8 by price for "trending")
  const featuredCards = [...sampleCards]
    .sort((a, b) => b.price - a.price)
    .slice(0, 8);

  const getRarityClass = (rarity: string) => {
    return `rarity-${rarity.toLowerCase().replace(' ', '-')}`;
  };

  const trackCardClick = (cardName: string) => {
    // Analytics tracking
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'featured_card_click', {
        card_name: cardName,
        section: 'featured_cards'
      });
    }
    console.log(`[Analytics] Featured card clicked: ${cardName}`);
  };

  return (
    <section className="bg-gray-50 dark:bg-gray-800 py-16">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-800 dark:text-gray-100">
            🔥 Trending Cards
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-lg max-w-2xl mx-auto">
            Check out the hottest cards on the marketplace right now
          </p>
        </div>

        {/* Card Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {featuredCards.map((card) => (
            <Link
              key={card.id}
              href={`/#marketplace`}
              onClick={() => trackCardClick(card.name)}
              className="group bg-white dark:bg-gray-900 rounded-xl shadow-md overflow-hidden transform transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
            >
              {/* Card Image Placeholder */}
              <div className="aspect-[3/4] bg-gradient-to-br from-purple-500 via-purple-600 to-purple-800 flex items-center justify-center text-white p-4 relative overflow-hidden">
                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors"></div>
                <span className="text-lg md:text-xl font-bold text-center relative z-10">
                  {card.name}
                </span>
                {/* Rarity Badge */}
                <span 
                  className={`absolute top-2 right-2 ${getRarityClass(card.rarity)} px-2 py-1 rounded-full text-xs font-bold text-white shadow-md`}
                >
                  {card.rarity}
                </span>
              </div>
              
              {/* Card Info */}
              <div className="p-3 md:p-4">
                <h3 className="font-semibold text-sm md:text-base text-gray-800 dark:text-gray-100 truncate mb-1">
                  {card.name}
                </h3>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500 dark:text-gray-400">{card.type}</span>
                  <span className="text-lg md:text-xl font-bold text-red-500">
                    ${card.price.toFixed(2)}
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/* View More Link */}
        <div className="text-center mt-10">
          <Link
            href="/#marketplace"
            onClick={() => {
              if (typeof window !== 'undefined' && (window as any).gtag) {
                (window as any).gtag('event', 'cta_click', {
                  cta_name: 'view_more_featured',
                  section: 'featured_cards'
                });
              }
            }}
            className="inline-flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-8 py-3 rounded-lg font-semibold transition-all transform hover:-translate-y-1 shadow-lg hover:shadow-xl"
          >
            View All Cards
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
