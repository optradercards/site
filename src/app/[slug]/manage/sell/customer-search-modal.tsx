"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { matchesQuery } from "@/lib/search";

export type CustomerSearchContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

// Modal for finding an existing ecom.contact to attach as the buyer.
// Loaded as a one-shot list (account-scoped) and filtered client-side so
// search results update with every keystroke — no debounce, no roundtrip.
export default function CustomerSearchModal({
  isOpen,
  onClose,
  accountId,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  accountId: string | null;
  onSelect: (contact: CustomerSearchContact) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [contacts, setContacts] = useState<CustomerSearchContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset + reload on open
  useEffect(() => {
    if (!isOpen) return;
    setQuery("");
    if (!accountId) {
      setContacts([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .schema("ecom")
        .from("contacts")
        .select("id, name, email, phone")
        .eq("account_id", accountId)
        .order("name");
      if (cancelled) return;
      setContacts((data ?? []) as CustomerSearchContact[]);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, accountId, supabase]);

  // Focus the search box on open
  useEffect(() => {
    if (isOpen) {
      // Defer until the input is in the DOM
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const filtered = useMemo(() => {
    if (!query.trim()) return contacts;
    return contacts.filter((c) => matchesQuery(query, c.name, c.email, c.phone));
  }, [contacts, query]);

  const pick = useCallback(
    (c: CustomerSearchContact) => {
      onSelect(c);
      onClose();
    },
    [onSelect, onClose],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            Find customer
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none w-8 h-8 flex items-center justify-center"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-700">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email, or phone"
            className="block w-full px-4 py-3 text-base rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              Loading…
            </p>
          ) : contacts.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No saved customers yet. Fill in the buyer fields above for a
              walk-in — once you complete a sale with their email, they'll
              show up here next time.
            </p>
          ) : filtered.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              No matches for &ldquo;{query.trim()}&rdquo;.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-700">
              {filtered.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    className="w-full text-left px-5 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 focus:outline-none focus:bg-gray-50 dark:focus:bg-gray-700/50"
                  >
                    <p className="text-base font-medium text-gray-900 dark:text-gray-100">
                      {c.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || (
                        <span className="italic">no contact details</span>
                      )}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-5 py-3 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
          {filtered.length} of {contacts.length} customer
          {contacts.length === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );
}
