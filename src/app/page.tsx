'use client';

import { useState, useMemo, useEffect } from 'react';
import { sampleCards } from '@/data/sampleCards';
import { useCollection } from '@/hooks/useCollection';
import { Card } from '@/types/card';

export default function Home() {
  const [searchTerm, setSearchTerm] = useState('');
  const [rarityFilter, setRarityFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [selectedCard, setSelectedCard] = useState<Card | null>(null);
  const [activeSection, setActiveSection] = useState('home');
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Initialize from localStorage or system preference (only runs once on mount)
    if (typeof window !== 'undefined') {
      const savedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return savedTheme === 'dark' || (!savedTheme && prefersDark);
    }
    return false;
  });

  const { collection, addToCollection, isLoaded } = useCollection();

  // Apply dark mode class on mount and when isDarkMode changes
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Toggle theme
  const toggleTheme = () => {
    const newIsDark = !isDarkMode;
    setIsDarkMode(newIsDark);
    
    if (newIsDark) {
      localStorage.setItem('theme', 'dark');
    } else {
      localStorage.setItem('theme', 'light');
    }
  };

  // Filter marketplace cards
  const filteredCards = useMemo(() => {
    return sampleCards.filter(card => {
      const matchesSearch = card.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          card.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRarity = !rarityFilter || card.rarity === rarityFilter;
      const matchesType = !typeFilter || card.type === typeFilter;
      
      return matchesSearch && matchesRarity && matchesType;
    });
  }, [searchTerm, rarityFilter, typeFilter]);

  // Calculate collection statistics
  const collectionStats = useMemo(() => {
    const totalCards = collection.reduce((sum, item) => sum + item.quantity, 0);
    const uniqueCards = collection.length;
    const collectionValue = collection.reduce((sum, item) => {
      const card = sampleCards.find(c => c.id === item.id);
      return sum + (card ? card.price * item.quantity : 0);
    }, 0);

    return { totalCards, uniqueCards, collectionValue };
  }, [collection]);

  // Get collection cards with details
  const collectionCards = useMemo(() => {
    return collection.map(item => {
      const card = sampleCards.find(c => c.id === item.id);
      if (!card) return null;
      return {
        ...card,
        quantity: item.quantity,
        dateAdded: item.dateAdded
      };
    }).filter(card => card !== null);
  }, [collection]);

  const handleBuyCard = (card: Card) => {
    alert(`Purchase initiated for ${card.name} at $${card.price.toFixed(2)}\n\nThis is a demo. In a real marketplace, this would process your payment.`);
  };

  const handleTradeCard = (card: Card) => {
    alert(`Trade proposal for ${card.name}\n\nThis is a demo. In a real marketplace, you would select cards from your collection to trade.`);
  };

  const handleAddToCollection = (cardId: number) => {
    const card = sampleCards.find(c => c.id === cardId);
    if (card) {
      addToCollection(cardId);
      alert(`${card.name} added to your collection!`);
    }
  };

  const scrollToSection = (sectionId: string) => {
    setActiveSection(sectionId);
    const section = document.getElementById(sectionId);
    if (section) {
      section.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const getRarityClass = (rarity: string) => {
    return `rarity-${rarity.toLowerCase().replace(' ', '-')}`;
  };

  return (
    <>
      {/* Header */}
      <header className="bg-gray-800 dark:bg-gray-950 text-white shadow-lg sticky top-0 z-50">
        <nav className="container mx-auto px-4 py-4">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-red-500">OP Trader</h1>
              <p className="text-sm text-gray-300 dark:text-gray-400">One Piece TCG Marketplace</p>
            </div>
            <div className="flex items-center gap-4">
              <ul className="flex gap-4 md:gap-8 flex-wrap">
                {['home', 'marketplace', 'collection', 'about'].map(section => (
                  <li key={section}>
                    <button
                      onClick={() => scrollToSection(section)}
                      className={`font-medium transition-colors px-4 py-2 rounded capitalize ${
                        activeSection === section
                          ? 'text-red-500 bg-white bg-opacity-10'
                          : 'text-white hover:text-red-500 hover:bg-white hover:bg-opacity-10'
                      }`}
                    >
                      {section === 'collection' ? 'My Collection' : section}
                    </button>
                  </li>
                ))}
              </ul>
              {/* Theme Toggle Button */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-white bg-opacity-10 hover:bg-opacity-20 transition-colors"
                aria-label="Toggle theme"
              >
                {isDarkMode ? (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section id="home" className="bg-gradient-to-br from-red-500 to-blue-500 text-white py-16 text-center">
          <div className="container mx-auto px-4">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">Welcome to OP Trader</h2>
            <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
              The premier marketplace for One Piece Trading Card Game enthusiasts. Buy, sell, and trade cards with collectors worldwide.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <button
                onClick={() => scrollToSection('marketplace')}
                className="bg-white text-red-500 px-8 py-3 rounded-lg font-semibold hover:transform hover:-translate-y-1 transition-all shadow-lg"
              >
                Browse Cards
              </button>
              <button
                onClick={() => scrollToSection('collection')}
                className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:transform hover:-translate-y-1 transition-all"
              >
                View Collection
              </button>
            </div>
          </div>
        </section>

        {/* Marketplace Section */}
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
                {filteredCards.map(card => (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-all hover:-translate-y-2 hover:shadow-xl"
                  >
                    <div className="h-64 bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white text-xl md:text-2xl font-bold p-4 text-center">
                      {card.name}
                    </div>
                    <div className="p-4">
                      <div className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">{card.name}</div>
                      <div className="flex justify-between mb-2 text-sm text-gray-600 dark:text-gray-400 items-center">
                        <span className={`${getRarityClass(card.rarity)} px-3 py-1 rounded-full text-xs font-bold text-white`}>
                          {card.rarity}
                        </span>
                        <span>{card.type}</span>
                      </div>
                      {card.power && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Power: {card.power}</div>
                      )}
                      <div className="text-xl md:text-2xl font-bold text-red-500 mb-3">${card.price.toFixed(2)}</div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleBuyCard(card); }}
                          className="flex-1 bg-red-500 text-white py-2 text-sm rounded font-semibold hover:bg-red-600 transition-colors"
                        >
                          Buy
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleTradeCard(card); }}
                          className="flex-1 bg-blue-500 text-white py-2 text-sm rounded font-semibold hover:bg-blue-600 transition-colors"
                        >
                          Trade
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleAddToCollection(card.id); }}
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

        {/* Collection Section */}
        <section id="collection" className="bg-gray-100 dark:bg-gray-800 py-12 min-h-screen">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-800 dark:text-gray-100">My Collection</h2>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-lg text-center">
                <h3 className="text-3xl md:text-4xl font-bold text-red-500 mb-2">
                  {isLoaded ? collectionStats.totalCards : 0}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 font-medium">Total Cards</p>
              </div>
              <div className="bg-white dark:bg-gray-700 p-8 rounded-lg shadow-lg text-center">
                <h3 className="text-3xl md:text-4xl font-bold text-red-500 mb-2">
                  {isLoaded ? collectionStats.uniqueCards : 0}
                </h3>
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
                {collectionCards.map(card => card && (
                  <div
                    key={card.id}
                    onClick={() => setSelectedCard(card)}
                    className="bg-white dark:bg-gray-700 rounded-lg shadow-lg overflow-hidden cursor-pointer transform transition-all hover:-translate-y-2 hover:shadow-xl"
                  >
                    <div className="h-64 bg-gradient-to-br from-purple-400 to-purple-700 flex items-center justify-center text-white text-xl md:text-2xl font-bold p-4 text-center">
                      {card.name}
                    </div>
                    <div className="p-4">
                      <div className="font-bold text-lg mb-2 text-gray-800 dark:text-gray-100">{card.name}</div>
                      <div className="flex justify-between mb-2 text-sm text-gray-600 dark:text-gray-400 items-center">
                        <span className={`${getRarityClass(card.rarity)} px-3 py-1 rounded-full text-xs font-bold text-white`}>
                          {card.rarity}
                        </span>
                        <span>{card.type}</span>
                      </div>
                      {card.power && (
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">Power: {card.power}</div>
                      )}
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        <strong>Quantity:</strong> {card.quantity}
                      </div>
                      <div className="text-xl md:text-2xl font-bold text-red-500">${card.price.toFixed(2)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* About Section */}
        <section id="about" className="bg-white dark:bg-gray-900 py-12 min-h-screen">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-800 dark:text-gray-100">About OP Trader</h2>
            <div className="max-w-3xl mx-auto">
              <p className="text-base md:text-lg mb-6 text-gray-700 dark:text-gray-300 leading-relaxed">
                OP Trader is a specialized marketplace for One Piece Trading Card Game collectors. We provide a platform where enthusiasts can:
              </p>
              <ul className="list-disc list-inside mb-6 space-y-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
                <li>Browse and discover cards from all sets</li>
                <li>Buy and sell cards with other collectors</li>
                <li>Trade cards to complete your collection</li>
                <li>Track your collection&apos;s value and rarity</li>
                <li>Connect with the One Piece TCG community</li>
              </ul>
              <p className="text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                Whether you&apos;re a seasoned collector or just starting your journey in the Grand Line, OP Trader is your trusted companion for all things One Piece TCG.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 dark:bg-gray-950 text-white py-8">
        <div className="container mx-auto px-4">
          <div className="flex justify-between items-center flex-wrap gap-4 text-sm md:text-base">
            <p className="text-center md:text-left w-full md:w-auto text-gray-300 dark:text-gray-400">&copy; 2025 OP Trader. All rights reserved. One Piece is a trademark of Eiichiro Oda/Shueisha.</p>
            <div className="flex gap-4 md:gap-8 mx-auto md:mx-0">
              <a href="#privacy" className="hover:text-red-500 transition-colors">Privacy Policy</a>
              <a href="#terms" className="hover:text-red-500 transition-colors">Terms of Service</a>
              <a href="#contact" className="hover:text-red-500 transition-colors">Contact</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Card Detail Modal */}
      {selectedCard && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-[1000] flex items-center justify-center p-4"
          onClick={() => setSelectedCard(null)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 md:p-8">
              <button
                onClick={() => setSelectedCard(null)}
                className="float-right text-3xl md:text-4xl text-gray-400 hover:text-gray-800 dark:hover:text-gray-100 cursor-pointer leading-none"
              >
                &times;
              </button>
              <div className="h-64 md:h-96 bg-gradient-to-br from-purple-400 to-purple-700 rounded-lg flex items-center justify-center text-white text-2xl md:text-3xl font-bold mb-6 p-8 text-center">
                {selectedCard.name}
              </div>
              <h3 className="text-2xl md:text-3xl font-bold mb-4 text-gray-800 dark:text-gray-100">{selectedCard.name}</h3>
              <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300"><strong>Type:</strong> {selectedCard.type}</p>
              <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
                <strong>Rarity:</strong>{' '}
                <span className={`${getRarityClass(selectedCard.rarity)} px-3 py-1 rounded-full text-xs font-bold text-white`}>
                  {selectedCard.rarity}
                </span>
              </p>
              {selectedCard.power && (
                <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300"><strong>Power:</strong> {selectedCard.power}</p>
              )}
              {selectedCard.attribute && (
                <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300"><strong>Attribute:</strong> {selectedCard.attribute}</p>
              )}
              <p className="mb-3 text-base md:text-lg text-gray-700 dark:text-gray-300"><strong>Set:</strong> {selectedCard.set}</p>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg my-6">
                <p className="font-bold mb-2 text-base md:text-lg text-gray-800 dark:text-gray-100">Description:</p>
                <p className="text-gray-700 dark:text-gray-300 text-sm md:text-base">{selectedCard.description}</p>
              </div>
              <p className="text-2xl md:text-3xl font-bold text-red-500 mb-6">${selectedCard.price.toFixed(2)}</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => handleBuyCard(selectedCard)}
                  className="flex-1 bg-red-500 text-white py-3 rounded-lg font-semibold hover:bg-red-600 transition-colors"
                >
                  Buy Now
                </button>
                <button
                  onClick={() => handleTradeCard(selectedCard)}
                  className="flex-1 bg-blue-500 text-white py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors"
                >
                  Propose Trade
                </button>
                <button
                  onClick={() => handleAddToCollection(selectedCard.id)}
                  className="flex-1 bg-yellow-500 text-white py-3 rounded-lg font-semibold hover:bg-yellow-600 transition-colors"
                >
                  Add to Collection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        .rarity-common {
          background-color: #95a5a6;
        }
        .rarity-uncommon {
          background-color: #27ae60;
        }
        .rarity-rare {
          background-color: #3498db;
        }
        .rarity-super-rare {
          background-color: #9b59b6;
        }
        .rarity-secret-rare {
          background-color: #f39c12;
        }
      `}</style>
    </>
  );
}
