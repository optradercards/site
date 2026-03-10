"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

export default function ManageOverviewPage() {
  const params = useParams();
  const slug = params?.slug as string;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Total Listings
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            —
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Active Listings
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            —
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">
            Revenue
          </h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-1">
            —
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Link
          href={`/${slug}/manage/unlisted`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            Add Listings
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            List items from your collection for sale
          </p>
        </Link>
        <Link
          href={`/${slug}`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 hover:shadow-lg transition-shadow"
        >
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100 mb-2">
            View Public Store
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            See what buyers see when they visit your store
          </p>
        </Link>
      </div>
    </div>
  );
}
