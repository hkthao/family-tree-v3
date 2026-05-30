-- ============================================================================
-- persons_public_safe: fix two bugs surfaced while wiring the dashboard.
--
-- 1) The view was security_invoker = true, but the persons_select policy
--    only matches `is_clan_member or is_platform_admin`. Non-members of a
--    public clan therefore got zero rows even though the spec (plan §4)
--    requires them to see masked data. Switch to security_invoker = false
--    so the view runs with its owner's rights, and let the inner WHERE be
--    the entire gate (visibility=public or membership).
-- 2) The view was created before partial-date precision and the lunar
--    columns landed; they were silently absent. Add them, masked for the
--    living the same way the rest of the sensitive fields are.
-- ============================================================================

-- CREATE OR REPLACE can't reorder/insert columns; drop first.
drop view if exists public.persons_public_safe;

create view public.persons_public_safe
  with (security_invoker = false) as
  select
    p.id,
    p.clan_id,
    p.full_name,
    p.full_name_unaccent,
    p.gender,
    p.generation,
    p.branch_id,
    p.is_living,
    p.is_root,
    case when p.is_living then null else p.birth_date end as birth_date,
    case when p.is_living then null else p.birth_date_precision end as birth_date_precision,
    case when p.is_living then null else p.death_date end as death_date,
    case when p.is_living then null else p.death_date_precision end as death_date_precision,
    case when p.is_living then null else p.birth_place end as birth_place,
    case when p.is_living then null else p.burial_place end as burial_place,
    case when p.is_living then null else p.photo_path end as photo_path,
    case when p.is_living then null else p.bio end as bio,
    case when p.is_living then null else p.courtesy_name end as courtesy_name,
    case when p.is_living then null else p.posthumous_name end as posthumous_name,
    case when p.is_living then null else p.nickname end as nickname,
    case when p.is_living then null else p.birth_lunar_year end as birth_lunar_year,
    case when p.is_living then null else p.birth_lunar_month end as birth_lunar_month,
    case when p.is_living then null else p.birth_lunar_day end as birth_lunar_day,
    case when p.is_living then null else p.death_lunar_year end as death_lunar_year,
    case when p.is_living then null else p.death_lunar_month end as death_lunar_month,
    case when p.is_living then null else p.death_lunar_day end as death_lunar_day,
    case when p.is_living then null else p.death_anniv_lunar_month end as death_anniv_lunar_month,
    case when p.is_living then null else p.death_anniv_lunar_day end as death_anniv_lunar_day
  from public.persons p
  where p.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = p.clan_id
        and (
          c.visibility = 'public'
          or public.is_clan_member(c.id)
          or public.is_platform_admin()
        )
    );

revoke all on public.persons_public_safe from public;
revoke all on public.persons_public_safe from anon;
grant select on public.persons_public_safe to authenticated;
