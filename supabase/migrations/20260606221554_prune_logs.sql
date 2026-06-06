-- Retention prunes for the two log tables that didn't yet have one.
--
-- - `notification_log` — one row per email/SMS sent by notify-events.
--   Used for idempotency (event_key + channel UNIQUE) and audit.
--   Older entries don't guard anything: event_key always carries the
--   absolute date for the year, so next year's anniversary email
--   re-uses a fresh key. Safe to prune past N days.
--
-- - `share_view_rate` — per-IP rate-limit buckets for the share-view
--   Edge function. Each row is ~60 seconds of activity; old rows are
--   irrelevant. A prune function already exists (20260530153500) —
--   we just schedule it here.
--
-- Both schedules are guarded the same way audit_log_prune is: only
-- created when pg_cron is actually installed (skip silently on local
-- dev where the extension might be disabled).

-- ─── notification_log prune ─────────────────────────────────────────

create or replace function public.prune_notification_log(
  retention_days int default null
)
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    effective_days int;
    deleted_count  int;
  begin
    -- Resolve retention: explicit arg → GUC → default 180.
    effective_days := coalesce(
      retention_days,
      nullif(current_setting('app.notification_retention_days', true), '')::int,
      180
    );
    if effective_days < 7 then
      raise exception 'retention_days must be >= 7 (got %)', effective_days
        using errcode = '22023';
    end if;

    delete from public.notification_log
     where sent_at < now() - make_interval(days => effective_days);
    get diagnostics deleted_count = row_count;
    return deleted_count;
  end;
  $$;

revoke execute on function public.prune_notification_log(int) from public;
grant  execute on function public.prune_notification_log(int) to postgres;

-- ─── Scheduling (pg_cron) ───────────────────────────────────────────

-- notification_log: weekly. Same window as audit log so they share
-- a low-traffic slot. Different jobname so they don't clobber.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'notification-log-prune-weekly';

    perform cron.schedule(
      'notification-log-prune-weekly',
      '15 3 * * 0',
      $cron$ select public.prune_notification_log(); $cron$
    );
  end if;
end$$;

-- share_view_rate: hourly (the buckets themselves are minute-scoped,
-- and an hour of stale rows is the largest the rate limiter can
-- legitimately see). Tiny query, no traffic impact.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'share-view-rate-prune-hourly';

    perform cron.schedule(
      'share-view-rate-prune-hourly',
      '7 * * * *',
      $cron$ select public.prune_share_view_rate(); $cron$
    );
  end if;
end$$;
