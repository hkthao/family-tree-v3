-- Let non-members of a public clan render the tree.
--
-- Bug surfaced in Tree.tsx: getTreeData() reads `persons` + `families`
-- directly, so non-members hit the row-level policies (members only)
-- and see "no data" even though /people works (it uses the
-- `persons_public_safe` view).
--
-- Two pieces fix this:
--   1. Extend `persons_public_safe` with `birth_family_id` and
--      `birth_order` — Tree needs the family pointer to draw
--      parent-child links + the explicit sibling rank for ordering.
--      Neither field is sensitive on its own; the linked family is
--      already gated by clan visibility via the new view below.
--   2. Add a `families_public_safe` view that exposes only the bare
--      structural columns (husband_id, wife_id, union_type) for
--      families of public clans. Family rows carry no personal data
--      beyond IDs that point back to persons whose visibility is
--      already enforced by persons_public_safe.
--
-- Mirrors the existing 20260530151940_persons_public_safe_fix.sql:
-- DROP + CREATE (not OR REPLACE) so we can keep column ordering
-- sane. security_invoker = false so the view runs as owner — the
-- WHERE clause is the gate. No callers depend on the existing view
-- shape beyond the columns it already exposes; we ADD two columns,
-- never drop.

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
    -- Tree-rendering columns. Not masked by is_living — the IDs
    -- themselves carry no PII (the people they point to are gated
    -- by this same view) and the tree shape is intentionally public
    -- for public clans.
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

-- Families view — same visibility gate. Families carry no
-- personal text data, just the structural pair (husband_id,
-- wife_id, union_type). Safe to expose unmasked for public clans.
create or replace view public.families_public_safe
  with (security_invoker = false) as
  select
    f.id,
    f.clan_id,
    f.husband_id,
    f.wife_id,
    f.union_type
  from public.families f
  where f.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = f.clan_id
        and (
          c.visibility = 'public'
          or public.is_clan_member(c.id)
          or public.is_platform_admin()
        )
    );

revoke all on public.families_public_safe from public;
revoke all on public.families_public_safe from anon;
grant select on public.families_public_safe to authenticated;
