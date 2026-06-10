-- Distinct-person count for the "Họ ta đã hoàn thành X%" widget.
--
-- The existing count_clan_todo SUMS three categories, so a person
-- who is in BOTH missing_parents AND missing_dates is double-
-- counted. That inflated total drove the completion percentage to
-- 0% on real clans where nearly every old ancestor is missing both
-- parents and dates.
--
-- This RPC returns the number of DISTINCT persons that fail at
-- least one of the two "load-bearing" criteria — i.e. the gaps the
-- user actually cares about being chased to fix:
--   * missing_parents: not root + no birth_family_id
--   * missing_dates:   no birth year at all, or deceased with no
--                      death/giỗ year
--
-- Soft gaps (dead_end heuristic, missing photo/lunar) deliberately
-- stay out of the denominator — they're tracked on /todo but
-- shouldn't drag the headline percentage down for clans that
-- simply don't have photos of their ancestors.
--
-- Mirrors count_clan_todo's auth gate (is_clan_member) and
-- security_definer + locked search_path.

create or replace function public.count_clan_completion_gaps(p_clan_id uuid)
  returns bigint
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    n bigint;
  begin
    if not coalesce(public.is_clan_member(p_clan_id), false) then
      raise exception 'Not authorized' using errcode = '42501';
    end if;

    select count(distinct p.id)
    into n
    from public.persons p
    where p.clan_id = p_clan_id
      and p.deleted_at is null
      and p.todo_excluded = false
      and (
        (p.is_root = false and p.birth_family_id is null)
        or
        (p.birth_date is null and p.birth_lunar_year is null)
        or (
          p.is_living = false
          and p.death_date is null
          and p.death_lunar_year is null
          and p.death_anniv_lunar_month is null
        )
      );

    return coalesce(n, 0);
  end;
  $$;

revoke all on function public.count_clan_completion_gaps(uuid)
  from public, anon;
grant execute on function public.count_clan_completion_gaps(uuid)
  to authenticated;
