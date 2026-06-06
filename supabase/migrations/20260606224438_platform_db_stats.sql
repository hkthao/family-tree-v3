-- get_platform_db_stats — single RPC powering the /admin "Hệ thống"
-- tab. Returns:
--   - rows  : row counts per important table
--   - sizes : pg_total_relation_size per table (bytes, including
--             indexes + toast)
--   - rates : new rows in last 24h / 7d / 30d for activity tables
--   - states: counts of "needs attention" rows (pending contribs,
--             pending links, failed notifications)
--   - cron  : last-run state for each scheduled job
--
-- SECURITY DEFINER so we can reach pg_class / cron schemas without
-- granting global access. Gated to platform admins via an explicit
-- check at the top — anyone else gets an exception.

create or replace function public.get_platform_db_stats()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_catalog, pg_temp
as $$
declare
  result jsonb := '{}'::jsonb;
  rows_obj    jsonb := '{}'::jsonb;
  sizes_obj   jsonb := '{}'::jsonb;
  rates_obj   jsonb := '{}'::jsonb;
  states_obj  jsonb := '{}'::jsonb;
  cron_arr    jsonb := '[]'::jsonb;
  total_users int;
  suspended_users int;
  tbl text;
  tables text[] := array[
    'clans', 'persons', 'families', 'branches', 'clan_members',
    'share_links', 'person_links', 'contributions', 'events',
    'event_subscriptions', 'audit_log', 'notification_log',
    'share_view_rate'
  ];
  v_count bigint;
  v_size bigint;
begin
  if not public.is_platform_admin() then
    raise exception 'only platform admin may call' using errcode = '42501';
  end if;

  -- ── Row counts + per-table size ──────────────────────────────
  foreach tbl in array tables loop
    execute format('select count(*) from public.%I', tbl) into v_count;
    rows_obj := rows_obj || jsonb_build_object(tbl, v_count);
    select pg_total_relation_size(format('public.%I', tbl)::regclass)
      into v_size;
    sizes_obj := sizes_obj || jsonb_build_object(tbl, v_size);
  end loop;

  -- Plus auth.users — separate schema, separate select. Count
  -- suspended profiles too as a separate metric.
  select count(*) into v_count from auth.users;
  rows_obj := rows_obj || jsonb_build_object('auth_users', v_count);

  -- ── New-row rates ────────────────────────────────────────────
  -- persons
  select count(*) into v_count from public.persons
   where created_at > now() - interval '24 hours';
  rates_obj := jsonb_set(rates_obj, '{persons_24h}', to_jsonb(v_count));
  select count(*) into v_count from public.persons
   where created_at > now() - interval '7 days';
  rates_obj := jsonb_set(rates_obj, '{persons_7d}', to_jsonb(v_count));
  select count(*) into v_count from public.persons
   where created_at > now() - interval '30 days';
  rates_obj := jsonb_set(rates_obj, '{persons_30d}', to_jsonb(v_count));

  -- clans
  select count(*) into v_count from public.clans
   where created_at > now() - interval '7 days';
  rates_obj := jsonb_set(rates_obj, '{clans_7d}', to_jsonb(v_count));
  select count(*) into v_count from public.clans
   where created_at > now() - interval '30 days';
  rates_obj := jsonb_set(rates_obj, '{clans_30d}', to_jsonb(v_count));

  -- new users in last 7d / 30d
  select count(*) into v_count from auth.users
   where created_at > now() - interval '7 days';
  rates_obj := jsonb_set(rates_obj, '{users_7d}', to_jsonb(v_count));
  select count(*) into v_count from auth.users
   where created_at > now() - interval '30 days';
  rates_obj := jsonb_set(rates_obj, '{users_30d}', to_jsonb(v_count));

  -- ── States needing attention ────────────────────────────────
  select count(*) into v_count from public.contributions
   where status = 'pending';
  states_obj := jsonb_set(states_obj, '{contributions_pending}', to_jsonb(v_count));

  select count(*) into v_count from public.person_links
   where status = 'pending';
  states_obj := jsonb_set(states_obj, '{person_links_pending}', to_jsonb(v_count));

  select count(*) into v_count from public.share_links
   where is_revoked = false and expires_at > now();
  states_obj := jsonb_set(states_obj, '{share_links_active}', to_jsonb(v_count));

  select count(*) into v_count from public.notification_log
   where status = 'failed';
  states_obj := jsonb_set(states_obj, '{notifications_failed_total}', to_jsonb(v_count));

  select count(*) into total_users from auth.users;
  select count(*) into suspended_users from public.profiles
   where is_suspended = true;
  states_obj := jsonb_set(states_obj, '{users_total}', to_jsonb(total_users));
  states_obj := jsonb_set(states_obj, '{users_suspended}', to_jsonb(suspended_users));

  -- ── Cron jobs (skip if pg_cron not installed) ────────────────
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select coalesce(jsonb_agg(j order by jobname), '[]'::jsonb)
      into cron_arr
      from (
        select j.jobname,
               j.schedule,
               j.active,
               -- Most-recent run for this job, if any.
               (
                 select jsonb_build_object(
                   'status', d.status,
                   'start_time', d.start_time,
                   'end_time', d.end_time,
                   'return_message', d.return_message
                 )
                 from cron.job_run_details d
                 where d.jobid = j.jobid
                 order by d.start_time desc
                 limit 1
               ) as last_run
          from cron.job j
      ) as sub;
    cron_arr := coalesce(cron_arr, '[]'::jsonb);
  end if;

  result := jsonb_build_object(
    'rows', rows_obj,
    'sizes_bytes', sizes_obj,
    'rates', rates_obj,
    'states', states_obj,
    'cron', cron_arr,
    'generated_at', now()
  );
  return result;
end;
$$;

revoke execute on function public.get_platform_db_stats() from public, anon;
grant  execute on function public.get_platform_db_stats() to authenticated;
