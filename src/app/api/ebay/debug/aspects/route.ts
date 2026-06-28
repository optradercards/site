import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ebayConfigured } from "@/lib/ebay/config";
import {
  getDefaultCategoryTreeId,
  getItemAspectsForCategory,
  getCategorySuggestions,
} from "@/lib/ebay/taxonomy";

// GET /api/ebay/debug/aspects?marketplace=EBAY_AU&categoryId=183454
// GET /api/ebay/debug/aspects?marketplace=EBAY_AU&q=pokemon%20card
//
// Spike/diagnostic for the listing-mapping work: resolves the marketplace's
// category tree id, then either suggests categories for a query or returns the
// item aspects for a category (flagging the truly-required ones). Uses an
// app-level token — no seller connection needed. Signed-in only.
export async function GET(request: NextRequest) {
  if (!ebayConfigured()) {
    return NextResponse.json({ error: "eBay not configured" }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const marketplace = url.searchParams.get("marketplace") || "EBAY_AU";
  const categoryId = url.searchParams.get("categoryId");
  const q = url.searchParams.get("q");

  try {
    const treeId = await getDefaultCategoryTreeId(marketplace);

    if (categoryId) {
      const aspects = await getItemAspectsForCategory(treeId, categoryId);
      return NextResponse.json({
        marketplace,
        treeId,
        categoryId,
        requiredAspects: aspects.filter((a) => a.required).map((a) => a.name),
        aspects,
      });
    }

    if (q) {
      const suggestions = await getCategorySuggestions(treeId, q);
      return NextResponse.json({ marketplace, treeId, suggestions });
    }

    return NextResponse.json({
      marketplace,
      treeId,
      hint: "pass ?q=<search> for category suggestions or ?categoryId=<id> for aspects",
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "taxonomy call failed" },
      { status: 502 },
    );
  }
}
