// Linked account types
export type LinkedAccountType = "shiny" | "collectr";

export interface LinkedAccount {
  type: LinkedAccountType;
  handle: string;
}

// User profile types
export interface Profile {
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  linked_accounts: LinkedAccount[];
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
  linked_accounts?: LinkedAccount[];
}
