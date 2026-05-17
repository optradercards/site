# 06 — Inventory reconciliation surface

## Goal

A per-trader page that surfaces drift between the trader's Shiny
collection (source of truth for what they own) and their OP Trader
`ecom.products` listings, with one-click "fix" actions:

- **In Shiny but not listed on OP Trader** → "List this card" button →
  prefilled new-listing form
- **Listed on OP Trader but not in Shiny** → "This sold elsewhere"
  button → mark listing inactive / archived
- **Quantity mismatch** → side-by-side numbers + "Adjust to N" action

This is the operational pain that drove the Trading Card Summit prep —
stock on the POS must match what's actually in the binder.

## What's already here

The repo already has reconciliation pieces from prior work:

- `database/supabase/migrations/20260516030000_cards-reconciliation-findings.sql`
  introduces a `cards.reconciliation_findings` table
- `database/supabase/functions/collectr-reconcile/` (Collectr-specific
  diff engine — pattern to follow for Shiny)
- `src/app/admin/reconciliation/page.tsx` exists as the admin landing
  page

**Step 0 of this spec is to read all three** and figure out exactly
what's missing. The spec below assumes the findings table can hold
shiny-side findings too (likely needs a `source_provider` column or is
already provider-agnostic).

## Architecture sketch

### Diff job

New edge function `shiny-reconcile-trader`, wrapped as a job platform
`shiny-reconcile`. Inputs `{ account_id, shiny_account_id }`. Behavior:

1. Pull the trader's Shiny collection via `shiny-import-collections`
   (or a fresh read into a staging table).
2. Compare against `ecom.products` where `account_id = $1` and
   `status = 'active'`.
3. Insert findings into `cards.reconciliation_findings` with
   `source_provider = 'shiny'`, `kind in ('missing_listing',
   'extra_listing', 'qty_mismatch')`.
4. Mark stale findings (for the same account + provider) as resolved.

### Trader surface

New route `src/app/[slug]/manage/reconcile/page.tsx`:

- Three tabs (or a single sortable table with kind column):
  - Missing on OP Trader (sourced from Shiny)
  - Extra on OP Trader (no Shiny match)
  - Quantity mismatch
- Per-row actions wired via Supabase JS:
  - Missing → prefill the existing add-listing flow with card +
    suggested price (market value from cards.market_data)
  - Extra → set ecom.products.status = 'archived' for that listing
  - Mismatch → set ecom.products.quantity = shiny qty

### Trader dashboard

Add a counter widget to `src/app/[slug]/manage/page.tsx` showing
"N reconciliation findings — review" linking to the page above.

## Open questions

1. **Provider scope.** Diff against Shiny only, or also Collectr?
   Collectr reconcile already exists for the catalog side; this is
   trader-collection scope.
2. **Auto-action thresholds.** Do we ever auto-archive a listing whose
   Shiny qty drops to 0, or always require a click? Recommendation:
   always require a click (avoid surprise inventory deletion).
3. **Grading awareness.** A PSA-9 listing and a PSA-10 in Shiny are
   different cards. Findings should key on
   (card_product_id, grading_service, grade), not just card_product_id.

## Acceptance criteria

- Run reconcile job for a trader → findings populate within 1 min
- Trader sees three categories with counts
- "List this card" produces a draft listing
- "This sold elsewhere" archives the listing
- Re-running reconcile clears resolved findings

## Cost estimate

~1 day after Step 0 audit, depending on what the existing
reconciliation findings table already gives us.
