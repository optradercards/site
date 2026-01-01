'use client';

import { useState } from 'react';
import { sampleCards } from '@/data/sampleCards';
import { useCollection } from '@/hooks/useCollection';
import { Card } from '@/types/card';
import MarketplaceSection from './MarketplaceSection';
import CollectionSection from './CollectionSection';
import CardDetailModal from './CardDetailModal';

export default function HomePageClient() {
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const { addToCollection } = useCollection();

  const handleBuyCard = (card: Card) => {
    alert(
      `Purchase initiated for ${card.name} at $${card.price.toFixed(2)}\n\nThis is a demo. In a real marketplace, this would process your payment.`
    );
  };

  const handleTradeCard = (card: Card) => {
    alert(
      `Trade proposal for ${card.name}\n\nThis is a demo. In a real marketplace, you would select cards from your collection to trade.`
    );
  };

  const handleAddToCollection = (cardId: number) => {
    const card = sampleCards.find((c) => c.id === cardId);
    if (card) {
      addToCollection(cardId);
      alert(`${card.name} added to your collection!`);
    }
  };

  return (
    <>
      <MarketplaceSection
        onCardSelect={setSelectedCard}
        onBuyCard={handleBuyCard}
        onTradeCard={handleTradeCard}
        onAddToCollection={handleAddToCollection}
      />
      <CollectionSection onCardSelect={setSelectedCard} />
      {selectedCard && (
        <CardDetailModal
          card={selectedCard}
          onClose={() => setSelectedCard(null)}
          onBuy={handleBuyCard}
          onTrade={handleTradeCard}
          onAddToCollection={handleAddToCollection}
        />
      )}
    </>
  );
}

