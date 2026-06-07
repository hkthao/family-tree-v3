-- ============================================================================
-- "Việc cần làm" — gap detection for a clan.
--
-- Surfaces persons missing critical data so the clan can crowdsource
-- fixes. Four categories:
--
--   missing_parents — person has no birth_family_id and isn't a known
--                     root. The most load-bearing gap: parents drive
--                     generation/branch inference.
--   missing_dates   — birth year unknown (no solar AND no lunar), or
--                     deceased with no death year / giỗ anniversary.
--   dead_end        — married + age-eligible + no recorded children.
--                     Heuristic: a person 30+ years old (by birth_date
--                     or birth_lunar_year) who has a spouse-family but
--                     no children in any of their families.
--   missing_media   — photo missing, or solar date set but lunar copy
--                     not back-computed. Low-stakes but quick wins for
--                     non-admin contributors.
--
-- All RPCs gate on is_clan_member (coalesce → false for null safety).
--
-- Counts are O(N) sequential scans over persons (clan_id indexed +
-- `where deleted_at is null` index). For a 5k-person clan, summary
-- runs in well under 100ms.
-- ============================================================================

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
        and p.is_root = false
        and p.birth_family_id is null
      union all
      select 'missing_dates'::text, count(*)::bigint
      from public.persons p
      where p.clan_id = p_clan_id
        and p.deleted_at is null
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
        and (
          p.photo_path is null
          or (p.birth_date is not null and p.birth_lunar_year is null)
          or (p.death_date is not null and p.death_lunar_year is null)
        );
  end;
  $$;

revoke all on function public.get_clan_todo_summary(uuid) from public, anon;
grant execute on function public.get_clan_todo_summary(uuid) to authenticated;

-- ─── Items (paginated) ──────────────────────────────────────────────

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

revoke all on function public.get_clan_todo_items(uuid, text, int, int)
  from public, anon;
grant execute on function public.get_clan_todo_items(uuid, text, int, int)
  to authenticated;

-- ─── Drawer badge — total of "load-bearing" gaps only ──────────────
-- Skips missing_media (photo + lunar) because those are nice-to-have
-- and would always dominate the badge. The badge nudges towards
-- data-correctness gaps (parents, dates, dead-ends).

create or replace function public.count_clan_todo(p_clan_id uuid)
  returns bigint
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    total bigint := 0;
    rec record;
  begin
    if not coalesce(public.is_clan_member(p_clan_id), false) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;

    for rec in
      select category, count
      from public.get_clan_todo_summary(p_clan_id)
    loop
      if rec.category in ('missing_parents', 'missing_dates', 'dead_end') then
        total := total + rec.count;
      end if;
    end loop;

    return total;
  end;
  $$;

revoke all on function public.count_clan_todo(uuid) from public, anon;
grant execute on function public.count_clan_todo(uuid) to authenticated;
