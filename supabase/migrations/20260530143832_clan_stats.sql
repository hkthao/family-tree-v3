-- ============================================================================
-- get_clan_stats(target_clan): aggregate counts for the dashboard.
--
-- SECURITY INVOKER (the default) — RLS applies to the underlying selects.
-- If the caller cannot see the clan's rows, the function returns zeros,
-- which the frontend treats as "no access" (matches the empty-clan case).
-- ============================================================================

create or replace function public.get_clan_stats(target_clan uuid)
  returns table (
    total_persons int,
    males int,
    females int,
    living int,
    deceased int,
    max_generation int,
    branches int
  )
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
  as $$
    select
      (select count(*)::int
         from public.persons
        where clan_id = target_clan
          and deleted_at is null),
      (select count(*)::int
         from public.persons
        where clan_id = target_clan
          and deleted_at is null
          and gender = 'M'),
      (select count(*)::int
         from public.persons
        where clan_id = target_clan
          and deleted_at is null
          and gender = 'F'),
      (select count(*)::int
         from public.persons
        where clan_id = target_clan
          and deleted_at is null
          and is_living = true),
      (select count(*)::int
         from public.persons
        where clan_id = target_clan
          and deleted_at is null
          and is_living = false),
      (select max(generation)
         from public.persons
        where clan_id = target_clan
          and deleted_at is null),
      (select count(*)::int
         from public.branches
        where clan_id = target_clan
          and deleted_at is null);
  $$;

revoke execute on function public.get_clan_stats(uuid) from public;
grant execute on function public.get_clan_stats(uuid) to authenticated;
