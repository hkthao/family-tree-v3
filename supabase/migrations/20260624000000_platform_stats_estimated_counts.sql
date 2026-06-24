-- Sửa timeout trang Admin → Hệ thống (get_platform_db_stats).
--
-- Hàm đếm count(*) toàn bộ 13 bảng (persons, families, audit_log,
-- notification_log, share_view_rate…). Mỗi count(*) là một lần quét
-- toàn bảng; cộng dồn lại vượt statement_timeout của admin khi dữ liệu
-- lớn (vd sau khi import gia phả 4802 người + log tích luỹ) →
-- "canceling statement due to statement timeout".
--
-- Bảng thống kê chỉ cần số dòng GẦN ĐÚNG, nên thay count(*) bằng
-- pg_class.reltuples (ước lượng do ANALYZE/autovacuum cập nhật) — tức
-- thì, không quét bảng. Các số nhỏ (chờ duyệt, gần đây, theo trạng
-- thái) vẫn đếm chính xác vì chỉ chạm tập con nhỏ.

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
  failed_arr  jsonb := '[]'::jsonb;
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

  -- Số dòng ƯỚC LƯỢNG từ pg_class.reltuples (tức thì) thay vì count(*)
  -- quét toàn bảng. reltuples = -1 nếu chưa từng ANALYZE → kẹp về 0.
  foreach tbl in array tables loop
    select greatest(c.reltuples, 0)::bigint
      into v_count
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = tbl;
    rows_obj := rows_obj || jsonb_build_object(tbl, coalesce(v_count, 0));
    select pg_total_relation_size(format('public.%I', tbl)::regclass)
      into v_size;
    sizes_obj := sizes_obj || jsonb_build_object(tbl, v_size);
  end loop;

  select greatest(c.reltuples, 0)::bigint
    into v_count
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'auth' and c.relname = 'users';
  rows_obj := rows_obj || jsonb_build_object('auth_users', coalesce(v_count, 0));

  select count(*) into v_count from public.persons
   where created_at > now() - interval '24 hours';
  rates_obj := jsonb_set(rates_obj, '{persons_24h}', to_jsonb(v_count));
  select count(*) into v_count from public.persons
   where created_at > now() - interval '7 days';
  rates_obj := jsonb_set(rates_obj, '{persons_7d}', to_jsonb(v_count));
  select count(*) into v_count from public.persons
   where created_at > now() - interval '30 days';
  rates_obj := jsonb_set(rates_obj, '{persons_30d}', to_jsonb(v_count));

  select count(*) into v_count from public.clans
   where created_at > now() - interval '7 days';
  rates_obj := jsonb_set(rates_obj, '{clans_7d}', to_jsonb(v_count));
  select count(*) into v_count from public.clans
   where created_at > now() - interval '30 days';
  rates_obj := jsonb_set(rates_obj, '{clans_30d}', to_jsonb(v_count));

  select count(*) into v_count from auth.users
   where created_at > now() - interval '7 days';
  rates_obj := jsonb_set(rates_obj, '{users_7d}', to_jsonb(v_count));
  select count(*) into v_count from auth.users
   where created_at > now() - interval '30 days';
  rates_obj := jsonb_set(rates_obj, '{users_30d}', to_jsonb(v_count));

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

  select coalesce(
    jsonb_agg(to_jsonb(r) order by r.sent_at desc),
    '[]'::jsonb
  ) into failed_arr
  from (
    select n.id,
           n.event_key,
           n.channel,
           n.sent_at,
           n.clan_id,
           c.name as clan_name,
           n.user_id,
           u.email as user_email
      from public.notification_log n
      left join public.clans c on c.id = n.clan_id
      left join auth.users u on u.id = n.user_id
     where n.status = 'failed'
     order by n.sent_at desc
     limit 10
  ) r;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    select coalesce(jsonb_agg(to_jsonb(j) order by j.jobname), '[]'::jsonb)
      into cron_arr
      from (
        select cj.jobname,
               cj.schedule,
               cj.active,
               (
                 select jsonb_build_object(
                   'status', d.status,
                   'start_time', d.start_time,
                   'end_time', d.end_time,
                   'return_message', d.return_message
                 )
                 from cron.job_run_details d
                 where d.jobid = cj.jobid
                 order by d.start_time desc
                 limit 1
               ) as last_run
          from cron.job cj
      ) as j;
    cron_arr := coalesce(cron_arr, '[]'::jsonb);
  end if;

  result := jsonb_build_object(
    'rows', rows_obj,
    'sizes_bytes', sizes_obj,
    'rates', rates_obj,
    'states', states_obj,
    'cron', cron_arr,
    'recent_failed_notifications', failed_arr,
    'generated_at', now()
  );
  return result;
end;
$$;
