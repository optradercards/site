import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { fetchExchangeRates, formatPrice } from "@/lib/currency";
import ProductBadges from "@/components/ProductBadges";

export const metadata: Metadata = {
  title: "Browse Products - OP Trader",
  description:
    "Browse the One Piece TCG catalog and explore market data on Australia's premier TCG marketplace.",
};

type Product = {
  id: string;
  name: string;
  image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  set_name: string;
  brand_name: string;
  language: string | null;
  product_kind: "single" | "sealed";
  is_foil: boolean;
  is_variant_edition: boolean;
  is_case: boolean;
  price_ungraded: number | null;
  unit_change_percent: number | null;
};

const PAGE_SIZE = 40;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    brand?: string;
    set?: string;
    rarity?: string;
    kind?: string;
    language?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const params = await searchParams;
  const supabase = await createClient();

  const q = params.q ?? "";
  const brand = params.brand ?? "";
  const setName = params.set ?? "";
  const rarity = params.rarity ?? "";
  const kind = params.kind ?? "";
  const language = params.language ?? "";
  const sort = params.sort ?? "name_asc";
  const page = Math.max(1, parseInt(params.page ?? "1", 10) || 1);

  const brandsQuery = supabase
    .schema("cards")
    .from("brands")
    .select("id,name")
    .eq("is_available", true)
    .order("name");

  let setsQuery = supabase
    .schema("cards")
    .from("sets")
    .select("name,brand_id")
    .order("name")
    .limit(5000);

  if (brand) {
    const { data: brandRow } = await supabase
      .schema("cards")
      .from("brands")
      .select("id")
      .eq("name", brand)
      .maybeSingle();
    if (brandRow?.id) {
      setsQuery = setsQuery.eq("brand_id", brandRow.id);
    }
  }

  const [brandsRes, setsRes, raritiesRes, languagesRes] = await Promise.all([
    brandsQuery,
    setsQuery,
    supabase
      .schema("cards")
      .from("products")
      .select("rarity")
      .not("rarity", "is", null)
      .order("rarity")
      .limit(5000),
    supabase
      .schema("cards")
      .from("sets")
      .select("language")
      .not("language", "is", null)
      .order("language")
      .limit(5000),
  ]);

  const brands = [
    ...new Set((brandsRes.data ?? []).map((r: any) => r.name as string)),
  ];
  const sets = [
    ...new Set((setsRes.data ?? []).map((r: any) => r.name as string)),
  ];
  const rarities = [
    ...new Set((raritiesRes.data ?? []).map((r: any) => r.rarity as string)),
  ];
  const languages = [
    ...new Set((languagesRes.data ?? []).map((r: any) => r.language as string)),
  ];

  let query = supabase
    .schema("cards")
    .from("products_with_details")
    .select(
      "id,name,image_url,card_number,rarity,set_name,brand_name,language,product_kind,is_foil,is_variant_edition,is_case,price_ungraded,unit_change_percent",
      { count: "exact" }
    );

  if (q) {
    query = query.or(
      `name.ilike.%${q}%,card_number.ilike.%${q}%,set_name.ilike.%${q}%`
    );
  }
  if (brand) query = query.eq("brand_name", brand);
  if (setName) query = query.eq("set_name", setName);
  if (rarity) query = query.eq("rarity", rarity);
  if (language) query = query.eq("language", language);
  if (kind === "single" || kind === "sealed") {
    query = query.eq("product_kind", kind);
  }

  switch (sort) {
    case "price_asc":
      query = query.order("price_ungraded", {
        ascending: true,
        nullsFirst: false,
      });
      break;
    case "price_desc":
      query = query.order("price_ungraded", { ascending: false });
      break;
    case "movers_desc":
      query = query.order("unit_change_percent", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "name_desc":
      query = query.order("name", { ascending: false });
      break;
    case "name_asc":
    default:
      query = query.order("name", { ascending: true });
  }

  const from = (page - 1) * PAGE_SIZE;
  query = query.range(from, from + PAGE_SIZE - 1);

  const { data, count, error } = await query;
  if (error) {
    console.error("Products catalog query error:", error);
  }

  const items = (data ?? []) as Product[];
  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const displayCurrency = "AUD";
  const rates = await fetchExchangeRates(supabase);
  const fmt = (cents: number | null) =>
    formatPrice(cents, displayCurrency, rates);

  return (
    <section className="bg-gray-50 dark:bg-gray-900 py-6 md:py-8 flex-1">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-800 dark:text-gray-100">
              Browse Products
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Catalog and market data. Looking to buy?{" "}
              <Link
                href="/search"
                className="text-red-500 hover:underline"
              >
                Search live listings
              </Link>
              .
            </p>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalCount === 0
              ? "No products found"
              : `${totalCount.toLocaleString()} product${totalCount !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div className="flex gap-6">
          <aside className="hidden lg:block w-64 shrink-0">
            <form
              action="/products"
              method="get"
              className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 space-y-4 sticky top-4"
            >
              <FilterField label="Search">
                <input
                  type="text"
                  name="q"
                  defaultValue={q}
                  placeholder="Card name, number, set"
                  className="filter-input"
                />
              </FilterField>

              <FilterField label="Brand">
                <select
                  name="brand"
                  defaultValue={brand}
                  className="filter-input"
                >
                  <option value="">All brands</option>
                  {brands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Set">
                <select
                  name="set"
                  defaultValue={setName}
                  className="filter-input"
                >
                  <option value="">All sets</option>
                  {sets.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Rarity">
                <select
                  name="rarity"
                  defaultValue={rarity}
                  className="filter-input"
                >
                  <option value="">All rarities</option>
                  {rarities.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Language">
                <select
                  name="language"
                  defaultValue={language}
                  className="filter-input"
                >
                  <option value="">All languages</option>
                  {languages.map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </FilterField>

              <FilterField label="Type">
                <select
                  name="kind"
                  defaultValue={kind}
                  className="filter-input"
                >
                  <option value="">Singles &amp; sealed</option>
                  <option value="single">Singles</option>
                  <option value="sealed">Sealed</option>
                </select>
              </FilterField>

              <FilterField label="Sort">
                <select
                  name="sort"
                  defaultValue={sort}
                  className="filter-input"
                >
                  <option value="name_asc">Name (A–Z)</option>
                  <option value="name_desc">Name (Z–A)</option>
                  <option value="price_asc">Price (low–high)</option>
                  <option value="price_desc">Price (high–low)</option>
                  <option value="movers_desc">Biggest movers</option>
                </select>
              </FilterField>

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg py-2 transition-colors"
                >
                  Apply
                </button>
                <Link
                  href="/products"
                  className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Reset
                </Link>
              </div>

              <style>{`
                .filter-input {
                  width: 100%;
                  padding: 0.5rem 0.75rem;
                  font-size: 0.875rem;
                  border-radius: 0.5rem;
                  border: 1px solid rgb(209 213 219);
                  background-color: white;
                  color: rgb(17 24 39);
                }
                :is(.dark .filter-input) {
                  border-color: rgb(75 85 99);
                  background-color: rgb(31 41 55);
                  color: rgb(243 244 246);
                }
                .filter-input:focus {
                  outline: none;
                  border-color: transparent;
                  box-shadow: 0 0 0 2px rgb(239 68 68);
                }
              `}</style>
            </form>
          </aside>

          <div className="flex-1 min-w-0">
            {items.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-12 text-center">
                <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  No products found
                </h3>
                <p className="text-gray-500 dark:text-gray-400">
                  Try adjusting your filters.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
                {items.map((p) => {
                  const change = p.unit_change_percent;
                  const changeNum = change != null ? Number(change) : null;
                  return (
                    <Link
                      key={p.id}
                      href={`/products/${p.id}`}
                      className="group bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
                    >
                      <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                        {p.image_url ? (
                          <img
                            src={p.image_url}
                            alt={p.name}
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
                        {p.rarity && (
                          <span className="absolute top-1.5 right-1.5 bg-black/60 text-white px-1.5 py-0.5 rounded-full text-[10px] font-medium backdrop-blur-sm">
                            {p.rarity}
                          </span>
                        )}
                      </div>

                      <div className="p-2.5">
                        <h3 className="font-semibold text-xs text-gray-800 dark:text-gray-100 truncate">
                          {p.name}
                        </h3>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                          {p.set_name}
                          {p.card_number && ` #${p.card_number}`}
                        </p>
                        <ProductBadges
                          productKind={p.product_kind}
                          isFoil={p.is_foil}
                          isVariantEdition={p.is_variant_edition}
                          isCase={p.is_case}
                          className="mt-1"
                        />
                        <div className="flex items-center justify-between mt-1.5">
                          {p.price_ungraded != null ? (
                            <span className="text-sm font-bold text-red-500 shrink-0">
                              {fmt(p.price_ungraded)}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">
                              No market data
                            </span>
                          )}
                          {changeNum != null && (
                            <span
                              className={`text-[10px] font-semibold ${
                                changeNum >= 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }`}
                            >
                              {changeNum >= 0 ? "+" : ""}
                              {changeNum.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {totalPages > 1 && (
              <nav className="flex justify-center items-center gap-2 mt-8">
                {page > 1 && (
                  <PaginationLink
                    page={page - 1}
                    params={params}
                    label="Previous"
                  />
                )}
                {generatePageNumbers(page, totalPages).map((p, i) =>
                  p === "..." ? (
                    <span key={`ellipsis-${i}`} className="px-2 text-gray-400">
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
                  <PaginationLink
                    page={page + 1}
                    params={params}
                    label="Next"
                  />
                )}
              </nav>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mb-1">
        {label}
      </span>
      {children}
    </label>
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
  const href = sp.toString() ? `/products?${sp.toString()}` : "/products";

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
