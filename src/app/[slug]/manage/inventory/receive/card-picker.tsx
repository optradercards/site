"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { applyMultiWordIlike } from "@/lib/search";

// ---------------------------------------------------------------------------
// CardPicker — keyboard-driven inline search for cards.products_with_details,
// with a "+ Custom product" sentinel that opens a sub-form. Used by all
// three modes of /manage/inventory/receive.
// ---------------------------------------------------------------------------

// Market reference fields straight from cards.products_with_details (USD cents).
// Used by callers to render a market price next to the card and per line row.
export type MarketSnapshot = {
  price_ungraded: number | null;
  price_psa_1: number | null;
  price_psa_2: number | null;
  price_psa_3: number | null;
  price_psa_4: number | null;
  price_psa_5: number | null;
  price_psa_6: number | null;
  price_psa_7: number | null;
  price_psa_8: number | null;
  price_psa_9: number | null;
  price_psa_10: number | null;
  price_psa_9_5: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
};

export type CardOption = {
  id: string;
  name: string;
  image_url: string | null;
  set_name: string | null;
  card_number: string | null;
  rarity: string | null;
} & MarketSnapshot;

export type PickedCard =
  | { kind: "card"; card: CardOption }
  | { kind: "custom" };

export type CardPickerHandle = {
  focus: () => void;
  clear: () => void;
};

function useDebounced<T>(value: T, ms = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

type Props = {
  onPick: (picked: PickedCard) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export const CardPicker = forwardRef<CardPickerHandle, Props>(function CardPicker(
  { onPick, placeholder = "Search cards by name...", autoFocus = false },
  ref,
) {
  const supabase = useMemo(() => createClient(), []);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [query, setQuery] = useState("");
  const debounced = useDebounced(query, 200);
  const [results, setResults] = useState<CardOption[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);

  useImperativeHandle(ref, () => ({
    focus: () => inputRef.current?.focus(),
    clear: () => {
      setQuery("");
      setResults([]);
      setHighlight(0);
    },
  }));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const term = debounced.trim();
      if (!term) {
        setResults([]);
        setSearching(false);
        return;
      }
      setSearching(true);
      const { data } = await applyMultiWordIlike(
        supabase
          .schema("cards")
          .from("products_with_details")
          .select(
            "id, name, image_url, set_name, card_number, rarity," +
              "price_ungraded, price_psa_1, price_psa_2, price_psa_3, price_psa_4," +
              "price_psa_5, price_psa_6, price_psa_7, price_psa_8, price_psa_9," +
              "price_psa_10, price_psa_9_5, price_bgs, price_cgc",
          ),
        term,
        ["name", "card_number", "language"],
      ).limit(20);
      if (!cancelled) {
        setResults((data ?? []) as unknown as CardOption[]);
        setHighlight(0);
        setSearching(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, debounced]);

  // Items shown in dropdown: results + the "+ Custom product" sentinel
  // at the end. The sentinel is index = results.length.
  const totalItems = results.length + 1;
  const customIndex = results.length;

  const choose = useCallback(
    (idx: number) => {
      if (idx === customIndex) {
        onPick({ kind: "custom" });
      } else {
        const card = results[idx];
        if (!card) return;
        onPick({ kind: "card", card });
      }
      setQuery("");
      setResults([]);
      setHighlight(0);
      // Stay focused so user can immediately type next card
      inputRef.current?.focus();
    },
    [customIndex, onPick, results],
  );

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => (h - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (totalItems === 0) return;
      choose(highlight);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={query}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Delay so clicks register
          setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKey}
        placeholder={placeholder}
        className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
      />
      {open && (query.trim() || searching) && (
        <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-96 overflow-y-auto">
          {searching && results.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">Searching...</div>
          ) : results.length === 0 ? (
            <div className="p-3 text-sm text-gray-500">No matches.</div>
          ) : (
            results.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(i);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={`w-full flex items-center gap-3 px-3 py-2 text-left border-b border-gray-100 dark:border-gray-700 ${
                  i === highlight
                    ? "bg-red-50 dark:bg-red-900/20"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                }`}
              >
                {c.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={c.image_url}
                    alt={c.name}
                    className="w-8 h-11 object-contain rounded shrink-0"
                  />
                ) : (
                  <div className="w-8 h-11 bg-gray-200 dark:bg-gray-600 rounded shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                    {c.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                    {[c.set_name, c.card_number ? `#${c.card_number}` : null, c.rarity]
                      .filter(Boolean)
                      .join(" • ")}
                  </p>
                </div>
                {c.price_ungraded != null && (
                  <div className="shrink-0 text-right">
                    <p className="text-xs text-gray-400 dark:text-gray-500 leading-none">
                      Market
                    </p>
                    <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                      ${(c.price_ungraded / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
                <a
                  href={`/products/${c.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
                  title="Open product page in new tab"
                  className="shrink-0 p-1 text-gray-400 hover:text-red-500"
                  aria-label={`Open ${c.name} product page`}
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                    />
                  </svg>
                </a>
              </button>
            ))
          )}
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault();
              choose(customIndex);
            }}
            onMouseEnter={() => setHighlight(customIndex)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm font-medium text-red-500 hover:text-red-600 ${
              customIndex === highlight
                ? "bg-red-50 dark:bg-red-900/20"
                : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
            }`}
          >
            + Custom product
          </button>
        </div>
      )}
    </div>
  );
});
