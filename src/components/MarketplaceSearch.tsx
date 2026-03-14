"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

interface MarketplaceSearchProps {
  brands: string[];
  sets: string[];
  rarities: string[];
}

const COLLAPSED_LIMIT = 7;

function parseMulti(value: string): string[] {
  return value ? value.split(",") : [];
}

function serializeMulti(values: string[]): string {
  return values.join(",");
}

function FilterSection({
  title,
  paramKey,
  items,
  activeValues,
  onToggle,
}: {
  title: string;
  paramKey: string;
  items: string[];
  activeValues: string[];
  onToggle: (key: string, item: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const [showAll, setShowAll] = useState(false);

  // Show selected items first, then the rest
  const selected = items.filter((i) => activeValues.includes(i));
  const unselected = items.filter((i) => !activeValues.includes(i));
  const sorted = [...selected, ...unselected];
  const visible = showAll ? sorted : sorted.slice(0, COLLAPSED_LIMIT);
  const hasMore = sorted.length > COLLAPSED_LIMIT;

  return (
    <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center justify-between w-full text-left"
      >
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100">
          {title}
          {activeValues.length > 0 && (
            <span className="ml-1.5 text-xs font-normal text-red-500">
              ({activeValues.length})
            </span>
          )}
        </h3>
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <ul className="mt-2 space-y-0.5">
          {visible.map((item) => {
            const isActive = activeValues.includes(item);
            return (
              <li key={item}>
                <label className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={() => onToggle(paramKey, item)}
                    className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                  />
                  <span
                    className={`text-sm truncate ${
                      isActive
                        ? "text-gray-900 dark:text-white font-medium"
                        : "text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200"
                    }`}
                  >
                    {item}
                  </span>
                </label>
              </li>
            );
          })}
          {hasMore && (
            <li>
              <button
                onClick={() => setShowAll(!showAll)}
                className="text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline mt-1 px-1"
              >
                {showAll ? "Show less" : `See all ${sorted.length}`}
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

export default function MarketplaceSearch({
  brands,
  sets,
  rarities,
}: MarketplaceSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const brandValues = parseMulti(searchParams.get("brand") ?? "");
  const setValues = parseMulti(searchParams.get("set") ?? "");
  const rarityValues = parseMulti(searchParams.get("rarity") ?? "");
  const sort = searchParams.get("sort") ?? "";

  const hasFilters = brandValues.length > 0 || setValues.length > 0 || rarityValues.length > 0;

  function navigate(params: URLSearchParams) {
    params.delete("page");
    startTransition(() => {
      router.push(`/search?${params.toString()}`, { scroll: false });
    });
  }

  function handleCheckboxToggle(key: string, item: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = parseMulti(params.get(key) ?? "");

    const updated = current.includes(item)
      ? current.filter((v) => v !== item)
      : [...current, item];

    if (updated.length > 0) {
      params.set(key, serializeMulti(updated));
    } else {
      params.delete(key);
    }
    navigate(params);
  }

  function removeFilter(key: string, item: string) {
    const params = new URLSearchParams(searchParams.toString());
    const current = parseMulti(params.get(key) ?? "");
    const updated = current.filter((v) => v !== item);
    if (updated.length > 0) {
      params.set(key, serializeMulti(updated));
    } else {
      params.delete(key);
    }
    navigate(params);
  }

  function handleSortChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("sort", value);
    } else {
      params.delete("sort");
    }
    navigate(params);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    const q = params.get("q");
    startTransition(() => {
      router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search", {
        scroll: false,
      });
    });
  }

  // Active filter pills
  const activeFilters = [
    ...brandValues.map((v) => ({ key: "brand", label: v })),
    ...setValues.map((v) => ({ key: "set", label: v })),
    ...rarityValues.map((v) => ({ key: "rarity", label: v })),
  ];

  const filterContent = (
    <div className={`space-y-4 ${isPending ? "opacity-60 pointer-events-none" : ""}`}>
      {/* Active filter pills */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pb-3 border-b border-gray-200 dark:border-gray-700">
          {activeFilters.map((f) => (
            <button
              key={`${f.key}-${f.label}`}
              onClick={() => removeFilter(f.key, f.label)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full hover:bg-red-100 dark:hover:bg-red-900/50 transition-colors"
            >
              {f.label}
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ))}
          {activeFilters.length > 1 && (
            <button
              onClick={clearAll}
              className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-1 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>
      )}

      {/* Sort */}
      <div className="border-b border-gray-200 dark:border-gray-700 pb-4">
        <h3 className="text-sm font-bold text-gray-800 dark:text-gray-100 mb-2">
          Sort By
        </h3>
        <ul className="space-y-0.5">
          {[
            { value: "", label: "Newest First" },
            { value: "price_asc", label: "Price: Low to High" },
            { value: "price_desc", label: "Price: High to Low" },
            { value: "name_asc", label: "Name: A\u2013Z" },
          ].map((opt) => (
            <li key={opt.value}>
              <label className="flex items-center gap-2 py-1 px-1 rounded cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors group">
                <input
                  type="radio"
                  name="sort"
                  checked={sort === opt.value}
                  onChange={() => handleSortChange(opt.value)}
                  className="w-4 h-4 border-gray-300 dark:border-gray-600 text-red-500 focus:ring-red-500 focus:ring-offset-0 cursor-pointer"
                />
                <span
                  className={`text-sm ${
                    sort === opt.value
                      ? "text-gray-900 dark:text-white font-medium"
                      : "text-gray-600 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-gray-200"
                  }`}
                >
                  {opt.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Filter sections */}
      <FilterSection
        title="Brand"
        paramKey="brand"
        items={brands}
        activeValues={brandValues}
        onToggle={handleCheckboxToggle}
      />
      <FilterSection
        title="Set"
        paramKey="set"
        items={sets}
        activeValues={setValues}
        onToggle={handleCheckboxToggle}
      />
      <FilterSection
        title="Rarity"
        paramKey="rarity"
        items={rarities}
        activeValues={rarityValues}
        onToggle={handleCheckboxToggle}
      />

    </div>
  );

  return (
    <>
      {/* Top loading bar */}
      {isPending && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div className="h-full bg-red-500 animate-loading-bar" />
          <style>{`
            @keyframes loading-bar {
              0% { width: 0%; margin-left: 0; }
              30% { width: 40%; margin-left: 0; }
              60% { width: 30%; margin-left: 50%; }
              100% { width: 0%; margin-left: 100%; }
            }
            .animate-loading-bar {
              animation: loading-bar 1.2s ease-in-out infinite;
            }
          `}</style>
        </div>
      )}

      {/* Loading spinner pill — fixed to top center of viewport */}
      {isPending && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-2 bg-white dark:bg-gray-800 shadow-lg rounded-full px-5 py-2.5 border border-gray-200 dark:border-gray-700">
          <svg className="w-5 h-5 text-red-500 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span className="text-sm font-medium text-gray-600 dark:text-gray-300">Updating results...</span>
        </div>
      )}

      {/* Desktop sidebar */}
      <div className="hidden lg:block">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-5 sticky top-24">
          {filterContent}
        </div>
      </div>

      {/* Mobile filter toggle + drawer */}
      <div className="lg:hidden mb-4">
        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
            />
          </svg>
          Filters
          {activeFilters.length > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {activeFilters.length}
            </span>
          )}
        </button>

        {isMobileOpen && (
          <div className="mt-3 bg-white dark:bg-gray-800 rounded-xl shadow p-5">
            {filterContent}
          </div>
        )}
      </div>
    </>
  );
}
