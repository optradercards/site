import type { Metadata } from "next";
import HomePageClient from "@/components/HomePageClient";
import FeaturedCards from "@/components/FeaturedCards";
import HeroSection from "@/components/HeroSection";

export const metadata: Metadata = {
  title: "OP Trader - Australia's Premier TCG Marketplace",
  description:
    "Find, buy, trade, and collect trading cards. Australia's premier marketplace for Pokémon, One Piece, Yu-Gi-Oh!, and more TCG collectors.",
};

export default function Home() {
  return (
    <>
      {/* Hero Section */}
      <HeroSection />

      {/* Featured Cards Section */}
      <FeaturedCards />

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
              OP Trader is Australia&apos;s premier marketplace for trading card game
              collectors. We provide a platform where enthusiasts can:
            </p>
            <ul className="list-disc list-inside mb-6 space-y-3 text-base md:text-lg text-gray-700 dark:text-gray-300">
              <li>Browse and discover cards from all sets and games</li>
              <li>Buy and sell cards with other collectors</li>
              <li>Trade cards to complete your collection</li>
              <li>Track your collection&apos;s value and rarity</li>
              <li>Connect with the TCG community across Australia</li>
            </ul>
            <p className="text-base md:text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
              Whether you&apos;re into Pokémon, One Piece, Yu-Gi-Oh!, or any other
              trading card game, OP Trader is your trusted companion for all
              things TCG.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}
