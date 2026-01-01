'use client';

import { useEffect, useState } from 'react';
import { CollectionItem } from '@/types/card';

export function useCollection() {
  const [collection, setCollection] = useState<CollectionItem[]>(() => {
    if (typeof window === 'undefined') return [];
    const saved = window.localStorage.getItem('opTraderCollection');
    if (!saved) return [];
    try {
      return JSON.parse(saved) as CollectionItem[];
    } catch (error) {
      console.error('Error loading collection:', error);
      return [];
    }
  });

  useEffect(() => {
    // Save collection to localStorage whenever it changes
    window.localStorage.setItem('opTraderCollection', JSON.stringify(collection));
  }, [collection]);

  const addToCollection = (cardId: number) => {
    setCollection(prevCollection => {
      const existingCard = prevCollection.find(c => c.id === cardId);
      if (existingCard) {
        return prevCollection.map(c =>
          c.id === cardId
            ? { ...c, quantity: c.quantity + 1 }
            : c
        );
      } else {
        return [
          ...prevCollection,
          {
            id: cardId,
            quantity: 1,
            dateAdded: new Date().toISOString()
          }
        ];
      }
    });
  };

  return {
    collection,
    addToCollection,
    isLoaded: true,
  };
}
