import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createServiceRoleClient } from '@/lib/supabase/service-role';

// POST /api/contacts/invite
//
// Body: {
//   accountId: string,      // vendor account that owns the contact
//   contactId: string,      // existing contact to invite (must belong to accountId)
// }
//
// Sends a Supabase auth invite to the contact's email and records a row in
// ecom.contact_invites. If the email is already a registered user, we still
// flip the contact to 'invited' and return success — the auth-users trigger
// will mark it 'linked' if/when they sign in.
//
// Falls back to {emailSent:false, reason:'no service role configured'} if the
// service-role key is unavailable; the contact + invite row are still saved
// via the caller's regular RLS path so vendor can hand off the signup URL
// manually.

type Body = {
  accountId: string;
  contactId: string;
};

export async function POST(request: Request) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { accountId, contactId } = body;
  if (!accountId || !contactId) {
    return NextResponse.json(
      { error: 'accountId and contactId are required' },
      { status: 400 },
    );
  }

  // Auth gate: caller must be signed in and own the vendor account.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Membership check via basejump.get_accounts_with_role (caller's RLS).
  const { data: contact, error: contactErr } = await supabase
    .schema('ecom')
    .from('contacts')
    .select('id, account_id, email, name, link_status')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (contactErr) {
    return NextResponse.json({ error: contactErr.message }, { status: 500 });
  }
  if (!contact) {
    return NextResponse.json(
      { error: 'Contact not found or not owned by this account' },
      { status: 404 },
    );
  }
  if (!contact.email) {
    return NextResponse.json(
      { error: 'Contact has no email — cannot invite' },
      { status: 400 },
    );
  }

  // Record the invite row first (so we always have an audit trail even if
  // the email send fails).
  const { error: inviteErr } = await supabase
    .schema('ecom')
    .from('contact_invites')
    .insert({ contact_id: contact.id, email: contact.email });
  if (inviteErr) {
    return NextResponse.json({ error: inviteErr.message }, { status: 500 });
  }

  // Flip status to 'invited' if currently unlinked.
  if (contact.link_status === 'unlinked') {
    await supabase
      .schema('ecom')
      .from('contacts')
      .update({ link_status: 'invited' })
      .eq('id', contact.id);
  }

  // Try to actually send the email via service-role auth admin.
  const admin = createServiceRoleClient();
  if (!admin) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      reason: 'no service role configured',
    });
  }

  try {
    const { error: inviteSendErr } = await admin.auth.admin.inviteUserByEmail(
      contact.email,
    );
    if (inviteSendErr) {
      // Common case: user already exists. We've still saved the invite row
      // and flipped status to 'invited'; the auto-link trigger will resolve
      // if/when the user signs up. Treat as success-with-warning.
      return NextResponse.json({
        ok: true,
        emailSent: false,
        reason: inviteSendErr.message,
      });
    }
    return NextResponse.json({ ok: true, emailSent: true });
  } catch (e) {
    return NextResponse.json({
      ok: true,
      emailSent: false,
      reason: e instanceof Error ? e.message : 'invite send failed',
    });
  }
}
