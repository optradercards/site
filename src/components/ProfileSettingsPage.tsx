"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useUser } from "@/contexts/UserContext";
import {
  useProfile,
  useUpdateProfile,
  useUploadAvatar,
} from "@/hooks/useProfile";
import Image from "next/image";

type ProfileFormData = {
  profileName: string;
  profileSlug: string;
};

// Helper function to generate URL-friendly slug from profile name
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function ProfileSettingsPage() {
  const router = useRouter();
  const { user } = useUser();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const { data: profileData, isLoading: loading } = useProfile();
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProfileFormData>({
    defaultValues: {
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
      // No fields to update currently - profile name and slug are disabled
      setMessage("Profile updated successfully");
    } catch (err: any) {
      console.error("Error updating profile:", err);
      setError("Failed to update profile");
    }
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Profile Information
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
          Profile
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
          Manage your public profile settings and avatar
        </p>
      </div>

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Avatar Section */}
      <div className="flex flex-col sm:flex-row items-start gap-6">
        <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt="Profile avatar"
              fill
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-3xl text-gray-500">
              👤
            </div>
          )}
        </div>

        <div className="flex-1">
          <label
            htmlFor="avatar-upload"
            className="inline-block px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors cursor-pointer font-medium"
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

      <hr className="border-gray-200 dark:border-gray-700" />

      {/* Profile Information */}
      <div className="space-y-4">
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
            Your profile will be at: optrader.cards/
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
      </div>
    </div>
  );
}
