"use client";

import ProductLink from "@/components/ProductLink";

// Two-line card identity cell used across /manage list tables.
// Line 1: card name (linked to /products/{id}) + inline #card_number.
// Line 2: set name in muted text.
// When cardProductId is null (custom products, deleted catalog rows),
// the name renders as plain text via ProductLink's fallthrough.
export default function CardCell({
  cardProductId,
  name,
  cardNumber,
  setName,
  showIcon = true,
}: {
  cardProductId: string | null | undefined;
  name: string | null | undefined;
  cardNumber: string | null | undefined;
  setName: string | null | undefined;
  showIcon?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="font-medium text-gray-900 dark:text-gray-100">
        <ProductLink cardProductId={cardProductId} showIcon={showIcon}>
          {name ?? "—"}
        </ProductLink>
      </div>
      {cardNumber && (
        <div className="text-xs font-mono text-gray-500 dark:text-gray-400">
          #{cardNumber}
        </div>
      )}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        {setName ?? "—"}
      </div>
    </div>
  );
}
