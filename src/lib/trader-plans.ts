import { createClient } from "@/lib/supabase/server";
import type {
  TraderPlan,
  TraderStore,
  TraderPlanType,
} from "@/types/trader-plans";

/**
 * Get trader plan for a specific account
 */
export async function getTraderPlan(
  accountId: string
): Promise<TraderPlan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("traders")
    .select("*")
    .eq("account_id", accountId)
    .single();

  if (error) {
    console.error("Error fetching trader plan:", error);
    return null;
  }

  return data;
}

/**
 * Get trader plan for the current user's personal account
 */
export async function getTraderPlanForUser(): Promise<TraderPlan | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  // Get user's personal account
  const { data: account } = await supabase
    .from("accounts")
    .select("id")
    .eq("primary_owner_user_id", user.id)
    .eq("personal_account", true)
    .single();

  if (!account) return null;

  return getTraderPlan(account.id);
}

/**
 * Create a trader plan for an account
 * Note: Billing is managed through Stripe, not stored in database
 */
export async function createTraderPlan(
  accountId: string,
  planType: TraderPlanType,
  billingPeriod: "monthly" | "yearly" = "monthly"
): Promise<TraderPlan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("traders")
    .insert([
      {
        account_id: accountId,
        plan_type: planType,
        billing_period: billingPeriod,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error creating trader plan:", error);
    return null;
  }

  return data;
}

/**
 * Update trader plan
 */
export async function updateTraderPlan(
  accountId: string,
  planType: TraderPlanType
): Promise<TraderPlan | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("traders")
    .update({
      plan_type: planType,
      updated_at: new Date().toISOString(),
    })
    .eq("account_id", accountId)
    .select()
    .single();

  if (error) {
    console.error("Error updating trader plan:", error);
    return null;
  }

  return data;
}

/**
 * Get trader stores for a parent account
 */
export async function getTraderStores(
  parentAccountId: string
): Promise<TraderStore[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trader_stores")
    .select("*")
    .eq("parent_id", parentAccountId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching trader stores:", error);
    return [];
  }

  return data || [];
}

/**
 * Add a trader store (creates new account linked to parent)
 * Note: Store pricing is managed through Stripe subscriptions
 */
export async function addTraderStore(
  parentAccountId: string,
  storeAccountId: string
): Promise<TraderStore | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("trader_stores")
    .insert([
      {
        account_id: storeAccountId,
        parent_id: parentAccountId,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error adding trader store:", error);
    return null;
  }

  return data;
}

/**
 * Remove a trader store
 */
export async function removeTraderStore(
  storeAccountId: string
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("trader_stores")
    .delete()
    .eq("account_id", storeAccountId);

  if (error) {
    console.error("Error removing trader store:", error);
    return false;
  }

  return true;
}

/**
 * Update Stripe subscription details
 */
export async function updateStripeSubscription(
  accountId: string,
  stripeData: {
    stripe_customer_id?: string;
    stripe_subscription_id?: string;
    stripe_price_id?: string;
    billing_cycle_start?: string;
    billing_cycle_end?: string;
  }
): Promise<boolean> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("traders")
    .update(stripeData)
    .eq("account_id", accountId);

  if (error) {
    console.error("Error updating Stripe subscription:", error);
    return false;
  }

  return true;
}

/**
 * Format cents to USD
 */
export function formatCentsToUSD(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
