"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Reads the shiny-sync container's run log (sync.runs / sync.run_events).
// The container writes these; admins have RLS select. Requires "sync" in the
// project's Exposed Schemas (Settings → API) for the PostgREST call to resolve.

interface SyncRun {
  id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "completed" | "interrupted" | "failed";
  phase: string | null;
  checkpoint: Record<string, unknown> | null;
  stats: Record<string, unknown> | null;
  error: string | null;
  machine_id: string | null;
  updated_at: string;
}

interface RunEvent {
  id: number;
  ts: string;
  phase: string | null;
  kind: string;
  message: string | null;
  data: Record<string, unknown> | null;
}

const STATUS_STYLES: Record<string, string> = {
  running: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  interrupted: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const EVENT_KIND_STYLES: Record<string, string> = {
  error: "text-red-600 dark:text-red-400",
  rate_limited: "text-amber-600 dark:text-amber-400",
  completed: "text-green-600 dark:text-green-400",
  interrupted: "text-orange-600 dark:text-orange-400",
};

// Stats keys in a friendly order; unknown keys are appended after these.
const STAT_ORDER = [
  "brands_imported",
  "set_lists_imported",
  "groups_imported",
  "sets_imported",
  "products_imported",
  "product_fetch_failures",
  "history_synced",
  "history_skipped_unchanged",
  "purchases_synced",
  "history_errors",
  "images_processed",
  "images_fetched",
  "images_reused",
  "images_failed",
  "catalog_images_fetched",
  "catalog_images_reused",
  "errors_total",
];

const HEARTBEAT_STALE_MS = 60_000; // matches LEASE_STALE_MS in the container

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(0, Math.round(ms))}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${Math.round(s % 60)}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

function runDuration(r: SyncRun): string {
  const start = new Date(r.started_at).getTime();
  const end = r.finished_at ? new Date(r.finished_at).getTime() : Date.now();
  return fmtDuration(end - start);
}

function fmtNum(v: unknown): string {
  return typeof v === "number" ? v.toLocaleString() : String(v);
}

function orderedStats(stats: Record<string, unknown> | null): Array<[string, unknown]> {
  if (!stats) return [];
  const keys = Object.keys(stats).filter((k) => k !== "error_samples");
  keys.sort((a, b) => {
    const ia = STAT_ORDER.indexOf(a);
    const ib = STAT_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });
  return keys.map((k) => [k, stats[k]]);
}

export default function AdminSyncPage() {
  const supabase = createClient();
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [events, setEvents] = useState<Record<string, RunEvent[]>>({});
  const [eventsLoading, setEventsLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const expandedRef = useRef<string | null>(null);
  expandedRef.current = expanded;

  const loadEvents = useCallback(
    async (runId: string) => {
      setEventsLoading(true);
      const { data, error: err } = await supabase
        .schema("sync")
        .from("run_events")
        .select("id, ts, phase, kind, message, data")
        .eq("run_id", runId)
        .order("ts", { ascending: false })
        .limit(200);
      if (!err) setEvents((prev) => ({ ...prev, [runId]: (data ?? []) as RunEvent[] }));
      setEventsLoading(false);
    },
    [supabase]
  );

  const load = useCallback(async () => {
    setError(null);
    const { data, error: err } = await supabase
      .schema("sync")
      .from("runs")
      .select(
        "id, started_at, finished_at, status, phase, checkpoint, stats, error, machine_id, updated_at"
      )
      .order("started_at", { ascending: false })
      .limit(25);
    if (err) setError(err.message);
    setRuns((data ?? []) as SyncRun[]);
    setLoading(false);
    const open = expandedRef.current;
    if (open) await loadEvents(open);
  }, [supabase, loadEvents]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(load, 10_000);
    return () => clearInterval(t);
  }, [autoRefresh, load]);

  const toggle = (runId: string) => {
    if (expanded === runId) {
      setExpanded(null);
    } else {
      setExpanded(runId);
      if (!events[runId]) loadEvents(runId);
    }
  };

  const latest = runs[0];
  const heartbeatAge = latest ? Date.now() - new Date(latest.updated_at).getTime() : 0;
  const latestStale = latest?.status === "running" && heartbeatAge > HEARTBEAT_STALE_MS;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Sync</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            The shiny-sync container&apos;s catalog crawl runs (
            <span className="font-mono text-xs">sync.runs</span>).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-gray-300 dark:border-gray-600"
            />
            Auto-refresh (10s)
          </label>
          <button
            onClick={load}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 text-sm text-red-700 dark:text-red-400">
          {error}
          {/PGRST|schema|not exist|find the table/i.test(error) && (
            <p className="mt-1 text-xs">
              If this is a schema error, add <span className="font-mono">sync</span> to the
              project&apos;s Exposed Schemas (Settings → API).
            </p>
          )}
        </div>
      )}

      {/* Live status banner */}
      {latest && (
        <div
          className={`rounded-lg border p-4 ${
            latestStale
              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
              : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700"
          }`}
        >
          <div className="flex items-center gap-3 flex-wrap text-sm">
            <span className="text-gray-500 dark:text-gray-400">Latest run</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[latest.status] ?? ""}`}
            >
              {latest.status}
            </span>
            {latest.phase && (
              <span className="text-gray-700 dark:text-gray-300">
                phase <span className="font-mono">{latest.phase}</span>
              </span>
            )}
            <span className="text-gray-500 dark:text-gray-400">
              {runDuration(latest)} elapsed
            </span>
            {latest.status === "running" && (
              <span className={latestStale ? "text-red-600 dark:text-red-400 font-medium" : "text-gray-500 dark:text-gray-400"}>
                heartbeat {fmtDuration(heartbeatAge)} ago
                {latestStale ? " — stale, machine may be dead" : ""}
              </span>
            )}
            {latest.machine_id && (
              <span className="text-xs text-gray-400 dark:text-gray-500 font-mono ml-auto">
                {latest.machine_id}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
        {loading ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        ) : runs.length === 0 ? (
          <p className="p-6 text-sm text-gray-500 dark:text-gray-400">
            No sync runs yet. If the container is deployed and its secrets are set, the
            first run will appear here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 whitespace-nowrap">Started</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Phase</th>
                  <th className="px-4 py-3 whitespace-nowrap">Duration</th>
                  <th className="px-4 py-3 whitespace-nowrap">Products</th>
                  <th className="px-4 py-3 whitespace-nowrap">History</th>
                  <th className="px-4 py-3 whitespace-nowrap">Errors</th>
                </tr>
              </thead>
              <tbody className="text-gray-700 dark:text-gray-300">
                {runs.map((r) => {
                  const isOpen = expanded === r.id;
                  const s = r.stats ?? {};
                  const errCount = (s.errors_total as number) ?? 0;
                  return (
                    <Fragment key={r.id}>
                      <tr
                        className="border-b border-gray-100 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30"
                        onClick={() => toggle(r.id)}
                      >
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-500 dark:text-gray-400">
                          {new Date(r.started_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap font-mono text-xs">
                          {r.phase ?? "—"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">{runDuration(r)}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {fmtNum(s.products_imported ?? 0)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {fmtNum(s.history_synced ?? 0)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs">
                          {errCount > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-medium">
                              {fmtNum(errCount)}
                            </span>
                          ) : (
                            "0"
                          )}
                        </td>
                      </tr>
                      {isOpen && (
                        <tr className="bg-gray-50 dark:bg-gray-900/40 border-b border-gray-100 dark:border-gray-700/50">
                          <td colSpan={7} className="px-4 py-4 space-y-4">
                            {r.error && (
                              <div>
                                <div className="text-xs font-semibold text-red-500 uppercase mb-1">
                                  Run error
                                </div>
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-white dark:bg-gray-800 border border-red-200 dark:border-red-800 rounded p-2">
                                  {r.error}
                                </pre>
                              </div>
                            )}

                            {/* Stats grid */}
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
                                Stats
                              </div>
                              {orderedStats(r.stats).length === 0 ? (
                                <p className="text-xs text-gray-400">no stats yet</p>
                              ) : (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                                  {orderedStats(r.stats).map(([k, v]) => (
                                    <div
                                      key={k}
                                      className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded px-3 py-2"
                                    >
                                      <div className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                                        {k}
                                      </div>
                                      <div className="text-sm font-semibold text-gray-900 dark:text-white">
                                        {fmtNum(v)}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* error samples */}
                            {Array.isArray(r.stats?.error_samples) &&
                              (r.stats!.error_samples as unknown[]).length > 0 && (
                                <div>
                                  <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                    Error samples
                                  </div>
                                  <pre className="text-xs font-mono whitespace-pre-wrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 max-h-48 overflow-y-auto">
                                    {JSON.stringify(r.stats!.error_samples, null, 2)}
                                  </pre>
                                </div>
                              )}

                            {/* checkpoint */}
                            {r.checkpoint && Object.keys(r.checkpoint).length > 0 && (
                              <div>
                                <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                  Checkpoint
                                </div>
                                <pre className="text-xs font-mono whitespace-pre-wrap bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-2 max-h-48 overflow-y-auto">
                                  {JSON.stringify(r.checkpoint, null, 2)}
                                </pre>
                              </div>
                            )}

                            {/* events timeline */}
                            <div>
                              <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                                Events {eventsLoading && expanded === r.id ? "(loading…)" : ""}
                              </div>
                              {(events[r.id] ?? []).length === 0 ? (
                                <p className="text-xs text-gray-400">no events</p>
                              ) : (
                                <div className="max-h-72 overflow-y-auto rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                                  <table className="w-full text-xs">
                                    <tbody>
                                      {(events[r.id] ?? []).map((e) => (
                                        <tr
                                          key={e.id}
                                          className="border-b border-gray-100 dark:border-gray-700/50 last:border-0"
                                        >
                                          <td className="px-2 py-1 whitespace-nowrap text-gray-400 font-mono">
                                            {new Date(e.ts).toLocaleTimeString()}
                                          </td>
                                          <td className="px-2 py-1 whitespace-nowrap font-mono text-gray-500 dark:text-gray-400">
                                            {e.phase ?? "—"}
                                          </td>
                                          <td
                                            className={`px-2 py-1 whitespace-nowrap font-medium ${EVENT_KIND_STYLES[e.kind] ?? "text-gray-600 dark:text-gray-300"}`}
                                          >
                                            {e.kind}
                                          </td>
                                          <td className="px-2 py-1 text-gray-700 dark:text-gray-300">
                                            {e.message}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
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
