-- assign_person_to_family — link an EXISTING person as a child of a
-- family. Companion to addChildToFamily (which creates a new person).
--
-- Use case: after merging data, fixing inherited mistakes, or pulling
-- in a person whose lineage was discovered later. Example: Kim Hương
-- was attached to a phantom "Hưng + null" family; admin wants to move
-- her into the real "Hưng + Yến" family.
--
-- Safety checks performed server-side:
--   1. Caller must can_edit_clan() the target clan.
--   2. Person + family must be non-deleted and in the SAME clan.
--   3. Person can't be either parent of the family (no self-as-child).
--   4. No cycle: target person must not be an ancestor of either parent
--      via the existing birth_family_id chains.

create or replace function public.assign_person_to_family(
  p_person_id uuid,
  p_family_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    child_clan  uuid;
    family_clan uuid;
    family_h    uuid;
    family_w    uuid;
    chain_id    uuid;
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;

    select clan_id into child_clan
      from public.persons
     where id = p_person_id and deleted_at is null;
    if child_clan is null then
      raise exception 'Người con không tồn tại hoặc đã xoá' using errcode = '22023';
    end if;

    if not coalesce(public.can_edit_clan(child_clan), false) then
      raise exception 'Không có quyền sửa dòng họ này' using errcode = '42501';
    end if;

    select clan_id, husband_id, wife_id
      into family_clan, family_h, family_w
      from public.families
     where id = p_family_id and deleted_at is null;
    if family_clan is null then
      raise exception 'Family không tồn tại hoặc đã xoá' using errcode = '22023';
    end if;
    if family_clan <> child_clan then
      raise exception 'Family thuộc dòng họ khác' using errcode = '22023';
    end if;

    if p_person_id = family_h or p_person_id = family_w then
      raise exception 'Người này đang là cha/mẹ của family — không thể đặt làm con'
        using errcode = '22023';
    end if;

    -- Cycle check: BFS up from BOTH parents over the existing
    -- birth_family_id chains. Bounded depth (20 generations) plus
    -- visited-set guards both runaway-tree and pathological loops.
    for chain_id in
      with recursive up(id) as (
        select v.pid
          from (values (family_h), (family_w)) v(pid)
         where v.pid is not null
        union
        select n.id
          from up
          join public.persons px on px.id = up.id
          join public.families fp on fp.id = px.birth_family_id
            and fp.deleted_at is null
          cross join lateral (
            values (fp.husband_id), (fp.wife_id)
          ) n(id)
         where n.id is not null
      )
      select id from up
    loop
      if chain_id = p_person_id then
        raise exception 'Tạo vòng lặp tổ tiên — người này nằm trong dòng tổ tiên của cha/mẹ'
          using errcode = '22023';
      end if;
    end loop;

    update public.persons
       set birth_family_id = p_family_id,
           updated_at = now()
     where id = p_person_id;
  end;
  $$;

revoke all on function public.assign_person_to_family(uuid, uuid) from public, anon;
grant execute on function public.assign_person_to_family(uuid, uuid) to authenticated;
