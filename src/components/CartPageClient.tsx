"use client";

import Link from "next/link";
import { useUser } from "@/contexts/UserContext";
import { useCart, useUpdateCartQuantity, useRemoveFromCart } from "@/hooks/useCart";
import { useExchangeRates } from "@/hooks/useExchangeRates";
import { formatPrice } from "@/lib/currency";

export default function CartPageClient() {
  const { user } = useUser();
  const { data: items, isLoading } = useCart();
  const { data: rates } = useExchangeRates();
  const updateQuantity = useUpdateCartQuantity();
  const removeFromCart = useRemoveFromCart();

  const displayCurrency = "AUD";
  const fmtPrice = (cents: number | null, sourceCurrency: string) =>
    formatPrice(cents, displayCurrency, rates ?? {}, sourceCurrency);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Sign in to view your cart
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          You need to be logged in to add items to your cart.
        </p>
        <Link
          href="/login"
          className="inline-block px-6 py-2.5 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-sm"
        >
          Sign In
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-gray-700 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
        </svg>
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Your cart is empty
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">
          Looks like you haven&apos;t added anything to your cart yet.
        </p>
        <Link
          href="/search"
          className="inline-block px-6 py-2.5 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-sm"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  // Calculate subtotal in AUD cents
  const subtotalCents = items.reduce((sum, item) => {
    if (item.price_cents == null) return sum;
    const fromCurrency = item.currency.toLowerCase();
    const fromRate = fromCurrency === "usd" ? 1 : (rates?.[fromCurrency] ?? 1);
    const toRate = rates?.["aud"] ?? 1;
    const convertedCents = (item.price_cents * toRate) / fromRate;
    return sum + convertedCents * item.quantity;
  }, 0);

  return (
    <div className="container mx-auto px-4 py-6 md:py-10">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
        Shopping Cart ({items.length} {items.length === 1 ? "item" : "items"})
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-8">
        {/* Items list */}
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-4 flex gap-4"
            >
              {/* Image */}
              <Link href={`/listing/${item.product_id}`} className="shrink-0">
                <div className="w-20 h-28 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden">
                  {item.image_url ? (
                    <img
                      src={item.image_url}
                      alt={item.title}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
              </Link>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <Link
                  href={`/listing/${item.product_id}`}
                  className="font-semibold text-sm text-gray-900 dark:text-gray-100 hover:text-red-500 transition-colors line-clamp-2"
                >
                  {item.title}
                </Link>
                <Link
                  href={`/${item.seller_slug}`}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1 block"
                >
                  {item.seller_name}
                </Link>

                {/* Price */}
                <p className="text-base font-bold text-gray-900 dark:text-gray-100 mt-2">
                  {fmtPrice(item.price_cents, item.currency)}
                </p>

                {/* Quantity controls */}
                <div className="flex items-center gap-3 mt-2">
                  <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg">
                    <button
                      onClick={() =>
                        item.quantity <= 1
                          ? removeFromCart.mutate(item.id)
                          : updateQuantity.mutate({ itemId: item.id, quantity: item.quantity - 1 })
                      }
                      disabled={updateQuantity.isPending || removeFromCart.isPending}
                      className="px-2.5 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                    >
                      -
                    </button>
                    <span className="px-3 py-1 text-sm font-medium text-gray-900 dark:text-gray-100 border-x border-gray-300 dark:border-gray-600 min-w-[2rem] text-center">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() =>
                        updateQuantity.mutate({ itemId: item.id, quantity: item.quantity + 1 })
                      }
                      disabled={updateQuantity.isPending || item.quantity >= item.stock}
                      className="px-2.5 py-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>

                  <button
                    onClick={() => removeFromCart.mutate(item.id)}
                    disabled={removeFromCart.isPending}
                    className="text-xs text-red-500 hover:text-red-600 font-medium transition-colors disabled:opacity-50"
                  >
                    Remove
                  </button>
                </div>
              </div>

              {/* Line total */}
              <div className="shrink-0 text-right">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                  {item.price_cents != null
                    ? fmtPrice(item.price_cents * item.quantity, item.currency)
                    : "\u2014"}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Order summary */}
        <div className="lg:sticky lg:top-24 h-fit">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
              Order Summary
            </h2>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal ({items.length} {items.length === 1 ? "item" : "items"})</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  A${(subtotalCents / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Shipping</span>
                <span className="text-gray-500">Calculated at checkout</span>
              </div>
            </div>

            <hr className="my-4 border-gray-200 dark:border-gray-700" />

            <div className="flex justify-between text-base font-bold text-gray-900 dark:text-gray-100">
              <span>Estimated Total</span>
              <span>A${(subtotalCents / 100).toFixed(2)}</span>
            </div>

            <button
              disabled
              className="w-full mt-5 py-3 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Proceed to Checkout
            </button>
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mt-2">
              Checkout coming soon
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
