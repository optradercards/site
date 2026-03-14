import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatPrice } from "@/lib/currency";
import { gradeLabel } from "@/lib/pricing";

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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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

  const { data: listings, error } = await supabase
    .schema("ecom")
    .from("listings")
    .select("*")
    .eq("seller_slug", slug)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Storefront listings query error:", error);
  }

  const items = (listings ?? []) as Listing[];

  // Get seller name from listings, or fall back to slug
  const sellerName = items[0]?.seller_name || slug;

  // If no listings exist, check if the account even exists by querying for any
  // listing (including non-active) to distinguish "no store" from "empty store"
  if (items.length === 0) {
    const { data: anyListing } = await supabase
      .schema("ecom")
      .from("listings")
      .select("seller_name")
      .eq("seller_slug", slug)
      .limit(1);

    const name = (anyListing as any)?.[0]?.seller_name || slug;

    return (
      <div className="container mx-auto px-4 py-12">
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
    );
  }

  // Collect unique brands and sets for filter display
  const brands = [...new Set(items.map((l) => l.brand_name))].sort();
  const sets = [...new Set(items.map((l) => l.set_name))].sort();

  return (
    <div className="container mx-auto px-4 py-12">
      {/* Store Header */}
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-100">
            {sellerName}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {items.length} {items.length === 1 ? "listing" : "listings"}{" "}
            available
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

      {/* Listings Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
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
                    className="w-12 h-12"
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
                <span className="absolute top-2 right-2 bg-black/60 text-white px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm">
                  {listing.rarity}
                </span>
              )}

              {/* Grade Badge */}
              {listing.grading_service &&
                listing.grading_service !== "ungraded" && (
                  <span className="absolute top-2 left-2 bg-blue-600/90 text-white px-2 py-0.5 rounded-full text-xs font-medium backdrop-blur-sm">
                    {gradeLabel(listing.grading_service, listing.grade)}
                  </span>
                )}
            </div>

            {/* Card Info */}
            <div className="p-3">
              <h3 className="font-semibold text-sm text-gray-800 dark:text-gray-100 truncate">
                {listing.title}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                {listing.set_name}
                {listing.card_number && ` #${listing.card_number}`}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {listing.brand_name}
                </span>
                {listing.price_cents != null ? (
                  <span className="text-lg font-bold text-red-500">
                    {fmtListing(listing.price_cents, listing.currency)}
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">--</span>
                )}
              </div>
              {listing.quantity > 1 && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Qty: {listing.quantity}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
