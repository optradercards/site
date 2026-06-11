import { redirect } from "next/navigation";

// The combined Store table moved from /manage/listings to /manage/store.
// Keep this path working for old links and bookmarks.
export default async function ListingsRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/${slug}/manage/store`);
}
