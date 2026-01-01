'use client';

import { Card } from '@/types/card';

interface CardDetailModalProps {
  card: Card;
  onClose: () => void;
  onBuy: (card: Card) => void;
  onTrade: (card: Card) => void;
  onAddToCollection: (cardId: number) => void;
}

export default function CardDetailModal({
  card,
  onClose,
  onBuy,
  onTrade,
  onAddToCollection,
}: CardDetailModalProps) {
  const getRarityClass = (rarity: string) => {
    return `rarity-${rarity.toLowerCase().replace(' ', '-')}`;
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 md:p-8">
          <button
            onClick={onClose}
            className="float-right text-3xl md:text-4xl text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer leading-none"
          >
            &times;
          </button>
          <div className="h-64 md:h-96 bg-gradient-to-br from-purple-400 to-purple-700 rounded-lg flex items-center justify-center text-white text-2xl md:text-3xl font-bold mb-6 p-8 text-center">
            {card.name}
          </div>
          <h3 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">{card.name}</h3>
          <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
            <strong>Type:</strong> {card.type}
          </p>
          <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
            <strong>Rarity:</strong>{' '}
            <span
              className={`${getRarityClass(card.rarity)} px-3 py-1 rounded-full text-xs font-bold text-white`}
            >
              {card.rarity}
            </span>
          </p>
          {card.power && (
            <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
              <strong>Power:</strong> {card.power}
            </p>
          )}
          {card.attribute && (
            <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
              <strong>Attribute:</strong> {card.attribute}
            </p>
          )}
          <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
            <strong>Set:</strong> {card.set}
          </p>
          <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg my-6">
            <p className="font-bold mb-2 text-base md:text-lg text-gray-800 dark:text-gray-100">Description:</p>
            <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base">{card.description}</p>
          </div>
          <p className="text-2xl md:text-3xl font-bold text-red-500 mb-6">${card.price.toFixed(2)}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => onBuy(card)}
              className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
            >
              Buy Now
            </button>
            <button
              onClick={() => onTrade(card)}
              className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
            >
              Propose Trade
            </button>
            <button
              onClick={() => onAddToCollection(card.id)}
              className="flex-1 bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
            >
              Add to Collection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

