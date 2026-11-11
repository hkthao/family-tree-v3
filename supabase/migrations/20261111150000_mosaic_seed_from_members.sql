-- Trần số ô của một bức: 150 (trước đó 500). Bức nào lỡ vượt thì hạ về mức tròn hàng ≤150.
update public.clan_mosaics
set slots = (150 / cols) * cols
where slots > 150;
alter table public.clan_mosaics drop constraint if exists clan_mosaics_slots;
alter table public.clan_mosaics add constraint clan_mosaics_slots check (slots between 4 and 150);

-- Tạo bức ảnh ghép với tuỳ chọn "nạp sẵn avatar thành viên": mỗi người trong cây CÓ ảnh
-- đại diện thành một mảnh (photo_path trỏ thẳng avatar nên đổi avatar là mảnh đổi theo).
-- Mảnh nạp sẵn không gắn user_id (không tính vào hạn mức của ai).

-- Trigger INSERT: bỏ gán user_id = auth.uid() khi đang nạp sẵn (cờ phiên app.mosaic_seed).
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
    v_seeding boolean := coalesce(current_setting('app.mosaic_seed', true), '') = '1';
  begin
    select clan_id, status, max_per_member into v_clan, v_status, v_max
    from public.clan_mosaics where id = new.mosaic_id;
    if v_clan is null then
      raise exception 'Bức ảnh ghép không tồn tại';
    end if;
    new.clan_id := v_clan;
    if new.user_id is null and not v_seeding then
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

-- RPC: nạp avatar thành viên vào bức (chỉ admin/editor). Trả số mảnh đã thêm. Nếu số người
-- có ảnh vượt số ô thì nới `slots` (tròn hàng, tối đa 150).
create or replace function public.seed_clan_mosaic_from_members(p_mosaic_id uuid)
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_clan uuid;
    v_cols int;
    v_slots int;
    v_existing int;
    v_candidates int;
    v_added int;
    v_cap int;
  begin
    select clan_id, cols, slots into v_clan, v_cols, v_slots
    from public.clan_mosaics where id = p_mosaic_id;
    if v_clan is null then
      raise exception 'Bức ảnh ghép không tồn tại';
    end if;
    if not (public.can_edit_clan(v_clan) or public.is_platform_admin()) then
      raise exception 'Không có quyền chỉnh sửa dòng họ này' using errcode = '42501';
    end if;

    v_cap := (150 / v_cols) * v_cols; -- trần 150 ô, tròn hàng
    select count(*) into v_existing from public.clan_mosaic_tiles where mosaic_id = p_mosaic_id;
    select count(*) into v_candidates
    from public.persons p
    where p.clan_id = v_clan and p.deleted_at is null and p.photo_path is not null
      and not exists (select 1 from public.clan_mosaic_tiles t
                      where t.mosaic_id = p_mosaic_id and t.person_id = p.id);

    -- Nới số ô cho đủ (tròn hàng, trần 150).
    if v_existing + v_candidates > v_slots then
      update public.clan_mosaics
      set slots = least(v_cap, ceil((v_existing + v_candidates)::numeric / v_cols)::int * v_cols)
      where id = p_mosaic_id;
    end if;

    perform set_config('app.mosaic_seed', '1', true);
    with ins as (
      insert into public.clan_mosaic_tiles (mosaic_id, clan_id, person_id, photo_path, caption)
      select p_mosaic_id, v_clan, p.id, p.photo_path, p.full_name
      from public.persons p
      where p.clan_id = v_clan and p.deleted_at is null and p.photo_path is not null
        and not exists (select 1 from public.clan_mosaic_tiles t
                        where t.mosaic_id = p_mosaic_id and t.person_id = p.id)
      order by p.generation nulls last, p.birth_order nulls last, p.full_name
      limit greatest(0, v_cap - v_existing)
      returning 1
    )
    select count(*) into v_added from ins;
    perform set_config('app.mosaic_seed', '', true);
    return v_added;
  end; $$;

grant execute on function public.seed_clan_mosaic_from_members(uuid) to authenticated;
