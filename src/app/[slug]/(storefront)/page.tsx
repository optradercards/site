import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";
import MarketplaceSearch from "@/components/MarketplaceSearch";

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

async function fetchExchangeRates(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, number>> {
  try {
    const { data } = await supabase.functions.invoke("exchange-rates");
    if (data?.success) return data.rates as Record<string, number>;
  } catch {}
  return {};
}

export default async function StorefrontPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    q?: string;
    brand?: string;
    set?: string;
    rarity?: string;
    sort?: string;
  }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const q = sp.q ?? "";
  const supabase = await createClient();

  // Check if logged-in user is a member of this account
  let canManage = false;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: accounts } = await supabase.rpc("get_accounts");
    canManage = (accounts ?? []).some(
      (a: any) => a.slug === slug || a.account_id === slug
    );
  }

  const displayCurrency = "AUD";
  const rates = await fetchExchangeRates(supabase);
  const fmtListing = (cents: number | null, sourceCurrency: string) =>
    formatPrice(cents, displayCurrency, rates, sourceCurrency);

  // Fetch filter options scoped to this store
  const [brandsRes, setsRes, raritiesRes] = await Promise.all([
    supabase
      .schema("ecom")
      .from("storefront_listings")
      .select("brand_name")
      .eq("seller_slug", slug)
      .order("brand_name")
      .limit(100),
    supabase
      .schema("ecom")
      .from("storefront_listings")
      .select("set_name")
      .eq("seller_slug", slug)
      .order("set_name")
      .limit(500),
    supabase
      .schema("ecom")
      .from("storefront_listings")
      .select("rarity")
      .eq("seller_slug", slug)
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
    ...new Set((raritiesRes.data ?? []).map((r: any) => r.rarity as string)),
  ];

  // Build filtered query
  const brandsFilter = (sp.brand ?? "").split(",").filter(Boolean);
  const setsFilter = (sp.set ?? "").split(",").filter(Boolean);
  const raritiesFilter = (sp.rarity ?? "").split(",").filter(Boolean);
  const sort = sp.sort ?? "";

  let query = supabase
    .schema("ecom")
    .from("storefront_listings")
    .select("*")
    .eq("seller_slug", slug);

  if (q) {
    query = query.or(
      `title.ilike.%${q}%,card_name.ilike.%${q}%,set_name.ilike.%${q}%`
    );
  }
  if (brandsFilter.length > 0) query = query.in("brand_name", brandsFilter);
  if (setsFilter.length > 0) query = query.in("set_name", setsFilter);
  if (raritiesFilter.length > 0) query = query.in("rarity", raritiesFilter);

  switch (sort) {
    case "price_asc":
      query = query.order("price_cents", { ascending: true, nullsFirst: false });
      break;
    case "price_desc":
      query = query.order("price_cents", { ascending: false });
      break;
    case "name_asc":
      query = query.order("title", { ascending: true });
      break;
    default:
      query = query.order("updated_at", { ascending: false });
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error("Storefront listings query error:", error);
  }

  const items = (listings ?? []) as Listing[];

  // Get seller name from listings, or fall back to slug
  const sellerName = items[0]?.seller_name || slug;

  // If no listings exist (and no filters active), check if store exists
  if (items.length === 0 && !brandsFilter.length && !setsFilter.length && !raritiesFilter.length) {
    const { data: anyListing } = await supabase
      .schema("ecom")
      .from("listings")
      .select("seller_name")
      .eq("seller_slug", slug)
      .limit(1);

    const name = (anyListing as any)?.[0]?.seller_name || slug;

    return (
      <section className="bg-gray-50 dark:bg-gray-900 py-6 md:py-8 flex-1">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
              {name}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Trading card store
            </p>
            {canManage && (
              <Link
                href={`/${slug}/manage`}
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
              >
                Manage Store
              </Link>
            )}
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-12 text-center text-gray-500 dark:text-gray-400">
            No listings available right now. Check back soon!
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-6 md:py-8 flex-1">
      <div className="container mx-auto px-4">
        {/* Store Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800 dark:text-gray-100">
              {sellerName}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {items.length} {items.length === 1 ? "listing" : "listings"}
              {q
                ? ` for "${q}"`
                : brandsFilter.length || setsFilter.length || raritiesFilter.length
                  ? " matching filters"
                  : " available"}
            </p>
          </div>
          {canManage && (
            <Link
              href={`/${slug}/manage`}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors shrink-0"
            >
              Manage Store
            </Link>
          )}
        </div>

        {/* Mobile filter toggle */}
        <div className="lg:hidden">
          <Suspense>
            <MarketplaceSearch
              brands={brands}
              sets={sets}
              rarities={rarities}
              basePath={`/${slug}`}
              showSearch
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
                basePath={`/${slug}`}
              />
            </Suspense>
          </aside>

          {/* Main results area */}
          <div className="flex-1 min-w-0">
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
                  Try adjusting your filters.
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
                            {gradeLabel(listing.grading_service, listing.grade)}
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
                          {listing.brand_name}
                        </span>
                        {listing.price_cents != null ? (
                          <span className="text-sm font-bold text-red-500 shrink-0 ml-1">
                            {fmtListing(listing.price_cents, listing.currency)}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">--</span>
                        )}
                      </div>
                      {listing.quantity > 1 && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                          Qty: {listing.quantity}
                        </p>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
