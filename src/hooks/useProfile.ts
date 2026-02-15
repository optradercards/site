import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";

type ProfileData = {
  account_id: string;
  first_name: string | null;
  last_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  phone_number: string | null;
};

type AccountData = {
  account_id: string;
  name: string | null;
  slug: string | null;
};

type Address = {
  id: string;
  address_type: "shipping" | "billing" | "other";
  street_address: string;
  city: string;
  state_province: string;
  postal_code: string;
  country: string;
  is_default: boolean;
};

export function useProfile() {
  const { user } = useUser();
  const supabase = createClient();

  return useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data: accountData } = await supabase.rpc("get_personal_account");

      if (!accountData?.account_id) {
        throw new Error("No personal account found");
      }

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("account_id", accountData.account_id)
        .single();

      if (profileError && profileError.code !== "PGRST116") {
        throw profileError;
      }

      const { data: addressesData } = await supabase
        .schema("contacts")
        .from("addresses")
        .select("*")
        .eq("account_id", accountData.account_id);

      return {
        profile: profileData as ProfileData | null,
        account: {
          account_id: accountData.account_id,
          name: accountData.name,
          slug: accountData.slug,
        } as AccountData,
        addresses: (addressesData || []) as Address[],
      };
    },
    enabled: !!user,
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      firstName: string;
      lastName: string;
      phoneNumber: string;
      accountId: string;
    }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: data.firstName.trim(),
          last_name: data.lastName.trim(),
          phone_number: data.phoneNumber.trim() || null,
        })
        .eq("account_id", data.accountId);

      if (error) throw error;

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

export function useUploadAvatar() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: { file: File; accountId: string }) => {
      const fileExt = data.file.name.split(".").pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, data.file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: publicUrl })
        .eq("account_id", data.accountId);

      if (updateError) throw updateError;

      return publicUrl;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

export function useAddAddress() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      accountId: string;
      addressType: "shipping" | "billing" | "other";
      streetAddress: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
      isDefault: boolean;
    }) => {
      const { error } = await supabase.schema("contacts").from("addresses").insert({
        account_id: data.accountId,
        address_type: data.addressType,
        street_address: data.streetAddress.trim(),
        city: data.city.trim(),
        state_province: data.stateProvince.trim(),
        postal_code: data.postalCode.trim(),
        country: data.country.trim(),
        is_default: data.isDefault,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

export function useUpdateAddress() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (data: {
      addressId: string;
      addressType: "shipping" | "billing" | "other";
      streetAddress: string;
      city: string;
      stateProvince: string;
      postalCode: string;
      country: string;
      isDefault: boolean;
    }) => {
      const { error } = await supabase
        .schema("contacts")
        .from("addresses")
        .update({
          address_type: data.addressType,
          street_address: data.streetAddress.trim(),
          city: data.city.trim(),
          state_province: data.stateProvince.trim(),
          postal_code: data.postalCode.trim(),
          country: data.country.trim(),
          is_default: data.isDefault,
        })
        .eq("id", data.addressId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}

export function useDeleteAddress() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (addressId: string) => {
      const { error } = await supabase
        .schema("contacts")
        .from("addresses")
        .delete()
        .eq("id", addressId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", user?.id] });
    },
  });
}
