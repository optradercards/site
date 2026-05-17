# 02 — Buyer magic-link account + email receipts

## Goal

Walk-up buyers at the POS leave the table with:
1. An emailed receipt (line items, total, payment method)
2. A magic link that creates / signs them into a Basejump personal
   account so they can claim the order online later

Without this, paper-free buyers leave with nothing.

See `[[project-event-build-decisions]]` for context on why this was
chosen over receipt printing or PayID integration.

## New edge function

`database/supabase/functions/send-order-receipt/`

**Trigger:** invoked from POS (`src/app/[slug]/manage/sell/page.tsx`)
immediately after `transactions.status` flips to `completed`. Fire and
forget — UI should not block on the email.

**Input payload:** `{ transaction_id: string }`

**Behavior:**

1. Load the transaction with items + payments:
   ```sql
   ecom.transactions
     join ecom.transaction_items
     left join ecom.order_payments
   ```
2. If `buyer_contact.email` is null → return success with no-op.
3. Look up auth.users by email. If not found:
   - Use `supabase.auth.admin.inviteUserByEmail` (or
     `createUser` + manual magic-link generation) to create a Basejump
     personal account. The existing
     `auto_create_collector_plan` trigger handles the trader row.
   - Capture the new user id; update
     `ecom.transactions.buyer_user_id` so the buyer can claim it on
     login.
4. Send email via SendGrid using a new template:
   - Subject: `Your OP Trader receipt — <trader name>`
   - Body: line items (name + qty + unit price), totals breakdown,
     payment method, table number / event if `transactions.event_id` is
     set, and a "View your order" magic-link CTA.

**Worker contract** (matches the supervisor):
`{ success: true, stats: { sent: 1 } }` or
`{ success: false, retryable: true, error: "SendGrid 5xx" }`.

**config.toml:** `verify_jwt = false` (called from POS via
`supabase.functions.invoke` with the user session, but also potentially
from `run-job` if we wrap it as a job — see below).

## Should it go through the job framework?

**Recommendation: yes.** Wrap as a `send-receipt` platform.

- POS inserts a `jobs.job_logs` row with platform=`send-receipt`,
  payload `{ transaction_id }`, status=pending.
- `run-job` invokes `send-order-receipt`.
- SendGrid 5xx → retryable, supervisor reschedules automatically.

That avoids the POS having to do its own error handling and gets free
retry semantics from the recent supervisor refactor (see
`database/supabase/functions/run-job/index.ts`).

Migration: add `'send-receipt'` to the `jobs.job_logs.platform` CHECK
constraint; add `send-receipt → send-order-receipt` mapping in run-job.

## Email template

New file: `database/supabase/templates/order-receipt.html`

Use existing templates (`invite.html`, `magic_link.html`) as visual
reference. Two CTAs:

- "View your order" → magic link to `/orders/<id>`
- "Visit shop" → trader storefront `/<seller_slug>`

Note: the new `/orders/<id>` page does not yet exist — see Open
question #2.

## POS-side change

After step 5 of `complete()` in `src/app/[slug]/manage/sell/page.tsx`,
insert a job_logs row:

```ts
await supabase
  .schema('jobs')
  .from('job_logs')
  .insert({
    account_id: activeAccountId,
    platform: 'send-receipt',
    handle: `Receipt: ${buyerEmail}`,
    status: 'pending',
    payload: { transaction_id: tx.id },
  });
```

The pg_net insert trigger fires `run-job` and the receipt goes out
asynchronously. No `await` of the actual send.

## Open questions

1. **Passwordless behaviour.** Should the magic link auto-sign the
   buyer in (passwordless), or take them to `/login` with the email
   pre-filled? Passwordless is friendlier but a forwarded email leaks
   account access. Recommendation: passwordless with 7-day expiry
   (matches the existing invitation flow).
2. **Order view page.** `/orders/<id>` doesn't exist. MVP: when buyer
   clicks the magic link they land on a stub that lists the transaction
   items + payment. Could grow into a full buyer dashboard later.
3. **Email throttling.** If the same buyer makes 5 trades in 10 minutes
   they get 5 emails. Acceptable for v1.
4. **Welcome flow.** First-time auto-created accounts go straight to
   the order view. AccountSetupModal will pop up the first time they
   actually visit `/manage`. Fine for v1.

## Acceptance criteria

- Complete a POS sale with a buyer email → email arrives within ~60s
  (allow for SendGrid + supervisor cron tick).
- New email address: new Basejump account exists, magic link signs in.
- Existing email: receipt arrives, magic link signs in to existing
  account.
- No email captured: POS still succeeds, no email sent, no error.
- SendGrid 5xx: job retries automatically per supervisor backoff.

## Cost estimate

~3–4 hours including template + edge function + POS wiring + the stub
`/orders/<id>` page.
