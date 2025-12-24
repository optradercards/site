'use client';

import { useState, useEffect } from 'react';
import { CollectionItem } from '@/types/card';

export function useCollection() {
  const [collection, setCollection] = useState<CollectionItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Load collection from localStorage
    const saved = localStorage.getItem('opTraderCollection');
    if (saved) {
      try {
        setCollection(JSON.parse(saved));
      } catch (error) {
        console.error('Error loading collection:', error);
      }
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    // Save collection to localStorage whenever it changes
    if (isLoaded) {
      localStorage.setItem('opTraderCollection', JSON.stringify(collection));
    }
  }, [collection, isLoaded]);

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
    isLoaded
  };
}
