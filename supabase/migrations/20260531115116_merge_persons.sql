-- ============================================================================
-- merge_persons(winner, loser) — collapse a duplicate person row into another.
--
-- Useful after GEDCOM / Excel re-imports produce duplicates: the editor
-- picks which row to keep, and this function moves every relationship
-- pointer (family spouse positions, child birth_family_id, event
-- related_person_id, subscription target_id) from `loser` onto
-- `winner`, fills in any null fields on the winner from the loser,
-- then soft-deletes the loser. Idempotent at the DB level via a single
-- transaction.
--
-- Caller must `can_edit_clan(winner.clan_id)`. Both persons must
-- belong to the same clan.
-- ============================================================================

create or replace function public.merge_persons(
  p_winner uuid,
  p_loser uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_winner public.persons%rowtype;
  v_loser public.persons%rowtype;
  v_families_updated int := 0;
  v_subs_updated int := 0;
  v_events_updated int := 0;
  v_children_updated int := 0;
begin
  if p_winner = p_loser then
    raise exception 'cannot merge a person with themselves';
  end if;

  select * into v_winner from public.persons where id = p_winner;
  if v_winner.id is null then
    raise exception 'winner not found';
  end if;
  select * into v_loser from public.persons where id = p_loser;
  if v_loser.id is null then
    raise exception 'loser not found';
  end if;

  if v_winner.clan_id <> v_loser.clan_id then
    raise exception 'persons belong to different clans';
  end if;

  if not public.can_edit_clan(v_winner.clan_id) then
    raise exception 'forbidden';
  end if;

  if v_loser.deleted_at is not null then
    raise exception 'loser is already deleted';
  end if;

  -- 1) Fill any null fields on the winner from the loser
  update public.persons set
    birth_date = coalesce(v_winner.birth_date, v_loser.birth_date),
    birth_date_precision = coalesce(v_winner.birth_date_precision, v_loser.birth_date_precision),
    death_date = coalesce(v_winner.death_date, v_loser.death_date),
    death_date_precision = coalesce(v_winner.death_date_precision, v_loser.death_date_precision),
    birth_place = coalesce(v_winner.birth_place, v_loser.birth_place),
    burial_place = coalesce(v_winner.burial_place, v_loser.burial_place),
    bio = coalesce(v_winner.bio, v_loser.bio),
    courtesy_name = coalesce(v_winner.courtesy_name, v_loser.courtesy_name),
    nickname = coalesce(v_winner.nickname, v_loser.nickname),
    posthumous_name = coalesce(v_winner.posthumous_name, v_loser.posthumous_name),
    photo_path = coalesce(v_winner.photo_path, v_loser.photo_path),
    birth_lunar_year = coalesce(v_winner.birth_lunar_year, v_loser.birth_lunar_year),
    birth_lunar_month = coalesce(v_winner.birth_lunar_month, v_loser.birth_lunar_month),
    birth_lunar_day = coalesce(v_winner.birth_lunar_day, v_loser.birth_lunar_day),
    death_lunar_year = coalesce(v_winner.death_lunar_year, v_loser.death_lunar_year),
    death_lunar_month = coalesce(v_winner.death_lunar_month, v_loser.death_lunar_month),
    death_lunar_day = coalesce(v_winner.death_lunar_day, v_loser.death_lunar_day),
    death_anniv_lunar_month = coalesce(v_winner.death_anniv_lunar_month, v_loser.death_anniv_lunar_month),
    death_anniv_lunar_day = coalesce(v_winner.death_anniv_lunar_day, v_loser.death_anniv_lunar_day),
    branch_id = coalesce(v_winner.branch_id, v_loser.branch_id),
    birth_family_id = coalesce(v_winner.birth_family_id, v_loser.birth_family_id),
    is_root = v_winner.is_root or v_loser.is_root
  where id = p_winner;

  -- 2) Re-point family spouse pointers. If a family has the loser as
  --    husband and the winner as wife (or vice versa), the UPDATE
  --    would put winner on both sides — soft-delete those degenerate
  --    families instead.
  delete from public.families
    where (husband_id = p_loser and wife_id = p_winner)
       or (husband_id = p_winner and wife_id = p_loser);

  update public.families set husband_id = p_winner where husband_id = p_loser;
  get diagnostics v_families_updated = row_count;
  update public.families set wife_id = p_winner where wife_id = p_loser;
  v_families_updated := v_families_updated + (case when found then 1 else 0 end);

  -- 3) Children whose birth_family_id pointed to a family that hosted
  --    the loser will already follow because the family row was
  --    re-pointed in step 2. Nothing extra needed here.

  -- 4) Re-point subscriptions. If a user had a sub targeting both
  --    persons (rare), drop the loser one to satisfy the partial
  --    unique index.
  delete from public.event_subscriptions
    where scope = 'person'
      and target_id = p_loser
      and exists (
        select 1 from public.event_subscriptions w
        where w.user_id = event_subscriptions.user_id
          and w.scope = 'person'
          and w.target_id = p_winner
      );
  update public.event_subscriptions
    set target_id = p_winner
    where scope = 'person' and target_id = p_loser;
  get diagnostics v_subs_updated = row_count;

  -- 5) Re-point custom events
  update public.events set related_person_id = p_winner
    where related_person_id = p_loser;
  get diagnostics v_events_updated = row_count;

  -- 6) Soft-delete loser via BEFORE-DELETE trigger
  delete from public.persons where id = p_loser;

  return jsonb_build_object(
    'winner', p_winner,
    'loser', p_loser,
    'familiesUpdated', v_families_updated,
    'subsUpdated', v_subs_updated,
    'eventsUpdated', v_events_updated,
    'childrenUpdated', v_children_updated
  );
end;
$$;

revoke all on function public.merge_persons(uuid, uuid) from public;
grant execute on function public.merge_persons(uuid, uuid) to authenticated;
