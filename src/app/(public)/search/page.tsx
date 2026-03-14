import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";
import MarketplaceSearch from "@/components/MarketplaceSearch";

export const metadata: Metadata = {
  title: "Search Listings - OP Trader",
  description:
    "Search trading cards on Australia's premier TCG marketplace.",
};

type Listing = {
  id: string;
  title: string;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  grading_service: string | null;
  grade: string | null;
  card_name: string;
  card_number: string | null;
  rarity: string | null;
  set_name: string;
  brand_name: string;
  brand_icon: string | null;
  seller_slug: string;
  seller_name: string;
  quantity: number;
};

const PAGE_SIZE = 40;

async function fetchExchangeRates(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, number>> {
  try {
    const { data } = await supabase.functions.invoke("exchange-rates");
    if (data?.success) return data.rates as Record<string, number>;
  } catch {}
  return {};
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    set?: string;
    rarity?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const q = params.q ?? "";
  const brands_filter = (params.brand ?? "").split(",").filter(Boolean);
  const sets_filter = (params.set ?? "").split(",").filter(Boolean);
  const rarities_filter = (params.rarity ?? "").split(",").filter(Boolean);
  const sort = params.sort ?? "";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  // Fetch filter options (distinct brands, sets, rarities)
  const [brandsRes, setsRes, raritiesRes] = await Promise.all([
    supabase
      .schema("ecom")
      .from("listings")
      .select("brand_name")
      .eq("status", "active")
      .order("brand_name")
      .limit(100),
    supabase
      .schema("ecom")
      .from("listings")
      .select("set_name")
      .eq("status", "active")
      .order("set_name")
      .limit(500),
    supabase
      .schema("ecom")
      .from("listings")
      .select("rarity")
      .eq("status", "active")
      .not("rarity", "is", null)
      .order("rarity")
      .limit(100),
  ]);

  const brands = [
    ...new Set((brandsRes.data ?? []).map((r: any) => r.brand_name as string)),
  ];
  const sets = [
    ...new Set((setsRes.data ?? []).map((r: any) => r.set_name as string)),
  ];
  const rarities = [
    ...new Set(
      (raritiesRes.data ?? []).map((r: any) => r.rarity as string)
    ),
  ];

  // Build listings query
  let query = supabase
    .schema("ecom")
    .from("listings")
    .select("*", { count: "exact" })
    .eq("status", "active");

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,card_name.ilike.%${q}%,set_name.ilike.%${q}%,seller_name.ilike.%${q}%`
    );
  }
  if (brands_filter.length > 0) {
    query = query.in("brand_name", brands_filter);
  }
  if (sets_filter.length > 0) {
    query = query.in("set_name", sets_filter);
  }
  if (rarities_filter.length > 0) {
    query = query.in("rarity", rarities_filter);
  }

  // Sorting
  switch (sort) {
    case "price_asc":
      query = query.order("price_cents", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "name_asc":
      query = query.order("card_name", { ascending: true });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }

  // Pagination
  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data: listings, count, error } = await query;
  if (error) {
    console.error("Search listings query error:", error);
  }

  const items = (listings ?? []) as Listing[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Exchange rates for price conversion
  const displayCurrency = "AUD";
  const rates = await fetchExchangeRates(supabase);
  const fmtListing = (cents: number | null, sourceCurrency: string) =>
    formatPrice(cents, displayCurrency, rates, sourceCurrency);

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-6 md:py-8 flex-1">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            {q ? (
              <>Search Results for &ldquo;{q}&rdquo;</>
            ) : (
              "Browse Listings"
            )}
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalCount === 0
              ? "No listings found"
              : `${totalCount.toLocaleString()} listing${totalCount !== 1 ? "s" : ""}`}
          </p>
        </div>

        {/* Mobile filter toggle (shown above results on small screens) */}
        <div className="lg:hidden">
          <Suspense>
            <MarketplaceSearch
              brands={brands}
              sets={sets}
              rarities={rarities}
            />
          </Suspense>
        </div>

        <div className="flex gap-6">
          {/* Left sidebar filters (desktop only) */}
          <aside className="hidden lg:block w-64 shrink-0">
            <Suspense>
              <MarketplaceSearch
                brands={brands}
                sets={sets}
                rarities={rarities}
              />
            </Suspense>
          </aside>

          {/* Main results area */}
          <div className="flex-1 min-w-0">
            {/* Listings Grid */}
            {items.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                <svg
                  className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No listings found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your search or filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {items.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/listing/${listing.id}`}
                    className="group bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                  >
                    {/* Card Image */}
                    <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                      {listing.image_url ? (
                        <img
                          src={listing.image_url}
                          alt={listing.title}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                          <svg
                            className="w-10 h-10"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                      )}

                      {/* Rarity Badge */}
                      {listing.rarity && (
                        <span className="absolute top-1.5 right-1.5 bg-black/60 text-white px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm">
                          {listing.rarity}
                        </span>
                      )}

                      {/* Grade Badge */}
                      {listing.grading_service &&
                        listing.grading_service !== "ungraded" && (
                          <span className="absolute top-1.5 left-1.5 bg-blue-600/90 text-white px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm">
                            {gradeLabel(
                              listing.grading_service,
                              listing.grade
                            )}
                          </span>
                        )}
                    </div>

                    {/* Card Info */}
                    <div className="p-2.5">
                      <h3 className="font-semibold text-xs text-gray-800 dark:text-gray-100 truncate">
                        {listing.title}
                      </h3>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {listing.set_name}
                        {listing.card_number && ` #${listing.card_number}`}
                      </p>
                      <div className="flex items-center justify-between mt-1.5">
                        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
                          {listing.seller_name}
                        </span>
                        {listing.price_cents != null ? (
                          <span className="text-sm font-bold text-red-500 shrink-0 ml-1">
                            {fmtListing(listing.price_cents, listing.currency)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <nav className="flex justify-center items-center gap-2 mt-8">
                {page > 1 && (
                  <PaginationLink page={page - 1} params={params} label="Previous" />
                )}
                {generatePageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-2 text-gray-400"
                    >
                      ...
                    </span>
                  ) : (
                    <PaginationLink
                      key={p}
                      page={p as number}
                      params={params}
                      label={String(p)}
                      active={p === page}
                    />
                  )
                )}
                {page < totalPages && (
                  <PaginationLink page={page + 1} params={params} label="Next" />
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function PaginationLink({
  page,
  params,
  label,
  active,
}: {
  page: number;
  params: Record<string, string | undefined>;
  label: string;
  active?: boolean;
}) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v && k !== "page") sp.set(k, v);
  }
  if (page > 1) sp.set("page", String(page));
  const href = sp.toString() ? `/search?${sp.toString()}` : "/search";

  return (
    <Link
      href={href}
      className={`px-3 py-2 text-sm rounded-lg transition-colors ${
        active
          ? "bg-red-500 text-white font-semibold"
          : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
      }`}
    >
      {label}
    </Link>
  );
}

function generatePageNumbers(
  current: number,
  total: number
): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "...")[] = [1];
  if (current > 3) pages.push("...");
  for (
    let i = Math.max(2, current - 1);
    i <= Math.min(total - 1, current + 1);
    i++
  ) {
    pages.push(i);
  }
  if (current < total - 2) pages.push("...");
  pages.push(total);
  return pages;
}
