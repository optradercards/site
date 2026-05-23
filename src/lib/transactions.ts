// Per-item pro-rata discount allocation.
//
// A transaction-level discount (ecom.transactions.discount_cents) is spread
// across the items the vendor is sending OUT (side IN 'sold'/'traded_out')
// in proportion to each line's value. Incoming trade-ins are not "discounted
// to" the customer, so they're excluded from the denominator and absorb no
// share themselves.

const OUTGOING_SIDES = new Set(["sold", "traded_out"]);

export function isOutgoingSide(side: string): boolean {
  return OUTGOING_SIDES.has(side);
}

/**
 * Discount share allocated to a single transaction_item line, in cents.
 * Returns 0 for non-outgoing items or when there's nothing to allocate.
 */
export function lineDiscountShareCents(
  unit_price_cents: number,
  quantity: number,
  side: string,
  discount_cents: number,
  outgoing_subtotal_cents: number,
): number {
  if (!isOutgoingSide(side)) return 0;
  if (discount_cents <= 0 || outgoing_subtotal_cents <= 0) return 0;
  const lineTotal = unit_price_cents * quantity;
  return Math.round((discount_cents * lineTotal) / outgoing_subtotal_cents);
}

/**
 * Effective line total in cents after the line's share of the transaction
 * discount has been deducted. For non-outgoing or zero-discount cases this
 * is just unit_price × quantity.
 */
export function effectiveLineTotalCents(
  unit_price_cents: number,
  quantity: number,
  side: string,
  discount_cents: number,
  outgoing_subtotal_cents: number,
): number {
  const lineTotal = unit_price_cents * quantity;
  const share = lineDiscountShareCents(
    unit_price_cents,
    quantity,
    side,
    discount_cents,
    outgoing_subtotal_cents,
  );
  return lineTotal - share;
}
