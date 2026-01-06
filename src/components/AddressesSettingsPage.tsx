"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import {
  useProfile,
  useAddAddress,
  useDeleteAddress,
} from "@/hooks/useProfile";
import { useAddressAutocomplete } from "@/hooks/useAddressAutocomplete";

type AddressFormData = {
  addressType: "shipping" | "billing" | "other";
  streetAddress: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
};

export default function AddressesSettingsPage() {
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: profileData, isLoading: loading } = useProfile();
  const deleteAddress = useDeleteAddress();

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Delivery Addresses
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Loading…
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Delivery Addresses
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Manage your shipping and billing addresses
        </p>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

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

      {/* List of existing addresses */}
      {profileData?.addresses && profileData.addresses.length > 0 ? (
        <div className="space-y-3">
          {profileData.addresses.map((address) => (
            <div
              key={address.id}
              className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700"
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
                  onClick={() => {
                    deleteAddress.mutate(address.id);
                    setMessage("Address deleted successfully");
                  }}
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
                {address.city}, {address.state_province} {address.postal_code}
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
        className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium"
      >
        {showAddressForm ? "Cancel" : "Add New Address"}
      </button>

      {showAddressForm && profileData && (
        <AddressForm
          accountId={profileData.account.account_id}
          onSuccess={() => {
            setShowAddressForm(false);
            setMessage("Address added successfully");
            setError(null);
          }}
          onError={(err) => {
            setError(err);
            setMessage(null);
          }}
        />
      )}
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
      className="p-4 border border-gray-300 dark:border-gray-600 rounded-lg space-y-3 bg-white dark:bg-gray-900"
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
          <p className="text-xs text-gray-500 mt-1">
            Loading address autocomplete...
          </p>
        )}
        <input
          {...register("streetAddress", {
            required: "Street address is required",
          })}
          type="hidden"
        />
        {errors.streetAddress && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">
            {errors.streetAddress.message}
          </p>
        )}
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
          {errors.city && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errors.city.message}
            </p>
          )}
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
          {errors.stateProvince && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errors.stateProvince.message}
            </p>
          )}
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
          {errors.postalCode && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              {errors.postalCode.message}
            </p>
          )}
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
