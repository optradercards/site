import type { Metadata } from "next";
import CartPageClient from "@/components/CartPageClient";

export const metadata: Metadata = {
  title: "Shopping Cart",
  description: "View and manage items in your shopping cart on OP Trader.",
};

export default function CartPage() {
  return <CartPageClient />;
}
