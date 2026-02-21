"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useProfile } from "@/hooks/useProfile";
import { useAccounts } from "@/contexts/AccountContext";

interface UserMenuProps {
  mobile?: boolean;
  onNavigate?: () => void;
}

export default function UserMenu({ mobile, onNavigate }: UserMenuProps) {
  const supabase = createClient();
  const router = useRouter();
  const { user } = useUser();
  const { activeAccount } = useAccounts();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { data: profileData } = useProfile();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setIsDropdownOpen(false);
    onNavigate?.();
    router.push("/");
  };

  if (!user) return null;

  if (mobile) {
    return (
      <div className="space-y-2">
        <div className="px-4 py-3 bg-gray-700 rounded-lg">
          {profileData?.profile?.avatar_url && (
            <div className="flex items-center gap-3 mb-2">
              <Image
                src={profileData.profile.avatar_url}
                alt="Profile"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
              {profileData?.profile?.full_name && (
                <span className="text-sm font-medium text-white">
                  {profileData.profile.full_name}
                </span>
              )}
            </div>
          )}
          {!profileData?.profile?.avatar_url &&
            profileData?.profile?.full_name && (
              <p className="text-sm font-medium text-white mb-1">
                {profileData.profile.full_name}
              </p>
            )}
          <p className="text-xs text-gray-300">{user.email}</p>
        </div>
        <Link
          href="/settings/profile"
          onClick={onNavigate}
          className="block px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-center"
        >
          Profile Settings
        </Link>
        <Link
          href={`/${activeAccount?.slug}/settings/support`}
          onClick={onNavigate}
          className="block px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors text-center"
        >
          Support
        </Link>
        <button
          onClick={handleLogout}
          className="block w-full text-center px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          Logout
        </button>
      </div>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <div className="relative">
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500 hover:bg-red-600 transition-colors font-semibold text-white overflow-hidden"
          aria-label="User menu"
        >
          {profileData?.profile?.avatar_url ? (
            <Image
              src={profileData.profile.avatar_url}
              alt="Profile"
              width={40}
              height={40}
              className="object-cover w-full h-full"
            />
          ) : (
            profileData?.profile?.full_name?.[0]?.toUpperCase() ||
            user.email?.[0]?.toUpperCase() ||
            "U"
          )}
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg z-50">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
              {profileData?.profile?.full_name && (
                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                  {profileData.profile.full_name}
                </p>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {user.email}
              </p>
            </div>
            <Link
              href="/settings/profile"
              onClick={() => setIsDropdownOpen(false)}
              className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Profile Settings
            </Link>
            <Link
              href={`/${activeAccount?.slug}/settings/support`}
              onClick={() => setIsDropdownOpen(false)}
              className="block px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Support
            </Link>
            <button
              onClick={handleLogout}
              className="w-full text-left px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
