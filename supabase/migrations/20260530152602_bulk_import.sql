-- ============================================================================
-- bulk_import_persons: insert a fully-resolved batch in one transaction.
--
-- Plan §14. The Excel import flow normalises the spreadsheet on the
-- client (UUIDs, parent resolution, family deduplication) and passes a
-- pre-shaped payload here. This function only needs to:
--   1. authorise the caller (must be admin/editor of target_clan)
--   2. enforce max_persons cumulatively (the per-row trigger does it row
--      by row, which would let a 50-row import that pushes over the cap
--      partially succeed — we want all-or-nothing)
--   3. defer FK constraints so persons + families can land in any order
--      (persons.birth_family_id ↔ families.husband_id/wife_id are mutually
--      referential)
--   4. insert branches → families → persons
--   5. return a summary
-- ============================================================================

create or replace function public.bulk_import_persons(
  target_clan uuid,
  payload jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    caller uuid := auth.uid();
    persons_arr jsonb := coalesce(payload->'persons', '[]'::jsonb);
    families_arr jsonb := coalesce(payload->'families', '[]'::jsonb);
    branches_arr jsonb := coalesce(payload->'branches', '[]'::jsonb);
    persons_to_add int := jsonb_array_length(persons_arr);
    current_count int;
    clan_limit int;
  begin
    if caller is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if not public.can_edit_clan(target_clan) then
      raise exception 'Not allowed to edit this clan' using errcode = '42501';
    end if;

    -- max_persons gate (cumulative). One advisory lock keeps concurrent
    -- imports from racing past the limit.
    perform pg_advisory_xact_lock(
      hashtext('max_persons:' || target_clan::text)::bigint
    );
    select count(*) into current_count
    from public.persons
    where clan_id = target_clan and deleted_at is null;
    select max_persons into clan_limit
    from public.clans where id = target_clan;
    if current_count + persons_to_add > coalesce(clan_limit, 500) then
      raise exception
        'Import would exceed max_persons (% existing + % new > %)',
        current_count, persons_to_add, clan_limit
        using errcode = 'check_violation';
    end if;

    -- Defer FK so persons + families can land in any order. The two FK
    -- columns persons.birth_family_id and families.husband_id/wife_id are
    -- already DEFERRABLE INITIALLY DEFERRED by core_schema; setting them
    -- here is belt-and-braces.
    set constraints all deferred;

    -- 1. Branches (each has its UUID assigned client-side so persons can
    --    already reference it by id).
    insert into public.branches(id, clan_id, name)
    select
      (b->>'id')::uuid,
      target_clan,
      b->>'name'
    from jsonb_array_elements(branches_arr) as b
    on conflict (id) do nothing;

    -- 2. Families (husband_id / wife_id reference persons that may not
    --    yet exist — deferred FK).
    insert into public.families(id, clan_id, husband_id, wife_id, union_type)
    select
      (f->>'id')::uuid,
      target_clan,
      nullif(f->>'husband_id', '')::uuid,
      nullif(f->>'wife_id', '')::uuid,
      coalesce(f->>'union_type', 'marriage')
    from jsonb_array_elements(families_arr) as f;

    -- 3. Persons. The single statement keeps the row trigger from firing
    --    per-row in a way that drives MVCC bloat; the enforce_max_persons
    --    row trigger still runs but we've already gated capacity above.
    insert into public.persons(
      id, clan_id, full_name, gender, is_living, is_root,
      birth_date, birth_date_precision,
      death_date, death_date_precision,
      branch_id, birth_family_id, bio
    )
    select
      (p->>'id')::uuid,
      target_clan,
      p->>'full_name',
      p->>'gender',
      coalesce((p->>'is_living')::boolean, true),
      coalesce((p->>'is_root')::boolean, false),
      nullif(p->>'birth_date', '')::date,
      nullif(p->>'birth_date_precision', ''),
      nullif(p->>'death_date', '')::date,
      nullif(p->>'death_date_precision', ''),
      nullif(p->>'branch_id', '')::uuid,
      nullif(p->>'birth_family_id', '')::uuid,
      nullif(p->>'bio', '')
    from jsonb_array_elements(persons_arr) as p;

    return jsonb_build_object(
      'imported_branches', jsonb_array_length(branches_arr),
      'imported_families', jsonb_array_length(families_arr),
      'imported_persons', persons_to_add
    );
  end;
  $$;

revoke execute on function public.bulk_import_persons(uuid, jsonb) from public;
grant execute on function public.bulk_import_persons(uuid, jsonb) to authenticated;
