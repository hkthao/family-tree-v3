-- Giới hạn số lượt xuất sổ gia phả chạy CÙNG LÚC trên toàn hệ thống để server không quá tải.
-- Việc dựng PDF làm ở trình duyệt; phần tốn server là lấy dữ liệu cả dòng họ + tải ảnh. Máy khách xin một "chỗ"
-- trước khi lấy dữ liệu và trả lại ngay khi lấy xong. Chỗ tự hết hạn (lease) để tab đóng/mất mạng không giữ chỗ mãi.

create table if not exists public.export_slots (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  clan_id    uuid not null references public.clans(id) on delete cascade,
  expires_at timestamptz not null
);
create index if not exists export_slots_expires_idx on public.export_slots (expires_at);
create unique index if not exists export_slots_user_uniq on public.export_slots (user_id);

-- Chỉ truy cập qua hai hàm bên dưới.
alter table public.export_slots enable row level security;
revoke all on public.export_slots from anon, authenticated;

-- Xin một chỗ. Trả { granted, slot_id?, active, max }. Mỗi người tối đa một chỗ (xin lại thì làm mới chỗ cũ).
create or replace function public.acquire_export_slot(p_clan uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  max_slots constant int := 3;
  lease constant interval := interval '3 minutes';
  n int;
  sid uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  if not public.is_clan_member(p_clan) then raise exception 'not a clan member' using errcode = '42501'; end if;

  -- Khoá chung để hai người xin cùng lúc không cùng lọt qua giới hạn.
  perform pg_advisory_xact_lock(hashtext('export_slots'));
  delete from public.export_slots where expires_at < now();

  select id into sid from public.export_slots where user_id = uid;
  if sid is not null then
    update public.export_slots set clan_id = p_clan, expires_at = now() + lease where id = sid;
    select count(*) into n from public.export_slots;
    return jsonb_build_object('granted', true, 'slot_id', sid, 'active', n, 'max', max_slots);
  end if;

  select count(*) into n from public.export_slots;
  if n >= max_slots then
    return jsonb_build_object('granted', false, 'active', n, 'max', max_slots);
  end if;

  insert into public.export_slots (user_id, clan_id, expires_at) values (uid, p_clan, now() + lease) returning id into sid;
  return jsonb_build_object('granted', true, 'slot_id', sid, 'active', n + 1, 'max', max_slots);
end;
$$;

create or replace function public.release_export_slot(p_slot uuid)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.export_slots where id = p_slot and user_id = auth.uid();
$$;

revoke all on function public.acquire_export_slot(uuid) from public, anon;
revoke all on function public.release_export_slot(uuid) from public, anon;
grant execute on function public.acquire_export_slot(uuid) to authenticated;
grant execute on function public.release_export_slot(uuid) to authenticated;
