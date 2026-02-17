"use client";

import { useJobLogs, type JobLog } from "@/hooks/useJobLogs";

const PLATFORM_LABELS: Record<string, string> = {
  shiny: "Shiny",
  collectr: "Collectr",
  "shiny-brands": "Brands",
  "shiny-cards": "Cards",
  "shiny-collections": "Collections",
  "shiny-accounts": "Accounts",
};

function formatDuration(log: JobLog): string {
  if (!log.completed_at) return "—";
  const start = new Date(log.started_at).getTime();
  const end = new Date(log.completed_at).getTime();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

function formatStats(log: JobLog): string {
  const s = log.stats;
  if (!s || Object.keys(s).length === 0) return "—";

  if (log.platform === "collectr") {
    const parts: string[] = [];
    if (s.products_found != null) parts.push(`${s.products_found} found`);
    if (s.products_matched != null) parts.push(`${s.products_matched} matched`);
    if (s.products_imported != null) parts.push(`${s.products_imported} imported`);
    return parts.join(", ") || "—";
  }

  if (log.platform === "shiny") {
    const parts: string[] = [];
    if (s.collections_imported != null) parts.push(`${s.collections_imported} collections`);
    if (s.collection_items_imported != null) parts.push(`${s.collection_items_imported} items`);
    if (s.sold_items_imported != null) parts.push(`${s.sold_items_imported} sold`);
    return parts.join(", ") || "—";
  }

  if (log.platform === "shiny-brands") {
    const parts: string[] = [];
    if (s.brands_imported != null) parts.push(`${s.brands_imported} brands`);
    if (s.set_lists_imported != null) parts.push(`${s.set_lists_imported} set lists`);
    if (s.groups_imported != null) parts.push(`${s.groups_imported} groups`);
    if (s.sets_imported != null) parts.push(`${s.sets_imported} sets`);
    return parts.join(", ") || "—";
  }

  if (log.platform === "shiny-cards") {
    const parts: string[] = [];
    if (s.brands_imported != null) parts.push(`${s.brands_imported} brands`);
    if (s.sets_imported != null) parts.push(`${s.sets_imported} sets`);
    if (s.products_imported != null) parts.push(`${s.products_imported} products`);
    return parts.join(", ") || "—";
  }

  if (log.platform === "shiny-collections") {
    const parts: string[] = [];
    if (s.collections_imported != null) parts.push(`${s.collections_imported} collections`);
    if (s.collection_items_imported != null) parts.push(`${s.collection_items_imported} items`);
    if (s.sold_items_imported != null) parts.push(`${s.sold_items_imported} sold`);
    return parts.join(", ") || "—";
  }

  if (log.platform === "shiny-accounts") {
    const parts: string[] = [];
    if (s.accounts_imported != null) parts.push(`${s.accounts_imported} accounts`);
    return parts.join(", ") || "—";
  }

  // Fallback: show all keys
  return Object.entries(s)
    .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
    .join(", ");
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

export default function ImportHistoryPage() {
  const { data: logs, isLoading } = useJobLogs();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
          Import History
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          A log of all collection imports from your linked accounts.
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
        {isLoading ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading...</p>
        ) : !logs || logs.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No imports yet. Link an account and import your collection to see history here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="pb-2 pr-4">Date</th>
                  <th className="pb-2 pr-4">Platform</th>
                  <th className="pb-2 pr-4">Handle</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Stats</th>
                  <th className="pb-2">Duration</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className="border-b border-gray-100 dark:border-gray-700/50"
                  >
                    <td className="py-2 pr-4 whitespace-nowrap">
                      {new Date(log.started_at).toLocaleDateString()}{" "}
                      <span className="text-gray-400 dark:text-gray-500">
                        {new Date(log.started_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </td>
                    <td className="py-2 pr-4">
                      <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                        {PLATFORM_LABELS[log.platform] ?? log.platform}
                      </span>
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">
                      {log.handle}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[log.status] ?? ""}`}
                      >
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-xs">
                      {log.status === "failed" ? (
                        <span className="text-red-500 dark:text-red-400">
                          {log.error_message || "Unknown error"}
                        </span>
                      ) : (
                        formatStats(log)
                      )}
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {formatDuration(log)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
