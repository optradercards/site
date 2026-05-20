"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

interface JobLog {
  id: string;
  account_id: string | null;
  platform: string;
  handle: string | null;
  status: "pending" | "running" | "waiting" | "completed" | "failed";
  payload: Record<string, unknown> | null;
  stats: Record<string, unknown> | null;
  error_message: string | null;
  depends_on: string[] | null;
  parent_id: string | null;
  attempts: number | null;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string | null;
}

interface JobEvent {
  id: number;
  job_id: string;
  kind: string;
  message: string | null;
  data: Record<string, unknown> | null;
  created_at: string;
}

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  running: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  waiting: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  completed_with_errors:
    "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

function effectiveChildStatus(log: JobLog): keyof typeof STATUS_STYLES {
  if (log.status === "completed" && log.error_message) return "completed_with_errors";
  return log.status;
}

const EVENT_KIND_STYLES: Record<string, string> = {
  started: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  completed: "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  error: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  rate_limited: "bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  warning: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
};

function eventKindStyle(kind: string): string {
  return (
    EVENT_KIND_STYLES[kind] ??
    (kind.startsWith("phase_")
      ? "bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
      : "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300")
  );
}

function formatRelative(eventTs: string, anchorMs: number): string {
  const ms = new Date(eventTs).getTime() - anchorMs;
  if (Math.abs(ms) < 1000) return `+${ms}ms`;
  const seconds = ms / 1000;
  if (Math.abs(seconds) < 60) return `+${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds - m * 60);
  return `+${m}m${s.toString().padStart(2, "0")}s`;
}

function formatDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s${endIso ? "" : "…"}`;
  const m = Math.floor(seconds / 60);
  return `${m}m ${seconds % 60}s${endIso ? "" : "…"}`;
}

function JsonBlock({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-gray-400 dark:text-gray-500">null</span>;
  }
  return (
    <pre className="text-xs font-mono bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700 rounded p-3 overflow-x-auto whitespace-pre-wrap break-words">
      {JSON.stringify(value, null, 2)}
    </pre>
  );
}

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = String(params.id);
  const supabase = createClient();

  const [job, setJob] = useState<JobLog | null>(null);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [children, setChildren] = useState<JobLog[]>([]);
  // Root -> immediate parent of this job. Excludes the job itself.
  const [ancestors, setAncestors] = useState<
    Array<Pick<JobLog, "id" | "platform" | "handle" | "parent_id">>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const loadEvents = useCallback(async () => {
    const { data, error } = await supabase
      .schema("jobs")
      .from("job_events")
      .select("*")
      .eq("job_id", jobId)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
    if (!error) setEvents((data ?? []) as JobEvent[]);
  }, [supabase, jobId]);

  const loadChildren = useCallback(async () => {
    const { data, error } = await supabase
      .schema("jobs")
      .from("job_logs")
      .select("*")
      .eq("parent_id", jobId)
      .order("created_at", { ascending: true });
    if (!error) setChildren((data ?? []) as JobLog[]);
  }, [supabase, jobId]);

  // Walk parent_id from this job up to the root, building the chain
  // root -> ... -> immediate parent. Bounded to 20 hops so a cyclic
  // parent_id (shouldn't happen, but) doesn't spin forever.
  const loadAncestors = useCallback(
    async (startParentId: string | null) => {
      const chain: Array<Pick<JobLog, "id" | "platform" | "handle" | "parent_id">> = [];
      let cursor: string | null = startParentId;
      for (let i = 0; cursor && i < 20; i++) {
        const { data, error } = await supabase
          .schema("jobs")
          .from("job_logs")
          .select("id, platform, handle, parent_id")
          .eq("id", cursor)
          .maybeSingle();
        if (error || !data) break;
        chain.unshift(data as typeof chain[number]);
        cursor = data.parent_id;
      }
      setAncestors(chain);
    },
    [supabase]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [, , jobResult] = await Promise.all([
        loadEvents(),
        loadChildren(),
        // Capture the job in the same await so we can chain ancestor
        // loading off its parent_id without a second round-trip.
        supabase
          .schema("jobs")
          .from("job_logs")
          .select("*")
          .eq("id", jobId)
          .single(),
      ]);
      if (cancelled) return;
      if (jobResult.error) {
        setLoadError(jobResult.error.message);
        setJob(null);
      } else {
        const fetched = jobResult.data as JobLog;
        setJob(fetched);
        await loadAncestors(fetched.parent_id);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, jobId, loadEvents, loadChildren, loadAncestors]);

  // Realtime: subscribe to this job's row and its events.
  useEffect(() => {
    const channel = supabase
      .channel(`job-detail-${jobId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "jobs",
          table: "job_logs",
          filter: `id=eq.${jobId}`,
        },
        (payload) => {
          setJob(payload.new as JobLog);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "jobs",
          table: "job_events",
          filter: `job_id=eq.${jobId}`,
        },
        (payload) => {
          const ev = payload.new as JobEvent;
          setEvents((prev) =>
            [...prev, ev].sort((a, b) => {
              const ta = new Date(a.created_at).getTime();
              const tb = new Date(b.created_at).getTime();
              return ta === tb ? a.id - b.id : ta - tb;
            })
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "jobs",
          table: "job_logs",
          filter: `parent_id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as JobLog;
          setChildren((prev) =>
            [...prev, row].sort(
              (a, b) =>
                new Date(a.created_at).getTime() -
                new Date(b.created_at).getTime()
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "jobs",
          table: "job_logs",
          filter: `parent_id=eq.${jobId}`,
        },
        (payload) => {
          const row = payload.new as JobLog;
          setChildren((prev) =>
            prev.map((c) => (c.id === row.id ? row : c))
          );
        }
      )
      .subscribe();
    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, jobId]);

  // Tick once a second so the "running for X" duration on the header
  // keeps moving without a full reload.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!job || (job.status !== "running" && job.status !== "pending")) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [job]);

  const retry = async () => {
    if (!job) return;
    setRetrying(true);
    try {
      if (job.status === "failed") {
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
          .eq("id", jobId);
      }
      const { error } = await supabase.functions.invoke("run-job", {
        body: { job_id: jobId },
      });
      if (error) throw error;
      toast.info("Job triggered");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to retry");
    } finally {
      setRetrying(false);
    }
  };

  const deleteTree = async () => {
    if (!job) return;
    const childCount = children.length;
    const message = childCount > 0
      ? `Delete this job and ${childCount} direct child${childCount === 1 ? "" : "ren"} (plus everything they spawned and all events)? This cannot be undone.`
      : "Delete this job and all of its events? This cannot be undone.";
    if (!window.confirm(message)) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase
        .schema("jobs")
        .rpc("admin_delete_tree", { p_job_id: jobId });
      if (error) throw error;
      toast.success(`Deleted ${data ?? 1} job${data === 1 ? "" : "s"}`);
      const parentId = job.parent_id;
      router.replace(parentId ? `/admin/jobs/${parentId}` : "/admin/jobs");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
      setDeleting(false);
    }
  };

  if (loading) {
    return <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>;
  }
  if (loadError || !job) {
    return (
      <div className="space-y-4">
        <Link href="/admin/jobs" className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
          ← All jobs
        </Link>
        <p className="text-sm text-red-600 dark:text-red-400">
          {loadError ?? "Job not found"}
        </p>
      </div>
    );
  }

  // Anchor for relative timestamps. Prefer started_at when present;
  // otherwise fall back to the row's created_at so events before
  // started_at don't show negative offsets.
  const anchorMs = new Date(job.started_at ?? job.created_at).getTime();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <Breadcrumb ancestors={ancestors} current={job} />
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
            {job.platform}
            {job.handle && (
              <span className="ml-2 text-base font-mono text-gray-500 dark:text-gray-400">
                {job.handle}
              </span>
            )}
          </h2>
          <p className="text-xs font-mono text-gray-500 dark:text-gray-400 mt-1">
            {job.id}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center px-3 py-1 rounded text-sm font-medium ${STATUS_STYLES[job.status] ?? ""}`}
          >
            {job.status}
          </span>
          {(job.status === "pending" || job.status === "failed") && (
            <button
              onClick={retry}
              disabled={retrying}
              className="px-3 py-1 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-50"
            >
              {retrying ? "Retrying…" : "Retry"}
            </button>
          )}
          <button
            onClick={deleteTree}
            disabled={deleting}
            className="px-3 py-1 text-sm font-medium text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>

      {/* Summary grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="Created" value={new Date(job.created_at).toLocaleString()} />
        <SummaryCard
          label="Started"
          value={job.started_at ? new Date(job.started_at).toLocaleString() : "—"}
        />
        <SummaryCard
          label="Completed"
          value={job.completed_at ? new Date(job.completed_at).toLocaleString() : "—"}
        />
        <SummaryCard label="Duration" value={formatDuration(job.started_at, job.completed_at)} />
        <SummaryCard label="Attempts" value={String((job.attempts ?? 0) + 1)} />
        <SummaryCard
          label="Scheduled"
          value={job.scheduled_at ? new Date(job.scheduled_at).toLocaleString() : "—"}
        />
        <SummaryCard
          label="Parent"
          value={job.parent_id ?? "—"}
          href={job.parent_id ? `/admin/jobs/${job.parent_id}` : null}
          mono
        />
      </div>

      {job.error_message && (
        <Section title="Last error">
          <pre className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded p-3 whitespace-pre-wrap break-words">
            {job.error_message}
          </pre>
        </Section>
      )}

      {children.length > 0 && (
        <Section title={`Children (${children.length})`}>
          <div className="overflow-x-auto border border-gray-200 dark:border-gray-700 rounded">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
                  <th className="px-3 py-2 whitespace-nowrap">Platform</th>
                  <th className="px-3 py-2 whitespace-nowrap">Handle</th>
                  <th className="px-3 py-2 whitespace-nowrap">Status</th>
                  <th className="px-3 py-2 whitespace-nowrap">Duration</th>
                  <th className="px-3 py-2 whitespace-nowrap">Created</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {children.map((c) => {
                  const eff = effectiveChildStatus(c);
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 dark:border-gray-700/50 last:border-b-0"
                    >
                      <td className="px-3 py-2 whitespace-nowrap text-xs font-medium">
                        {c.platform}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs max-w-[240px] truncate">
                        {c.handle || "—"}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[eff] ?? ""}`}
                        >
                          {eff === "completed_with_errors"
                            ? "completed (errors)"
                            : c.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs">
                        {formatDuration(c.started_at, c.completed_at)}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                        {new Date(c.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <Link
                          href={`/admin/jobs/${c.id}`}
                          className="px-2 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-700/40 border border-gray-200 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      <Section title={`Events (${events.length})`}>
        {events.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No events recorded for this job.{" "}
            {job.status === "running" || job.status === "pending"
              ? "Events appear here as the worker emits them."
              : "Worker may predate the job_events table."}
          </p>
        ) : (
          <ol className="space-y-2">
            {events.map((ev) => (
              <li
                key={ev.id}
                className="border border-gray-200 dark:border-gray-700 rounded p-3 bg-white dark:bg-gray-800/40"
              >
                <div className="flex items-center justify-between gap-4 mb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400 tabular-nums">
                      {formatRelative(ev.created_at, anchorMs)}
                    </span>
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${eventKindStyle(ev.kind)}`}
                    >
                      {ev.kind}
                    </span>
                    {ev.message && (
                      <span className="text-sm text-gray-700 dark:text-gray-200">
                        {ev.message}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                    {new Date(ev.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {ev.data && Object.keys(ev.data).length > 0 && (
                  <JsonBlock value={ev.data} />
                )}
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section title="Stats">
        <JsonBlock value={job.stats ?? {}} />
      </Section>

      <Section title="Payload">
        <JsonBlock value={job.payload ?? {}} />
      </Section>

      {job.depends_on && job.depends_on.length > 0 && (
        <Section title="Depends on">
          <ul className="space-y-1">
            {job.depends_on.map((dep) => (
              <li key={dep}>
                <Link
                  href={`/admin/jobs/${dep}`}
                  className="text-xs font-mono text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {dep}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  href = null,
  mono = false,
}: {
  label: string;
  value: string;
  href?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800/40 border border-gray-200 dark:border-gray-700 rounded p-3">
      <div className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </div>
      <div
        className={`mt-1 text-sm text-gray-900 dark:text-white ${mono ? "font-mono break-all" : ""}`}
      >
        {href ? (
          <Link
            href={href}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {value}
          </Link>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Breadcrumb({
  ancestors,
  current,
}: {
  ancestors: Array<Pick<JobLog, "id" | "platform" | "handle" | "parent_id">>;
  current: Pick<JobLog, "platform" | "handle">;
}) {
  const sepClass =
    "text-gray-400 dark:text-gray-500 select-none";
  const linkClass =
    "text-blue-600 dark:text-blue-400 hover:underline truncate max-w-[180px] inline-block align-middle";
  const currentClass =
    "text-gray-700 dark:text-gray-200 font-medium truncate max-w-[180px] inline-block align-middle";

  return (
    <nav
      aria-label="Breadcrumb"
      className="text-sm flex items-center gap-1.5 flex-wrap"
    >
      <Link href="/admin/jobs" className="text-blue-600 dark:text-blue-400 hover:underline">
        All jobs
      </Link>
      {ancestors.map((a) => (
        <span key={a.id} className="flex items-center gap-1.5">
          <span className={sepClass}>/</span>
          <Link href={`/admin/jobs/${a.id}`} className={linkClass} title={a.handle ?? a.platform}>
            {a.platform}
            {a.handle && (
              <span className="ml-1 text-xs font-mono text-gray-500 dark:text-gray-400">
                {a.handle}
              </span>
            )}
          </Link>
        </span>
      ))}
      <span className={sepClass}>/</span>
      <span className={currentClass} title={current.handle ?? current.platform}>
        {current.platform}
        {current.handle && (
          <span className="ml-1 text-xs font-mono text-gray-500 dark:text-gray-400">
            {current.handle}
          </span>
        )}
      </span>
    </nav>
  );
}
