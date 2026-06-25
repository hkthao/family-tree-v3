-- "Di sản & Văn hoá dòng họ" — giá trị phi vật thể: từ đường/đền/chùa,
-- tục lệ/gia phong, giai thoại/công trạng, tư liệu/kỷ vật. Xem kế hoạch:
-- docs/plan-di-san-van-hoa.md
--
-- Đối tượng chính là NGƯỜI LỚN TUỔI nên nội dung lưu PLAIN TEXT (không
-- markdown) + ưu tiên ảnh/ghi âm. Media gộp ảnh + audio vào MỘT bảng
-- (heritage_media) có cột bytes/duration_sec để thống kê & giới hạn dung
-- lượng (VPS ít storage). Cấu trúc/RLS theo resting_places: đọc = thành
-- viên clan, sửa = editor/admin (can_edit_clan). Bảng con denormalized
-- clan_id (đồng bộ bằng trigger). Soft-delete bằng deleted_at ở tầng query.

-- ─── Enums ────────────────────────────────────────────────────────
create type public.heritage_category
  as enum ('place', 'custom', 'story', 'artifact');
create type public.heritage_status
  as enum ('active', 'draft', 'archived');
create type public.heritage_media_kind
  as enum ('photo', 'audio');

-- ─── heritage_items ───────────────────────────────────────────────
create table public.heritage_items (
  id            uuid primary key default gen_random_uuid(),
  clan_id       uuid not null references public.clans(id) on delete cascade,
  category      public.heritage_category not null,
  title         text not null,
  summary       text,           -- mô tả ngắn (list + preview share)
  body          text,           -- nội dung PLAIN TEXT (tự tách đoạn), KHÔNG markdown
  location_name text,           -- chỉ dùng cho category = 'place'
  address       text,
  latitude      double precision,
  longitude     double precision,
  built_year    int,
  status        public.heritage_status not null default 'active',
  sort          int not null default 0,
  cover_media_id uuid,          -- ảnh đại diện (FK heritage_media, gán sau khi có ảnh)
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  constraint heritage_title_len check (char_length(title) <= 200),
  constraint heritage_year check (built_year is null or built_year between 1 and 9999),
  constraint heritage_lat check (latitude is null or latitude between -90 and 90),
  constraint heritage_lng check (longitude is null or longitude between -180 and 180)
);
create index heritage_items_clan_idx
  on public.heritage_items (clan_id) where deleted_at is null;
create index heritage_items_clan_cat_idx
  on public.heritage_items (clan_id, category) where deleted_at is null;

create trigger heritage_items_set_updated_at
  before update on public.heritage_items
  for each row execute function public.set_updated_at();

-- ─── heritage_media (ảnh + audio gộp chung) ───────────────────────
create table public.heritage_media (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid not null references public.heritage_items(id) on delete cascade,
  clan_id      uuid not null references public.clans(id) on delete cascade, -- denormalized
  kind         public.heritage_media_kind not null,
  path         text not null,   -- bucket person-photos: {clan_id}/heritage/{item_id}/{uuid}.{jpg|webm}
  caption      text,
  sort         int not null default 0,
  bytes        int,             -- thống kê dung lượng + chặn vượt
  duration_sec int,             -- chỉ có ý nghĩa với audio
  created_at   timestamptz not null default now()
);
create index heritage_media_item_idx on public.heritage_media (item_id, sort);

-- cover_media_id trỏ tới heritage_media; xoá ảnh thì gỡ cover
alter table public.heritage_items
  add constraint heritage_items_cover_fk
  foreign key (cover_media_id) references public.heritage_media(id) on delete set null;

-- ─── heritage_people (gắn người liên quan, nhiều-nhiều) ───────────
create table public.heritage_people (
  id         uuid primary key default gen_random_uuid(),
  item_id    uuid not null references public.heritage_items(id) on delete cascade,
  person_id  uuid not null references public.persons(id) on delete cascade,
  clan_id    uuid not null references public.clans(id) on delete cascade, -- denormalized
  role_note  text,             -- vd "người lập từ đường", "nhân vật chính"
  created_at timestamptz not null default now(),
  unique (item_id, person_id)
);
create index heritage_people_item_idx on public.heritage_people (item_id);
create index heritage_people_person_idx on public.heritage_people (person_id);

-- ─── sync clan_id của bảng con = clan_id của heritage_item ─────────
create or replace function public.heritage_child_sync_clan()
  returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  begin
    new.clan_id := (
      select clan_id from public.heritage_items where id = new.item_id
    );
    if new.clan_id is null then
      raise exception 'Mục di sản không tồn tại';
    end if;
    return new;
  end; $$;

create trigger heritage_media_sync_clan
  before insert or update of item_id on public.heritage_media
  for each row execute function public.heritage_child_sync_clan();
create trigger heritage_people_sync_clan
  before insert or update of item_id on public.heritage_people
  for each row execute function public.heritage_child_sync_clan();

-- ─── RLS (đọc: thành viên/admin; sửa: can_edit_clan) ──────────────
alter table public.heritage_items  enable row level security;
alter table public.heritage_media  enable row level security;
alter table public.heritage_people enable row level security;

create policy heritage_items_select on public.heritage_items for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy heritage_items_insert on public.heritage_items for insert
  with check (public.can_edit_clan(clan_id));
create policy heritage_items_update on public.heritage_items for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy heritage_items_delete on public.heritage_items for delete
  using (public.can_edit_clan(clan_id));

create policy heritage_media_select on public.heritage_media for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy heritage_media_insert on public.heritage_media for insert
  with check (public.can_edit_clan(clan_id));
create policy heritage_media_update on public.heritage_media for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy heritage_media_delete on public.heritage_media for delete
  using (public.can_edit_clan(clan_id));

create policy heritage_people_select on public.heritage_people for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy heritage_people_insert on public.heritage_people for insert
  with check (public.can_edit_clan(clan_id));
create policy heritage_people_update on public.heritage_people for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy heritage_people_delete on public.heritage_people for delete
  using (public.can_edit_clan(clan_id));
