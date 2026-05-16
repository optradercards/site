import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "./format";

export const metadata: Metadata = {
  title: "Events — OP Trader",
  description:
    "Upcoming trading card events where OP Trader vendors are selling, trading, and meeting collectors in person.",
};

export const revalidate = 300;

type EventTrader = {
  account_id: string;
  slug: string;
  name: string;
  table_number: string | null;
};

type PublishedEvent = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  venue: string | null;
  address: string | null;
  hero_image_url: string | null;
  description: string | null;
  external_url: string | null;
  traders: EventTrader[];
};

export default async function EventsPage() {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .schema("events")
    .from("published_events_with_traders")
    .select("*")
    .gte("ends_at", now)
    .order("starts_at", { ascending: true });

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <h1 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
            Events couldn&apos;t load
          </h1>
          <p className="text-sm text-red-700 dark:text-red-300">{error.message}</p>
        </div>
      </div>
    );
  }

  const events = (data ?? []) as PublishedEvent[];

  return (
    <div className="container mx-auto px-4 py-12">
      <header className="mb-10">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-800 dark:text-gray-100 mb-3">
          Events
        </h1>
        <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl">
          Meet OP Trader vendors in person at upcoming TCG conventions, summits, and
          trade days across Australia.
        </p>
      </header>

      {events.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-10 text-center">
          <p className="text-gray-600 dark:text-gray-400">
            No upcoming events right now — check back soon.
          </p>
        </div>
      ) : (
        <ul className="grid gap-6 md:grid-cols-2">
          {events.map((e) => {
            const confirmedTraders = e.traders ?? [];
            return (
              <li key={e.id}>
                <Link
                  href={`/events/${e.slug}`}
                  className="group block bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow"
                >
                  {e.hero_image_url ? (
                    <div className="relative aspect-[16/9] bg-gray-100 dark:bg-gray-900">
                      <Image
                        src={e.hero_image_url}
                        alt={e.name}
                        fill
                        sizes="(min-width: 768px) 50vw, 100vw"
                        className="object-cover"
                      />
                    </div>
                  ) : (
                    <div className="aspect-[16/9] bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
                      <span className="text-white text-2xl font-bold tracking-tight px-6 text-center">
                        {e.name}
                      </span>
                    </div>
                  )}
                  <div className="p-6 space-y-3">
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-100 group-hover:text-red-500 transition-colors">
                      {e.name}
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {formatEventDateRange(e.starts_at, e.ends_at)}
                    </p>
                    {e.venue && (
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        {e.venue}
                      </p>
                    )}
                    {confirmedTraders.length > 0 && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
                        {confirmedTraders.length}{" "}
                        {confirmedTraders.length === 1 ? "vendor" : "vendors"} attending
                      </p>
                    )}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
