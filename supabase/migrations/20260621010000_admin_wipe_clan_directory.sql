-- admin_wipe_clan_directory — hard-delete every person + family of a
-- clan so a botched import can be redone from scratch.
--
-- ⚠️  Platform-admin only. DESTRUCTIVE + irreversible: rows are hard
--     deleted (not soft deleted), so the audit-log restore flow can't
--     bring them back. The clan itself, its members and settings stay.
--
-- Safe because the persons↔families FKs are ON DELETE SET NULL and
-- person_links is ON DELETE CASCADE, so deleting persons then families
-- leaves no dangling references.

create or replace function public.admin_wipe_clan_directory(p_clan_id uuid)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    n_persons int;
    n_families int;
  begin
    if not coalesce(public.is_platform_admin(), false) then
      raise exception 'not authorized';
    end if;

    select count(*) into n_persons from public.persons where clan_id = p_clan_id;
    select count(*) into n_families from public.families where clan_id = p_clan_id;

    -- persons first: families.husband_id/wife_id → SET NULL, and
    -- person_links cascade-delete. Then drop the now-empty families.
    delete from public.persons where clan_id = p_clan_id;
    delete from public.families where clan_id = p_clan_id;

    return jsonb_build_object(
      'clan_id', p_clan_id,
      'deleted_persons', n_persons,
      'deleted_families', n_families
    );
  end;
  $$;

revoke all on function public.admin_wipe_clan_directory(uuid) from public, anon;
grant execute on function public.admin_wipe_clan_directory(uuid) to authenticated;
