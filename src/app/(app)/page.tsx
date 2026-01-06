import type { Metadata } from "next";
import HomePageClient from "@/components/HomePageClient";

export const metadata: Metadata = {
  title: "OP Trader - One Piece TCG Marketplace",
  description:
    "The premier marketplace for One Piece Trading Card Game collectors to buy, sell, and trade cards.",
};

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <section
        id="home"
        className="bg-gradient-to-br from-red-500 to-blue-500 text-white py-16 text-center"
      >
        <div className="container mx-auto px-4">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Welcome to OP Trader
          </h2>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto">
            The premier marketplace for One Piece Trading Card Game enthusiasts.
            Buy, sell, and trade cards with collectors worldwide.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <a
              href="#marketplace"
              className="bg-white text-red-500 px-8 py-3 rounded-lg font-semibold hover:transform hover:-translate-y-1 transition-all shadow-lg"
            >
              Browse Cards
            </a>
            <a
              href="#collection"
              className="bg-transparent border-2 border-white text-white px-8 py-3 rounded-lg font-semibold hover:transform hover:-translate-y-1 transition-all"
            >
              View Collection
            </a>
          </div>
        </div>
      </section>

      {/* Interactive Sections (Client Components) */}
      <HomePageClient />

      {/* About Section */}
      <section
        id="about"
        className="bg-white dark:bg-gray-900 py-12 min-h-screen"
      >
        <div className="container mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold mb-8 text-gray-800 dark:text-gray-100">
            About OP Trader
          </h2>
          <div className="mx-auto">
            <p className="text-base md:text-lg mb-6 text-gray-700 dark:text-gray-300 leading-relaxed">
              OP Trader is a specialized marketplace for One Piece Trading Card
              Game collectors. We provide a platform where enthusiasts can:
            </p>
            <ul className="list-disc list-inside mb-6 space-y-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
              <li>Browse and discover cards from all sets</li>
              <li>Buy and sell cards with other collectors</li>
              <li>Trade cards to complete your collection</li>
              <li>Track your collection&apos;s value and rarity</li>
              <li>Connect with the One Piece TCG community</li>
            </ul>
            <p className="text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              Whether you&apos;re a seasoned collector or just starting your
              journey in the Grand Line, OP Trader is your trusted companion for
              all things One Piece TCG.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
