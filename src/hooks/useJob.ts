import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  status: JobStatus;
  stats: Record<string, number>;
  error_message: string | null;
}

export function useJob() {
  const supabase = createClient();
  const [job, setJob] = useState<Job | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const cleanup = useCallback(() => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  }, [supabase]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  const createJob = useCallback(
    async (
      accountId: string,
      platform: string,
      handle: string,
      payload: Record<string, unknown>,
      opts?: { depends_on?: string[]; dag_id?: string }
    ) => {
      // Clean up any previous subscription
      cleanup();

      const { data: row, error } = await supabase
        .schema("jobs").from("job_logs")
        .insert({
          account_id: accountId,
          platform,
          handle,
          status: "pending",
          payload,
          ...(opts?.depends_on && { depends_on: opts.depends_on }),
          ...(opts?.dag_id && { dag_id: opts.dag_id }),
        })
        .select("id, status, stats, error_message")
        .single();

      if (error) throw error;

      const jobId = row.id;
      setJob({
        id: jobId,
        status: row.status as JobStatus,
        stats: row.stats ?? {},
        error_message: null,
      });

      // Subscribe to realtime updates on this row
      const channel = supabase
        .channel(`job-${jobId}`)
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "jobs",
            table: "job_logs",
            filter: `id=eq.${jobId}`,
          },
          (payload) => {
            const updated = payload.new as Record<string, unknown>;
            setJob({
              id: jobId,
              status: updated.status as JobStatus,
              stats: (updated.stats as Record<string, number>) ?? {},
              error_message: (updated.error_message as string) ?? null,
            });
          }
        )
        .subscribe();

      channelRef.current = channel;

      return jobId;
    },
    [supabase, cleanup]
  );

  const status = job?.status ?? null;
  const stats = job?.stats ?? {};
  const error = job?.error_message ?? null;

  return { job, createJob, status, stats, error };
}
