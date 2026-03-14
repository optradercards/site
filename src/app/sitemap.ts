import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://optrader.com.au";
  const supabase = await createClient();

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/search`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/contact`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${baseUrl}/become-a-trader`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/become-a-trader/benefits`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/become-a-trader/requirements`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/become-a-trader/how-it-works`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/become-a-trader/features`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/privacy-policy`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/terms-of-service`, changeFrequency: "yearly", priority: 0.3 },
  ];

  // Dynamic listing pages
  let listingPages: MetadataRoute.Sitemap = [];
  try {
    const { data: listings } = await supabase
      .schema("ecom")
      .from("listings")
      .select("id, updated_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(5000);

    if (listings) {
      listingPages = listings.map((listing) => ({
        url: `${baseUrl}/listing/${listing.id}`,
        lastModified: new Date(listing.updated_at),
        changeFrequency: "weekly" as const,
        priority: 0.8,
      }));
    }
  } catch {
    // Fail gracefully — static pages still get indexed
  }

  return [...staticPages, ...listingPages];
}
