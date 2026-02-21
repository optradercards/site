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
  const dagIdRef = useRef<string | null>(null);

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

      const dagId = crypto.randomUUID();
      dagIdRef.current = dagId;

      // Insert steps in order, collecting IDs to resolve dependsOn indices
      const createdIds: string[] = [];

      for (const step of steps) {
        const dependsOn = (step.dependsOn ?? []).map((idx) => {
          if (idx < 0 || idx >= createdIds.length) {
            throw new Error(
              `Invalid dependsOn index ${idx} — only ${createdIds.length} jobs created so far`
            );
          }
          return createdIds[idx];
        });

        const { data: row, error } = await supabase
          .schema("jobs").from("job_logs")
          .insert({
            account_id: accountId,
            platform: step.platform,
            handle: step.handle,
            status: "pending",
            payload: step.payload,
            dag_id: dagId,
            depends_on: dependsOn,
          })
          .select("id, platform, status, stats, error_message")
          .single();

        if (error) throw error;

        createdIds.push(row.id);
      }

      // Set initial jobs state
      const initial: PipelineJob[] = createdIds.map((id, i) => ({
        id,
        platform: steps[i].platform,
        status: "pending" as JobStatus,
        stats: {},
        error_message: null,
      }));
      setJobs(initial);

      // Subscribe to realtime updates for all jobs in this pipeline
      const channel = supabase
        .channel(`pipeline-${dagId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "jobs",
            table: "job_logs",
            filter: `dag_id=eq.${dagId}`,
          },
          (payload) => {
            const updated = payload.new as Record<string, unknown>;
            setJobs((prev) =>
              prev.map((j) =>
                j.id === updated.id
                  ? {
                      ...j,
                      status: updated.status as JobStatus,
                      stats:
                        (updated.stats as Record<string, number>) ?? {},
                      error_message:
                        (updated.error_message as string) ?? null,
                    }
                  : j
              )
            );
          }
        )
        .subscribe();

      channelRef.current = channel;

      return { dagId, jobIds: createdIds };
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
