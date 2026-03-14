"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Suggestion = {
  label: string;
  type: "card" | "set" | "seller";
  slug: string | null;
};

export default function SearchBar() {
  const router = useRouter();
  const supabase = createClient();
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Fetch suggestions with debounce
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      const { data, error } = await supabase.rpc("search_suggestions", {
        query: query.trim(),
      });
      if (!error && data) {
        setSuggestions(data as Suggestion[]);
        setIsOpen(data.length > 0);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function navigate(suggestion: Suggestion) {
    setQuery(suggestion.label);
    setIsOpen(false);
    if (suggestion.type === "seller" && suggestion.slug) {
      router.push(`/${suggestion.slug}`);
    } else if (suggestion.type === "set") {
      router.push(`/search?set=${encodeURIComponent(suggestion.label)}`);
    } else {
      router.push(`/search?q=${encodeURIComponent(suggestion.label)}`);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (activeIndex >= 0 && activeIndex < suggestions.length) {
      navigate(suggestions[activeIndex]);
    } else if (query.trim()) {
      setIsOpen(false);
      router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    }
  }

  const typeLabel: Record<string, string> = {
    card: "Card",
    set: "Set",
    seller: "Seller",
  };

  const typeIcon: Record<string, React.ReactNode> = {
    card: (
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    set: (
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
    seller: (
      <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  };

  return (
    <div ref={containerRef} className="relative flex-1">
      <form onSubmit={handleSubmit} className="flex">
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
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
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onFocus={() => {
              if (suggestions.length > 0) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search for anything"
            autoComplete="off"
            className="w-full pl-9 pr-4 py-2.5 rounded-l-full text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-6 py-2.5 bg-red-500 text-white text-sm font-semibold rounded-r-full hover:bg-red-600 transition-colors"
        >
          Search
        </button>
      </form>

      {/* Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={`${s.type}-${s.label}`}
              onClick={() => navigate(s)}
              onMouseEnter={() => setActiveIndex(i)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm text-left transition-colors ${
                i === activeIndex
                  ? "bg-gray-100 dark:bg-gray-700"
                  : "hover:bg-gray-50 dark:hover:bg-gray-750"
              }`}
            >
              {typeIcon[s.type]}
              <span className="flex-1 truncate text-gray-800 dark:text-gray-200">
                {s.label}
              </span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400 shrink-0">
                {typeLabel[s.type]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
