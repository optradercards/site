import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";

export const metadata: Metadata = {
  title: "OP Trader - Australia's Premier TCG Marketplace",
  description:
    "Find, buy, trade, and collect trading cards. Australia's premier marketplace for Pokemon, One Piece, Yu-Gi-Oh!, and more TCG collectors.",
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

async function fetchExchangeRates(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<Record<string, number>> {
  try {
    const { data } = await supabase.functions.invoke("exchange-rates");
    if (data?.success) return data.rates as Record<string, number>;
  } catch {}
  return {};
}

type Brand = {
  id: string;
  name: string;
  icon_url: string | null;
  icon_dark_url: string | null;
};

export default async function Home() {
  const supabase = await createClient();

  const displayCurrency = "AUD";
  const rates = await fetchExchangeRates(supabase);
  const fmtListing = (cents: number | null, sourceCurrency: string) =>
    formatPrice(cents, displayCurrency, rates, sourceCurrency);

  // Fetch brands and recently listed items in parallel
  const [{ data: brandsData }, { data: recentListings }] = await Promise.all([
    supabase
      .schema("cards")
      .from("brands")
      .select("id, name, icon_url, icon_dark_url")
      .eq("is_available", true)
      .order("name"),
    supabase
      .schema("ecom")
      .from("storefront_listings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(12),
  ]);

  const brands = (brandsData ?? []) as Brand[];
  const recentItems = (recentListings ?? []) as Listing[];

  return (
    <>
      {/* Hero Banner */}
      <section className="bg-gradient-to-br from-red-600 via-red-500 to-blue-600 text-white py-10 md:py-14 relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <h1 className="text-3xl md:text-5xl font-bold mb-2 tracking-wide text-center">
            FIND. BUY. TRADE. COLLECT.
          </h1>
          <p className="text-base md:text-lg mb-6 text-center opacity-95">
            Australia&apos;s Premier TCG Marketplace
          </p>
        </div>
      </section>

      {/* Browse by TCG */}
      {brands.length > 0 && (
        <section className="bg-white dark:bg-gray-800 py-8 md:py-10 border-b border-gray-200 dark:border-gray-700">
          <div className="container mx-auto px-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6 text-center">
              Browse by TCG
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
              {brands.map((brand) => (
                <Link
                  key={brand.id}
                  href={`/search?brand=${encodeURIComponent(brand.name)}`}
                  className="group flex flex-col items-center gap-3 p-4 md:p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md"
                >
                  {brand.icon_url ? (
                    <>
                      <img
                        src={brand.icon_url}
                        alt={brand.name}
                        className="w-12 h-12 object-contain dark:hidden"
                      />
                      <img
                        src={brand.icon_dark_url || brand.icon_url}
                        alt={brand.name}
                        className="w-12 h-12 object-contain hidden dark:block"
                      />
                    </>
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center">
                      <span className="text-lg font-bold text-gray-400 dark:text-gray-300">
                        {brand.name.charAt(0)}
                      </span>
                    </div>
                  )}
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200 text-center group-hover:text-red-500 transition-colors">
                    {brand.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Recently Listed */}
      <section className="bg-gray-50 dark:bg-gray-900 py-8 md:py-12 flex-1">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Recently Listed
            </h2>
            <Link
              href="/search"
              className="text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              View all &rarr;
            </Link>
          </div>

          {recentItems.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
              <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                No listings yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Check back soon for new listings!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
              {recentItems.map((listing) => (
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
        </div>
      </section>
    </>
  );
}
