"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ImportLog {
  id: string;
  account_id: string | null;
  platform: string;
  handle: string | null;
  status: "pending" | "running" | "waiting" | "completed" | "failed";
  stats: Record<string, number>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  depends_on: string[] | null;
  parent_id: string | null;
  attempts: number | null;
  scheduled_at: string | null;
}

function formatScheduledIn(iso: string | null): string | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "due";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `retry in ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  return `retry in ${minutes}m`;
}

const PLATFORM_LABELS: Record<string, string> = {
  shiny: "Shiny",
  collectr: "Collectr",
  "shiny-brands": "Shiny Brands",
  "shiny-cards": "Shiny Cards",
  "shiny-collections": "Shiny Collections",
  "shiny-accounts": "Shiny Accounts",
  "shiny-history": "Shiny History",
  "shiny-discover-catalog": "Catalog Discovery",
  "shiny-discover-brand": "Brand Discovery",
  "resync-images": "Image Resync",
  "daily-shiny-sync": "Daily Shiny Sync",
  "daily-snapshot": "Daily Snapshot",
};

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  running:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  waiting:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  // Parent rolled up to completed but at least one descendant
  // failed — see error_message ("N child job(s) failed") + stats
  // .failed_children. Rendered amber to distinguish from clean
  // completion without poisoning the dependency chain.
  completed_with_errors:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
};

function effectiveStatus(log: ImportLog): keyof typeof STATUS_STYLES {
  if (log.status === "completed" && log.error_message) return "completed_with_errors";
  return log.status;
}

function statusLabel(log: ImportLog): string {
  return effectiveStatus(log) === "completed_with_errors"
    ? "completed (errors)"
    : log.status;
}

function formatDuration(log: ImportLog): string {
  if (!log.completed_at) {
    if (log.status === "running") {
      const seconds = Math.round(
        (Date.now() - new Date(log.started_at).getTime()) / 1000
      );
      if (seconds < 60) return `${seconds}s…`;
      const m = Math.floor(seconds / 60);
      return `${m}m ${seconds % 60}s…`;
    }
    return "—";
  }
  const seconds = Math.round(
    (new Date(log.completed_at).getTime() -
      new Date(log.started_at).getTime()) /
      1000
  );
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${seconds % 60}s`;
}

function formatStats(log: ImportLog): string {
  const s = log.stats;
  if (!s || Object.keys(s).length === 0) return "—";
  return Object.entries(s)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${v} ${k.replace(/_/g, " ")}`)
    .join(", ");
}

function PulsingDot() {
  return (
    <span className="relative flex h-2 w-2 mr-1.5">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
    </span>
  );
}

// Roll up the parent's own status with its descendants into a single
// summary string + styling for the table row. Only used when the root
// actually has descendants — for standalone jobs we render the row's
// own status directly.
function rollupSummary(root: ImportLog, descendants: ImportLog[]) {
  const all = [root, ...descendants];
  const completed = all.filter((l) => l.status === "completed").length;
  const failed = all.some((l) => l.status === "failed");
  const running = all.some((l) => l.status === "running");
  const waiting = all.some((l) => l.status === "waiting");

  let label: string;
  let style: string;
  if (failed) {
    label = `${completed}/${all.length} completed (failed)`;
    style = STATUS_STYLES.failed;
  } else if (completed === all.length) {
    label = `${all.length}/${all.length} completed`;
    style = STATUS_STYLES.completed;
  } else if (running) {
    label = `${completed}/${all.length} completed (running)`;
    style = STATUS_STYLES.running;
  } else if (waiting) {
    label = `${completed}/${all.length} completed (waiting)`;
    style = STATUS_STYLES.waiting;
  } else {
    label = `${completed}/${all.length} completed (pending)`;
    style = STATUS_STYLES.pending;
  }
  const inFlight = running || waiting || all.some((l) => l.status === "pending");
  return { label, style, inFlight };
}

function JobRow({
  log,
  childCount,
  rollup,
  expandedError,
  setExpandedError,
  onRetry,
  isRetrying,
}: {
  log: ImportLog;
  childCount: number;
  rollup: ReturnType<typeof rollupSummary> | null;
  expandedError: string | null;
  setExpandedError: (id: string | null) => void;
  onRetry: (id: string) => void;
  isRetrying?: boolean;
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50">
      <td className="px-4 py-3 whitespace-nowrap">
        {new Date(log.created_at).toLocaleDateString()}{" "}
        <span className="text-gray-400 dark:text-gray-500">
          {new Date(log.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300">
          {PLATFORM_LABELS[log.platform] ?? log.platform}
        </span>
        {childCount > 0 && (
          <span
            className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            title={`${childCount} child job${childCount === 1 ? "" : "s"}`}
          >
            +{childCount}
          </span>
        )}
        {log.attempts != null && log.attempts > 0 && (
          <span
            className="ml-1.5 inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
            title={`Attempts: ${log.attempts}`}
          >
            ×{log.attempts + 1}
          </span>
        )}
      </td>
      <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
        {log.handle || "—"}
      </td>
      <td className="px-4 py-3">
        {rollup ? (
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${rollup.style}`}
          >
            {rollup.inFlight && <PulsingDot />}
            {rollup.label}
          </span>
        ) : (
          <>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[effectiveStatus(log)] ?? ""}`}
            >
              {(log.status === "running" ||
                log.status === "pending" ||
                log.status === "waiting") && <PulsingDot />}
              {statusLabel(log)}
            </span>
            {log.status === "pending" && log.scheduled_at && (
              <span className="ml-1.5 text-[10px] text-gray-500 dark:text-gray-400">
                {formatScheduledIn(log.scheduled_at)}
              </span>
            )}
          </>
        )}
      </td>
      <td className="px-4 py-3 text-xs">{formatStats(log)}</td>
      <td className="px-4 py-3 whitespace-nowrap">{formatDuration(log)}</td>
      <td className="px-4 py-3 text-xs max-w-[300px]">
        {log.status === "failed" && log.error_message ? (
          <button
            onClick={() =>
              setExpandedError(expandedError === log.id ? null : log.id)
            }
            className="text-left text-red-500 dark:text-red-400 hover:underline cursor-pointer"
          >
            {expandedError === log.id
              ? log.error_message
              : log.error_message.length > 60
                ? log.error_message.slice(0, 60) + "…"
                : log.error_message}
          </button>
        ) : (
          <span className="text-gray-400">—</span>
        )}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/jobs/${log.id}`}
            className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            View
          </Link>
          {(log.status === "pending" ||
            log.status === "failed" ||
            effectiveStatus(log) === "completed_with_errors") && (
            <button
              onClick={() => onRetry(log.id)}
              disabled={isRetrying}
              className="px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRetrying ? "Retrying…" : "Retry"}
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

export default function AdminJobsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  // Reset a list of failed job_logs rows back to pending so the
  // dispatcher / run-job can process them again. Bulk update + bulk
  // invoke for the all-failed case; the single-job path uses the same
  // helper with one id.
  const resetAndInvoke = useCallback(async (jobIds: string[]) => {
    if (jobIds.length === 0) return 0;
    // Bulk reset of any failed rows in the set (no-op for non-failed
    // ids since the WHERE clause filters by status).
    await supabase
      .schema("jobs")
      .from("job_logs")
      .update({
        status: "pending",
        error_message: null,
        completed_at: null,
        attempts: 0,
        scheduled_at: null,
      })
      .in("id", jobIds)
      .eq("status", "failed");

    let triggered = 0;
    await Promise.all(
      jobIds.map(async (id) => {
        try {
          await supabase.functions.invoke("run-job", { body: { job_id: id } });
          triggered++;
        } catch {
          // continue with remaining jobs
        }
      })
    );
    return triggered;
  }, [supabase]);

  const retryJob = useCallback(async (jobId: string) => {
    const job = logs.find((l) => l.id === jobId);
    setRetrying((prev) => new Set(prev).add(jobId));
    try {
      // For a parent in "completed (errors)" the parent's own work
      // is done — retrying it would re-run the worker and re-queue
      // children. Instead retry the failed direct children; the
      // rollup trigger will clear the parent's amber state once they
      // all succeed.
      if (
        job &&
        job.status === "completed" &&
        job.error_message &&
        (job.error_message.includes("child job(s) failed") ||
          (job.stats as Record<string, unknown> | null)?.failed_children)
      ) {
        // Walk the full subtree — the rollup bubbles amber state up
        // multiple levels, so a failed leaf can be several hops below.
        const { data: failedDescendants } = await supabase
          .schema("jobs")
          .rpc("failed_descendants", { p_root_ids: [jobId] });
        const ids = (failedDescendants ?? []).map((r: { id: string }) => r.id);
        if (ids.length === 0) {
          toast.info("No failed descendants to retry");
        } else {
          const triggered = await resetAndInvoke(ids);
          toast.info(`Retried ${triggered} failed job(s)`);
        }
        return;
      }

      await resetAndInvoke([jobId]);
      toast.info("Job triggered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry job");
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }, [supabase, logs, resetAndInvoke]);

  const retryAllPending = useCallback(async () => {
    const pendingJobs = logs.filter((l) => l.status === "pending");
    if (pendingJobs.length === 0) {
      toast.info("No pending jobs");
      return;
    }
    const ids = pendingJobs.map((j) => j.id);
    setRetrying((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
    const triggered = await resetAndInvoke(ids);
    setRetrying((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast.info(`Triggered ${triggered} pending job(s)`);
  }, [logs, resetAndInvoke]);

  const retryAllFailed = useCallback(async () => {
    // Two buckets: rows with status='failed' (themselves retried),
    // and rows in 'completed' with error_message indicating failed
    // children (their failed children get retried). Together these
    // cover every red/amber row visible on the page.
    const directFailures = logs.filter((l) => l.status === "failed");
    const parentsWithFailedChildren = logs.filter(
      (l) =>
        l.status === "completed" &&
        l.error_message &&
        (l.error_message.includes("child job(s) failed") ||
          (l.stats as Record<string, unknown> | null)?.failed_children)
    );

    if (directFailures.length === 0 && parentsWithFailedChildren.length === 0) {
      toast.info("No failed jobs");
      return;
    }

    const idsToInvoke = directFailures.map((j) => j.id);

    // Walk every amber root's subtree in one round-trip; the recursive
    // rollup means failed leaves can be several hops deeper than direct
    // children.
    if (parentsWithFailedChildren.length > 0) {
      const parentIds = parentsWithFailedChildren.map((p) => p.id);
      const { data: failedKids } = await supabase
        .schema("jobs")
        .rpc("failed_descendants", { p_root_ids: parentIds });
      for (const r of (failedKids ?? []) as Array<{ id: string }>) {
        idsToInvoke.push(r.id);
      }
    }

    if (idsToInvoke.length === 0) {
      toast.info("No failed rows to retry");
      return;
    }

    setRetrying((prev) => {
      const next = new Set(prev);
      idsToInvoke.forEach((id) => next.add(id));
      return next;
    });
    const triggered = await resetAndInvoke(idsToInvoke);
    setRetrying((prev) => {
      const next = new Set(prev);
      idsToInvoke.forEach((id) => next.delete(id));
      return next;
    });
    toast.info(`Retried ${triggered} failed job(s)`);
  }, [logs, supabase, resetAndInvoke]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .schema("jobs")
      .from("job_logs")
      .select("*")
      .is("parent_id", null)
      .order("created_at", { ascending: false })
      .limit(25);
    setLogs((data ?? []) as ImportLog[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Realtime subscription
  //
  // Scoped to rows created in the last 24h so we don't ride along on
  // every UPDATE to historical job_logs rows (backfills, daily sync
  // status flips, etc). The initial fetch via recent_jobs() already
  // pulls the current view of the page; realtime only needs to keep
  // recent activity fresh. Subscription is captured once on mount;
  // if it survives past midnight the cutoff is mildly stale, but the
  // page is short-lived so a refresh rebuilds it.
  useEffect(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const filter = `created_at=gte.${cutoff}`;
    const channel = supabase
      .channel("admin-jobs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "jobs", table: "job_logs", filter },
        (payload) => {
          const newLog = payload.new as ImportLog;
          if (newLog.parent_id != null) return;
          setLogs((prev) => [newLog, ...prev]);
          const label = PLATFORM_LABELS[newLog.platform] ?? newLog.platform;
          toast.info(`New job: ${label}${newLog.handle ? ` (${newLog.handle})` : ""}`);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "jobs", table: "job_logs", filter },
        (payload) => {
          const updated = payload.new as ImportLog;
          setLogs((prev) =>
            prev.map((log) => (log.id === updated.id ? updated : log))
          );
          // Only toast on top-level job completion/failure — child
          // status churn would otherwise drown the user.
          if (updated.parent_id == null) {
            const label = PLATFORM_LABELS[updated.platform] ?? updated.platform;
            if (updated.status === "completed") {
              toast.success(`${label} completed${updated.handle ? ` (${updated.handle})` : ""}`);
            } else if (updated.status === "failed") {
              toast.error(`${label} failed${updated.handle ? ` (${updated.handle})` : ""}`);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  // Tick running durations every second
  const [, setTick] = useState(0);
  useEffect(() => {
    const hasRunning = logs.some((l) => l.status === "running");
    if (!hasRunning) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [logs]);

  // Build the list of top-level rows.
  //
  // For each row, walk parent_id up as far as we can within the loaded
  // set. The highest ancestor we reach is that row's visible root. Rows
  // whose parent_id is NULL — or points outside the window — are roots
  // themselves. Everything else collapses under its root and only shows
  // up when you drill in.
  const rootRows = useMemo(() => {
    const logsById = new Map<string, ImportLog>();
    for (const log of logs) logsById.set(log.id, log);

    function findRoot(log: ImportLog): ImportLog {
      let current = log;
      const seen = new Set<string>();
      while (current.parent_id && logsById.has(current.parent_id)) {
        if (seen.has(current.id)) break; // cycle defense
        seen.add(current.id);
        current = logsById.get(current.parent_id)!;
      }
      return current;
    }

    const groups = new Map<
      string,
      { root: ImportLog; descendants: ImportLog[] }
    >();
    for (const log of logs) {
      const root = findRoot(log);
      let group = groups.get(root.id);
      if (!group) {
        group = { root, descendants: [] };
        groups.set(root.id, group);
      }
      if (log.id !== root.id) group.descendants.push(log);
    }

    return [...groups.values()]
      .map(({ root, descendants }) => ({
        root,
        descendants,
        rollup:
          descendants.length > 0 ? rollupSummary(root, descendants) : null,
      }))
      .sort(
        (a, b) =>
          new Date(b.root.created_at).getTime() -
          new Date(a.root.created_at).getTime()
      );
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Jobs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Top-level import jobs. Open a row to see its children.
          </p>
        </div>
        <div className="flex gap-2">
          {logs.some(
            (l) =>
              l.status === "failed" ||
              effectiveStatus(l) === "completed_with_errors"
          ) && (
            <button
              onClick={retryAllFailed}
              className="px-4 py-2 text-sm font-medium text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 transition-colors"
            >
              Retry All Failed
            </button>
          )}
          {logs.some((l) => l.status === "pending") && (
            <button
              onClick={retryAllPending}
              className="px-4 py-2 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
            >
              Retry All Pending
            </button>
          )}
          <button
            onClick={loadLogs}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            Loading...
          </p>
        ) : rootRows.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No jobs yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 whitespace-nowrap">Platform</th>
                  <th className="px-4 py-3 whitespace-nowrap">Handle</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 w-full">Stats</th>
                  <th className="px-4 py-3 whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 whitespace-nowrap">Error</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {rootRows.map(({ root, descendants, rollup }) => (
                  <JobRow
                    key={root.id}
                    log={root}
                    childCount={descendants.length}
                    rollup={rollup}
                    expandedError={expandedError}
                    setExpandedError={setExpandedError}
                    onRetry={retryJob}
                    isRetrying={retrying.has(root.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
