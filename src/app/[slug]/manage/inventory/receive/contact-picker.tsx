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
// ContactPicker — keyboard-driven inline search for ecom.contacts (scoped to
// the active vendor account), with action items to create a new contact
// inline or to look up a platform account by exact email and pull them in
// as a contact.
//
// Mirrors the shape of card-picker.tsx (debounce, keyboard nav, dropdown).
// ---------------------------------------------------------------------------

export type ContactRow = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  linked_account_id: string | null;
  link_status: "unlinked" | "invited" | "linked" | "declined";
};

export type ContactPickerHandle = {
  focus: () => void;
  clear: () => void;
};

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());
}

type Props = {
  accountId: string;
  onSelect: (contact: ContactRow) => void;
  placeholder?: string;
  autoFocus?: boolean;
};

export const ContactPicker = forwardRef<ContactPickerHandle, Props>(
  function ContactPicker(
    {
      accountId,
      onSelect,
      placeholder = "Search contacts by name or email…",
      autoFocus = false,
    },
    ref,
  ) {
    const supabase = useMemo(() => createClient(), []);
    const inputRef = useRef<HTMLInputElement | null>(null);

    const [query, setQuery] = useState("");
    const debounced = useDebounced(query, 250);
    const [results, setResults] = useState<ContactRow[]>([]);
    const [searching, setSearching] = useState(false);
    const [open, setOpen] = useState(false);
    const [highlight, setHighlight] = useState(0);

    // Inline "create new" mini-form state
    const [createOpen, setCreateOpen] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createEmail, setCreateEmail] = useState("");
    const [createPhone, setCreatePhone] = useState("");
    const [createSendInvite, setCreateSendInvite] = useState(true);
    const [createBusy, setCreateBusy] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [createNotice, setCreateNotice] = useState<string | null>(null);

    // Email lookup state
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupResult, setLookupResult] = useState<
      | { found: true; account_id: string; slug: string | null; name: string | null }
      | { found: false }
      | null
    >(null);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
      clear: () => {
        setQuery("");
        setResults([]);
        setHighlight(0);
        setCreateOpen(false);
        setLookupResult(null);
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
            .schema("ecom")
            .from("contacts")
            .select("id, account_id, name, email, phone, linked_account_id, link_status")
            .eq("account_id", accountId),
          term,
          ["name", "email"],
        )
          .order("name", { ascending: true })
          .limit(20);
        if (!cancelled) {
          setResults((data ?? []) as ContactRow[]);
          setHighlight(0);
          setSearching(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [supabase, debounced, accountId]);

    // Reset side panels when query changes substantially
    useEffect(() => {
      setLookupResult(null);
    }, [debounced]);

    const totalItems = results.length + 2; // + "save new" + "find by email"
    const idxSaveNew = results.length;
    const idxLookup = results.length + 1;

    const choose = useCallback(
      (idx: number) => {
        if (idx < results.length) {
          const c = results[idx];
          if (!c) return;
          onSelect(c);
          setQuery("");
          setResults([]);
          setHighlight(0);
          setCreateOpen(false);
          setLookupResult(null);
          inputRef.current?.focus();
          return;
        }
        if (idx === idxSaveNew) {
          // Prefill name/email from current query
          const q = query.trim();
          if (looksLikeEmail(q)) {
            setCreateEmail(q);
            setCreateName("");
          } else {
            setCreateName(q);
            setCreateEmail("");
          }
          setCreateOpen(true);
          setLookupResult(null);
          return;
        }
        if (idx === idxLookup) {
          // Trigger the lookup
          void doLookup();
          return;
        }
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [results, query, idxSaveNew, idxLookup, onSelect],
    );

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (createOpen) return; // let the inline form keys work normally
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

    // ----- Create flow ------------------------------------------------------

    const submitCreate = async () => {
      if (!createName.trim()) {
        setCreateError("Name is required");
        return;
      }
      setCreateBusy(true);
      setCreateError(null);
      setCreateNotice(null);
      try {
        const emailNorm = createEmail.trim().toLowerCase() || null;

        // If an email is provided, check for a duplicate first so we can
        // surface a clean error rather than the postgres unique-constraint
        // message.
        if (emailNorm) {
          const { data: existing } = await supabase
            .schema("ecom")
            .from("contacts")
            .select("id, account_id, name, email, phone, linked_account_id, link_status")
            .eq("account_id", accountId)
            .eq("email", emailNorm)
            .maybeSingle();
          if (existing) {
            onSelect(existing as ContactRow);
            setQuery("");
            setResults([]);
            setHighlight(0);
            setCreateOpen(false);
            return;
          }
        }

        // Try to find an existing platform account for this email up front
        // so we can pre-populate linked_account_id (and avoid the invite
        // path entirely when the user is already on the platform).
        let linkedAccountId: string | null = null;
        let linkStatus: ContactRow["link_status"] = "unlinked";
        if (emailNorm) {
          const { data: foundRows } = await supabase
            .schema("ecom")
            .rpc("find_user_by_email", { p_email: emailNorm });
          const found = (foundRows as { account_id: string }[] | null)?.[0];
          if (found) {
            linkedAccountId = found.account_id;
            linkStatus = "linked";
          }
        }

        const insertRow = {
          account_id: accountId,
          name: createName.trim(),
          email: emailNorm,
          phone: createPhone.trim() || null,
          linked_account_id: linkedAccountId,
          link_status: linkStatus,
        };
        const { data: created, error: createErr } = await supabase
          .schema("ecom")
          .from("contacts")
          .insert(insertRow)
          .select("id, account_id, name, email, phone, linked_account_id, link_status")
          .single();
        if (createErr || !created) throw createErr ?? new Error("Failed to save contact");
        const contact = created as ContactRow;

        // Optionally send invite (only if there's an email and they're not
        // already on the platform).
        if (createSendInvite && emailNorm && !linkedAccountId) {
          try {
            const res = await fetch("/api/contacts/invite", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ accountId, contactId: contact.id }),
            });
            const body = await res.json().catch(() => null);
            if (res.ok && body) {
              if (!body.emailSent) {
                setCreateNotice(
                  `Contact saved. Email not sent (${body.reason ?? "no reason given"}). Ask them to sign up — they'll be auto-linked when they do.`,
                );
              }
              // Refresh the contact's link_status if invited
              if (body.emailSent || body.reason) {
                const { data: refreshed } = await supabase
                  .schema("ecom")
                  .from("contacts")
                  .select("id, account_id, name, email, phone, linked_account_id, link_status")
                  .eq("id", contact.id)
                  .single();
                if (refreshed) {
                  onSelect(refreshed as ContactRow);
                  setQuery("");
                  setResults([]);
                  setHighlight(0);
                  setCreateOpen(false);
                  setCreateName("");
                  setCreateEmail("");
                  setCreatePhone("");
                  return;
                }
              }
            }
          } catch {
            // Non-fatal — the contact was saved.
          }
        }

        onSelect(contact);
        setQuery("");
        setResults([]);
        setHighlight(0);
        setCreateOpen(false);
        setCreateName("");
        setCreateEmail("");
        setCreatePhone("");
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setCreateBusy(false);
      }
    };

    // ----- Lookup flow ------------------------------------------------------

    const doLookup = async () => {
      const q = query.trim();
      if (!looksLikeEmail(q)) {
        // Treat as "save as new" — open the form prefilled with name.
        setCreateName(q);
        setCreateEmail("");
        setCreateOpen(true);
        return;
      }
      setLookupBusy(true);
      try {
        const { data } = await supabase
          .schema("ecom")
          .rpc("find_user_by_email", { p_email: q });
        const row = (data as
          | { account_id: string; slug: string | null; name: string | null }[]
          | null)?.[0];
        if (row) {
          setLookupResult({
            found: true,
            account_id: row.account_id,
            slug: row.slug,
            name: row.name,
          });
        } else {
          setLookupResult({ found: false });
        }
      } finally {
        setLookupBusy(false);
      }
    };

    const addFromLookup = async () => {
      if (!lookupResult || !lookupResult.found) return;
      setCreateBusy(true);
      try {
        const emailNorm = query.trim().toLowerCase();
        const insertRow = {
          account_id: accountId,
          name: lookupResult.name?.trim() || emailNorm,
          email: emailNorm,
          phone: null,
          linked_account_id: lookupResult.account_id,
          link_status: "linked" as const,
        };
        // De-dup
        const { data: existing } = await supabase
          .schema("ecom")
          .from("contacts")
          .select("id, account_id, name, email, phone, linked_account_id, link_status")
          .eq("account_id", accountId)
          .eq("email", emailNorm)
          .maybeSingle();
        if (existing) {
          onSelect(existing as ContactRow);
        } else {
          const { data: created, error } = await supabase
            .schema("ecom")
            .from("contacts")
            .insert(insertRow)
            .select("id, account_id, name, email, phone, linked_account_id, link_status")
            .single();
          if (error || !created) throw error ?? new Error("Save failed");
          onSelect(created as ContactRow);
        }
        setQuery("");
        setResults([]);
        setHighlight(0);
        setLookupResult(null);
      } catch (e) {
        setCreateError(e instanceof Error ? e.message : "Save failed");
      } finally {
        setCreateBusy(false);
      }
    };

    // ----- Render -----------------------------------------------------------

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
            setCreateOpen(false);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay so clicks register
            setTimeout(() => {
              if (!createOpen) setOpen(false);
            }, 150);
          }}
          onKeyDown={handleKey}
          placeholder={placeholder}
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
        />
        {open && (query.trim() || searching || createOpen) && (
          <div className="absolute z-30 mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg max-h-[28rem] overflow-y-auto">
            {!createOpen && (
              <>
                {searching && results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">Searching…</div>
                ) : results.length === 0 ? (
                  <div className="p-3 text-sm text-gray-500">
                    No matches — use an action below.
                  </div>
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
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 text-left border-b border-gray-100 dark:border-gray-700 ${
                        i === highlight
                          ? "bg-red-50 dark:bg-red-900/20"
                          : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-1">
                          {c.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1">
                          {c.email ?? "—"}
                          {c.phone ? ` · ${c.phone}` : ""}
                        </p>
                      </div>
                      <LinkStatusBadge status={c.link_status} />
                    </button>
                  ))
                )}

                {lookupResult && (
                  <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 bg-amber-50 dark:bg-amber-900/20">
                    {lookupResult.found ? (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            Platform account found: {lookupResult.name ?? lookupResult.slug ?? "(unnamed)"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {lookupResult.slug ? `/${lookupResult.slug}` : lookupResult.account_id}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={createBusy}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            void addFromLookup();
                          }}
                          className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-50"
                        >
                          Add + link
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        No platform account for that email. Use “Save as new
                        contact” below to invite them.
                      </p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(idxSaveNew);
                  }}
                  onMouseEnter={() => setHighlight(idxSaveNew)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium text-red-500 hover:text-red-600 border-b border-gray-100 dark:border-gray-700 ${
                    idxSaveNew === highlight
                      ? "bg-red-50 dark:bg-red-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  + Save as new contact
                </button>
                <button
                  type="button"
                  disabled={lookupBusy}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(idxLookup);
                  }}
                  onMouseEnter={() => setHighlight(idxLookup)}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium ${
                    looksLikeEmail(query)
                      ? "text-red-500 hover:text-red-600"
                      : "text-gray-400 cursor-not-allowed"
                  } ${
                    idxLookup === highlight
                      ? "bg-red-50 dark:bg-red-900/20"
                      : "hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  }`}
                >
                  {lookupBusy ? "Looking up…" : "Find by exact email…"}
                </button>
              </>
            )}

            {createOpen && (
              <div className="p-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  New contact
                </p>
                <input
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="Name *"
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
                <input
                  type="email"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  placeholder="Email"
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
                <input
                  type="tel"
                  value={createPhone}
                  onChange={(e) => setCreatePhone(e.target.value)}
                  placeholder="Phone"
                  className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                />
                <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                  <input
                    type="checkbox"
                    checked={createSendInvite}
                    onChange={(e) => setCreateSendInvite(e.target.checked)}
                  />
                  Send invite email (if email provided)
                </label>
                {createError && (
                  <p className="text-xs text-red-600 dark:text-red-400">{createError}</p>
                )}
                {createNotice && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">{createNotice}</p>
                )}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setCreateOpen(false);
                      setCreateError(null);
                      setCreateNotice(null);
                    }}
                    className="px-3 py-1 text-xs text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={createBusy}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      void submitCreate();
                    }}
                    className="px-3 py-1 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 disabled:opacity-50"
                  >
                    {createBusy ? "Saving…" : "Save contact"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

export function LinkStatusBadge({
  status,
}: {
  status: "unlinked" | "invited" | "linked" | "declined";
}) {
  const styles =
    status === "linked"
      ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
      : status === "invited"
        ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
        : status === "declined"
          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
          : "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300";
  const label =
    status === "linked"
      ? "Linked"
      : status === "invited"
        ? "Invited"
        : status === "declined"
          ? "Declined"
          : "Unlinked";
  return (
    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full uppercase tracking-wide ${styles}`}>
      {label}
    </span>
  );
}
