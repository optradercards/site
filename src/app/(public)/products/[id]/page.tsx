import type { Metadata } from "next";
import CardDetailPage from "@/components/CardDetailPage";

export const metadata: Metadata = {
  title: "Card Details",
  description: "View card details, pricing, and availability on OP Trader.",
};

export default function CardDetailRoute() {
  return <CardDetailPage />;
}
