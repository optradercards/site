import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";

type Listing = {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  grading_service: string | null;
  grade: string | null;
  card_name: string;
  card_number: string | null;
  card_product_id: string;
  rarity: string | null;
  set_name: string;
  brand_name: string;
  brand_icon: string | null;
  seller_slug: string;
  seller_name: string;
  account_id: string;
  quantity: number;
  status: string;
  created_at: string;
  updated_at: string;
};

type SellerLocation = {
  city: string;
  state_province: string;
  country: string;
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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .schema("ecom")
    .from("listings")
    .select("title, set_name, seller_name")
    .eq("id", id)
    .single();

  if (!data) return { title: "Listing Not Found - OP Trader" };

  return {
    title: `${data.title} - ${data.set_name} | OP Trader`,
    description: `Buy ${data.title} from ${data.seller_name} on OP Trader.`,
  };
}

export default async function ListingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch listing
  const { data: listing, error } = await supabase
    .schema("ecom")
    .from("listings")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !listing) notFound();

  const item = listing as Listing;

  // Fetch seller location + exchange rates + other listings from same seller in parallel
  const [locationRes, rates, otherListingsRes] = await Promise.all([
    supabase.rpc("seller_location", { seller_account_id: item.account_id }),
    fetchExchangeRates(supabase),
    supabase
      .schema("ecom")
      .from("listings")
      .select("id, title, image_url, price_cents, currency")
      .eq("seller_slug", item.seller_slug)
      .eq("status", "active")
      .neq("id", item.id)
      .order("updated_at", { ascending: false })
      .limit(6),
  ]);

  const location = (locationRes.data?.[0] as SellerLocation) ?? null;
  const otherListings = (otherListingsRes.data ?? []) as {
    id: string;
    title: string;
    image_url: string | null;
    price_cents: number | null;
    currency: string;
  }[];

  const displayCurrency = "AUD";
  const fmtPrice = (cents: number | null, sourceCurrency: string) =>
    formatPrice(cents, displayCurrency, rates, sourceCurrency);

  return (
    <div className="bg-gray-50 dark:bg-gray-900 py-6 md:py-10">
      <div className="container mx-auto px-4">
        {/* Breadcrumb */}
        <nav className="text-sm text-gray-500 dark:text-gray-400 mb-6 flex items-center gap-1.5 flex-wrap">
          <Link href="/" className="hover:text-red-500 transition-colors">
            Home
          </Link>
          <span>/</span>
          <Link
            href={`/search?brand=${encodeURIComponent(item.brand_name)}`}
            className="hover:text-red-500 transition-colors"
          >
            {item.brand_name}
          </Link>
          <span>/</span>
          <Link
            href={`/search?set=${encodeURIComponent(item.set_name)}`}
            className="hover:text-red-500 transition-colors"
          >
            {item.set_name}
          </Link>
          <span>/</span>
          <span className="text-gray-700 dark:text-gray-300 truncate">
            {item.title}
          </span>
        </nav>

        {/* Main Content: Image left, details right */}
        <div className="grid grid-cols-1 lg:grid-cols-[55fr_45fr] gap-8 lg:gap-10">
          {/* Left: Image */}
          <div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md p-4 md:p-6 sticky top-24">
              <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-700 rounded-xl overflow-hidden relative">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.title}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg
                      className="w-20 h-20"
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

                {/* Badges */}
                {item.grading_service &&
                  item.grading_service !== "ungraded" && (
                    <span className="absolute top-3 left-3 bg-blue-600/90 text-white px-2.5 py-1 rounded-full text-xs font-medium backdrop-blur-sm">
                      {gradeLabel(item.grading_service, item.grade)}
                    </span>
                  )}
              </div>
            </div>
          </div>

          {/* Right: Details — eBay-style order */}
          <div>
            {/* 1. Title */}
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 leading-snug">
              {item.title}
            </h1>

            {/* 2. Seller info with location */}
            <div className="flex items-center gap-2 mt-3 text-sm">
              <Link
                href={`/${item.seller_slug}`}
                className="font-semibold text-blue-600 dark:text-blue-400 hover:underline"
              >
                {item.seller_name}
              </Link>
              {location && (
                <>
                  <span className="text-gray-400">|</span>
                  <span className="text-gray-500 dark:text-gray-400 inline-flex items-center gap-1">
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {location.city}, {location.state_province}
                    {location.country !== "Australia" &&
                      `, ${location.country}`}
                  </span>
                </>
              )}
            </div>

            <hr className="my-4 border-gray-200 dark:border-gray-700" />

            {/* 3. Price */}
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Price
              </p>
              {item.price_cents != null ? (
                <span className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                  {fmtPrice(item.price_cents, item.currency)}
                </span>
              ) : (
                <span className="text-xl text-gray-400">
                  Price not available
                </span>
              )}
            </div>

            {/* 4. Buy / Add to Cart buttons */}
            <div className="flex flex-col gap-2.5 mt-5">
              <button className="w-full py-3 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-sm">
                Buy It Now
              </button>
              <button className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors text-sm">
                Add to Cart
              </button>
              <button className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm">
                Add to Watchlist
              </button>
            </div>

            <hr className="my-5 border-gray-200 dark:border-gray-700" />

            {/* 5. Shipping & returns info */}
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Shipping
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    {location
                      ? `Ships from ${location.city}, ${location.state_province}`
                      : "Contact seller for shipping details"}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Buyer Protection
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Money-back guarantee
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Returns
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Contact seller for return policy
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-gray-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Payments
                  </p>
                  <p className="text-gray-500 dark:text-gray-400">
                    Secure checkout via Stripe
                  </p>
                </div>
              </div>
            </div>

            <hr className="my-5 border-gray-200 dark:border-gray-700" />

            {/* 6. Seller card */}
            <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-500 flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {item.seller_name[0]?.toUpperCase()}
                </div>
                <div>
                  <Link
                    href={`/${item.seller_slug}`}
                    className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:underline"
                  >
                    {item.seller_name}
                  </Link>
                  {location && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {location.city}, {location.state_province}
                    </p>
                  )}
                </div>
              </div>
              <Link
                href={`/${item.seller_slug}`}
                className="shrink-0 px-4 py-1.5 text-xs font-semibold border border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400 rounded-full hover:bg-blue-600 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white transition-colors"
              >
                Visit Store
              </Link>
            </div>
          </div>
        </div>

        {/* Item Specifics — full width below the two columns */}
        <div className="mt-10 bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 md:p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Item Specifics
          </h2>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-sm">
            <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <dt className="text-gray-500 dark:text-gray-400 w-32 shrink-0">Condition</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {item.grading_service && item.grading_service !== "ungraded"
                  ? gradeLabel(item.grading_service, item.grade)
                  : "Ungraded"}
              </dd>
            </div>
            <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <dt className="text-gray-500 dark:text-gray-400 w-32 shrink-0">Brand</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{item.brand_name}</dd>
            </div>
            <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <dt className="text-gray-500 dark:text-gray-400 w-32 shrink-0">Set</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{item.set_name}</dd>
            </div>
            {item.card_number && (
              <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
                <dt className="text-gray-500 dark:text-gray-400 w-32 shrink-0">Card Number</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">#{item.card_number}</dd>
              </div>
            )}
            {item.rarity && (
              <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
                <dt className="text-gray-500 dark:text-gray-400 w-32 shrink-0">Rarity</dt>
                <dd className="font-medium text-gray-900 dark:text-gray-100">{item.rarity}</dd>
              </div>
            )}
            <div className="flex gap-2 py-1.5 border-b border-gray-100 dark:border-gray-700">
              <dt className="text-gray-500 dark:text-gray-400 w-32 shrink-0">Quantity</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{item.quantity} available</dd>
            </div>
          </dl>
        </div>

        {/* Description — full width */}
        {item.description && (
          <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 md:p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-3">
              Item Description
            </h2>
            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-line leading-relaxed">
              {item.description}
            </p>
          </div>
        )}

        {/* More from this seller */}
        {otherListings.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                More from {item.seller_name}
              </h2>
              <Link
                href={`/${item.seller_slug}`}
                className="text-sm text-red-500 hover:text-red-600 font-medium transition-colors"
              >
                See all
              </Link>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              {otherListings.map((other) => (
                <Link
                  key={other.id}
                  href={`/listing/${other.id}`}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-700 overflow-hidden">
                    {other.image_url ? (
                      <img
                        src={other.image_url}
                        alt={other.title}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <svg
                          className="w-8 h-8"
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
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                      {other.title}
                    </p>
                    {other.price_cents != null && (
                      <p className="text-sm font-bold text-red-500 mt-0.5">
                        {fmtPrice(other.price_cents, other.currency)}
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
