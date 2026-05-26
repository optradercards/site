"use client";

import Link from "next/link";

// Renders children as a link to the public product page when a catalog
// card_product_id is present; otherwise renders children unchanged.
// Always opens in a new tab so vendors don't lose intake-form state when
// they pop out to check the market.
export default function ProductLink({
  cardProductId,
  children,
  className = "",
  title = "Open product details",
  showIcon = false,
}: {
  cardProductId: string | null | undefined;
  children: React.ReactNode;
  className?: string;
  title?: string;
  showIcon?: boolean;
}) {
  if (!cardProductId) return <>{children}</>;
  return (
    <Link
      href={`/products/${cardProductId}`}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`hover:text-red-500 hover:underline inline-flex items-center gap-1 ${className}`}
      title={title}
    >
      {children}
      {showIcon && (
        <svg
          className="w-3 h-3 opacity-60"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      )}
    </Link>
  );
}
