export interface Card {
  id: number;
  name: string;
  type: 'Leader' | 'Character' | 'Event' | 'Stage';
  rarity: 'Common' | 'Uncommon' | 'Rare' | 'Super Rare' | 'Secret Rare';
  price: number;
  power: number | null;
  attribute: string | null;
  set: string;
  description: string;
}

export interface CollectionItem {
  id: number;
  quantity: number;
  dateAdded: string;
}

export interface CardWithQuantity extends Card {
  quantity: number;
  dateAdded?: string;
}
