"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";

interface CronRow {
  jobid: number;
  jobname: string | null;
  schedule: string;
  command: string;
  active: boolean;
  database: string;
  username: string;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
  last_return_message: string | null;
}

const STATUS_STYLES: Record<string, string> = {
  succeeded:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  running:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  if (ms < 1000) return `${ms}ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${Math.round(seconds % 60)}s`;
}

export default function AdminCronsPage() {
  const supabase = createClient();
  const [crons, setCrons] = useState<CronRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase.rpc("list_crons");
    if (err) setError(err.message);
    setCrons((data ?? []) as CronRow[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Crons
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            pg_cron schedules and the result of each job&apos;s most recent fire.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Loading…
          </p>
        ) : crons.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No cron jobs scheduled.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 whitespace-nowrap">Name</th>
                  <th className="px-4 py-3 whitespace-nowrap">Schedule</th>
                  <th className="px-4 py-3">Command</th>
                  <th className="px-4 py-3 whitespace-nowrap">Last run</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 whitespace-nowrap">Active</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {crons.map((c) => {
                  const isOpen = expanded === c.jobid;
                  const trimmedCommand = c.command.trim().replace(/\s+/g, " ");
                  return (
                    <>
                      <tr
                        key={c.jobid}
                        className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        onClick={() =>
                          setExpanded(isOpen ? null : c.jobid)
                        }
                      >
                        <td className="px-4 py-3 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                          {c.jobname ?? `job ${c.jobid}`}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                          {c.schedule}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs max-w-[480px] truncate">
                          {trimmedCommand}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {c.last_run_at
                            ? new Date(c.last_run_at).toLocaleString()
                            : "never"}
                        </td>
                        <td className="px-4 py-3">
                          {c.last_status ? (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[c.last_status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
                            >
                              {c.last_status}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {formatDuration(c.last_duration_ms)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {c.active ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              yes
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
                              paused
                            </span>
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700/50">
                          <td colSpan={7} className="px-4 py-3 space-y-2">
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                Command
                              </div>
                              <pre className="text-xs font-mono whitespace-pre-wrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2">
                                {c.command.trim()}
                              </pre>
                            </div>
                            {c.last_return_message && (
                              <div>
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                  Last return message
                                </div>
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 max-h-64 overflow-y-auto">
                                  {c.last_return_message}
                                </pre>
                              </div>
                            )}
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              database <span className="font-mono">{c.database}</span>{" "}
                              · user <span className="font-mono">{c.username}</span>{" "}
                              · jobid <span className="font-mono">{c.jobid}</span>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
