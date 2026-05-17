# 05 — PayID provider integration (post-event)

## Goal

Replace the manual-record PayID flow (vendor types in a reference after
seeing the transfer in their bank app) with real-time confirmation via
a PayID-as-a-service provider. Webhook from the provider flips
`ecom.order_payments.status` to `received` automatically.

See `[[project-event-build-decisions]]` for why this was deferred —
provider onboarding (KYB/AML) takes 1–3 weeks at minimum, longer than
the 7-day window before the Trading Card Summit.

## Provider shortlist

| Provider | Notes |
|---|---|
| **Azupay** | Strong AU focus, PayID-first product. Good API docs. Typical onboarding 2–4 weeks. |
| **Zepto** | PayTo + PayID. Established. Onboarding similar. |
| **Monoova** | Enterprise leaning, robust webhooks. |
| **Cuscal** | Wholesale provider many fintechs build on. Heavier integration. |
| **Hay / Up** | Consumer bank APIs (read-only). Not a real-time PayID receive solution; eliminate. |

**Recommendation:** start with Azupay's sandbox while paperwork goes
through. Their `Create PayID` + `Inbound Payment Webhook` is the
minimum viable surface.

## Schema (no new migration needed)

`ecom.payment_method` enum already includes
`('cash', 'payid_manual', 'bank_transfer', 'trade_offset')` with a
comment noting future `payid_api` and `stripe` are valid additions.
When the provider is live:

```sql
alter type ecom.payment_method add value if not exists 'payid_api';
```

## Integration shape

1. **Generate a PayID for the trader account** on signup or first use.
   Store provider account id on `traders` table (new column).
2. **POS Payment "PayID" button** changes behaviour:
   - Today: free-text reference field + mark paid manually
   - With provider: show the PayID + amount as a QR code (the buyer
     scans into their banking app). The order_payments row is inserted
     with status=`pending`.
3. **New edge function `payid-webhook`**:
   - Receives provider's inbound payment webhook
   - Verifies signature
   - Looks up the matching `order_payments` row by reference / amount
   - Updates status to `received`, sets `paid_at`
   - `verify_jwt = false` (called by provider not by user)
4. **Reconciliation safety.** If the buyer sends the wrong amount or
   pays the wrong PayID, the webhook can't match — surface this in
   `/admin/reconciliation` for manual handling.

## Open questions

1. **One PayID per trader vs one per transaction.** Per-trader is
   simpler but reconciliation has to use the amount+timestamp window to
   match. Per-transaction PayIDs are cleaner but some providers
   throttle creation. Start per-trader.
2. **Refunds.** Provider-specific; out of scope for v1.

## Acceptance criteria

- Provider sandbox configured + webhook endpoint deployed
- POS PayID flow renders QR; sandbox payment marks order received
- Failed match surfaces in /admin/reconciliation

## Cost estimate

Implementation: ~2 days once a provider account is live (sandbox
credentials in hand). Onboarding lead time: weeks, not days.
