-- Phase 2: cơ sở an táng (cemeteries) — nghĩa trang / chùa / hoa viên /
-- tháp lưu tro… như một thực thể có cấu trúc (tên + địa chỉ + GPS cơ sở)
-- để gom & lọc nhiều nơi an nghỉ theo cùng một cơ sở.

create table public.cemeteries (
  id        uuid primary key default gen_random_uuid(),
  clan_id   uuid not null references public.clans(id) on delete cascade,
  name      text not null,
  address   text,
  latitude  double precision,
  longitude double precision,
  notes     text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint cemeteries_name_len check (char_length(btrim(name)) between 1 and 200),
  constraint cemeteries_lat check (latitude is null or latitude between -90 and 90),
  constraint cemeteries_lng check (longitude is null or longitude between -180 and 180)
);
create index cemeteries_clan_idx on public.cemeteries (clan_id) where deleted_at is null;

create trigger cemeteries_set_updated_at
  before update on public.cemeteries
  for each row execute function public.set_updated_at();

alter table public.cemeteries enable row level security;
create policy cemeteries_select on public.cemeteries for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy cemeteries_insert on public.cemeteries for insert
  with check (public.can_edit_clan(clan_id));
create policy cemeteries_update on public.cemeteries for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy cemeteries_delete on public.cemeteries for delete
  using (public.can_edit_clan(clan_id));

-- Liên kết nơi an nghỉ → cơ sở (tuỳ chọn).
alter table public.resting_places
  add column if not exists cemetery_id uuid
    references public.cemeteries(id) on delete set null;
