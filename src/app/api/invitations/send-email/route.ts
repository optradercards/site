import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  // Auth check
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { account_id: string; email: string; role: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { account_id, email, role } = body;
  if (!account_id || !email || !role) {
    return NextResponse.json({ error: "account_id, email, and role are required" }, { status: 400 });
  }

  // Verify caller is an owner of this account
  const { data: roleData } = await supabase.rpc("current_user_account_role", { account_id });
  if (!roleData || roleData.account_role !== "owner") {
    return NextResponse.json({ error: "Only account owners can send invitations" }, { status: 403 });
  }

  // Get account name
  const { data: accountData } = await supabase
    .from("basejump.accounts")
    .select("name")
    .eq("id", account_id)
    .single();

  // Fall back to RPC if direct query fails (RLS)
  let accountName = accountData?.name;
  if (!accountName) {
    const { data: accounts } = await supabase.rpc("get_accounts");
    const account = (accounts as any[])?.find((a: any) => a.account_id === account_id);
    accountName = account?.name || "your team";
  }

  // Create invitation token
  const { data: inviteData, error: inviteError } = await supabase.rpc("create_invitation", {
    account_id,
    account_role: role,
    invitation_type: "one_time",
  });

  if (inviteError || !inviteData?.token) {
    console.error("create_invitation error:", inviteError);
    return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
  }

  const token = inviteData.token;

  // Get inviter's display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", user.id)
    .single();

  const inviterName = profile?.name || user.email || undefined;

  // Call Edge Function to send email
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const fnRes = await fetch(`${supabaseUrl}/functions/v1/send-invitation-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({
      email,
      token,
      account_name: accountName,
      invited_by_name: inviterName,
    }),
  });

  if (!fnRes.ok) {
    const errText = await fnRes.text();
    console.error("send-invitation-email function error:", errText);
    // Token was created — don't fail the request, just warn
    return NextResponse.json({ success: true, token, emailSent: false });
  }

  return NextResponse.json({ success: true, token, emailSent: true });
}
