"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

// Live container health from sync.metrics (scraped from each container's
// Prometheus /metrics by the metrics-sync container). Shows per-container cards
// with role-appropriate metrics, a reset-aware throughput rate (the counters are
// in-memory and reset on redeploy, so we sum only positive step-deltas), memory,
// and a freshness dot (scrape interval is ~30s).

interface MetricRow {
  container: string;
  captured_at: string;
  metrics: Record<string, number | string>;
}

type Kind = "rate" | "total" | "gauge" | "age";
interface Field {
  label: string;
  base: string; // metric name without the {labels} suffix
  kind: Kind;
  unit?: string;
}

// Which metrics to surface per container role.
const CRAWLER_FIELDS: Field[] = [
  { label: "products/min", base: "crawler_products_imported_total", kind: "rate" },
  { label: "history/min", base: "crawler_history_rows_total", kind: "rate" },
  { label: "circuit", base: "crawler_circuit_open", kind: "gauge" },
  { label: "410 retries", base: "shiny_gone_retries_total", kind: "gauge" },
  { label: "429s", base: "shiny_rate_limit_hits_total", kind: "gauge" },
];
const FIELDS: Record<string, Field[]> = {
  loader: [
    { label: "rows/min", base: "loader_rows_inserted_total", kind: "rate" },
    { label: "rows total", base: "loader_rows_inserted_total", kind: "total" },
    { label: "files", base: "loader_files_loaded_total", kind: "total" },
    { label: "pending", base: "loader_pending_files", kind: "gauge" },
    { label: "quarantined", base: "loader_files_quarantined_total", kind: "gauge" },
  ],
  "image-fetch": [
    { label: "img/min", base: "image_fetch_uploaded_total", kind: "rate" },
    { label: "uploaded", base: "image_fetch_uploaded_total", kind: "total" },
    { label: "pending", base: "image_fetch_pending_files", kind: "gauge" },
    { label: "failed", base: "image_fetch_failed_total", kind: "gauge" },
    { label: "quarantined", base: "image_fetch_files_quarantined_total", kind: "gauge" },
  ],
  "exchange-rates": [
    { label: "rates", base: "exchange_rates_upserted", kind: "gauge" },
    { label: "last ok", base: "exchange_rates_last_success_unixtime", kind: "age" },
  ],
  "price-fetch": [
    { label: "files", base: "price_fetch_files_written_total", kind: "total" },
    { label: "errors", base: "price_fetch_errors_total", kind: "gauge" },
    { label: "last ok", base: "price_fetch_last_success_unixtime", kind: "age" },
  ],
  "price-load": [{ label: "up", base: "price_load_up", kind: "gauge" }],
};
const CONTAINER_ORDER = [
  "pokemon",
  "mtg",
  "onepiece",
  "rest",
  "metadata",
  "loader",
  "image-fetch",
  "exchange-rates",
  "price-fetch",
  "price-load",
];
const fieldsFor = (c: string): Field[] => FIELDS[c] ?? CRAWLER_FIELDS;

const CHIP: Record<string, string> = {
  pokemon: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  mtg: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  onepiece: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  rest: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  metadata: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  loader: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "image-fetch": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "exchange-rates": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "price-fetch": "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  "price-load": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
};

// Read a metric by base name, ignoring the {labels} suffix the exporter adds.
function mv(metrics: Record<string, number | string> | undefined, base: string): number | undefined {
  if (!metrics) return undefined;
  if (base in metrics) return Number(metrics[base]);
  const key = Object.keys(metrics).find((k) => k.startsWith(base + "{"));
  return key === undefined ? undefined : Number(metrics[key]);
}

// Reset-aware per-minute rate: sum only positive step-deltas (a drop = a counter
// reset on redeploy, which we skip) over the spanned time.
function ratePerMin(snaps: MetricRow[], base: string): number | null {
  let sum = 0;
  let spanMs = 0;
  for (let i = 1; i < snaps.length; i++) {
    const prev = mv(snaps[i - 1].metrics, base);
    const cur = mv(snaps[i].metrics, base);
    spanMs += new Date(snaps[i].captured_at).getTime() - new Date(snaps[i - 1].captured_at).getTime();
    if (prev === undefined || cur === undefined) continue;
    const d = cur - prev;
    if (d > 0) sum += d;
  }
  if (spanMs <= 0) return null;
  return (sum / spanMs) * 60_000;
}

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}
function fmtAge(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

export default function ContainerHealth() {
  const supabase = createClient();
  const [rows, setRows] = useState<MetricRow[]>([]);
  const [now, setNow] = useState(0); // wall clock captured at fetch time (avoids Date.now() in render)
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const nowMs = Date.now();
    const since = new Date(nowMs - 20 * 60_000).toISOString();
    const { data, error } = await supabase
      .schema("sync")
      .from("metrics")
      .select("container, captured_at, metrics")
      .gte("captured_at", since)
      .order("captured_at", { ascending: true });
    if (error) setErr(error.message);
    else {
      setErr(null);
      setRows((data ?? []) as MetricRow[]);
    }
    setNow(nowMs);
    setLoaded(true);
  }, [supabase]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15_000);
    return () => clearInterval(t);
  }, [load]);

  // Group snapshots by container (already time-ascending).
  const byContainer = new Map<string, MetricRow[]>();
  for (const r of rows) {
    const arr = byContainer.get(r.container) ?? [];
    arr.push(r);
    byContainer.set(r.container, arr);
  }
  const names = CONTAINER_ORDER.filter((c) => byContainer.has(c)).concat(
    [...byContainer.keys()].filter((c) => !CONTAINER_ORDER.includes(c))
  );

  if (err) return null; // sync.metrics not exposed / empty — stay quiet, the runs table still shows

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">
        Container health
      </div>
      {!loaded ? (
        <p className="text-sm text-gray-400">Loading…</p>
      ) : names.length === 0 ? (
        <p className="text-sm text-gray-400">No container metrics yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {names.map((c) => {
            const snaps = byContainer.get(c)!;
            const latest = snaps[snaps.length - 1];
            const ageMs = now - new Date(latest.captured_at).getTime();
            // Scrape cadence ~30s; fresh < 75s, stale < 5m, else down.
            const dot = ageMs < 75_000 ? "bg-green-500" : ageMs < 300_000 ? "bg-amber-500" : "bg-red-500";
            const memMb = mv(latest.metrics, "process_resident_memory_bytes");

            return (
              <div
                key={c}
                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium font-mono ${CHIP[c] ?? "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300"}`}
                  >
                    {c}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-400">
                    <span className={`h-2 w-2 rounded-full ${dot}`} />
                    {fmtAge(ageMs)}
                  </span>
                </div>
                <dl className="space-y-1">
                  {fieldsFor(c).map((f) => {
                    let display: string;
                    let warn = false;
                    if (f.kind === "rate") {
                      const r = ratePerMin(snaps, f.base);
                      display = r === null ? "—" : `${fmt(r)}/min`;
                    } else if (f.kind === "age") {
                      const v = mv(latest.metrics, f.base);
                      display = v ? `${fmtAge(now - v * 1000)} ago` : "never";
                    } else {
                      const v = mv(latest.metrics, f.base);
                      display = v === undefined ? "—" : fmt(v);
                      // Flag non-zero problem gauges.
                      warn =
                        v !== undefined &&
                        v > 0 &&
                        /quarantined|failed|circuit|429|410/.test(f.label);
                    }
                    return (
                      <div key={f.label} className="flex items-center justify-between text-xs">
                        <dt className="text-gray-500 dark:text-gray-400">{f.label}</dt>
                        <dd
                          className={`font-mono font-medium ${warn ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}
                        >
                          {display}
                        </dd>
                      </div>
                    );
                  })}
                  {memMb !== undefined && (
                    <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-100 dark:border-gray-700/50">
                      <dt className="text-gray-500 dark:text-gray-400">memory</dt>
                      <dd className="font-mono text-gray-700 dark:text-gray-300">
                        {fmt(memMb / 1024 / 1024)} MB
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
