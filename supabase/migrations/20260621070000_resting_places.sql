-- "Mộ phần & tro cốt" — nơi an nghỉ của thành viên dòng họ.
-- Bao cả chôn cất (mộ) lẫn hoả táng + gửi tro cốt (gửi chùa, nhà lưu
-- tro / tháp họ chứa tro cốt nhiều người, rải tro). Xem kế hoạch:
-- docs/plan-mo-phan-tro-cot.md
--
-- Cấu trúc/RLS theo persons: đọc = thành viên clan, sửa = editor/admin
-- (can_edit_clan). Bảng con denormalized clan_id (đồng bộ bằng trigger)
-- để RLS gọn + chặn gửi clan_id chéo. Soft-delete resting_places bằng
-- deleted_at ở tầng query (không trigger). Một nơi an nghỉ gắn NHIỀU
-- người (mộ đôi / mộ chung / tháp họ) qua bảng nối nhiều-nhiều.

-- ─── Enums ────────────────────────────────────────────────────────
create type public.resting_place_kind
  as enum ('grave', 'ashes_temple', 'columbarium', 'scattered', 'other');
create type public.resting_place_status
  as enum ('existing', 'relocated', 'lost');

-- ─── resting_places ───────────────────────────────────────────────
create table public.resting_places (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid not null references public.clans(id) on delete cascade,
  kind        public.resting_place_kind not null default 'grave',
  name        text,
  location_name   text,   -- nghĩa trang / tên chùa / tên cơ sở-tháp / nơi rải
  location_detail text,   -- lô–hàng–số (mộ) | ngăn/tầng/kệ/số hũ (tro cốt)
  address     text,
  latitude    double precision,
  longitude   double precision,
  orientation text,       -- hướng (chỉ ý nghĩa với mộ)
  status      public.resting_place_status not null default 'existing',
  built_year  int,
  material    text,
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint resting_places_name_len check (name is null or char_length(name) <= 200),
  constraint resting_places_year check (built_year is null or built_year between 1 and 9999),
  constraint resting_places_lat check (latitude is null or latitude between -90 and 90),
  constraint resting_places_lng check (longitude is null or longitude between -180 and 180)
);
create index resting_places_clan_idx
  on public.resting_places (clan_id) where deleted_at is null;

create trigger resting_places_set_updated_at
  before update on public.resting_places
  for each row execute function public.set_updated_at();

-- ─── resting_place_occupants (nhiều-nhiều) ────────────────────────
create table public.resting_place_occupants (
  id        uuid primary key default gen_random_uuid(),
  resting_place_id uuid not null references public.resting_places(id) on delete cascade,
  person_id uuid not null references public.persons(id) on delete cascade,
  clan_id   uuid not null references public.clans(id) on delete cascade, -- denormalized
  note      text,
  created_at timestamptz not null default now(),
  unique (resting_place_id, person_id)
);
create index resting_place_occupants_place_idx on public.resting_place_occupants (resting_place_id);
create index resting_place_occupants_person_idx on public.resting_place_occupants (person_id);

-- ─── resting_place_photos ─────────────────────────────────────────
create table public.resting_place_photos (
  id        uuid primary key default gen_random_uuid(),
  resting_place_id uuid not null references public.resting_places(id) on delete cascade,
  clan_id   uuid not null references public.clans(id) on delete cascade, -- denormalized
  path      text not null,
  caption   text,
  sort      int not null default 0,
  created_at timestamptz not null default now()
);
create index resting_place_photos_place_idx on public.resting_place_photos (resting_place_id, sort);

-- ─── sync clan_id của bảng con = clan_id của resting_place ─────────
create or replace function public.resting_place_child_sync_clan()
  returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  begin
    new.clan_id := (
      select clan_id from public.resting_places where id = new.resting_place_id
    );
    if new.clan_id is null then
      raise exception 'Nơi an nghỉ không tồn tại';
    end if;
    return new;
  end; $$;

create trigger resting_place_occupants_sync_clan
  before insert or update of resting_place_id on public.resting_place_occupants
  for each row execute function public.resting_place_child_sync_clan();
create trigger resting_place_photos_sync_clan
  before insert or update of resting_place_id on public.resting_place_photos
  for each row execute function public.resting_place_child_sync_clan();

-- ─── RLS (đọc: thành viên/admin; sửa: can_edit_clan) ──────────────
alter table public.resting_places          enable row level security;
alter table public.resting_place_occupants enable row level security;
alter table public.resting_place_photos    enable row level security;

create policy resting_places_select on public.resting_places for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy resting_places_insert on public.resting_places for insert
  with check (public.can_edit_clan(clan_id));
create policy resting_places_update on public.resting_places for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy resting_places_delete on public.resting_places for delete
  using (public.can_edit_clan(clan_id));

create policy rpo_select on public.resting_place_occupants for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy rpo_insert on public.resting_place_occupants for insert
  with check (public.can_edit_clan(clan_id));
create policy rpo_update on public.resting_place_occupants for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy rpo_delete on public.resting_place_occupants for delete
  using (public.can_edit_clan(clan_id));

create policy rpp_select on public.resting_place_photos for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy rpp_insert on public.resting_place_photos for insert
  with check (public.can_edit_clan(clan_id));
create policy rpp_update on public.resting_place_photos for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy rpp_delete on public.resting_place_photos for delete
  using (public.can_edit_clan(clan_id));
