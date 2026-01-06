export type TraderPlanType = "collector" | "dealer" | "dealer_plus";

export interface TraderPlan {
  account_id: string;
  plan_type: TraderPlanType;
  billing_period: "monthly" | "yearly" | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  billing_cycle_start: string | null;
  billing_cycle_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface TraderStore {
  account_id: string;
  parent_id: string;
  created_at: string;
  updated_at: string;
}

export const PLAN_DETAILS = {
  collector: {
    name: "Collector",
    price: 0,
    description: "Perfect for individuals who want to buy, sell, or hold cards",
    features: [
      "Personal collection management",
      "Buy and sell cards",
      "Track collection value",
      "Community access",
      "Standard support",
    ],
  },
  dealer: {
    name: "Dealer",
    price: 4900, // $49 in cents
    description: "For businesses ready to scale their trading operation",
    features: [
      "Everything in Collector",
      "Multiple collections",
      "Business dashboard",
      "Advanced analytics",
      "Priority support",
      "Marketing materials",
      "API access",
      "Dedicated account manager",
    ],
  },
  dealer_plus: {
    name: "Dealer++",
    price: 4900, // $49 + store fees
    description: "For businesses with physical retail locations",
    features: [
      "Everything in Dealer",
      "Point of Sale (POS) system",
      "Multi-location management",
      "Inventory sync across stores",
      "Hardware support",
      "Premium support",
    ],
  },
};
