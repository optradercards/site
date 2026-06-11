import { redirect } from "next/navigation";

// The "List Items" (unlisted) and "Listings" pages were merged into a single
// combined Store table at /manage/store. Keep this path working for old links
// and bookmarks.
export default async function UnlistedRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}/manage/store`);
}
