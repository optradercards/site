"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface MarketplaceSearchProps {
  brands: string[];
  sets: string[];
  rarities: string[];
}

export default function MarketplaceSearch({
  brands,
  sets,
  rarities,
}: MarketplaceSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const q = searchParams.get("q") ?? "";
  const brand = searchParams.get("brand") ?? "";
  const set = searchParams.get("set") ?? "";
  const rarity = searchParams.get("rarity") ?? "";
  const sort = searchParams.get("sort") ?? "";

  function updateParams(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }
    // Reset to page 1 when filters change
    params.delete("page");
    startTransition(() => {
      router.push(`/search?${params.toString()}`, { scroll: false });
    });
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    updateParams({ q: formData.get("q") as string });
  }

  function handleFilterChange(key: string, value: string) {
    updateParams({ [key]: value });
  }

  function clearAll() {
    startTransition(() => {
      router.push("/search", { scroll: false });
    });
  }

  const hasFilters = q || brand || set || rarity;

  return (
    <div>
      {/* Search Bar */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search cards, sets, sellers..."
            className="w-full pl-12 pr-4 py-3 md:py-4 text-base md:text-lg border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="px-6 md:px-8 py-3 md:py-4 bg-red-500 text-white font-semibold rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 shrink-0"
        >
          Search
        </button>
      </form>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3 mt-4">
        <select
          value={brand}
          onChange={(e) => handleFilterChange("brand", e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Brands</option>
          {brands.map((b) => (
            <option key={b} value={b}>
              {b}
            </option>
          ))}
        </select>
        <select
          value={set}
          onChange={(e) => handleFilterChange("set", e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Sets</option>
          {sets.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          value={rarity}
          onChange={(e) => handleFilterChange("rarity", e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">All Rarities</option>
          {rarities.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => handleFilterChange("sort", e.target.value)}
          className="px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          <option value="">Newest First</option>
          <option value="price_asc">Price: Low to High</option>
          <option value="price_desc">Price: High to Low</option>
          <option value="name_asc">Name: A–Z</option>
        </select>
        {hasFilters && (
          <button
            onClick={clearAll}
            className="px-3 py-2 text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {isPending && (
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Loading...
        </div>
      )}
    </div>
  );
}
