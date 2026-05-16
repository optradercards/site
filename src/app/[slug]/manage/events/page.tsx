"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";
import { formatEventDateRange } from "@/app/(public)/events/format";

// ---------------------------------------------------------------------------
// Trader self-service: which upcoming events am I attending?
// RLS: trader can read all published events; insert/update/delete only their
// own row in event_traders.
// ---------------------------------------------------------------------------

type AttendanceStatus = "confirmed" | "tentative" | "declined";

type EventRow = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  address: string | null;
};

type AttendanceRow = {
  event_id: string;
  table_number: string | null;
  status: AttendanceStatus;
};

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: "confirmed", label: "Going" },
  { value: "tentative", label: "Maybe" },
  { value: "declined", label: "Not going" },
];

const STATUS_BADGE: Record<AttendanceStatus, string> = {
  confirmed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  tentative:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  declined:
    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

export default function ManageEventsPage() {
  const supabase = createClient();
  const { activeAccountId } = useAccounts();

  const [events, setEvents] = useState<EventRow[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRow>>({});
  const [loading, setLoading] = useState(true);
  const [savingFor, setSavingFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeAccountId) return;
    setLoading(true);
    setError(null);

    const now = new Date().toISOString();
    const [{ data: eventData, error: evErr }, { data: attData, error: attErr }] =
      await Promise.all([
        supabase
          .schema("events")
          .from("events")
          .select("id, slug, name, starts_at, ends_at, venue, address")
          .eq("status", "published")
          .gte("ends_at", now)
          .order("starts_at", { ascending: true }),
        supabase
          .schema("events")
          .from("event_traders")
          .select("event_id, table_number, status")
          .eq("account_id", activeAccountId),
      ]);

    if (evErr || attErr) {
      setError(evErr?.message ?? attErr?.message ?? "Could not load events");
      setLoading(false);
      return;
    }

    setEvents((eventData ?? []) as EventRow[]);
    const map: Record<string, AttendanceRow> = {};
    for (const a of (attData ?? []) as AttendanceRow[]) {
      map[a.event_id] = a;
    }
    setAttendance(map);
    setLoading(false);
  }, [supabase, activeAccountId]);

  useEffect(() => {
    load();
  }, [load]);

  const upsertAttendance = useCallback(
    async (
      eventId: string,
      patch: { status?: AttendanceStatus; table_number?: string | null }
    ) => {
      if (!activeAccountId) return;
      setSavingFor(eventId);
      setError(null);

      const existing = attendance[eventId];
      const next: AttendanceRow = {
        event_id: eventId,
        status: patch.status ?? existing?.status ?? "confirmed",
        table_number:
          "table_number" in patch
            ? (patch.table_number?.trim() ? patch.table_number.trim() : null)
            : (existing?.table_number ?? null),
      };

      const { error: upErr } = await supabase
        .schema("events")
        .from("event_traders")
        .upsert(
          {
            event_id: eventId,
            account_id: activeAccountId,
            status: next.status,
            table_number: next.table_number,
          },
          { onConflict: "event_id,account_id" }
        );

      if (upErr) {
        setError(upErr.message);
      } else {
        setAttendance((prev) => ({ ...prev, [eventId]: next }));
      }
      setSavingFor(null);
    },
    [supabase, activeAccountId, attendance]
  );

  const removeAttendance = useCallback(
    async (eventId: string) => {
      if (!activeAccountId) return;
      setSavingFor(eventId);
      setError(null);
      const { error: delErr } = await supabase
        .schema("events")
        .from("event_traders")
        .delete()
        .eq("event_id", eventId)
        .eq("account_id", activeAccountId);
      if (delErr) {
        setError(delErr.message);
      } else {
        setAttendance((prev) => {
          const next = { ...prev };
          delete next[eventId];
          return next;
        });
      }
      setSavingFor(null);
    },
    [supabase, activeAccountId]
  );

  const sorted = useMemo(() => events, [events]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
          Events
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          RSVP for upcoming events. Set your table number once you have it from
          the organiser — buyers will see it on the public event page.
        </p>
      </header>

      {error && (
        <div className="mb-4 px-3 py-2 text-sm rounded bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
      ) : sorted.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            No upcoming events right now.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((e) => {
            const att = attendance[e.id];
            const saving = savingFor === e.id;
            return (
              <li
                key={e.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-5"
              >
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex-1 min-w-[14rem]">
                    <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100">
                      {e.name}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">
                      {formatEventDateRange(e.starts_at, e.ends_at)}
                    </p>
                    {e.venue && (
                      <p className="text-sm text-gray-700 dark:text-gray-300 mt-0.5">
                        {e.venue}
                      </p>
                    )}
                  </div>
                  {att && (
                    <span
                      className={`text-xs font-medium px-2.5 py-1 rounded ${STATUS_BADGE[att.status]}`}
                    >
                      {
                        STATUS_OPTIONS.find((s) => s.value === att.status)
                          ?.label
                      }
                    </span>
                  )}
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 flex flex-wrap items-end gap-3">
                  <div className="flex-1 min-w-[10rem]">
                    <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                      Status
                    </label>
                    <select
                      value={att?.status ?? ""}
                      onChange={(e2) =>
                        upsertAttendance(e.id, {
                          status: e2.target.value as AttendanceStatus,
                        })
                      }
                      disabled={saving}
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
                    >
                      {!att && <option value="">Not attending</option>}
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex-1 min-w-[10rem]">
                    <label className="block text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                      Table number
                    </label>
                    <input
                      type="text"
                      defaultValue={att?.table_number ?? ""}
                      placeholder="e.g. B12"
                      disabled={!att || saving}
                      onBlur={(e2) => {
                        const v = e2.target.value;
                        if ((att?.table_number ?? "") !== v) {
                          upsertAttendance(e.id, { table_number: v });
                        }
                      }}
                      className="w-full px-2 py-1.5 text-sm rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-50"
                    />
                  </div>

                  {att && (
                    <button
                      type="button"
                      onClick={() => removeAttendance(e.id)}
                      disabled={saving}
                      className="px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 transition-colors"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
