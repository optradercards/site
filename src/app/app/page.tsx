"use client";

import Link from "next/link";
import { useUser } from "@/contexts/UserContext";

export default function DashboardPage() {
  const { user } = useUser();

  const displayName =
    user?.user_metadata?.display_name ||
    user?.user_metadata?.full_name ||
    user?.email ||
    "Collector";

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-2">
        Welcome back, {displayName}
      </h1>
      <p className="text-gray-600 dark:text-gray-400 mb-8">
        Your trading card collection dashboard
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Cards
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            —
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Unique Cards
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            —
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Estimated Value
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            —
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href="/settings"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            Settings
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Manage your account and preferences
          </p>
        </Link>
        <Link
          href="/collection"
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            My Collection
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            View and manage your card collection
          </p>
        </Link>
      </div>
    </div>
  );
}
