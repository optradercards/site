import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";

// POST /api/consignment-intakes/[id]/send-email
//
// Generates an acknowledgement token (if not already present), flips the intake
// to status='pending_consignor', and tries to email the consignor a link to
// /consignor/confirm/<token>. The token is the auth — no supabase user signup
// is required for the recipient to act on it.
//
// Degrades gracefully:
//   - If the contact has no email                → 400
//   - If service-role isn't configured           → returns shareableUrl, emailSent:false
//   - If SendGrid isn't configured / fails       → returns shareableUrl, emailSent:false
// The intake + token still persist either way so the vendor can copy the link
// from the intake detail page and pass it along.

type Params = { id: string };

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const sendgridApiKey = process.env.SENDGRID_API_KEY;

async function sendConsignorEmail(
  email: string,
  vendorName: string,
  url: string,
): Promise<{ sent: boolean; reason?: string }> {
  if (!sendgridApiKey) {
    return { sent: false, reason: "SENDGRID_API_KEY not configured" };
  }
  try {
    // Lazy import so non-email paths don't pay the dep cost / fail at build.
    const sgMail = (await import("@sendgrid/mail")).default;
    sgMail.setApiKey(sendgridApiKey);
    await sgMail.send({
      to: email,
      from: {
        email: "noreply@help.optrader.com.au",
        name: "OP Trader",
      },
      replyTo: "support@help.optrader.com.au",
      subject: `${vendorName} shared a consignment intake with you`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Consignment intake to confirm</h2>
          <p>Hi,</p>
          <p><strong>${escapeHtml(vendorName)}</strong> has recorded a consignment drop-off from you on OP Trader and would like you to review the line items.</p>
          <p>Use the link below to accept the intake, dispute individual items, or reject the batch. No account required.</p>
          <p style="margin: 24px 0;">
            <a href="${url}" style="display: inline-block; padding: 12px 24px; background-color: #dc2626; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Review consignment intake
            </a>
          </p>
          <p style="color: #666; font-size: 12px;">If the button doesn't work, copy this URL into your browser:<br/><span style="word-break: break-all;">${url}</span></p>
          <p style="margin-top: 30px; color: #666;">— OP Trader</p>
        </div>
      `,
    });
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: e instanceof Error ? e.message : "send failed" };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing intake id" }, { status: 400 });
  }

  // Auth: caller must be signed in (vendor side).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Load intake — RLS ensures only vendor members see it.
  const { data: intake, error: intakeErr } = await supabase
    .schema("ecom")
    .from("consignment_intakes")
    .select(
      "id, vendor_account_id, consignor_contact_id, status, acknowledgement_token",
    )
    .eq("id", id)
    .maybeSingle();

  if (intakeErr) {
    return NextResponse.json({ error: intakeErr.message }, { status: 500 });
  }
  if (!intake) {
    return NextResponse.json(
      { error: "Intake not found or you do not have access" },
      { status: 404 },
    );
  }

  // Load contact + vendor details for the email body.
  const [contactRes, vendorRes] = await Promise.all([
    intake.consignor_contact_id
      ? supabase
          .schema("ecom")
          .from("contacts")
          .select("id, email, name")
          .eq("id", intake.consignor_contact_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null } as const),
    supabase
      .schema("basejump")
      .from("accounts")
      .select("id, name, slug")
      .eq("id", intake.vendor_account_id)
      .maybeSingle(),
  ]);

  const contact = contactRes.data as
    | { id: string; email: string | null; name: string }
    | null;
  const vendor = vendorRes.data as
    | { id: string; name: string | null; slug: string | null }
    | null;

  if (!contact) {
    return NextResponse.json(
      { error: "Intake has no contact attached" },
      { status: 400 },
    );
  }

  // Ensure we have a token; generate one if not.
  let token = intake.acknowledgement_token;
  if (!token) {
    token = randomUUID();
    // Use service role to bypass any policy edge cases on the token update,
    // since we want this to always succeed for the vendor.
    const admin = createServiceRoleClient();
    const writer = admin ?? supabase;
    const { error: updErr } = await writer
      .schema("ecom")
      .from("consignment_intakes")
      .update({
        acknowledgement_token: token,
        status:
          intake.status === "draft" || intake.status === "cancelled"
            ? "pending_consignor"
            : intake.status,
      })
      .eq("id", id);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 500 });
    }
  } else if (intake.status === "draft") {
    // Token exists but still draft (shouldn't happen via normal flow); flip it.
    await supabase
      .schema("ecom")
      .from("consignment_intakes")
      .update({ status: "pending_consignor" })
      .eq("id", id);
  }

  const shareableUrl = `${siteUrl}/consignor/confirm/${token}`;

  if (!contact.email) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      shareableUrl,
      reason: "Contact has no email — share the URL manually",
    });
  }

  const vendorName = vendor?.name || vendor?.slug || "A vendor";
  const result = await sendConsignorEmail(contact.email, vendorName, shareableUrl);
  return NextResponse.json({
    ok: true,
    emailSent: result.sent,
    shareableUrl,
    reason: result.sent ? undefined : result.reason,
  });
}
