// eBay Commerce Taxonomy API — category tree + item-aspect discovery.
// App-level reads (client_credentials token); no seller OAuth required.
//
// Used to map our cards to the right eBay leaf category and to discover which
// item aspects a listing must carry. CRITICAL: treat aspectRequired === true as
// mandatory; the aspectUsage field is unreliable (returns RECOMMENDED even for
// hard-required aspects — confirmed on AU category 183454 where `Game` is
// required:true but usage:RECOMMENDED).
//
// Confirmed for EBAY_AU (sandbox, tree 15): individual trading cards live in
// leaf 183454 "CCG Individual Cards"; graded and raw cards share that category,
// differentiated by the Graded / Grade / Professional Grader / Certification
// Number aspects.

import { ebayEndpoints } from "./config";
import { getApplicationToken } from "./oauth";

interface RawAspect {
  localizedAspectName: string;
  aspectConstraint?: {
    aspectRequired?: boolean;
    aspectMode?: string;
    itemToAspectCardinality?: string;
    aspectUsage?: string;
  };
  aspectValues?: { localizedValue?: string }[];
}

export interface EbayAspect {
  name: string;
  required: boolean;
  mode: string; // FREE_TEXT | SELECTION_ONLY
  cardinality: string; // SINGLE | MULTI
  usage: string; // RECOMMENDED | OPTIONAL — informational only, do NOT gate on this
  values: string[];
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  ancestors: string[]; // root → leaf order
}

async function taxFetch<T>(path: string): Promise<T> {
  const token = await getApplicationToken();
  const res = await fetch(`${ebayEndpoints.api}/commerce/taxonomy/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`taxonomy ${path} failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

export async function getDefaultCategoryTreeId(marketplaceId: string): Promise<string> {
  const d = await taxFetch<{ categoryTreeId: string }>(
    `/get_default_category_tree_id?marketplace_id=${encodeURIComponent(marketplaceId)}`,
  );
  return d.categoryTreeId;
}

export async function getItemAspectsForCategory(
  categoryTreeId: string,
  categoryId: string,
): Promise<EbayAspect[]> {
  const d = await taxFetch<{ aspects?: RawAspect[] }>(
    `/category_tree/${categoryTreeId}/get_item_aspects_for_category?category_id=${encodeURIComponent(categoryId)}`,
  );
  return (d.aspects ?? []).map((a) => ({
    name: a.localizedAspectName,
    required: !!a.aspectConstraint?.aspectRequired,
    mode: a.aspectConstraint?.aspectMode ?? "",
    cardinality: a.aspectConstraint?.itemToAspectCardinality ?? "",
    usage: a.aspectConstraint?.aspectUsage ?? "",
    values: (a.aspectValues ?? [])
      .map((v) => v.localizedValue ?? "")
      .filter(Boolean)
      .slice(0, 50),
  }));
}

export async function getCategorySuggestions(
  categoryTreeId: string,
  q: string,
): Promise<CategorySuggestion[]> {
  const d = await taxFetch<{
    categorySuggestions?: {
      category: { categoryId: string; categoryName: string };
      categoryTreeNodeAncestors?: { categoryName: string }[];
    }[];
  }>(`/category_tree/${categoryTreeId}/get_category_suggestions?q=${encodeURIComponent(q)}`);
  return (d.categorySuggestions ?? []).map((s) => ({
    categoryId: s.category.categoryId,
    categoryName: s.category.categoryName,
    ancestors: (s.categoryTreeNodeAncestors ?? []).map((a) => a.categoryName).reverse(),
  }));
}
