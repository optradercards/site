# 03 — Listing quantity decrement DB trigger

## Goal

When a transaction item with `side IN ('sold', 'traded_out')` is
inserted, atomically decrement `ecom.products.quantity` (the listing)
and mark it `sold` if the new quantity hits zero. Today the POS does
this app-side in a loop, which is race-prone if two cashiers process
overlapping sales (rare but possible).

## Current code to remove

`src/app/[slug]/manage/sell/page.tsx`, step 4 of `complete()`:

```ts
// 4. Decrement listing quantities for outbound items from stock
for (const it of items) {
  if (it.direction !== "out") continue;
  if (!it.listing_id) continue;
  const newQty = Math.max(0, it.max_available - it.quantity);
  await supabase
    .schema("ecom")
    .from("products")
    .update({ quantity: newQty, status: newQty === 0 ? "sold" : "active" })
    .eq("id", it.listing_id)
    .eq("account_id", activeAccountId);
}
```

This loop is the race window: `max_available` was read at search time,
not at sale time. If another cashier sold one between, we overwrite
their decrement.

## Migration sketch

```sql
create or replace function ecom.decrement_listing_on_sale()
returns trigger
language plpgsql
as $$
declare
  v_remaining integer;
begin
  if new.listing_id is null then return new; end if;
  if new.side not in ('sold', 'traded_out') then return new; end if;

  update ecom.products
  set quantity = greatest(0, quantity - new.quantity),
      status = case
        when greatest(0, quantity - new.quantity) = 0 then 'sold'
        else status
      end
  where id = new.listing_id
  returning quantity into v_remaining;

  if v_remaining is null then
    raise exception 'listing % not found for transaction_item %',
      new.listing_id, new.id;
  end if;

  return new;
end;
$$;

create trigger decrement_listing_after_insert
  after insert on ecom.transaction_items
  for each row execute function ecom.decrement_listing_on_sale();
```

Atomic single-row update solves the race — Postgres locks the listing
row for the duration of the UPDATE.

## Side cases

- **Updates / deletes on transaction_items.** v1 ignores; transactions
  are append-only in practice. If we later let cashiers edit a saved
  transaction, would need to reverse the decrement and reapply.
- **Quantity > available.** The trigger floors at 0 (`greatest(0, ...)`)
  rather than rejecting. POS already enforces qty ≤ max_available in
  the UI; floor protects against bad data.
- **Trade-ins (`bought`, `traded_in`).** Should they *increment* the
  matching listing if one exists? Recommendation: no — inbound cards go
  into the trader's inventory via a different flow (manual list, then
  the listing exists). Adding auto-listing is a separate feature.

## Acceptance criteria

- POS sale of qty 2 from a listing with qty 5 → listing.quantity = 3.
- POS sale of qty 5 from a listing with qty 5 → listing.quantity = 0,
  listing.status = 'sold'.
- Two concurrent POS sales for the same listing total no more than the
  available qty (no double-spend).
- Drop the app-side decrement loop from the POS after deploy.

## Cost estimate

~30 min including the migration, removing the app-side loop, and
testing against the hosted DB.
