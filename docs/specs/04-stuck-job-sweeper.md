# 04 — Stuck job sweeper

## Goal

A pg_cron job that detects `jobs.job_logs` rows wedged in `status='running'`
beyond a reasonable wall-clock (e.g. an edge function crashed mid-write)
and revives them by flipping back to `pending` so the supervisor can
re-invoke.

Without this, a crashed worker can leave a row in `running` indefinitely
(the supervisor's concurrency guard then refuses to re-invoke).

## Trigger

Every 5 minutes, find rows where:

- `status = 'running'`
- `started_at < now() - interval '5 minutes'`

For each:

- Set `status = 'pending'`
- Set `scheduled_at = now()` (immediate dispatcher pickup)
- Increment `attempts` so we don't loop forever
- If `attempts >= MAX_ATTEMPTS`: set `status = 'failed'` with a
  `Stuck: started_at older than 5min` error message instead

## Migration sketch

```sql
create or replace function jobs.sweep_stuck()
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  with stuck as (
    select id, attempts
    from jobs.job_logs
    where status = 'running'
      and started_at < now() - interval '5 minutes'
    for update skip locked
  ),
  revived as (
    update jobs.job_logs j
    set
      status = case when s.attempts + 1 >= 5 then 'failed' else 'pending' end,
      attempts = s.attempts + 1,
      scheduled_at = case when s.attempts + 1 >= 5 then null else now() end,
      error_message = case
        when s.attempts + 1 >= 5
        then 'Stuck: started_at older than 5min after retries exhausted'
        else j.error_message
      end,
      completed_at = case when s.attempts + 1 >= 5 then now() else null end
    from stuck s
    where j.id = s.id
    returning j.id
  )
  select count(*) into v_count from revived;
  return v_count;
end;
$$;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'jobs-sweep-stuck') then
    perform cron.unschedule('jobs-sweep-stuck');
  end if;
end $$;

select cron.schedule('jobs-sweep-stuck', '*/5 * * * *', $$ select jobs.sweep_stuck() $$);
```

## Open questions

1. **5-min threshold.** Right for most workers but tight for
   `shiny-discover-brand` which can run ~40s, or aggregate-style
   workers that legitimately run longer. Either:
   - Use a per-platform threshold (column on a platforms table)
   - Add a `max_runtime_seconds` to the payload and compare against it
   - Make the threshold 15 min globally (safer default)
2. **MAX_ATTEMPTS coupling.** Currently the supervisor uses 5 too. If
   they diverge, define a shared constant in a SQL view.

## Acceptance criteria

- Manually flip a job row to `status='running'`, `started_at = now() - '10 min'`,
  wait 5 min → sweeper picks it up, status='pending', supervisor
  re-invokes via dispatcher.
- A row stuck 5 times → final state `failed` with the stuck error
  message; no infinite loop.

## Cost estimate

~30 min including the migration and a manual test on the hosted DB.
