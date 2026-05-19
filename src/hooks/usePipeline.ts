import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";
import type { JobStatus } from "./useJob";

export interface PipelineStep {
  platform: string;
  handle: string;
  payload: Record<string, unknown>;
  dependsOn?: number[]; // indices into the steps array
}

export interface PipelineJob {
  id: string;
  platform: string;
  status: JobStatus;
  stats: Record<string, number>;
  error_message: string | null;
}

export type PipelineStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed";

export function usePipeline() {
  const supabase = createClient();
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const rootIdRef = useRef<string | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [supabase]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const createPipeline = useCallback(
    async (accountId: string, steps: PipelineStep[]) => {
      cleanup();

      // Insert steps in order, collecting IDs to resolve dependsOn indices.
      // The first inserted job becomes the pipeline root; every subsequent
      // job hangs off it via parent_id so the whole batch is reachable
      // from one realtime filter and from a single tree walk.
      const createdIds: string[] = [];
      let rootId: string | null = null;

      for (const step of steps) {
        const dependsOn = (step.dependsOn ?? []).map((idx) => {
          if (idx < 0 || idx >= createdIds.length) {
            throw new Error(
              `Invalid dependsOn index ${idx} — only ${createdIds.length} jobs created so far`
            );
          }
          return createdIds[idx];
        });

        const insertRow: {
          account_id: string;
          platform: string;
          handle: string;
          status: "pending";
          payload: Record<string, unknown>;
          depends_on: string[];
          parent_id?: string;
        } = {
          account_id: accountId,
          platform: step.platform,
          handle: step.handle,
          status: "pending",
          payload: step.payload,
          depends_on: dependsOn,
        };
        if (rootId) insertRow.parent_id = rootId;

        const { data: row, error } = await supabase
          .schema("jobs").from("job_logs")
          .insert(insertRow)
          .select("id, platform, status, stats, error_message")
          .single();

        if (error) throw error;

        createdIds.push(row.id);
        if (rootId === null) rootId = row.id;
      }

      rootIdRef.current = rootId;

      // Set initial jobs state
      const initial: PipelineJob[] = createdIds.map((id, i) => ({
        id,
        platform: steps[i].platform,
        status: "pending" as JobStatus,
        stats: {},
        error_message: null,
      }));
      setJobs(initial);

      // Subscribe to realtime updates for every job in this pipeline.
      // Postgres-changes filters only support a single column comparison,
      // so we register two listeners: one for the root row (id=eq.rootId)
      // and one for its children (parent_id=eq.rootId).
      const applyUpdate = (payload: { new: Record<string, unknown> }) => {
        const updated = payload.new;
        setJobs((prev) =>
          prev.map((j) =>
            j.id === updated.id
              ? {
                  ...j,
                  status: updated.status as JobStatus,
                  stats: (updated.stats as Record<string, number>) ?? {},
                  error_message: (updated.error_message as string) ?? null,
                }
              : j
          )
        );
      };

      const channel = supabase
        .channel(`pipeline-${rootId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "jobs",
            table: "job_logs",
            filter: `id=eq.${rootId}`,
          },
          applyUpdate
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "jobs",
            table: "job_logs",
            filter: `parent_id=eq.${rootId}`,
          },
          applyUpdate
        )
        .subscribe();

      channelRef.current = channel;

      return { rootId: rootId!, jobIds: createdIds };
    },
    [supabase, cleanup]
  );

  // Derive overall pipeline status
  const status: PipelineStatus =
    jobs.length === 0
      ? "idle"
      : jobs.some((j) => j.status === "failed")
        ? "failed"
        : jobs.every((j) => j.status === "completed")
          ? "completed"
          : "running";

  return { jobs, status, createPipeline, cleanup };
}
