-- ============================================================================
-- restore_audit_entry: apply the inverse of an audit_log row.
--
-- Soft-delete model (plan §7): rows in persons/families/branches stay in
-- place when "deleted" — only `deleted_at` is set. Restoring is therefore
-- almost always a single UPDATE; we never need to re-INSERT.
--
-- Inverse table:
--   action='insert' → set deleted_at = now() (undo the insert)
--   action='delete' → set deleted_at = null  (resurrect the row)
--   action='update' → write the `before` jsonb back column-by-column
--
-- Caller must be an editor of the clan that owns the entry.
-- ============================================================================

create or replace function public.restore_audit_entry(audit_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    e public.audit_log%rowtype;
  begin
    select * into e from public.audit_log where id = audit_id;
    if not found then
      raise exception 'Audit entry not found' using errcode = 'P0002';
    end if;
    if not public.can_edit_clan(e.clan_id) then
      raise exception 'Not allowed to restore in this clan'
        using errcode = '42501';
    end if;

    -- persons -----------------------------------------------------------
    if e.entity_type = 'person' then
      if e.action = 'delete' then
        update public.persons
           set deleted_at = null
         where id = e.entity_id and clan_id = e.clan_id;
      elsif e.action = 'insert' then
        update public.persons
           set deleted_at = now()
         where id = e.entity_id and clan_id = e.clan_id;
      elsif e.action = 'update' and e.before is not null then
        update public.persons set
          full_name              = e.before->>'full_name',
          gender                 = e.before->>'gender',
          is_living              = (e.before->>'is_living')::boolean,
          is_root                = (e.before->>'is_root')::boolean,
          birth_date             = nullif(e.before->>'birth_date','')::date,
          birth_date_precision   = nullif(e.before->>'birth_date_precision',''),
          death_date             = nullif(e.before->>'death_date','')::date,
          death_date_precision   = nullif(e.before->>'death_date_precision',''),
          birth_place            = e.before->>'birth_place',
          burial_place           = e.before->>'burial_place',
          bio                    = e.before->>'bio',
          courtesy_name          = e.before->>'courtesy_name',
          posthumous_name        = e.before->>'posthumous_name',
          nickname               = e.before->>'nickname',
          branch_id              = nullif(e.before->>'branch_id','')::uuid,
          birth_family_id        = nullif(e.before->>'birth_family_id','')::uuid
        where id = e.entity_id and clan_id = e.clan_id;
      end if;

    -- families ----------------------------------------------------------
    elsif e.entity_type = 'family' then
      if e.action = 'delete' then
        update public.families
           set deleted_at = null
         where id = e.entity_id and clan_id = e.clan_id;
      elsif e.action = 'insert' then
        update public.families
           set deleted_at = now()
         where id = e.entity_id and clan_id = e.clan_id;
      elsif e.action = 'update' and e.before is not null then
        update public.families set
          husband_id = nullif(e.before->>'husband_id','')::uuid,
          wife_id    = nullif(e.before->>'wife_id','')::uuid,
          union_type = e.before->>'union_type',
          notes      = e.before->>'notes'
        where id = e.entity_id and clan_id = e.clan_id;
      end if;

    -- branches ----------------------------------------------------------
    elsif e.entity_type = 'branch' then
      if e.action = 'delete' then
        update public.branches
           set deleted_at = null
         where id = e.entity_id and clan_id = e.clan_id;
      elsif e.action = 'insert' then
        update public.branches
           set deleted_at = now()
         where id = e.entity_id and clan_id = e.clan_id;
      elsif e.action = 'update' and e.before is not null then
        update public.branches set
          name            = e.before->>'name',
          ancestral_house = e.before->>'ancestral_house',
          notes           = e.before->>'notes'
        where id = e.entity_id and clan_id = e.clan_id;
      end if;

    else
      raise exception 'Unknown entity_type: %', e.entity_type;
    end if;
  end;
  $$;

revoke execute on function public.restore_audit_entry(uuid) from public;
grant execute on function public.restore_audit_entry(uuid) to authenticated;
