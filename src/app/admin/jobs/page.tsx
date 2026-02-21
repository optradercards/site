"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface ImportLog {
  id: string;
  account_id: string;
  platform: string;
  handle: string | null;
  status: "pending" | "running" | "completed" | "failed";
  stats: Record<string, number>;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
  created_at: string;
  depends_on: string[] | null;
  dag_id: string | null;
}

const PLATFORM_LABELS: Record<string, string> = {
  shiny: "Shiny",
  collectr: "Collectr",
  "shiny-brands": "Shiny Brands",
  "shiny-cards": "Shiny Cards",
  "shiny-collections": "Shiny Collections",
  "shiny-accounts": "Shiny Accounts",
  "shiny-history": "Shiny History",
};

const STATUS_STYLES: Record<string, string> = {
  pending:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  completed:
    "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  running:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
};

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

type DisplayItem =
  | { kind: "standalone"; log: ImportLog }
  | { kind: "pipeline"; dagId: string; logs: ImportLog[] };

function pipelineStatus(logs: ImportLog[]): string {
  const completed = logs.filter((l) => l.status === "completed").length;
  const failed = logs.some((l) => l.status === "failed");
  if (failed) return `${completed}/${logs.length} completed (failed)`;
  if (completed === logs.length) return `${logs.length}/${logs.length} completed`;
  const running = logs.some((l) => l.status === "running");
  if (running) return `${completed}/${logs.length} completed (running)`;
  return `${completed}/${logs.length} completed (pending)`;
}

function pipelineStatusStyle(logs: ImportLog[]): string {
  if (logs.some((l) => l.status === "failed")) return STATUS_STYLES.failed;
  if (logs.every((l) => l.status === "completed")) return STATUS_STYLES.completed;
  if (logs.some((l) => l.status === "running")) return STATUS_STYLES.running;
  return STATUS_STYLES.pending;
}

function JobRow({
  log,
  indent,
  expandedError,
  setExpandedError,
  onRetry,
  isRetrying,
}: {
  log: ImportLog;
  indent?: boolean;
  expandedError: string | null;
  setExpandedError: (id: string | null) => void;
  onRetry: (id: string) => void;
  isRetrying?: boolean;
}) {
  return (
    <tr className="border-b border-gray-100 dark:border-gray-700/50">
      <td className="px-4 py-3 whitespace-nowrap">
        {indent && <span className="inline-block w-4" />}
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
      </td>
      <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
        {log.handle || "—"}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[log.status] ?? ""}`}
        >
          {(log.status === "running" || log.status === "pending") && (
            <PulsingDot />
          )}
          {log.status}
        </span>
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
      <td className="px-4 py-3">
        {(log.status === "pending" || log.status === "failed") && (
          <button
            onClick={() => onRetry(log.id)}
            disabled={isRetrying}
            className="px-2 py-1 text-xs font-medium text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRetrying ? "Retrying…" : "Retry"}
          </button>
        )}
      </td>
    </tr>
  );
}

function PipelineGroup({
  dagId,
  logs,
  expandedError,
  setExpandedError,
  expandedPipelines,
  togglePipeline,
  onRetry,
  retrying,
}: {
  dagId: string;
  logs: ImportLog[];
  expandedError: string | null;
  setExpandedError: (id: string | null) => void;
  expandedPipelines: Set<string>;
  togglePipeline: (id: string) => void;
  onRetry: (id: string) => void;
  retrying: Set<string>;
}) {
  const expanded = expandedPipelines.has(dagId);
  const earliest = logs[logs.length - 1];

  return (
    <>
      <tr
        className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
        onClick={() => togglePipeline(dagId)}
      >
        <td className="px-4 py-3 whitespace-nowrap">
          <span className="inline-block w-4 text-gray-400 text-xs">
            {expanded ? "▼" : "▶"}
          </span>
          {new Date(earliest.created_at).toLocaleDateString()}{" "}
          <span className="text-gray-400 dark:text-gray-500">
            {new Date(earliest.created_at).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </td>
        <td className="px-4 py-3">
          <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            Pipeline ({logs.length} jobs)
          </span>
        </td>
        <td className="px-4 py-3 font-mono text-xs max-w-[200px] truncate">
          {earliest.handle || "—"}
        </td>
        <td className="px-4 py-3">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${pipelineStatusStyle(logs)}`}
          >
            {logs.some(
              (l) => l.status === "running" || l.status === "pending"
            ) && <PulsingDot />}
            {pipelineStatus(logs)}
          </span>
        </td>
        <td className="px-4 py-3 text-xs">—</td>
        <td className="px-4 py-3 whitespace-nowrap">—</td>
        <td className="px-4 py-3 text-xs">—</td>
        <td className="px-4 py-3" />
      </tr>
      {expanded &&
        logs.map((log) => (
          <JobRow
            key={log.id}
            log={log}
            indent
            expandedError={expandedError}
            setExpandedError={setExpandedError}
            onRetry={onRetry}
            isRetrying={retrying.has(log.id)}
          />
        ))}
    </>
  );
}

export default function AdminJobsPage() {
  const supabase = createClient();
  const [logs, setLogs] = useState<ImportLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedError, setExpandedError] = useState<string | null>(null);
  const [expandedPipelines, setExpandedPipelines] = useState<Set<string>>(
    new Set()
  );
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  const togglePipeline = useCallback((dagId: string) => {
    setExpandedPipelines((prev) => {
      const next = new Set(prev);
      if (next.has(dagId)) next.delete(dagId);
      else next.add(dagId);
      return next;
    });
  }, []);

  const retryJob = useCallback(async (jobId: string) => {
    setRetrying((prev) => new Set(prev).add(jobId));
    try {
      // Reset failed jobs so run-job can process them
      const job = logs.find((l) => l.id === jobId);
      if (job?.status === "failed") {
        await supabase
          .schema("jobs")
          .from("job_logs")
          .update({ status: "pending", error_message: null, completed_at: null })
          .eq("id", jobId);
      }

      const { error } = await supabase.functions.invoke("run-job", {
        body: { job_id: jobId },
      });
      if (error) throw error;
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
  }, [supabase, logs]);

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
    let triggered = 0;
    for (const job of pendingJobs) {
      try {
        await supabase.functions.invoke("run-job", {
          body: { job_id: job.id },
        });
        triggered++;
      } catch {
        // continue with remaining jobs
      }
    }
    setRetrying((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
    toast.info(`Triggered ${triggered} pending job(s)`);
  }, [supabase, logs]);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .schema("jobs")
      .from("job_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data ?? []) as ImportLog[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("admin-jobs")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "jobs", table: "job_logs" },
        (payload) => {
          const newLog = payload.new as ImportLog;
          setLogs((prev) => [newLog, ...prev].slice(0, 100));
          const label = PLATFORM_LABELS[newLog.platform] ?? newLog.platform;
          toast.info(`New job: ${label}${newLog.handle ? ` (${newLog.handle})` : ""}`);
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "jobs", table: "job_logs" },
        (payload) => {
          const updated = payload.new as ImportLog;
          setLogs((prev) =>
            prev.map((log) => (log.id === updated.id ? updated : log))
          );
          const label = PLATFORM_LABELS[updated.platform] ?? updated.platform;
          if (updated.status === "completed") {
            toast.success(`${label} completed${updated.handle ? ` (${updated.handle})` : ""}`);
          } else if (updated.status === "failed") {
            toast.error(`${label} failed${updated.handle ? ` (${updated.handle})` : ""}`);
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

  // Group logs into standalone jobs and pipeline groups
  const displayItems = useMemo(() => {
    const pipelineMap = new Map<string, ImportLog[]>();
    const standaloneList: ImportLog[] = [];

    // First pass: group jobs with a dag_id
    for (const log of logs) {
      if (log.dag_id) {
        const group = pipelineMap.get(log.dag_id);
        if (group) group.push(log);
        else pipelineMap.set(log.dag_id, [log]);
      } else {
        standaloneList.push(log);
      }
    }

    // Second pass: pull standalone jobs into a pipeline if their id is used as a dag_id
    const standalone = standaloneList.filter((log) => {
      const group = pipelineMap.get(log.id);
      if (group) {
        group.push(log);
        return false;
      }
      return true;
    });

    // Sort pipeline children by created_at ascending (execution order)
    for (const group of pipelineMap.values()) {
      group.sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
    }

    // Build display items, ordered by earliest created_at (desc)
    const items: DisplayItem[] = [
      ...standalone.map(
        (log) => ({ kind: "standalone" as const, log })
      ),
      ...[...pipelineMap.entries()].map(([dagId, pLogs]) => ({
        kind: "pipeline" as const,
        dagId,
        logs: pLogs,
      })),
    ];

    // Sort by most recent first
    items.sort((a, b) => {
      const aDate =
        a.kind === "standalone"
          ? a.log.created_at
          : a.logs[0].created_at;
      const bDate =
        b.kind === "standalone"
          ? b.log.created_at
          : b.logs[0].created_at;
      return new Date(bDate).getTime() - new Date(aDate).getTime();
    });

    return items;
  }, [logs]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Jobs
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live view of all import jobs across the platform.
          </p>
        </div>
        <div className="flex gap-2">
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
        ) : logs.length === 0 ? (
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
                {displayItems.map((item) =>
                  item.kind === "standalone" ? (
                    <JobRow
                      key={item.log.id}
                      log={item.log}
                      expandedError={expandedError}
                      setExpandedError={setExpandedError}
                      onRetry={retryJob}
                      isRetrying={retrying.has(item.log.id)}
                    />
                  ) : (
                    <PipelineGroup
                      key={item.dagId}
                      dagId={item.dagId}
                      logs={item.logs}
                      expandedError={expandedError}
                      setExpandedError={setExpandedError}
                      expandedPipelines={expandedPipelines}
                      togglePipeline={togglePipeline}
                      onRetry={retryJob}
                      retrying={retrying}
                    />
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
