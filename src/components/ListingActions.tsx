"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useUser } from "@/contexts/UserContext";
import { useAddToCart } from "@/hooks/useCart";
import { formatPrice } from "@/lib/currency";

type CrossSellItem = {
  id: string;
  title: string;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
};

export default function ListingActions({
  productId,
  disabled,
  stock,
  itemTitle,
  itemImage,
  itemPrice,
  crossSellItems,
  rates,
}: {
  productId: string;
  disabled?: boolean;
  stock: number;
  itemTitle: string;
  itemImage: string | null;
  itemPrice: string;
  crossSellItems?: CrossSellItem[];
  rates: Record<string, number>;
}) {
  const fmtPrice = (cents: number | null, currency: string) =>
    formatPrice(cents, "AUD", rates, currency);
  const { user } = useUser();
  const router = useRouter();
  const addToCart = useAddToCart();
  const [showModal, setShowModal] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const handleAddToCart = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    addToCart.mutate(
      { productId, quantity },
      { onSuccess: () => setShowModal(true) },
    );
  };

  return (
    <>
      {/* Quantity selector */}
      {stock > 1 && (
        <div className="mb-4">
          <label className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1.5 block">
            Quantity
          </label>
          <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-lg w-fit">
            <button
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={disabled || quantity <= 1}
              className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 text-sm font-medium"
            >
              -
            </button>
            <span className="px-4 py-2 text-sm font-semibold text-gray-900 dark:text-gray-100 border-x border-gray-300 dark:border-gray-600 min-w-[3rem] text-center">
              {quantity}
            </span>
            <button
              onClick={() => setQuantity((q) => Math.min(stock, q + 1))}
              disabled={disabled || quantity >= stock}
              className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors disabled:opacity-50 text-sm font-medium"
            >
              +
            </button>
          </div>
          {stock <= 10 && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {stock} available
            </p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-2.5">
        <button
          disabled={disabled}
          className="w-full py-3 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Buy It Now
        </button>
        <button
          onClick={handleAddToCart}
          disabled={disabled || addToCart.isPending}
          className="w-full py-3 bg-blue-600 text-white font-semibold rounded-full hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {addToCart.isPending ? "Adding..." : "Add to Cart"}
        </button>
        <button
          disabled={disabled}
          className="w-full py-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add to Watchlist
        </button>
      </div>

      {/* Added to Cart modal */}
      {showModal && (
        <div
          className="fixed inset-0 bg-black/50 z-[1000] flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div
            className="bg-white dark:bg-gray-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-sm">Added to Cart</span>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Added item */}
            <div className="p-4 flex gap-3">
              <div className="w-16 h-20 bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden shrink-0">
                {itemImage ? (
                  <img src={itemImage} alt={itemTitle} className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 line-clamp-2">
                  {itemTitle}
                </p>
                <p className="text-sm font-bold text-red-500 mt-1">{itemPrice}</p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="px-4 pb-4 flex gap-2">
              <Link
                href="/cart"
                className="flex-1 py-2.5 bg-red-500 text-white font-semibold rounded-full hover:bg-red-600 transition-colors text-sm text-center"
              >
                View Cart
              </Link>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-semibold rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-sm"
              >
                Continue Shopping
              </button>
            </div>

            {/* Cross-sell */}
            {crossSellItems && crossSellItems.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4">
                <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 mb-3">
                  You may also like
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {crossSellItems.slice(0, 6).map((item) => (
                    <Link
                      key={item.id}
                      href={`/listing/${item.id}`}
                      onClick={() => setShowModal(false)}
                      className="bg-gray-50 dark:bg-gray-700/50 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
                    >
                      <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-700 overflow-hidden">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.title}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-400">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-1.5">
                        <p className="text-[11px] font-medium text-gray-800 dark:text-gray-200 truncate">
                          {item.title}
                        </p>
                        {item.price_cents != null && (
                          <p className="text-[11px] font-bold text-red-500 mt-0.5">
                            {fmtPrice(item.price_cents, item.currency)}
                          </p>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
