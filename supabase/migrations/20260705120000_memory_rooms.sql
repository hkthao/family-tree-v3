-- "Phòng ký ức" — phòng trưng bày ảnh 3D theo từng dòng họ.
-- Một dòng họ có thể tạo NHIỀU phòng; số phòng bị giới hạn bởi
-- clans.max_memory_rooms (platform-admin cấu hình, giống max_persons/max_users).
--
-- Mỗi phòng gồm nhiều "item":
--   - kind='photo': ảnh của MỘT thành viên (person_id → resolve photo_path động,
--     KHÔNG lưu url) HOẶC ảnh dán từ ngoài (image_url) HOẶC ảnh trong bucket
--     (image_path). Admin/editor có thể sửa item: đổi person_id hoặc dán image_url.
--   - kind='model': (mở rộng sau) object 3D GLB/GLTF (model_url) đặt tại vị trí
--     `transform` (jsonb: pos/rot/scale).
-- RLS: đọc = thành viên clan; sửa = can_edit_clan (như resting_places).

-- ─── Giới hạn số phòng / clan (platform-admin cấu hình) ───────────────
alter table public.clans
  add column if not exists max_memory_rooms int not null default 3;

-- Bảo vệ cột đặc quyền: chỉ platform admin đổi được max_memory_rooms
-- (bổ sung vào guard sẵn có cho max_persons/max_users/owner_id).
create or replace function public.protect_clan_privileged_cols()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if auth.uid() is null then
      return new;
    end if;
    if not public.is_platform_admin() then
      if new.max_persons is distinct from old.max_persons then
        raise exception 'Only platform admin can change max_persons';
      end if;
      if new.max_users is distinct from old.max_users then
        raise exception 'Only platform admin can change max_users';
      end if;
      if new.max_memory_rooms is distinct from old.max_memory_rooms then
        raise exception 'Only platform admin can change max_memory_rooms';
      end if;
      if new.owner_id is distinct from old.owner_id then
        raise exception 'Only platform admin can transfer clan ownership';
      end if;
    end if;
    return new;
  end;
  $$;

-- ─── memory_rooms ────────────────────────────────────────────────────
create table if not exists public.memory_rooms (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid not null references public.clans(id) on delete cascade,
  name        text not null default 'Phòng ký ức',
  description text,
  theme       text not null default 'white',   -- preset tông phòng (white/warm/sage/dark)
  cover_image_url text,                          -- ảnh bìa (tuỳ chọn)
  is_public   boolean not null default false,   -- (dự phòng) chia sẻ công khai sau
  sort        int not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint memory_rooms_name_len check (char_length(name) <= 200),
  constraint memory_rooms_theme_len check (char_length(theme) <= 40)
);
create index memory_rooms_clan_idx
  on public.memory_rooms (clan_id) where deleted_at is null;

create trigger memory_rooms_set_updated_at
  before update on public.memory_rooms
  for each row execute function public.set_updated_at();

-- Giới hạn số phòng / clan (advisory lock chống race như enforce_max_persons).
create or replace function public.enforce_max_memory_rooms()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    current_count int;
    clan_limit int;
  begin
    if public.is_platform_admin() then
      return new;
    end if;
    perform pg_advisory_xact_lock(
      hashtext('max_memory_rooms:' || new.clan_id::text)::bigint
    );
    select count(*) into current_count
    from public.memory_rooms
    where clan_id = new.clan_id and deleted_at is null;
    select max_memory_rooms into clan_limit
    from public.clans where id = new.clan_id;
    if current_count >= coalesce(clan_limit, 3) then
      raise exception 'Clan has reached max_memory_rooms limit (%)', clan_limit
        using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

create trigger enforce_max_memory_rooms_trg
  before insert on public.memory_rooms
  for each row execute function public.enforce_max_memory_rooms();

-- ─── memory_room_items ───────────────────────────────────────────────
create table if not exists public.memory_room_items (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.memory_rooms(id) on delete cascade,
  clan_id     uuid not null references public.clans(id) on delete cascade, -- denormalized (sync trigger)
  kind        text not null default 'photo',
  person_id   uuid references public.persons(id) on delete set null, -- ảnh theo thành viên (resolve photo_path)
  image_url   text,      -- ảnh dán từ ngoài (https) — chỉ lưu khi không dùng person
  image_path  text,      -- ảnh trong bucket (tuỳ chọn/tương lai)
  model_url   text,      -- GLB/GLTF cho kind='model' (mở rộng sau)
  caption     text,      -- ghi đè tiêu đề
  subtitle    text,      -- ghi đè phụ đề
  transform   jsonb,     -- vị trí/xoay/scale cho object 3D (kind='model'); null = tự bố trí
  sort        int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint memory_room_items_kind check (kind in ('photo', 'model')),
  constraint memory_room_items_url_https check (
    image_url is null or image_url ~ '^https?://'
  ),
  constraint memory_room_items_model_https check (
    model_url is null or model_url ~ '^https?://'
  ),
  -- Phải có nguồn hợp lệ theo loại.
  constraint memory_room_items_source check (
    (kind = 'photo' and (person_id is not null or image_url is not null or image_path is not null))
    or (kind = 'model' and model_url is not null)
  )
);
create index memory_room_items_room_idx on public.memory_room_items (room_id, sort);
create index memory_room_items_person_idx on public.memory_room_items (person_id);

create trigger memory_room_items_set_updated_at
  before update on public.memory_room_items
  for each row execute function public.set_updated_at();

-- Sync clan_id của item = clan_id của phòng (chặn gửi clan_id chéo).
create or replace function public.memory_room_item_sync_clan()
  returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  begin
    new.clan_id := (select clan_id from public.memory_rooms where id = new.room_id);
    if new.clan_id is null then
      raise exception 'Phòng ký ức không tồn tại';
    end if;
    return new;
  end; $$;

create trigger memory_room_items_sync_clan
  before insert or update of room_id on public.memory_room_items
  for each row execute function public.memory_room_item_sync_clan();

-- ─── RLS (đọc: thành viên/admin; sửa: can_edit_clan) ─────────────────
alter table public.memory_rooms      enable row level security;
alter table public.memory_room_items enable row level security;

create policy memory_rooms_select on public.memory_rooms for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy memory_rooms_insert on public.memory_rooms for insert
  with check (public.can_edit_clan(clan_id));
create policy memory_rooms_update on public.memory_rooms for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy memory_rooms_delete on public.memory_rooms for delete
  using (public.can_edit_clan(clan_id));

create policy mri_select on public.memory_room_items for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy mri_insert on public.memory_room_items for insert
  with check (public.can_edit_clan(clan_id));
create policy mri_update on public.memory_room_items for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy mri_delete on public.memory_room_items for delete
  using (public.can_edit_clan(clan_id));

-- ─── RPC: nạp ảnh từ danh sách thành viên (chỉ người CÓ ẢNH) ─────────
-- Dùng khi tạo phòng mới với tuỳ chọn "load ảnh từ thành viên". Bỏ qua người
-- đã có sẵn trong phòng (tránh trùng). SECURITY DEFINER + kiểm tra quyền sửa.
create or replace function public.seed_memory_room_from_members(p_room_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_clan uuid;
    v_added int;
  begin
    select clan_id into v_clan from public.memory_rooms where id = p_room_id;
    if v_clan is null then
      raise exception 'Phòng ký ức không tồn tại';
    end if;
    if not public.can_edit_clan(v_clan) then
      raise exception 'Không có quyền chỉnh sửa dòng họ này';
    end if;

    with ins as (
      insert into public.memory_room_items (room_id, clan_id, kind, person_id, sort)
      select p_room_id, v_clan, 'photo', p.id,
             row_number() over (order by p.generation nulls last, p.birth_order nulls last, p.full_name)
      from public.persons p
      where p.clan_id = v_clan
        and p.deleted_at is null
        and p.photo_path is not null
        and not exists (
          select 1 from public.memory_room_items mri
          where mri.room_id = p_room_id and mri.person_id = p.id
        )
      returning 1
    )
    select count(*) into v_added from ins;
    return v_added;
  end; $$;

grant execute on function public.seed_memory_room_from_members(uuid) to authenticated;
