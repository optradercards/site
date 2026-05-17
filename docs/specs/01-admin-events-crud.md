# 01 — Admin events CRUD + vendor mapping

## Goal

Operator-facing UI to create, edit, publish, and unpublish events, and to
override vendor attendance (in case a trader hasn't RSVP'd themselves).

Trader self-service at `/[slug]/manage/events` already covers the common
case — vendors RSVP themselves. This admin surface is the override layer.

## Schema

Already in place:

- `events.events` (slug, name, starts_at, ends_at, venue, address,
  hero_image_url, description, external_url, status enum draft|published|past)
- `events.event_traders` (event_id, account_id, table_number, status enum
  confirmed|tentative|declined)
- View `events.published_events_with_traders` (read-only)

No new migrations.

## Routes

- `src/app/admin/events/page.tsx` — list + create button. Shows status,
  date range, # attending vendors.
- `src/app/admin/events/[slug]/page.tsx` — edit form + attending vendors
  manager.
- (Optional) `src/app/admin/events/new/page.tsx` — dedicated create flow,
  or inline modal on the list page.

## Edit form fields

| Field | Type | Notes |
|---|---|---|
| slug | text | auto-generated from name; editable; uniqueness validated |
| name | text | |
| starts_at, ends_at | datetime-local | timezone is Australia/Sydney; render in local time |
| venue, address | text | |
| hero_image_url | text + upload | see image upload below |
| description | textarea | plain text; whitespace preserved by current renderer |
| external_url | url | optional |
| status | select | draft / published / past — past is auto-set when ends_at < now (admin can override) |

## Image upload

Two options:

- **Simple (recommended):** keep hero_image_url as text. Admin uploads
  via Supabase Storage `trading-cards` bucket (or a new `events` bucket)
  using existing infra; copies returned public URL into the field.
- **Integrated:** dropzone component, uploads inline, stores object path,
  resolves to public URL on read.

Trading Card Summit was set up via the `public/events/*.jpg` path. Either
works for future events but mixing local-asset and Storage-URL hero
images is fine — both render through Next/Image.

## Attending vendors panel

Below the edit form, list all rows from `events.event_traders` for this
event. For each:

- Trader name + slug (link to `/<slug>` storefront)
- Status dropdown (confirmed / tentative / declined)
- Table number input
- Remove button

Add "Add vendor" autocomplete: search basejump.accounts where
`personal_account = false` (i.e. team accounts = traders) and insert
event_traders row. RLS already allows admins via `is_admin()`.

## Open questions

1. **Status auto-transition.** Do we run a daily cron to flip
   ends_at < now() events from `published` to `past`? Or compute the
   "past" badge purely from `ends_at` and stop storing status=past
   separately? (Recommended: drop the 'past' enum value and compute.)
2. **Slug edit safety.** Editing slug breaks any external links to
   `/events/<old-slug>`. Probably fine for non-public events; for
   published events warn the admin.
3. **Soft delete.** No DELETE button in v1 — set status=draft to hide.

## Acceptance criteria

- Admin can create a new event end-to-end without touching SQL.
- Edits land on `/events/<slug>` public page within ISR window (5 min).
- Admin can add/remove vendor attendance and override status.
- Form rejects duplicate slugs with a clear error.

## Cost estimate

~3–4 hours including form validation and the attending vendors panel.
