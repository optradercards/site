export interface CardWithDetails {
  id: string;
  name: string;
  image_url: string | null;
  back_image_url: string | null;
  card_number: string | null;
  rarity: string | null;
  product_code: string | null;
  total_count: string | null;
  follower_count: number | null;
  purchase_unit_count: number | null;
  unit_change_cents: number | null;
  unit_change_percent: number | null;
  has_market_premium: boolean | null;
  set_id: string;
  set_name: string;
  set_code: string | null;
  language: string | null;
  group_id: string | null;
  group_name: string | null;
  set_list_id: string | null;
  set_list_name: string | null;
  brand_id: string;
  brand_name: string;
  brand_icon: string | null;
  price_ungraded: number | null;
  price_psa_1: number | null;
  price_psa_2: number | null;
  price_psa_3: number | null;
  price_psa_4: number | null;
  price_psa_5: number | null;
  price_psa_6: number | null;
  price_psa_7: number | null;
  price_psa_8: number | null;
  price_psa_9: number | null;
  price_psa_10: number | null;
  price_psa_9_5: number | null;
  price_bgs: number | null;
  price_cgc: number | null;
}

export interface RecentPurchase {
  id: string;
  product_id: string;
  source_account_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  activity_timestamp: number;
  created_at: string;
}

export interface PriceHistoryEntry {
  id: string;
  product_id: string;
  recorded_date: string;
  condition: string;
  price_cents: number;
  created_at: string;
}
