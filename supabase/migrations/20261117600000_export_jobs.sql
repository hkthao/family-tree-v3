-- Hàng đợi xuất Sổ gia phả PDF cho dịch vụ `book-worker` (máy chủ riêng).
-- App tạo việc qua create_export_job; worker (service role) nhận việc bằng claim_export_job (SKIP LOCKED), dựng PDF,
-- đưa lên bucket private `book-exports` (<uid>/job-<id>.pdf) rồi ghi trạng thái. App theo dõi qua get_export_job và tải
-- bằng signed URL (policy của bucket cho người tạo đọc thư mục của mình). Worker báo "còn sống" qua export_workers để app
-- tự lùi về dựng tại trình duyệt khi dịch vụ tắt.

create table if not exists public.export_jobs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  clan_id      uuid not null references public.clans(id) on delete cascade,
  options      jsonb not null default '{}'::jsonb,
  status       text not null default 'queued' check (status in ('queued','running','done','failed','cancelled')),
  stage        text,
  error        text,
  file_path    text,
  bytes        bigint,
  person_count int,
  attempts     int not null default 0,
  worker       text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz,
  heartbeat_at timestamptz
);
create index if not exists export_jobs_queue_idx on public.export_jobs (created_at) where status in ('queued','running');
create index if not exists export_jobs_user_idx on public.export_jobs (user_id, created_at desc);

alter table public.export_jobs enable row level security;
revoke all on public.export_jobs from anon, authenticated;
grant select on public.export_jobs to authenticated;
-- Chỉ ĐỌC việc của chính mình; ghi qua các hàm bên dưới.
drop policy if exists export_jobs_select_own on public.export_jobs;
create policy export_jobs_select_own on public.export_jobs for select to authenticated using (user_id = (select auth.uid()));

create table if not exists public.export_workers (
  id          text primary key,
  seen_at     timestamptz not null default now(),
  max_persons int not null default 400
);
alter table public.export_workers enable row level security;
revoke all on public.export_workers from anon, authenticated;

-- Tạo việc. Lỗi dùng làm tín hiệu cho app lùi về dựng tại máy: service_unavailable, too_large:<n>:<max>, queue_full.
create or replace function public.create_export_job(p_clan uuid, p_options jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  w record;
  n int;
  j public.export_jobs;
  pos int;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_clan_member(p_clan) then raise exception 'not a clan member' using errcode = '42501'; end if;

  select max(max_persons) as m, count(*) as c into w from public.export_workers where seen_at > now() - interval '90 seconds';
  if w.c = 0 then raise exception 'service_unavailable'; end if;

  select count(*) into n from public.persons where clan_id = p_clan and deleted_at is null;
  if n > w.m then raise exception 'too_large:%:%', n, w.m; end if;

  -- Đã có việc đang chờ/chạy của người này cho họ này → dùng lại (bấm hai lần không tạo hai việc).
  select * into j from public.export_jobs where user_id = uid and clan_id = p_clan and status in ('queued','running') order by created_at desc limit 1;
  if not found then
    if (select count(*) from public.export_jobs where status = 'queued') >= 30 then raise exception 'queue_full'; end if;
    insert into public.export_jobs (user_id, clan_id, options, person_count) values (uid, p_clan, coalesce(p_options, '{}'::jsonb), n) returning * into j;
  end if;
  select count(*) into pos from public.export_jobs where status = 'queued' and created_at < j.created_at;
  return jsonb_build_object('id', j.id, 'status', j.status, 'position', pos);
end;
$$;

create or replace function public.get_export_job(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare j public.export_jobs; pos int; alive boolean;
begin
  select * into j from public.export_jobs where id = p_id and user_id = auth.uid();
  if not found then return null; end if;
  select count(*) into pos from public.export_jobs where status = 'queued' and created_at < j.created_at;
  select exists(select 1 from public.export_workers where seen_at > now() - interval '90 seconds') into alive;
  return jsonb_build_object('id', j.id, 'status', j.status, 'stage', j.stage, 'error', j.error, 'file_path', j.file_path,
                            'bytes', j.bytes, 'position', pos, 'worker_alive', alive);
end;
$$;

create or replace function public.cancel_export_job(p_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.export_jobs set status = 'cancelled', finished_at = now() where id = p_id and user_id = auth.uid() and status = 'queued';
$$;

-- Worker nhận việc kế tiếp. Việc "đang chạy" mà mất nhịp tim > 5 phút (worker chết) được xếp lại, tối đa 2 lần.
create or replace function public.claim_export_job(p_worker text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare r public.export_jobs;
begin
  update public.export_jobs set status = 'failed', error = 'Dịch vụ xuất sổ bị gián đoạn.', finished_at = now()
    where status = 'running' and heartbeat_at < now() - interval '5 minutes' and attempts >= 2;
  update public.export_jobs set status = 'queued', stage = null
    where status = 'running' and heartbeat_at < now() - interval '5 minutes' and attempts < 2;

  with c as (
    select id from public.export_jobs where status = 'queued' order by created_at for update skip locked limit 1
  )
  update public.export_jobs j set status = 'running', started_at = now(), heartbeat_at = now(), attempts = j.attempts + 1, worker = p_worker, stage = 'data'
    from c where j.id = c.id returning j.* into r;
  if r.id is null then return null; end if;
  return to_jsonb(r);
end;
$$;

revoke all on function public.create_export_job(uuid, jsonb) from public, anon;
revoke all on function public.get_export_job(uuid) from public, anon;
revoke all on function public.cancel_export_job(uuid) from public, anon;
revoke all on function public.claim_export_job(text) from public, anon, authenticated;
grant execute on function public.create_export_job(uuid, jsonb) to authenticated;
grant execute on function public.get_export_job(uuid) to authenticated;
grant execute on function public.cancel_export_job(uuid) to authenticated;
grant execute on function public.claim_export_job(text) to service_role;
grant all on public.export_jobs, public.export_workers to service_role;
