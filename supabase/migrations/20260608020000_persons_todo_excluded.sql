-- persons.todo_excluded — manual opt-out flag for the "Việc cần làm"
-- board. The auto-detection in get_clan_todo_summary / _items is
-- great at finding gaps but bad at knowing which gaps are KNOWN
-- unknowns: e.g. thuỷ tổ legitimately has no parents (already
-- covered by is_root=false filter on missing_parents), or a person
-- whose dates are genuinely lost to history and admin doesn't want
-- them surfacing on the list every time the board is opened.
--
-- Toggle flips this flag. When true, the person is skipped in ALL
-- todo categories regardless of which gaps they have.
-- count_clan_todo follows suit so the drawer badge stays in sync.

alter table public.persons
  add column if not exists todo_excluded boolean not null default false;

create index if not exists persons_todo_excluded_idx
  on public.persons (clan_id)
  where todo_excluded = true;

-- ─── Re-emit get_clan_todo_summary with the flag check ────────────

create or replace function public.get_clan_todo_summary(p_clan_id uuid)
  returns table (category text, count bigint)
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    age_threshold int := extract(year from current_date)::int - 30;
  begin
    if not coalesce(public.is_clan_member(p_clan_id), false) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;

    return query
      select 'missing_parents'::text, count(*)::bigint
      from public.persons p
      where p.clan_id = p_clan_id
        and p.deleted_at is null
        and p.todo_excluded = false
        and p.is_root = false
        and p.birth_family_id is null
      union all
      select 'missing_dates'::text, count(*)::bigint
      from public.persons p
      where p.clan_id = p_clan_id
        and p.deleted_at is null
        and p.todo_excluded = false
        and (
          (p.birth_date is null and p.birth_lunar_year is null)
          or (
            p.is_living = false
            and p.death_date is null
            and p.death_lunar_year is null
            and p.death_anniv_lunar_month is null
          )
        )
      union all
      select 'dead_end'::text, count(*)::bigint
      from public.persons p
      where p.clan_id = p_clan_id
        and p.deleted_at is null
        and p.todo_excluded = false
        and (
          (p.birth_date is not null
           and extract(year from p.birth_date)::int <= age_threshold)
          or (p.birth_lunar_year is not null
              and p.birth_lunar_year <= age_threshold)
        )
        and exists (
          select 1 from public.families f
          where (f.husband_id = p.id or f.wife_id = p.id)
            and f.deleted_at is null
        )
        and not exists (
          select 1 from public.families f2
          join public.persons c on c.birth_family_id = f2.id
            and c.deleted_at is null
          where (f2.husband_id = p.id or f2.wife_id = p.id)
            and f2.deleted_at is null
        )
      union all
      select 'missing_media'::text, count(*)::bigint
      from public.persons p
      where p.clan_id = p_clan_id
        and p.deleted_at is null
        and p.todo_excluded = false
        and (
          p.photo_path is null
          or (p.birth_date is not null and p.birth_lunar_year is null)
          or (p.death_date is not null and p.death_lunar_year is null)
        );
  end;
  $$;

-- ─── Re-emit get_clan_todo_items ──────────────────────────────────

create or replace function public.get_clan_todo_items(
  p_clan_id uuid,
  p_category text,
  p_limit int default 50,
  p_offset int default 0
)
  returns table (
    person_id uuid,
    full_name text,
    gender text,
    is_living boolean,
    birth_year int,
    death_year int,
    generation int,
    photo_path text,
    missing text[]
  )
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    age_threshold int := extract(year from current_date)::int - 30;
    eff_limit int;
    eff_offset int;
  begin
    if not coalesce(public.is_clan_member(p_clan_id), false) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;

    eff_limit := least(greatest(coalesce(p_limit, 50), 1), 200);
    eff_offset := greatest(coalesce(p_offset, 0), 0);

    if p_category = 'missing_parents' then
      return query
        select p.id, p.full_name, p.gender, p.is_living,
               extract(year from p.birth_date)::int,
               extract(year from p.death_date)::int,
               p.generation, p.photo_path,
               array['parents']::text[]
        from public.persons p
        where p.clan_id = p_clan_id
          and p.deleted_at is null
          and p.todo_excluded = false
          and p.is_root = false
          and p.birth_family_id is null
        order by coalesce(p.generation, 9999), p.full_name
        limit eff_limit offset eff_offset;

    elsif p_category = 'missing_dates' then
      return query
        select p.id, p.full_name, p.gender, p.is_living,
               extract(year from p.birth_date)::int,
               extract(year from p.death_date)::int,
               p.generation, p.photo_path,
               array_remove(array[
                 case when p.birth_date is null and p.birth_lunar_year is null
                      then 'birth_year' else null end,
                 case when p.is_living = false
                      and p.death_date is null
                      and p.death_lunar_year is null
                      and p.death_anniv_lunar_month is null
                      then 'death_year' else null end
               ]::text[], null)
        from public.persons p
        where p.clan_id = p_clan_id
          and p.deleted_at is null
          and p.todo_excluded = false
          and (
            (p.birth_date is null and p.birth_lunar_year is null)
            or (
              p.is_living = false
              and p.death_date is null
              and p.death_lunar_year is null
              and p.death_anniv_lunar_month is null
            )
          )
        order by coalesce(p.generation, 9999), p.full_name
        limit eff_limit offset eff_offset;

    elsif p_category = 'dead_end' then
      return query
        select p.id, p.full_name, p.gender, p.is_living,
               extract(year from p.birth_date)::int,
               extract(year from p.death_date)::int,
               p.generation, p.photo_path,
               array['dead_end']::text[]
        from public.persons p
        where p.clan_id = p_clan_id
          and p.deleted_at is null
          and p.todo_excluded = false
          and (
            (p.birth_date is not null
             and extract(year from p.birth_date)::int <= age_threshold)
            or (p.birth_lunar_year is not null
                and p.birth_lunar_year <= age_threshold)
          )
          and exists (
            select 1 from public.families f
            where (f.husband_id = p.id or f.wife_id = p.id)
              and f.deleted_at is null
          )
          and not exists (
            select 1 from public.families f2
            join public.persons c on c.birth_family_id = f2.id
              and c.deleted_at is null
            where (f2.husband_id = p.id or f2.wife_id = p.id)
              and f2.deleted_at is null
          )
        order by coalesce(p.generation, 9999), p.full_name
        limit eff_limit offset eff_offset;

    elsif p_category = 'missing_media' then
      return query
        select p.id, p.full_name, p.gender, p.is_living,
               extract(year from p.birth_date)::int,
               extract(year from p.death_date)::int,
               p.generation, p.photo_path,
               array_remove(array[
                 case when p.photo_path is null then 'photo' else null end,
                 case when p.birth_date is not null and p.birth_lunar_year is null
                      then 'birth_lunar' else null end,
                 case when p.death_date is not null and p.death_lunar_year is null
                      then 'death_lunar' else null end
               ]::text[], null)
        from public.persons p
        where p.clan_id = p_clan_id
          and p.deleted_at is null
          and p.todo_excluded = false
          and (
            p.photo_path is null
            or (p.birth_date is not null and p.birth_lunar_year is null)
            or (p.death_date is not null and p.death_lunar_year is null)
          )
        order by coalesce(p.generation, 9999), p.full_name
        limit eff_limit offset eff_offset;

    else
      raise exception 'Unknown category: %', p_category using errcode = '22023';
    end if;
  end;
  $$;

-- ─── Toggle RPC ──────────────────────────────────────────────────
-- Owner-callable mutation. Plain UPDATE would also work via the
-- existing persons RLS policy, but a dedicated SECURITY DEFINER RPC
-- keeps the auth check explicit and lets the API surface stay terse.

create or replace function public.set_person_todo_excluded(
  p_person_id uuid,
  p_excluded boolean
)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_clan uuid;
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;

    select clan_id into v_clan
      from public.persons
     where id = p_person_id and deleted_at is null;
    if v_clan is null then
      raise exception 'Người không tồn tại hoặc đã xoá' using errcode = '22023';
    end if;
    if not coalesce(public.can_edit_clan(v_clan), false) then
      raise exception 'Không có quyền sửa' using errcode = '42501';
    end if;

    update public.persons
       set todo_excluded = coalesce(p_excluded, false),
           updated_at = now()
     where id = p_person_id;
  end;
  $$;

revoke all on function public.set_person_todo_excluded(uuid, boolean)
  from public, anon;
grant execute on function public.set_person_todo_excluded(uuid, boolean)
  to authenticated;
