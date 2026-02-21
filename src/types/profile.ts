// Linked account types
export type LinkedAccountType = "shiny" | "collectr";

// User profile types
export interface Profile {
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  default_currency: string;
  created_at: string;
  updated_at: string;
}

// Linked account row from public.linked_accounts table
export interface LinkedAccountRow {
  id: string;
  account_id: string;
  platform: LinkedAccountType;
  platform_account_id: string | null;
  handle: string;
  created_at: string;
  updated_at: string;
}

// Profile creation data
export interface CreateProfileData {
  first_name: string;
  last_name: string;
}

// Profile update data
export interface UpdateProfileData {
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  default_currency?: string;
}
