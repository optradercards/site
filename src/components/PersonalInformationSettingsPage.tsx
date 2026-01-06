"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useUser } from "@/contexts/UserContext";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";

type PersonalInfoFormData = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
};

export default function PersonalInformationSettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const { data: profileData, isLoading: loading } = useProfile();
  const updateProfile = useUpdateProfile();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<PersonalInfoFormData>({
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
    },
  });

  // Populate form when profile data loads
  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    if (profileData?.profile) {
      setValue("firstName", profileData.profile.first_name || "");
      setValue("lastName", profileData.profile.last_name || "");
      setValue("phoneNumber", profileData.profile.phone_number || "");
    }
  }, [user, profileData, router, setValue]);

  const onSubmit = async (data: PersonalInfoFormData) => {
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

      setMessage("Personal information updated successfully");
    } catch (err: any) {
      console.error("Error updating personal information:", err);
      setError("Failed to update personal information");
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Personal Information
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
          Loading…
        </p>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Personal Information
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Update your personal details and contact information
        </p>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Optional - Used for order and delivery notifications
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

        <button
          type="submit"
          disabled={updateProfile.isPending}
          className="w-full px-4 py-3 rounded-lg bg-red-500 text-white hover:bg-red-600 disabled:opacity-60 disabled:cursor-not-allowed transition-colors font-semibold"
        >
          {updateProfile.isPending ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
