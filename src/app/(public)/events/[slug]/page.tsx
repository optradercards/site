import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatEventDateRange } from "../format";

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

async function fetchEvent(slug: string): Promise<PublishedEvent | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .schema("events")
    .from("published_events_with_traders")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error || !data) return null;
  return data as PublishedEvent;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) return { title: "Event — OP Trader" };
  return {
    title: `${event.name} — OP Trader`,
    description:
      event.description ??
      `${event.name} on ${formatEventDateRange(event.starts_at, event.ends_at)}.`,
  };
}

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const event = await fetchEvent(slug);
  if (!event) notFound();

  const traders = event.traders ?? [];
  const isPast = new Date(event.ends_at) < new Date();

  return (
    <div className="container mx-auto px-4 py-8 md:py-12">
      <nav aria-label="Breadcrumb" className="mb-6 text-sm">
        <ol className="flex items-center gap-1.5 flex-wrap text-gray-500 dark:text-gray-400">
          <li>
            <Link
              href="/"
              className="hover:text-red-500 transition-colors"
            >
              Home
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">
            /
          </li>
          <li>
            <Link
              href="/events"
              className="hover:text-red-500 transition-colors"
            >
              Events
            </Link>
          </li>
          <li aria-hidden="true" className="text-gray-300 dark:text-gray-600">
            /
          </li>
          <li
            aria-current="page"
            className="text-gray-800 dark:text-gray-200 font-medium line-clamp-1"
          >
            {event.name}
          </li>
        </ol>
      </nav>

      <article className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
        {event.hero_image_url ? (
          <div className="relative aspect-[16/9] md:aspect-[21/9] bg-gray-100 dark:bg-gray-900">
            <Image
              src={event.hero_image_url}
              alt={event.name}
              fill
              sizes="(min-width: 768px) 80vw, 100vw"
              priority
              className="object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] md:aspect-[21/9] bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <span className="text-white text-3xl md:text-5xl font-bold tracking-tight px-6 text-center">
              {event.name}
            </span>
          </div>
        )}

        <div className="p-6 md:p-10 space-y-8">
          <header className="space-y-3">
            {isPast && (
              <span className="inline-block px-2.5 py-1 text-xs font-medium uppercase tracking-wide bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                Past event
              </span>
            )}
            <h1 className="text-3xl md:text-5xl font-bold text-gray-800 dark:text-gray-100">
              {event.name}
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">
              {formatEventDateRange(event.starts_at, event.ends_at)}
            </p>
          </header>

          <dl className="grid gap-4 md:grid-cols-2">
            {event.venue && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Venue
                </dt>
                <dd className="text-gray-800 dark:text-gray-200">{event.venue}</dd>
              </div>
            )}
            {event.address && (
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-1">
                  Address
                </dt>
                <dd className="text-gray-800 dark:text-gray-200">{event.address}</dd>
              </div>
            )}
          </dl>

          {event.description && (
            <section className="prose dark:prose-invert max-w-none">
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {event.description}
              </p>
            </section>
          )}

          {event.external_url && (
            <a
              href={event.external_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 border-2 border-red-500 text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors font-medium text-sm"
            >
              Official event page
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </a>
          )}

          <section className="border-t border-gray-200 dark:border-gray-700 pt-8">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-4">
              Vendors attending
            </h2>
            {traders.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400">
                Vendor list is coming together — check back closer to the date.
              </p>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {traders.map((t) => (
                  <li key={t.account_id}>
                    <Link
                      href={`/${t.slug}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/20 hover:text-red-600 transition-colors group"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 group-hover:text-red-600">
                        {t.name}
                      </span>
                      {t.table_number && (
                        <span className="text-xs px-2 py-0.5 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 rounded">
                          Table {t.table_number}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </article>
    </div>
  );
}
