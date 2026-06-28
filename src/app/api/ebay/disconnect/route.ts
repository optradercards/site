import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// POST /api/ebay/disconnect  { connectionId }
// Removes the Vault token secret + the connection row (membership enforced in
// the RPC). Listings already live on eBay are not affected.
export async function POST(request: Request) {
  let body: { connectionId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.connectionId) {
    return NextResponse.json({ error: "connectionId is required" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { error } = await supabase
    .schema("ecom")
    .rpc("disconnect_ebay", { p_connection_id: body.connectionId });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
