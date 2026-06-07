-- Companion RPCs to assign_person_to_family: link existing persons as
-- spouses or parents instead of creating new persons.
--
-- Cycle guards are critical: the user explicitly warned "ông nội là
-- con của cháu" must be impossible. We walk BOTH directions of the
-- existing tree before applying any change.

-- ─── Helpers ───────────────────────────────────────────────────────
-- Return descendants of p_root via the existing family graph. Includes
-- p_root itself for ease of "ancestor or self" checks.

create or replace function public._person_descendants(p_root uuid)
  returns table (id uuid)
  language sql
  security definer
  stable
  set search_path = public, pg_temp
  as $$
    with recursive d(id) as (
      select p_root
      union
      select cp.id
        from d
        join public.families fp on
          (fp.husband_id = d.id or fp.wife_id = d.id)
          and fp.deleted_at is null
        join public.persons cp on cp.birth_family_id = fp.id
          and cp.deleted_at is null
    )
    select id from d
  $$;

-- Return ancestors of p_root via birth_family chain. Includes p_root.

create or replace function public._person_ancestors(p_root uuid)
  returns table (id uuid)
  language sql
  security definer
  stable
  set search_path = public, pg_temp
  as $$
    with recursive a(id) as (
      select p_root
      union
      select v.pid
        from a
        join public.persons px on px.id = a.id
        join public.families fp on fp.id = px.birth_family_id
          and fp.deleted_at is null
        cross join lateral (values (fp.husband_id), (fp.wife_id)) v(pid)
       where v.pid is not null
    )
    select id from a
  $$;

revoke all on function public._person_descendants(uuid) from public, anon;
revoke all on function public._person_ancestors(uuid) from public, anon;

-- ─── assign_existing_spouse ────────────────────────────────────────
-- Pair two existing persons as husband/wife. Creates a new family row
-- (returns id) when no family between them already exists; returns
-- the existing one when there is. Refuses if spouse is in focal's
-- ancestor OR descendant chain (no incest cycles on the tree).

create or replace function public.assign_existing_spouse(
  p_person_id uuid,
  p_spouse_id uuid
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    focal_clan uuid;
    spouse_clan uuid;
    focal_gender text;
    spouse_gender text;
    v_husband uuid;
    v_wife uuid;
    existing_family uuid;
    new_family uuid;
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if p_person_id = p_spouse_id then
      raise exception 'Không thể đặt một người làm vợ/chồng của chính họ'
        using errcode = '22023';
    end if;

    select clan_id, gender into focal_clan, focal_gender
      from public.persons where id = p_person_id and deleted_at is null;
    if focal_clan is null then
      raise exception 'Người gốc không tồn tại hoặc đã xoá' using errcode = '22023';
    end if;
    if not coalesce(public.can_edit_clan(focal_clan), false) then
      raise exception 'Không có quyền sửa dòng họ này' using errcode = '42501';
    end if;

    select clan_id, gender into spouse_clan, spouse_gender
      from public.persons where id = p_spouse_id and deleted_at is null;
    if spouse_clan is null then
      raise exception 'Người bạn đời không tồn tại' using errcode = '22023';
    end if;
    if spouse_clan <> focal_clan then
      raise exception 'Người bạn đời thuộc dòng họ khác' using errcode = '22023';
    end if;
    if focal_gender = spouse_gender then
      raise exception 'App chưa hỗ trợ cặp đôi cùng giới'
        using errcode = '22023';
    end if;

    -- Cycle guard #1: spouse must not be an ancestor of focal.
    if exists (
      select 1 from public._person_ancestors(p_person_id)
       where id = p_spouse_id and id <> p_person_id
    ) then
      raise exception 'Vợ/chồng không thể đồng thời là tổ tiên của người này'
        using errcode = '22023';
    end if;

    -- Cycle guard #2: spouse must not be a descendant of focal either.
    if exists (
      select 1 from public._person_descendants(p_person_id)
       where id = p_spouse_id and id <> p_person_id
    ) then
      raise exception 'Vợ/chồng không thể đồng thời là con cháu của người này'
        using errcode = '22023';
    end if;

    -- Resolve husband/wife slots by gender.
    if focal_gender = 'M' then
      v_husband := p_person_id;
      v_wife := p_spouse_id;
    else
      v_husband := p_spouse_id;
      v_wife := p_person_id;
    end if;

    -- Already paired? Return that family.
    select f.id into existing_family
      from public.families f
     where f.husband_id = v_husband
       and f.wife_id = v_wife
       and f.clan_id = focal_clan
       and f.deleted_at is null
     limit 1;
    if existing_family is not null then
      return existing_family;
    end if;

    insert into public.families (clan_id, husband_id, wife_id, union_type)
      values (focal_clan, v_husband, v_wife, 'marriage')
      returning id into new_family;
    return new_family;
  end;
  $$;

revoke all on function public.assign_existing_spouse(uuid, uuid) from public, anon;
grant execute on function public.assign_existing_spouse(uuid, uuid) to authenticated;

-- ─── assign_existing_parent ────────────────────────────────────────
-- Set an existing person as the father OR mother of focal. Plays
-- nicely with focal's current birth_family:
--   - If focal already has a birth_family, update its husband_id/wife_id
--     slot to the new parent (slot inferred from parent's gender).
--   - If focal has no birth_family, create one with the parent as the
--     sole partner and set focal.birth_family_id.
-- Refuses if parent is a descendant of focal.

create or replace function public.assign_existing_parent(
  p_person_id uuid,
  p_parent_id uuid
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    focal_clan uuid;
    parent_clan uuid;
    parent_gender text;
    current_family uuid;
    fam_husband uuid;
    fam_wife uuid;
    new_family uuid;
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if p_person_id = p_parent_id then
      raise exception 'Không thể đặt một người làm cha/mẹ của chính họ'
        using errcode = '22023';
    end if;

    select clan_id, birth_family_id into focal_clan, current_family
      from public.persons where id = p_person_id and deleted_at is null;
    if focal_clan is null then
      raise exception 'Người con không tồn tại hoặc đã xoá' using errcode = '22023';
    end if;
    if not coalesce(public.can_edit_clan(focal_clan), false) then
      raise exception 'Không có quyền sửa' using errcode = '42501';
    end if;

    select clan_id, gender into parent_clan, parent_gender
      from public.persons where id = p_parent_id and deleted_at is null;
    if parent_clan is null then
      raise exception 'Cha/mẹ không tồn tại hoặc đã xoá' using errcode = '22023';
    end if;
    if parent_clan <> focal_clan then
      raise exception 'Cha/mẹ thuộc dòng họ khác' using errcode = '22023';
    end if;

    -- Cycle guard: candidate parent must NOT be in focal's descendant
    -- chain — that's the "ông nội là con của cháu" case the user
    -- explicitly called out.
    if exists (
      select 1 from public._person_descendants(p_person_id)
       where id = p_parent_id and id <> p_person_id
    ) then
      raise exception 'Tạo vòng lặp — người này là con cháu của người con bạn đang sửa'
        using errcode = '22023';
    end if;

    if current_family is not null then
      -- Update existing family. Replace husband_id or wife_id by parent
      -- gender. If the other slot is already filled with a DIFFERENT
      -- person, leave it alone (we're just slotting in this parent).
      select husband_id, wife_id into fam_husband, fam_wife
        from public.families where id = current_family;
      if parent_gender = 'M' then
        if fam_husband is not null and fam_husband <> p_parent_id then
          raise exception 'Family hiện đã có cha khác (% ). Sửa qua trang chỉnh sửa người để giải quyết.', fam_husband
            using errcode = '22023';
        end if;
        update public.families set husband_id = p_parent_id where id = current_family;
      else
        if fam_wife is not null and fam_wife <> p_parent_id then
          raise exception 'Family hiện đã có mẹ khác. Sửa qua trang chỉnh sửa người để giải quyết.'
            using errcode = '22023';
        end if;
        update public.families set wife_id = p_parent_id where id = current_family;
      end if;
      return current_family;
    end if;

    -- No existing family — create one with parent as the sole partner.
    insert into public.families (
      clan_id,
      husband_id,
      wife_id,
      union_type
    ) values (
      focal_clan,
      case when parent_gender = 'M' then p_parent_id else null end,
      case when parent_gender = 'F' then p_parent_id else null end,
      'marriage'
    ) returning id into new_family;

    update public.persons set birth_family_id = new_family, updated_at = now()
     where id = p_person_id;

    return new_family;
  end;
  $$;

revoke all on function public.assign_existing_parent(uuid, uuid) from public, anon;
grant execute on function public.assign_existing_parent(uuid, uuid) to authenticated;
