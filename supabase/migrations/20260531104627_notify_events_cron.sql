-- ============================================================================
-- notify-events: daily cron + idempotency index
--
-- The `event_subscriptions` + `notification_log` tables already exist
-- (core_schema.sql). This migration:
--   1. Hardens the dedupe index on notification_log so the Edge Function
--      can `INSERT ... ON CONFLICT DO NOTHING` and never resend the
--      same reminder.
--   2. Schedules the `notify-events` Edge Function via pg_cron + pg_net
--      to run daily at 00:05 UTC (07:05 Vietnam). The schedule is set
--      up GUARDED — if pg_cron or pg_net isn't enabled (local dev),
--      the migration is a no-op for the cron half and operators
--      trigger the function manually.
--
-- Trigger manually for testing:
--   curl -X POST \
--        -H "X-Cron-Token: ${CRON_TOKEN}" \
--        -H "Content-Type: application/json" \
--        -d '{"date":"2024-06-08"}' \
--        ${SUPABASE_URL}/functions/v1/notify-events
-- ============================================================================

-- Idempotency: the table already has UNIQUE (user_id, event_key, channel)
-- via core_schema.sql, but make it explicitly named so we can ON CONFLICT
-- against it.
do $$
begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'notification_log_user_event_channel_uq'
  ) then
    -- The original constraint named the index automatically. Rename it
    -- if it exists, otherwise create.
    if exists (
      select 1 from pg_constraint
      where conname = 'notification_log_user_id_event_key_channel_key'
    ) then
      alter index public.notification_log_user_id_event_key_channel_key
        rename to notification_log_user_event_channel_uq;
    else
      create unique index notification_log_user_event_channel_uq
        on public.notification_log (user_id, event_key, channel);
    end if;
  end if;
end$$;

-- Schedule the cron only if pg_cron + pg_net are available. They are
-- in Supabase Cloud but not always in local docker. Wrap in a guard.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    -- Drop any previous job with the same name (re-running the migration).
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'notify-events-daily';

    perform cron.schedule(
      'notify-events-daily',
      '5 0 * * *', -- 00:05 UTC daily = 07:05 Vietnam
      $cron$
      select net.http_post(
        url := current_setting('app.notify_events_url', true),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Token', current_setting('app.notify_events_token', true)
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  end if;
end$$;

-- The cron body reads two GUC settings. Operators must set them in the
-- project once:
--   alter database postgres
--     set app.notify_events_url = 'https://<ref>.supabase.co/functions/v1/notify-events';
--   alter database postgres
--     set app.notify_events_token = '<the same value as CRON_TOKEN env var>';
-- (These cannot live in this migration because they're project-specific.)
