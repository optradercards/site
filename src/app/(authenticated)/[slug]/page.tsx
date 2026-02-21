"use client";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
    </div>
  );
}
