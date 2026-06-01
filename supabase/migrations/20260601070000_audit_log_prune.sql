-- ============================================================================
-- audit_log retention: weekly prune of old audit entries.
--
-- audit_log gets one row per insert/update/delete on persons, families,
-- and branches (see triggers.sql). For a busy multi-thousand-person
-- clan this is a few writes per active session — over years it grows
-- unbounded and slows the Audit page query (sorted by changed_at desc).
--
-- Policy: delete rows older than the configured retention window
-- (default 180 days). Restore is unaffected: the underlying persons /
-- families / branches rows are soft-deleted, not hard-deleted, so an
-- admin can still un-delete via a future "show deleted rows" UI even
-- after the audit row is gone. What's lost is the audit page's
-- visibility of changes older than the window — explicitly the goal.
--
-- Retention is configurable per-deployment via a GUC:
--   alter database postgres set app.audit_retention_days = '365';
-- ============================================================================

create or replace function public.prune_audit_log(
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
      nullif(current_setting('app.audit_retention_days', true), '')::int,
      180
    );
    if effective_days < 7 then
      raise exception 'retention_days must be >= 7 (got %)', effective_days
        using errcode = '22023';
    end if;

    delete from public.audit_log
     where changed_at < now() - make_interval(days => effective_days);
    get diagnostics deleted_count = row_count;
    return deleted_count;
  end;
  $$;

revoke execute on function public.prune_audit_log(int) from public;
-- Only the cron job (postgres role) + platform admins should run this.
-- Service role bypasses RLS but can't EXECUTE without a grant.
grant execute on function public.prune_audit_log(int) to postgres;

-- Schedule weekly: Sunday 03:00 UTC = 10:00 Vietnam. Low-traffic hour,
-- and weekly is plenty — the prune cost grows linearly with retention,
-- so spreading it daily wouldn't help.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
      from cron.job
     where jobname = 'audit-log-prune-weekly';

    perform cron.schedule(
      'audit-log-prune-weekly',
      '0 3 * * 0',
      $cron$ select public.prune_audit_log(); $cron$
    );
  end if;
end$$;
