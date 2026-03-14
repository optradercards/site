import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";

type CartItem = {
  id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  updated_at: string;
  // Joined from listings view
  title: string;
  image_url: string | null;
  price_cents: number | null;
  currency: string;
  seller_slug: string;
  seller_name: string;
  stock: number;
};

export function useCart() {
  const { user } = useUser();
  const supabase = createClient();

  return useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data: items, error } = await supabase
        .schema("ecom")
        .from("cart_items")
        .select("id, product_id, quantity, created_at, updated_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!items || items.length === 0) return [];

      // Fetch listing details — only active listings
      const productIds = items.map((i) => i.product_id);
      const { data: listings, error: listingsError } = await supabase
        .schema("ecom")
        .from("storefront_listings")
        .select("id, title, image_url, price_cents, currency, seller_slug, seller_name, quantity")
        .in("id", productIds);

      if (listingsError) throw listingsError;

      const listingMap = new Map(listings?.map((l) => [l.id, l]) ?? []);

      return items
        .map((item) => {
          const listing = listingMap.get(item.product_id);
          if (!listing) return null;
          return {
            id: item.id,
            product_id: item.product_id,
            quantity: item.quantity,
            created_at: item.created_at,
            updated_at: item.updated_at,
            title: listing.title,
            image_url: listing.image_url,
            price_cents: listing.price_cents,
            currency: listing.currency,
            seller_slug: listing.seller_slug,
            seller_name: listing.seller_name,
            stock: listing.quantity,
          } as CartItem;
        })
        .filter(Boolean) as CartItem[];
    },
    enabled: !!user,
  });
}

export function useCartCount() {
  const { user } = useUser();
  const supabase = createClient();

  return useQuery({
    queryKey: ["cart-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;

      const { count, error } = await supabase
        .schema("ecom")
        .from("cart_items")
        .select("*", { count: "exact", head: true });

      if (error) throw error;
      return count ?? 0;
    },
    enabled: !!user,
  });
}

export function useAddToCart() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ productId, quantity = 1 }: { productId: string; quantity?: number }) => {
      if (!user) throw new Error("Must be logged in");

      const { error } = await supabase.schema("ecom").rpc("upsert_cart_item", {
        p_product_id: productId,
        p_quantity: quantity,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", user?.id] });
    },
  });
}

export function useUpdateCartQuantity() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      const { error } = await supabase
        .schema("ecom")
        .from("cart_items")
        .update({ quantity })
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", user?.id] });
    },
  });
}

export function useRemoveFromCart() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .schema("ecom")
        .from("cart_items")
        .delete()
        .eq("id", itemId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["cart-count", user?.id] });
    },
  });
}
