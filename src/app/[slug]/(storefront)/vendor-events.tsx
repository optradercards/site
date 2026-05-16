import Link from "next/link";
import type { SupabaseClient } from "@supabase/supabase-js";
import { formatEventDateRange } from "@/app/(public)/events/format";

export type VendorEvent = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  table_number: string | null;
  status: "confirmed" | "tentative";
};

export async function fetchVendorUpcomingEvents(
  supabase: SupabaseClient,
  slug: string
): Promise<VendorEvent[]> {
  const { data: accountRows } = await supabase
    .schema("basejump")
    .from("accounts")
    .select("id")
    .eq("slug", slug)
    .limit(1);
  const accountId = accountRows?.[0]?.id as string | undefined;
  if (!accountId) return [];

  const { data: attendance } = await supabase
    .schema("events")
    .from("event_traders")
    .select("event_id, table_number, status")
    .eq("account_id", accountId)
    .in("status", ["confirmed", "tentative"]);

  if (!attendance?.length) return [];

  const eventIds = attendance.map((r) => r.event_id);
  const attMap = new Map(
    attendance.map((r) => [
      r.event_id as string,
      {
        table_number: r.table_number as string | null,
        status: r.status as "confirmed" | "tentative",
      },
    ])
  );

  const now = new Date().toISOString();
  const { data: events } = await supabase
    .schema("events")
    .from("events")
    .select("id, slug, name, starts_at, ends_at, venue")
    .in("id", eventIds)
    .eq("status", "published")
    .gte("ends_at", now)
    .order("starts_at", { ascending: true });

  return (events ?? []).map((e) => {
    const a = attMap.get(e.id as string)!;
    return {
      id: e.id as string,
      slug: e.slug as string,
      name: e.name as string,
      starts_at: e.starts_at as string,
      ends_at: e.ends_at as string,
      venue: e.venue as string | null,
      table_number: a.table_number,
      status: a.status,
    };
  });
}

export function VendorEventsStrip({
  events,
  sellerName,
}: {
  events: VendorEvent[];
  sellerName: string;
}) {
  if (events.length === 0) return null;
  return (
    <section
      aria-label={`${sellerName} upcoming events`}
      className="mb-6 rounded-lg bg-gradient-to-r from-red-50 to-amber-50 dark:from-red-950/30 dark:to-amber-950/20 border border-red-100 dark:border-red-900/40 p-4 md:p-5"
    >
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <h2 className="text-sm font-semibold text-red-700 dark:text-red-300">
          <span className="mr-1.5">🎪</span>
          Catch us in person
        </h2>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {events.length === 1
            ? "1 upcoming event"
            : `${events.length} upcoming events`}
        </p>
      </div>
      <ul className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <li key={e.id}>
            <Link
              href={`/events/${e.slug}`}
              className="block bg-white dark:bg-gray-800 rounded-lg p-3 border border-transparent hover:border-red-300 dark:hover:border-red-700 transition-colors group"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-800 dark:text-gray-100 line-clamp-1 group-hover:text-red-600 transition-colors">
                  {e.name}
                </p>
                {e.status === "tentative" && (
                  <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium uppercase">
                    Maybe
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                {formatEventDateRange(e.starts_at, e.ends_at)}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                {e.venue && <span className="line-clamp-1">{e.venue}</span>}
                {e.table_number && (
                  <span className="shrink-0 px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 font-medium">
                    Table {e.table_number}
                  </span>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
