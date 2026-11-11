-- "Ảnh đại gia đình ghép mảnh" — mỗi dòng họ có NHIỀU bức (clan_mosaics), mỗi
-- thành viên góp ảnh của mình thành một mảnh (clan_mosaic_tiles) ghép thành tấm lớn.
--
-- Ảnh mảnh: `photo_path` là đường dẫn trong bucket person-photos
-- ({clan_id}/mosaic/{user_id}/{uuid}.jpg, đã nén nhỏ phía client) HOẶC link
-- https ngoài (dùng thẳng, không ký, không xoá trong bucket) — cùng quy ước
-- với isExternalPhoto() trong photoUpload.ts.
-- RLS: đọc = thành viên; thêm mảnh = thành viên (cả viewer) khi bức đang mở;
-- sửa/xoá mảnh = chủ mảnh hoặc admin/editor; quản lý bức = admin/editor.

-- ─── clan_mosaics (một "bức") ────────────────────────────────────────
create table if not exists public.clan_mosaics (
  id              uuid primary key default gen_random_uuid(),
  clan_id         uuid not null references public.clans(id) on delete cascade,
  title           text not null default 'Ảnh đại gia đình',
  description     text,
  status          text not null default 'open',
  max_per_member  int  not null default 1,
  cols            int  not null default 6,   -- số cột lưới; ô = position (0-based)
  slots           int  not null default 24,  -- tổng số ô (mảnh) của bức, luôn được vẽ đủ
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint clan_mosaics_title_len check (char_length(title) <= 200),
  constraint clan_mosaics_status check (status in ('open', 'closed')),
  constraint clan_mosaics_max_per_member check (max_per_member between 1 and 50),
  constraint clan_mosaics_cols check (cols between 2 and 12),
  constraint clan_mosaics_slots check (slots between 4 and 500)
);
create index if not exists clan_mosaics_clan_idx
  on public.clan_mosaics (clan_id, created_at);

create trigger clan_mosaics_set_updated_at
  before update on public.clan_mosaics
  for each row execute function public.set_updated_at();

-- Trần 20 bức / họ (advisory lock chống race), platform admin được bỏ qua.
create or replace function public.enforce_max_clan_mosaics()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if public.is_platform_admin() then
      return new;
    end if;
    perform pg_advisory_xact_lock(hashtext('max_clan_mosaics:' || new.clan_id::text)::bigint);
    if (select count(*) from public.clan_mosaics where clan_id = new.clan_id) >= 20 then
      raise exception 'Dòng họ đã đạt tối đa 20 bức ảnh ghép'
        using errcode = 'check_violation';
    end if;
    return new;
  end; $$;

create trigger enforce_max_clan_mosaics_trg
  before insert on public.clan_mosaics
  for each row execute function public.enforce_max_clan_mosaics();

-- ─── clan_mosaic_tiles (một "mảnh") ──────────────────────────────────
create table if not exists public.clan_mosaic_tiles (
  id          uuid primary key default gen_random_uuid(),
  mosaic_id   uuid not null references public.clan_mosaics(id) on delete cascade,
  clan_id     uuid not null references public.clans(id) on delete cascade, -- denormalized (trigger sync)
  user_id     uuid references auth.users(id) on delete set null,           -- người góp mảnh
  person_id   uuid references public.persons(id) on delete set null,       -- người trong ảnh (tuỳ chọn)
  photo_path  text not null,
  caption     text,
  position    int  not null default 0,   -- chỉ số ô trong lưới (0-based), duy nhất / bức
  status      text not null default 'approved',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clan_mosaic_tiles_status check (status in ('approved', 'hidden')),
  constraint clan_mosaic_tiles_caption_len check (caption is null or char_length(caption) <= 200),
  constraint clan_mosaic_tiles_path_len check (char_length(photo_path) <= 1000)
);
create index if not exists clan_mosaic_tiles_mosaic_idx
  on public.clan_mosaic_tiles (mosaic_id, position);
create unique index if not exists clan_mosaic_tiles_slot_uq
  on public.clan_mosaic_tiles (mosaic_id, position);
create index if not exists clan_mosaic_tiles_user_idx
  on public.clan_mosaic_tiles (mosaic_id, user_id);
create index if not exists clan_mosaic_tiles_clan_idx
  on public.clan_mosaic_tiles (clan_id);

create trigger clan_mosaic_tiles_set_updated_at
  before update on public.clan_mosaic_tiles
  for each row execute function public.set_updated_at();

-- INSERT: đồng bộ clan_id từ bức (chặn gửi clan_id chéo), ép user_id/status cho
-- người không phải editor, kiểm tra bức đang mở + hạn mức mảnh/người, gán position.
create or replace function public.clan_mosaic_tile_before_insert()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_clan uuid;
    v_status text;
    v_max int;
    v_editor boolean;
  begin
    select clan_id, status, max_per_member into v_clan, v_status, v_max
    from public.clan_mosaics where id = new.mosaic_id;
    if v_clan is null then
      raise exception 'Bức ảnh ghép không tồn tại';
    end if;
    new.clan_id := v_clan;
    if new.user_id is null then
      new.user_id := auth.uid();
    end if;

    perform pg_advisory_xact_lock(hashtext('clan_mosaic_tiles:' || new.mosaic_id::text)::bigint);

    v_editor := public.can_edit_clan(v_clan) or public.is_platform_admin();
    if not v_editor then
      new.user_id := auth.uid();
      new.status := 'approved';
      if v_status <> 'open' then
        raise exception 'Bức ảnh này đã đóng, không nhận thêm mảnh'
          using errcode = 'check_violation';
      end if;
      if (select count(*) from public.clan_mosaic_tiles
          where mosaic_id = new.mosaic_id and user_id = auth.uid()) >= v_max then
        raise exception 'Bạn đã dùng hết số mảnh được góp (%)', v_max
          using errcode = 'check_violation';
      end if;
    end if;

    -- Ô trống đầu tiên (lấp chỗ hở trước khi nới thêm hàng).
    select coalesce(
      (select min(g) from generate_series(0, (select coalesce(max(position), -1) + 1
                                              from public.clan_mosaic_tiles
                                              where mosaic_id = new.mosaic_id)) g
       where not exists (select 1 from public.clan_mosaic_tiles t
                         where t.mosaic_id = new.mosaic_id and t.position = g)),
      0)
      into new.position;
    return new;
  end; $$;

create trigger clan_mosaic_tiles_before_insert
  before insert on public.clan_mosaic_tiles
  for each row execute function public.clan_mosaic_tile_before_insert();

-- UPDATE: người không phải editor chỉ được đổi ảnh/chú thích/người trong ảnh.
create or replace function public.clan_mosaic_tile_before_update()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    new.mosaic_id := old.mosaic_id;
    new.clan_id := old.clan_id;
    if not (public.can_edit_clan(old.clan_id) or public.is_platform_admin()) then
      new.user_id := old.user_id;
      new.status := old.status;
      -- vị trí chỉ đổi qua RPC move_clan_mosaic_tile (đặt cờ phiên bên dưới)
      if coalesce(current_setting('app.mosaic_move', true), '') <> '1' then
        new.position := old.position;
      end if;
    end if;
    return new;
  end; $$;

create trigger clan_mosaic_tiles_before_update
  before update on public.clan_mosaic_tiles
  for each row execute function public.clan_mosaic_tile_before_update();

-- ─── RLS ─────────────────────────────────────────────────────────────
alter table public.clan_mosaics      enable row level security;
alter table public.clan_mosaic_tiles enable row level security;

create policy clan_mosaics_select on public.clan_mosaics for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());
create policy clan_mosaics_insert on public.clan_mosaics for insert
  with check (public.can_edit_clan(clan_id));
create policy clan_mosaics_update on public.clan_mosaics for update
  using (public.can_edit_clan(clan_id)) with check (public.can_edit_clan(clan_id));
create policy clan_mosaics_delete on public.clan_mosaics for delete
  using (public.can_edit_clan(clan_id));

-- Mảnh bị ẩn chỉ editor và chủ mảnh thấy.
create policy clan_mosaic_tiles_select on public.clan_mosaic_tiles for select
  using (
    public.is_platform_admin()
    or (public.is_clan_member(clan_id)
        and (status = 'approved'
             or user_id = (select auth.uid())
             or public.can_edit_clan(clan_id)))
  );
create policy clan_mosaic_tiles_insert on public.clan_mosaic_tiles for insert
  with check (public.is_clan_member(clan_id) or public.can_edit_clan(clan_id));
create policy clan_mosaic_tiles_update on public.clan_mosaic_tiles for update
  using (user_id = (select auth.uid()) or public.can_edit_clan(clan_id))
  with check (user_id = (select auth.uid()) or public.can_edit_clan(clan_id));
create policy clan_mosaic_tiles_delete on public.clan_mosaic_tiles for delete
  using (user_id = (select auth.uid()) or public.can_edit_clan(clan_id));

-- ─── Storage: thành viên (kể cả viewer) tự up/xoá ảnh mảnh của MÌNH ──
-- Đường dẫn {clan_id}/mosaic/{user_id}/{file}; editor đã có policy chung.
create policy "person_photos_mosaic_member_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'mosaic'
    and (storage.foldername(name))[3] = (select auth.uid())::text
    and public.is_clan_member(((storage.foldername(name))[1])::uuid)
  );

create policy "person_photos_mosaic_member_delete"
  on storage.objects for delete
  using (
    bucket_id = 'person-photos'
    and (storage.foldername(name))[2] = 'mosaic'
    and (storage.foldername(name))[3] = (select auth.uid())::text
  );

-- ─── RPC kéo-thả: đưa mảnh tới ô p_slot ──────────────────────────────
-- Ô trống → di chuyển. Ô đang có mảnh khác → đổi chỗ (chỉ editor).
-- Chủ mảnh chỉ được chuyển mảnh CỦA MÌNH sang ô trống.
create or replace function public.move_clan_mosaic_tile(p_tile_id uuid, p_slot int)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_tile public.clan_mosaic_tiles;
    v_other public.clan_mosaic_tiles;
    v_cols int;
    v_editor boolean;
  begin
    if p_slot < 0 or p_slot > 999 then
      raise exception 'Ô không hợp lệ';
    end if;
    select * into v_tile from public.clan_mosaic_tiles where id = p_tile_id;
    if v_tile.id is null then
      raise exception 'Mảnh không tồn tại';
    end if;
    v_editor := public.can_edit_clan(v_tile.clan_id) or public.is_platform_admin();
    if not v_editor and (v_tile.user_id is distinct from auth.uid()
                         or not public.is_clan_member(v_tile.clan_id)) then
      raise exception 'Không có quyền di chuyển mảnh này';
    end if;
    perform pg_advisory_xact_lock(hashtext('clan_mosaic_tiles:' || v_tile.mosaic_id::text)::bigint);
    perform set_config('app.mosaic_move', '1', true);

    select * into v_other from public.clan_mosaic_tiles
      where mosaic_id = v_tile.mosaic_id and position = p_slot and id <> v_tile.id;
    if v_other.id is not null then
      if not v_editor then
        raise exception 'Ô này đã có mảnh khác';
      end if;
      -- đổi chỗ qua ô tạm âm để không vướng unique
      update public.clan_mosaic_tiles set position = -1 where id = v_tile.id;
      update public.clan_mosaic_tiles set position = v_tile.position where id = v_other.id;
    end if;
    update public.clan_mosaic_tiles set position = p_slot where id = v_tile.id;
  end; $$;

grant execute on function public.move_clan_mosaic_tile(uuid, int) to authenticated;
