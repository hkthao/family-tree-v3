-- Make admin_wipe_clan_directory a TRUE hard delete + fast.
--
-- Two problems with the first version:
--   1. persons/families have a BEFORE DELETE soft-delete trigger, so
--      `delete` only set deleted_at — rows stayed (contradicting the
--      "không khôi phục được" warning, and re-import piled up hidden
--      rows).
--   2. The per-row generation + person_count triggers fire for every
--      deleted row → O(n²), blowing the timeout on big clans.
--
-- Fix: disable the soft-delete, generation, person_count and audit
-- triggers for the wipe, hard-delete, then reset person_count and bump
-- data_version manually. Trigger toggles are transaction-local.

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

    set local statement_timeout = 0;

    alter table public.persons  disable trigger persons_soft_delete_trg;
    alter table public.families disable trigger families_soft_delete_trg;
    alter table public.persons  disable trigger persons_recompute_generation_trg;
    alter table public.persons  disable trigger persons_recompute_generation_update_trg;
    alter table public.families disable trigger families_recompute_generation_trg;
    alter table public.families disable trigger families_recompute_generation_update_trg;
    alter table public.persons  disable trigger persons_bump_person_count_trg;
    alter table public.persons  disable trigger persons_audit_trg;
    alter table public.families disable trigger families_audit_trg;

    -- person_links ON DELETE CASCADE; families↔persons FKs SET NULL
    -- (deferred). Delete families first, then persons.
    delete from public.families where clan_id = p_clan_id;
    delete from public.persons where clan_id = p_clan_id;

    set constraints all immediate;

    alter table public.persons  enable trigger persons_soft_delete_trg;
    alter table public.families enable trigger families_soft_delete_trg;
    alter table public.persons  enable trigger persons_recompute_generation_trg;
    alter table public.persons  enable trigger persons_recompute_generation_update_trg;
    alter table public.families enable trigger families_recompute_generation_trg;
    alter table public.families enable trigger families_recompute_generation_update_trg;
    alter table public.persons  enable trigger persons_bump_person_count_trg;
    alter table public.persons  enable trigger persons_audit_trg;
    alter table public.families enable trigger families_audit_trg;

    update public.clans
       set person_count = 0,
           data_version = data_version + 1
     where id = p_clan_id;

    return jsonb_build_object(
      'clan_id', p_clan_id,
      'deleted_persons', n_persons,
      'deleted_families', n_families
    );
  end;
  $$;

revoke all on function public.admin_wipe_clan_directory(uuid) from public, anon;
grant execute on function public.admin_wipe_clan_directory(uuid) to authenticated;
