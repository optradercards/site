"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { LinkStatusBadge } from "../inventory/receive/contact-picker";

// ---------------------------------------------------------------------------
// /manage/contacts — vendor-side CRM for tracking people they do business
// with (consignors, buyers, suppliers). Mirrors the visual pattern of
// /manage/inventory.
// ---------------------------------------------------------------------------

type ContactRow = {
  id: string;
  account_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  linked_account_id: string | null;
  link_status: "unlinked" | "invited" | "linked" | "declined";
  created_at: string;
};

type LinkedAccountInfo = {
  id: string;
  slug: string | null;
  name: string | null;
};

export default function ContactsPage() {
  const supabase = useMemo(() => createClient(), []);
  const { activeAccountId } = useAccounts();

  const [rows, setRows] = useState<ContactRow[]>([]);
  const [linkedAccounts, setLinkedAccounts] = useState<Map<string, LinkedAccountInfo>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");

  // New-contact inline form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newSendInvite, setNewSendInvite] = useState(true);
  const [newBusy, setNewBusy] = useState(false);
  const [newNotice, setNewNotice] = useState<string | null>(null);

  // Per-row state
  const [editing, setEditing] = useState<Record<string, Partial<ContactRow>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [resendNotice, setResendNotice] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadContacts = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .schema("ecom")
      .from("contacts")
      .select(
        "id, account_id, name, email, phone, notes, linked_account_id, link_status, created_at",
      )
      .eq("account_id", activeAccountId)
      .order("created_at", { ascending: false });
    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    const contacts = (data ?? []) as ContactRow[];
    setRows(contacts);

    // Fetch linked basejump.accounts for any contacts that have one.
    const linkedIds = Array.from(
      new Set(contacts.map((c) => c.linked_account_id).filter((x): x is string => !!x)),
    );
    if (linkedIds.length > 0) {
      const { data: accs } = await supabase
        .schema("basejump")
        .from("accounts")
        .select("id, slug, name")
        .in("id", linkedIds);
      const map = new Map<string, LinkedAccountInfo>();
      (accs ?? []).forEach((a) => {
        const acc = a as LinkedAccountInfo;
        map.set(acc.id, acc);
      });
      setLinkedAccounts(map);
    } else {
      setLinkedAccounts(new Map());
    }
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    void loadContacts();
  }, [loadContacts]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(s) ||
        (r.email?.toLowerCase().includes(s) ?? false) ||
        (r.phone?.toLowerCase().includes(s) ?? false),
    );
  }, [rows, search]);

  // ----- Create new contact -------------------------------------------------

  const createContact = async () => {
    if (!activeAccountId) return;
    const name = newName.trim();
    if (!name) {
      setNewNotice("Name is required");
      return;
    }
    setNewBusy(true);
    setNewNotice(null);
    try {
      const emailNorm = newEmail.trim().toLowerCase() || null;

      // Check for an existing contact with this email
      if (emailNorm) {
        const { data: existing } = await supabase
          .schema("ecom")
          .from("contacts")
          .select("id")
          .eq("account_id", activeAccountId)
          .eq("email", emailNorm)
          .maybeSingle();
        if (existing) {
          setNewNotice("A contact with this email already exists.");
          setNewBusy(false);
          return;
        }
      }

      // Up-front platform lookup so we can set linked_account_id immediately.
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

      const { data: created, error: insertErr } = await supabase
        .schema("ecom")
        .from("contacts")
        .insert({
          account_id: activeAccountId,
          name,
          email: emailNorm,
          phone: newPhone.trim() || null,
          linked_account_id: linkedAccountId,
          link_status: linkStatus,
        })
        .select(
          "id, account_id, name, email, phone, notes, linked_account_id, link_status, created_at",
        )
        .single();
      if (insertErr || !created) throw insertErr ?? new Error("Failed to save contact");

      // Optionally invite.
      if (newSendInvite && emailNorm && !linkedAccountId) {
        try {
          const res = await fetch("/api/contacts/invite", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              accountId: activeAccountId,
              contactId: (created as ContactRow).id,
            }),
          });
          const body = await res.json().catch(() => null);
          if (res.ok && body && !body.emailSent) {
            setNewNotice(
              `Contact saved. Email not sent (${body.reason ?? "no reason"}). Share the signup URL with them — they'll auto-link on signup.`,
            );
          }
        } catch {
          /* non-fatal */
        }
      }

      // Reset form + reload list
      setNewName("");
      setNewEmail("");
      setNewPhone("");
      await loadContacts();
    } catch (e) {
      setNewNotice(e instanceof Error ? e.message : "Save failed");
    } finally {
      setNewBusy(false);
    }
  };

  // ----- Inline edit --------------------------------------------------------

  const startEdit = (row: ContactRow) => {
    setEditing((prev) => ({
      ...prev,
      [row.id]: { name: row.name, phone: row.phone, notes: row.notes },
    }));
  };

  const cancelEdit = (id: string) => {
    setEditing((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const saveEdit = async (id: string) => {
    const patch = editing[id];
    if (!patch) return;
    setSavingId(id);
    try {
      const { error: err } = await supabase
        .schema("ecom")
        .from("contacts")
        .update({
          name: (patch.name ?? "").toString().trim() || undefined,
          phone: (patch.phone ?? "")?.toString().trim() || null,
          notes: (patch.notes ?? "")?.toString().trim() || null,
        })
        .eq("id", id);
      if (err) throw err;
      cancelEdit(id);
      await loadContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingId(null);
    }
  };

  // ----- Resend invite ------------------------------------------------------

  const resendInvite = async (row: ContactRow) => {
    if (!activeAccountId) return;
    setResendingId(row.id);
    setResendNotice(null);
    try {
      const res = await fetch("/api/contacts/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccountId, contactId: row.id }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setResendNotice(body?.error ?? "Resend failed");
      } else if (body?.emailSent) {
        setResendNotice(`Invite re-sent to ${row.email}`);
      } else {
        setResendNotice(
          `Recorded. Email not sent: ${body?.reason ?? "unknown reason"}`,
        );
      }
      await loadContacts();
    } catch (e) {
      setResendNotice(e instanceof Error ? e.message : "Resend failed");
    } finally {
      setResendingId(null);
    }
  };

  // ----- Delete -------------------------------------------------------------

  const deleteContact = async (row: ContactRow) => {
    if (!confirm(`Delete contact "${row.name}"? This cannot be undone.`)) return;
    setDeletingId(row.id);
    try {
      const { error: err } = await supabase
        .schema("ecom")
        .from("contacts")
        .delete()
        .eq("id", row.id);
      if (err) throw err;
      await loadContacts();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  // ----- Render -------------------------------------------------------------

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
        Contacts
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Track the people you do business with — consignors, buyers, suppliers.
        When their email matches a platform account they auto-link.
      </p>

      {/* New contact form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
          New contact
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Name *"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          />
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Email"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          />
          <input
            type="tel"
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Phone"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
          />
        </div>
        <div className="flex items-center justify-between mt-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <input
              type="checkbox"
              checked={newSendInvite}
              onChange={(e) => setNewSendInvite(e.target.checked)}
            />
            Send invite email (if email provided and not already on platform)
          </label>
          <button
            type="button"
            disabled={newBusy || !activeAccountId}
            onClick={createContact}
            className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            {newBusy ? "Saving…" : "Add contact"}
          </button>
        </div>
        {newNotice && (
          <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">{newNotice}</p>
        )}
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, phone…"
          className="block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
        />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      )}
      {resendNotice && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 rounded text-amber-700 dark:text-amber-300 text-sm">
          {resendNotice}
        </div>
      )}

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-gray-500">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">
            {rows.length === 0 ? "No contacts yet." : "No contacts match that search."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 uppercase text-xs">
                <tr>
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-left">Email</th>
                  <th className="px-3 py-2 text-left">Phone</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Linked account</th>
                  <th className="px-3 py-2 text-left">Notes</th>
                  <th className="px-3 py-2 text-left">Added</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((row) => {
                  const isEditing = !!editing[row.id];
                  const linked = row.linked_account_id
                    ? linkedAccounts.get(row.linked_account_id)
                    : null;
                  return (
                    <tr key={row.id} className="align-top">
                      <td className="px-3 py-2">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editing[row.id]?.name ?? ""}
                            onChange={(e) =>
                              setEditing((p) => ({
                                ...p,
                                [row.id]: { ...p[row.id], name: e.target.value },
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                        ) : (
                          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                            {row.name}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {row.email ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                        {isEditing ? (
                          <input
                            type="tel"
                            value={editing[row.id]?.phone ?? ""}
                            onChange={(e) =>
                              setEditing((p) => ({
                                ...p,
                                [row.id]: { ...p[row.id], phone: e.target.value },
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                        ) : (
                          row.phone ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <LinkStatusBadge status={row.link_status} />
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300">
                        {linked?.slug ? (
                          <Link
                            href={`/${linked.slug}`}
                            target="_blank"
                            className="text-red-500 hover:text-red-600"
                          >
                            /{linked.slug}
                          </Link>
                        ) : (
                          row.linked_account_id ?? "—"
                        )}
                      </td>
                      <td className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 max-w-xs">
                        {isEditing ? (
                          <textarea
                            value={editing[row.id]?.notes ?? ""}
                            onChange={(e) =>
                              setEditing((p) => ({
                                ...p,
                                [row.id]: { ...p[row.id], notes: e.target.value },
                              }))
                            }
                            rows={2}
                            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-2 py-1 text-sm text-gray-900 dark:text-gray-100 focus:border-red-500 focus:ring-red-500"
                          />
                        ) : (
                          <p className="line-clamp-2">{row.notes ?? "—"}</p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={savingId === row.id}
                              onClick={() => saveEdit(row.id)}
                              className="text-sm font-medium text-red-500 hover:text-red-600 mr-3 disabled:opacity-50"
                            >
                              {savingId === row.id ? "Saving…" : "Save"}
                            </button>
                            <button
                              type="button"
                              onClick={() => cancelEdit(row.id)}
                              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="text-sm text-gray-500 hover:text-red-500 mr-3"
                            >
                              Edit
                            </button>
                            {row.link_status === "invited" && row.email && (
                              <button
                                type="button"
                                disabled={resendingId === row.id}
                                onClick={() => resendInvite(row)}
                                className="text-sm text-amber-600 hover:text-amber-700 dark:text-amber-400 dark:hover:text-amber-300 mr-3 disabled:opacity-50"
                              >
                                {resendingId === row.id ? "Sending…" : "Re-send invite"}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={deletingId === row.id}
                              onClick={() => deleteContact(row)}
                              className="text-sm text-red-500 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingId === row.id ? "Deleting…" : "Delete"}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
