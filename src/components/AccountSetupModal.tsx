"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";
import Image from "next/image";

type ProfileFormData = {
  name: string;
  slug: string;
};

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function AccountSetupModal() {
  const supabase = createClient();
  const { user } = useUser();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<"intro" | "setup">("intro");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProfileFormData>({
    defaultValues: {
      name: "",
      slug: "",
    },
  });

  const name = watch("name");
  const slug = watch("slug");

  // Auto-generate slug from name (unless user has manually edited it)
  useEffect(() => {
    if (name && !slugManuallyEdited) {
      const generatedSlug = generateSlug(name);
      setValue("slug", generatedSlug);
    }
  }, [name, slugManuallyEdited, setValue]);

  useEffect(() => {
    async function checkAccountSetup() {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user's personal account
        const { data: accountData, error } = await supabase.rpc(
          "get_personal_account"
        );

        if (error) throw error;

        setAccountId(accountData?.account_id);

        // Check if name or slug are missing
        const needsSetup =
          !accountData?.name ||
          !accountData?.slug ||
          accountData.name.trim() === "" ||
          accountData.slug.trim() === "";

        if (needsSetup) {
          setShowModal(true);
          setValue("name", accountData?.name || "");
          setValue("slug", accountData?.slug || "");
          setAvatarUrl(null); // Will fetch from profile if exists
        }
      } catch (err) {
        console.error("Error checking account setup:", err);
        setShowModal(false);
      } finally {
        setLoading(false);
      }
    }

    checkAccountSetup();
  }, [user, supabase, setValue]);

  const handleAvatarUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    try {
      setUploading(true);
      setSaveError(null);

      if (!event.target.files || event.target.files.length === 0) {
        return;
      }

      const file = event.target.files[0];
      const fileExt = file.name.split(".").pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(filePath);

      setAvatarUrl(publicUrl);
    } catch (err) {
      console.error("Error uploading avatar:", err);
      setSaveError("Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setSaveError(null);
    setIsSaving(true);

    if (!accountId) {
      setSaveError("Account not found");
      setIsSaving(false);
      return;
    }

    try {
      // Update account with name and slug
      const { error: updateError } = await supabase
        .schema("basejump")
        .from("accounts")
        .update({
          name: data.name.trim(),
          slug: data.slug.trim().toLowerCase(),
        })
        .eq("id", accountId);

      if (updateError) throw updateError;

      // Update profile with avatar if provided
      if (avatarUrl) {
        const { error: profileError } = await supabase
          .from("profiles")
          .update({ avatar_url: avatarUrl })
          .eq("account_id", accountId);

        if (profileError) throw profileError;
      }

      // Close modal on success
      setShowModal(false);
      setStep("intro");
    } catch (err: any) {
      console.error("Error saving profile:", err);
      if (err.code === "23505") {
        setSaveError("This username/slug is already taken");
      } else {
        setSaveError("Failed to save profile");
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading || !showModal) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full">
        {step === "intro" ? (
          <div className="p-6 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                Welcome to OP Trader!
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Let's set up your trader profile to get you started.
              </p>
            </div>

            <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                  1
                </div>
                <p>Choose your trader username</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                  2
                </div>
                <p>Create your public profile URL</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs font-bold">
                  3
                </div>
                <p>Add a profile picture (optional)</p>
              </div>
            </div>

            <button
              onClick={() => setStep("setup")}
              className="w-full px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
            >
              Get Started
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
            <div className="mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
                Set Up Your Profile
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Complete the fields below to finish setup
              </p>
            </div>

            {/* Avatar Section */}
            <div className="flex justify-center py-4">
              <div className="relative w-20 h-20 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
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
                      className="w-10 h-10"
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
            </div>

            <div className="text-center">
              <label
                htmlFor="avatar-upload"
                className="cursor-pointer inline-block px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors font-medium"
              >
                {uploading ? "Uploading…" : "Upload Photo"}
              </label>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                disabled={uploading}
                className="hidden"
              />
            </div>

            {/* Username Field */}
            <div className="space-y-1">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="name"
              >
                Trader Username
              </label>
              <input
                id="name"
                type="text"
                {...register("name", {
                  required: "Username is required",
                  minLength: {
                    value: 2,
                    message: "Username must be at least 2 characters",
                  },
                })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm"
                placeholder="e.g., CardMaster"
              />
              {errors.name && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.name.message}
                </p>
              )}
            </div>

            {/* Slug Field */}
            <div className="space-y-1">
              <label
                className="block text-sm font-medium text-gray-700 dark:text-gray-200"
                htmlFor="slug"
              >
                Profile URL
              </label>
              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                <span>optrader.cards/</span>
                <input
                  id="slug"
                  type="text"
                  onInput={() => setSlugManuallyEdited(true)}
                  {...register("slug", {
                    required: "Profile URL is required",
                    minLength: {
                      value: 3,
                      message: "URL must be at least 3 characters",
                    },
                    pattern: {
                      value: /^[a-zA-Z0-9-]+$/,
                      message: "Only letters, numbers, and hyphens allowed",
                    },
                  })}
                  className="flex-1 px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 text-sm ml-1"
                  placeholder="cardmaster"
                />
              </div>
              {errors.slug && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.slug.message}
                </p>
              )}
            </div>

            {saveError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 p-3">
                <p className="text-sm text-red-700 dark:text-red-300">
                  {saveError}
                </p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep("intro")}
                disabled={isSaving}
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-60"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={isSaving || isSubmitting}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving || isSubmitting ? "Saving…" : "Complete Setup"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
