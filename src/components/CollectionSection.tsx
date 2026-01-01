'use client';

import { useMemo } from 'react';
import { sampleCards } from '@/data/sampleCards';
import { useCollection } from '@/hooks/useCollection';
import { Card } from '@/types/card';

interface CollectionSectionProps {
  onCardSelect: (card: Card) => void;
}

export default function CollectionSection({ onCardSelect }: CollectionSectionProps) {
  const { collection, isLoaded } = useCollection();

  const collectionStats = useMemo(() => {
    const totalCards = collection.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueCards = collection.length;
    const collectionValue = collection.reduce((sum, item) => {
      const card = sampleCards.find((c) => c.id === item.id);
      return sum + (card ? card.price * item.quantity : 0);
    }, 0);

    return { totalCards, uniqueCards, collectionValue };
  }, [collection]);

  const collectionCards = useMemo(() => {
    return collection
      .map((item) => {
        const card = sampleCards.find((c) => c.id === item.id);
        if (!card) return null;
        return {
          ...card,
          quantity: item.quantity,
          dateAdded: item.dateAdded,
        };
      })
      .filter((card) => card !== null);
  }, [collection]);

  const getRarityClass = (rarity: string) => {
    return `rarity-${rarity.toLowerCase().replace(' ', '-')}`;
  };

  return (
    <section id="collection" className="bg-gray-100 dark:bg-gray-800 py-12 min-h-screen">
      <div className="container mx-auto px-4">
        <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-800 dark:text-gray-100">My Collection</h2>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-lg text-center">
            <h3 className="text-3xl md:text-4xl font-bold text-red-500 mb-2">{isLoaded ? collectionStats.totalCards : 0}</h3>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Total Cards</p>
          </div>
          <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-lg text-center">
            <h3 className="text-3xl md:text-4xl font-bold text-red-500 mb-2">{isLoaded ? collectionStats.uniqueCards : 0}</h3>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Unique Cards</p>
          </div>
          <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-lg text-center">
            <h3 className="text-3xl md:text-4xl font-bold text-red-500 mb-2">
              ${isLoaded ? collectionStats.collectionValue.toFixed(2) : '0.00'}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 font-medium">Estimated Value</p>
          </div>
        </div>

        {/* Collection Cards */}
        {collectionCards.length === 0 ? (
          <div className="text-center py-16 text-gray-500 dark:text-gray-400">
            <h3 className="text-2xl font-semibold mb-2">Your collection is empty</h3>
            <p>Start adding cards from the marketplace!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {collectionCards.map((card) =>
              card ? (
                <div
                  key={card.id}
                  onClick={() => onCardSelect(card)}
                  className="bg-white dark:bg-gray-700 rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-all hover:-translate-y-2 hover:shadow-xl"
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
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <strong>Quantity:</strong> {card.quantity}
                    </div>
                    <div className="text-xl md:text-2xl font-bold text-red-500">${card.price.toFixed(2)}</div>
                  </div>
                </div>
              ) : null
            )}
          </div>
        )}
      </div>
    </section>
  );
}

