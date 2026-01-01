'use client';

import { useMemo, useState } from 'react';
import { sampleCards } from '@/data/sampleCards';
import { Card } from '@/types/card';

interface MarketplaceSectionProps {
  onCardSelect: (card: Card) => void;
  onBuyCard: (card: Card) => void;
  onTradeCard: (card: Card) => void;
  onAddToCollection: (cardId: number) => void;
}

export default function MarketplaceSection({
  onCardSelect,
  onBuyCard,
  onTradeCard,
  onAddToCollection,
}: MarketplaceSectionProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const filteredCards = useMemo(() => {
    return sampleCards.filter((card) => {
      const matchesSearch =
        card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        card.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity = !rarityFilter || card.rarity === rarityFilter;
      const matchesType = !typeFilter || card.type === typeFilter;

      return matchesSearch && matchesRarity && matchesType;
    });
  }, [searchTerm, rarityFilter, typeFilter]);

  const getRarityClass = (rarity: string) => {
    return `rarity-${rarity.toLowerCase().replace(' ', '-')}`;
  };

  return (
    <section id="marketplace" className="bg-white dark:bg-gray-900 py-12 min-h-screen">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-800 dark:text-gray-100">Marketplace</h2>

        {/* Filters */}
        <div className="flex gap-4 mb-8 flex-wrap">
          <input
            type="text"
            placeholder="Search cards..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[250px] px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <select
            value={rarityFilter}
            onChange={(e) => setRarityFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[150px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Rarities</option>
            <option value="Common">Common</option>
            <option value="Uncommon">Uncommon</option>
            <option value="Rare">Rare</option>
            <option value="Super Rare">Super Rare</option>
            <option value="Secret Rare">Secret Rare</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 min-w-[150px] bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            <option value="">All Types</option>
            <option value="Character">Character</option>
            <option value="Event">Event</option>
            <option value="Stage">Stage</option>
            <option value="Leader">Leader</option>
          </select>
        </div>

        {/* Card Grid */}
        {filteredCards.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <h3 className="text-2xl font-semibold mb-2">No cards found</h3>
            <p>Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredCards.map((card) => (
              <div
                key={card.id}
                onClick={() => onCardSelect(card)}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-all hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="h-64 bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white text-xl md:text-2xl font-bold p-4 text-center">
                  {card.name}
                </div>
                <div className="p-4">
                  <div className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">{card.name}</div>
                  <div className="flex justify-between mb-2 text-sm text-gray-600 dark:text-gray-400 items-center">
                    <span
                      className={`${getRarityClass(card.rarity)} px-3 py-1 rounded-full text-xs font-bold text-white`}
                    >
                      {card.rarity}
                    </span>
                    <span>{card.type}</span>
                  </div>
                  {card.power && <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Power: {card.power}</div>}
                  <div className="text-xl md:text-2xl font-bold text-red-500 mb-3">${card.price.toFixed(2)}</div>
                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onBuyCard(card);
                      }}
                      className="flex-1 bg-red-500 text-white py-2 text-sm rounded font-semibold hover:bg-red-600 transition-colors"
                    >
                      Buy
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTradeCard(card);
                      }}
                      className="flex-1 bg-blue-500 text-white py-2 text-sm rounded font-semibold hover:bg-blue-600 transition-colors"
                    >
                      Trade
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAddToCollection(card.id);
                      }}
                      className="flex-1 bg-yellow-500 text-white py-2 text-sm rounded font-semibold hover:bg-yellow-600 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

