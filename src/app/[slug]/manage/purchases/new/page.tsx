"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

// Legacy route — the purchase intake now lives inside the unified Receive
// Inventory hub. Redirect to the Purchase tab.
export default function LegacyNewPurchasePage() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string | undefined;

  useEffect(() => {
    if (!slug) return;
    router.replace(`/${slug}/manage/inventory/receive?mode=purchase`);
  }, [router, slug]);

  return null;
}
