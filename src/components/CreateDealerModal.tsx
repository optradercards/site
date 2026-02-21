"use client";

import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useAccounts } from "@/contexts/AccountContext";

interface CreateDealerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateDealerModal({
  isOpen,
  onClose,
}: CreateDealerModalProps) {
  const { switchAccount } = useAccounts();
  const queryClient = useQueryClient();
  const supabase = createClient();

  const [dealerName, setDealerName] = useState("");
  const [dealerSlug, setDealerSlug] = useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setDealerName("");
      setDealerSlug("");
      setSlugManuallyEdited(false);
      setError(null);
    }
  }, [isOpen]);

  const handleSlugChange = (value: string) => {
    setDealerSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    );
  };

  const handleCreate = async () => {
    if (!dealerName.trim() || !dealerSlug.trim()) {
      setError("Please fill in both fields.");
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        "create_dealer_account",
        {
          dealer_name: dealerName.trim(),
          dealer_slug: dealerSlug.trim(),
        }
      );

      if (rpcError) throw rpcError;

      await queryClient.invalidateQueries({ queryKey: ["accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["trader-plan"] });

      if (data) {
        switchAccount(data);
      }

      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to create dealer account. Please try again."
      );
    } finally {
      setIsCreating(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">
            Create a Dealer Account
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-red-700 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={dealerName}
              onChange={(e) => {
                setDealerName(e.target.value);
                if (!slugManuallyEdited) {
                  handleSlugChange(e.target.value);
                }
              }}
              placeholder="My Card Shop"
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              URL Slug
            </label>
            <div className="flex items-center gap-0">
              <span className="px-3 py-2 bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400 text-sm rounded-l-lg border border-r-0 border-gray-300 dark:border-gray-600">
                optrader.cards/
              </span>
              <input
                type="text"
                value={dealerSlug}
                onChange={(e) => {
                  setSlugManuallyEdited(true);
                  handleSlugChange(e.target.value);
                }}
                placeholder="my-card-shop"
                className="flex-1 px-3 py-2 rounded-r-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={handleCreate}
              disabled={isCreating}
              className="flex-1 px-6 py-2 bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white font-semibold rounded-lg transition-colors"
            >
              {isCreating ? "Creating..." : "Create Dealer Account"}
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
