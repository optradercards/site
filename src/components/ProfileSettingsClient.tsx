"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useUser } from "@/contexts/UserContext";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
  useAddAddress,
  useUpdateAddress,
  useDeleteAddress,
} from "@/hooks/useProfile";
import Link from "next/link";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";
import Image from "next/image";

type ProfileFormData = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  profileName: string;
  profileSlug: string;
};

type AddressFormData = {
  addressType: "shipping" | "billing" | "other";
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

// Helper function to generate URL-friendly slug from profile name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function ProfileSettingsClient() {
  const router = useRouter();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  const { data: profileData, isLoading: loading } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const addAddress = useAddAddress();
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      profileName: "",
      profileSlug: "",
    },
  });

  const profileName = watch("profileName");
  const profileSlug = watch("profileSlug");

  // Auto-generate slug from profile name
  useEffect(() => {
    if (profileName && !profileSlug) {
      const generatedSlug = generateSlug(profileName);
      setValue("profileSlug", generatedSlug);
    }
  }, [profileName, profileSlug, setValue]);

  // Populate form when profile data loads
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (profileData) {
      const { profile, account } = profileData;
      if (profile) {
        setAvatarUrl(profile.avatar_url);
        setValue("firstName", profile.first_name || "");
        setValue("lastName", profile.last_name || "");
        setValue("phoneNumber", profile.phone_number || "");
      }
      if (account) {
        setValue("profileName", account.name || "");
        setValue("profileSlug", account.slug || "");
      }
    }
  }, [user, profileData, router, setValue]);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      setError(null);
      setMessage(null);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];

      if (!profileData?.account.account_id) {
        setError("No account found");
        return;
      }

      const publicUrl = await uploadAvatar.mutateAsync({
        file,
        accountId: profileData.account.account_id,
      });

      setAvatarUrl(publicUrl);
      setMessage("Avatar uploaded successfully");
    } catch (err) {
      console.error("Error uploading avatar:", err);
      setError("Failed to upload avatar");
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setError(null);
    setMessage(null);

    if (!profileData?.account.account_id) {
      setError("Profile not found");
      return;
    }

    try {
      await updateProfile.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        accountId: profileData.account.account_id,
      });

      setMessage("Profile updated successfully");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      if (err.code === "23505") {
        setError("This profile URL is already taken");
      } else {
        setError("Failed to update profile");
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <main className="container mx-auto px-4 py-12 max-w-2xl">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
            <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
              Profile Settings
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
              Loading…
            </p>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <main className="container mx-auto px-4 py-12 max-w-2xl">
        <h1 className="text-4xl font-bold mb-6 text-gray-800 dark:text-gray-100">
          Profile Settings
        </h1>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
          {/* Avatar Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Profile Picture
            </h2>
            <div className="flex items-center space-x-6">
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt="Profile avatar"
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                    <svg
                      className="w-12 h-12"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <label
                  htmlFor="avatar-upload"
                  className="cursor-pointer inline-block px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
                >
                  {uploadAvatar.isPending ? "Uploading…" : "Upload Photo"}
                </label>
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  disabled={uploadAvatar.isPending}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  JPG, PNG or GIF. Max 5MB.
                </p>
              </div>
            </div>
          </div>

          <hr className="border-gray-200 dark:border-gray-700" />

          {/* Profile Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Profile Information
            </h2>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  htmlFor="firstName"
                >
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  {...register("firstName", {
                    required: "First name is required",
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
                {errors.firstName && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  htmlFor="lastName"
                >
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  {...register("lastName", {
                    required: "Last name is required",
                  })}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
                {errors.lastName && (
                  <p className="text-sm text-red-600 dark:text-red-400">
                    {errors.lastName.message}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label
                  className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                  htmlFor="phoneNumber"
                >
                  Phone number
                </label>
                <input
                  id="phoneNumber"
                  type="tel"
                  {...register("phoneNumber")}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                  placeholder="(123) 456-7890"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="profileName"
              >
                Profile name
              </label>
              <input
                id="profileName"
                type="text"
                {...register("profileName")}
                disabled
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                placeholder="How you want to be known"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Profile name cannot be changed from settings
              </p>
            </div>

            <div className="space-y-1">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="profileSlug"
              >
                Profile URL
              </label>
              <input
                id="profileSlug"
                type="text"
                {...register("profileSlug")}
                disabled
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                placeholder="your-profile-url"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Your profile will be at: optrader.com.au/
                {profileSlug || "your-profile-url"}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Profile URL cannot be changed from settings
              </p>
            </div>

            {error && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}

            {message && (
              <div className="rounded-lg border border-green-300 bg-green-50 px-4 py-3 text-green-800 dark:border-green-800 dark:bg-green-950/30 dark:text-green-200">
                {message}
              </div>
            )}

            <hr className="border-gray-200 dark:border-gray-700 my-6" />

            <div className="space-y-2">
              <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Linked Accounts
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your connected Shiny and Collectr accounts.
              </p>
              <Link
                href="/settings/linked-accounts"
                className="inline-block text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
              >
                Manage linked accounts &rarr;
              </Link>
            </div>

            <button
              type="submit"
              disabled={updateProfile.isPending}
              className="w-full px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
            >
              {updateProfile.isPending ? "Saving…" : "Save Changes"}
            </button>
          </form>

          <hr className="border-gray-200 dark:border-gray-700 my-8" />

          {/* Addresses Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
              Delivery Addresses
            </h2>

            {/* List of existing addresses */}
            {profileData?.addresses && profileData.addresses.length > 0 ? (
              <div className="space-y-3">
                {profileData.addresses.map((address) => (
                  <div
                    key={address.id}
                    className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-800"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 capitalize">
                          {address.address_type}
                        </span>
                        {address.is_default && (
                          <span className="text-xs bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200 px-2 py-1 rounded">
                            Default
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => deleteAddress.mutate(address.id)}
                        disabled={deleteAddress.isPending}
                        className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </div>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {address.street_address}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {address.city}, {address.state_province}{" "}
                      {address.postal_code}
                    </p>
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {address.country}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                No addresses added yet
              </p>
            )}

            <button
              type="button"
              onClick={() => setShowAddressForm(!showAddressForm)}
              className="text-sm px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {showAddressForm ? "Cancel" : "Add Address"}
            </button>

            {showAddressForm && profileData && (
              <AddressForm
                accountId={profileData.account.account_id}
                onSuccess={() => {
                  setShowAddressForm(false);
                  setMessage("Address added successfully");
                }}
                onError={(err) => setError(err)}
              />
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AddressForm({
  accountId,
  onSuccess,
  onError,
}: {
  accountId: string;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const addAddress = useAddAddress();
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<AddressFormData>({
    defaultValues: {
      addressType: "shipping",
      streetAddress: "",
      city: "",
      stateProvince: "",
      postalCode: "",
      country: "Australia",
      isDefault: false,
    },
  });

  const {
    ready,
    value,
    setValue: setAutocompleteValue,
    suggestions,
    status,
    handleSelect,
    clearSuggestions,
  } = useAddressAutocomplete();

  const handleAddressSuggestionSelect = async (description: string) => {
    const parsed = await handleSelect(description);
    if (parsed) {
      setValue("streetAddress", parsed.streetAddress);
      setValue("city", parsed.city);
      setValue("stateProvince", parsed.stateProvince);
      setValue("postalCode", parsed.postalCode);
      setValue("country", parsed.country);
    }
  };

  const onSubmit = async (data: AddressFormData) => {
    try {
      await addAddress.mutateAsync({
        accountId,
        addressType: data.addressType,
        streetAddress: data.streetAddress,
        city: data.city,
        stateProvince: data.stateProvince,
        postalCode: data.postalCode,
        country: data.country,
        isDefault: data.isDefault,
      });
      reset();
      onSuccess();
    } catch (err: any) {
      onError(err.message || "Failed to add address");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Address Type
          </label>
          <select
            {...register("addressType")}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          >
            <option value="shipping">Shipping</option>
            <option value="billing">Billing</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Country
          </label>
          <input
            {...register("country", { required: "Country is required" })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
          Street Address
        </label>
        <div className="relative">
          <input
            value={value}
            onChange={(e) => setAutocompleteValue(e.target.value)}
            placeholder="Start typing your address..."
            disabled={!ready}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 disabled:opacity-50"
          />
          {status === "OK" && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto">
              {suggestions.map(({ place_id, description }) => (
                <button
                  key={place_id}
                  type="button"
                  onClick={() => handleAddressSuggestionSelect(description)}
                  className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm text-gray-900 dark:text-gray-100"
                >
                  {description}
                </button>
              ))}
            </div>
          )}
        </div>
        {!ready && (
          <p className="text-xs text-gray-500">
            Loading address autocomplete...
          </p>
        )}
        <input
          {...register("streetAddress", {
            required: "Street address is required",
          })}
          type="hidden"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            City
          </label>
          <input
            {...register("city", { required: "City is required" })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            State/Province
          </label>
          <input
            {...register("stateProvince", {
              required: "State/Province is required",
            })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
            Postal Code
          </label>
          <input
            {...register("postalCode", { required: "Postal code is required" })}
            type="text"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              {...register("isDefault")}
              type="checkbox"
              className="w-4 h-4"
            />
            <span className="text-sm text-gray-700 dark:text-gray-200">
              Set as default
            </span>
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={addAddress.isPending}
        className="w-full px-4 py-2 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold text-sm"
      >
        {addAddress.isPending ? "Adding…" : "Add Address"}
      </button>
    </form>
  );
}
