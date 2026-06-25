-- Add `lifespan_years` to persons_public_safe.
--
-- The lifespan feature (tuổi thọ / hưởng thọ-dương) added persons.lifespan_years
-- in 20260622000000 and the Share (public tree) view started selecting it, but
-- the safe view was never recreated to expose the column — so any non-member
-- query asking for lifespan_years gets 400 "column ... does not exist".
--
-- Masked for the living (lifespan only applies to the deceased; same rule as
-- the other deceased-only fields). DROP + CREATE because CREATE OR REPLACE
-- can't change the column set in place.

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
    case when p.is_living then null else p.death_anniv_lunar_day end as death_anniv_lunar_day,
    p.death_anniv_lunar_is_leap,
    -- Lifespan only applies to the deceased; mask for the living.
    case when p.is_living then null else p.lifespan_years end as lifespan_years,
    p.birth_family_id,
    p.birth_order
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
