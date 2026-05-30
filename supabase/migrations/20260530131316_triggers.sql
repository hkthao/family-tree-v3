-- ============================================================================
-- Triggers: limits enforcement, profile protection, audit log, generation,
-- data version, soft delete, unaccent maintenance, handle_new_user.
-- ============================================================================

-- handle_new_user -----------------------------------------------------------
-- When a row appears in auth.users, create a matching profiles row so app
-- has somewhere to hang display_name / is_platform_admin / limits.

create or replace function public.handle_new_user()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    insert into public.profiles (id, display_name)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'display_name', new.email)
    )
    on conflict (id) do nothing;
    return new;
  end;
  $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- protect_profile_privileged_cols ------------------------------------------
-- Stop users from elevating themselves. max_clans / is_platform_admin /
-- is_suspended are platform-admin-only fields.

create or replace function public.protect_profile_privileged_cols()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    -- Service role / internal calls have no auth.uid() — let them through.
    -- This trigger only guards against authenticated USER actions.
    if auth.uid() is null then
      return new;
    end if;

    if not public.is_platform_admin() then
      if new.max_clans is distinct from old.max_clans then
        raise exception 'Only platform admin can change max_clans';
      end if;
      if new.is_platform_admin is distinct from old.is_platform_admin then
        raise exception 'Only platform admin can grant platform admin';
      end if;
      if new.is_suspended is distinct from old.is_suspended then
        raise exception 'Only platform admin can suspend accounts';
      end if;
    end if;
    return new;
  end;
  $$;

create trigger protect_profile_privileged_cols_trg
  before update on public.profiles
  for each row
  execute function public.protect_profile_privileged_cols();

-- protect_clan_privileged_cols ---------------------------------------------
-- max_persons / max_users / owner_id are platform-admin-only on clans.
-- Clan admin can change name, description, visibility,
-- hide_living_for_nonmembers.

create or replace function public.protect_clan_privileged_cols()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    -- Service role / internal calls bypass (used for setup, admin actions).
    if auth.uid() is null then
      return new;
    end if;

    if not public.is_platform_admin() then
      if new.max_persons is distinct from old.max_persons then
        raise exception 'Only platform admin can change max_persons';
      end if;
      if new.max_users is distinct from old.max_users then
        raise exception 'Only platform admin can change max_users';
      end if;
      if new.owner_id is distinct from old.owner_id then
        raise exception 'Only platform admin can transfer clan ownership';
      end if;
    end if;
    return new;
  end;
  $$;

create trigger protect_clan_privileged_cols_trg
  before update on public.clans
  for each row
  execute function public.protect_clan_privileged_cols();

-- enforce_max_clans / persons / users --------------------------------------
-- All three use pg_advisory_xact_lock to avoid race conditions between
-- concurrent inserts. Lock is transaction-scoped, released at commit.

create or replace function public.enforce_max_clans()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    current_count int;
    user_max int;
  begin
    -- Platform admin can always create
    if public.is_platform_admin() then
      return new;
    end if;

    perform pg_advisory_xact_lock(
      hashtext('max_clans:' || coalesce(new.owner_id::text, ''))::bigint
    );

    select count(*) into current_count
    from public.clans
    where owner_id = new.owner_id;

    select max_clans into user_max
    from public.profiles
    where id = new.owner_id;

    if current_count >= coalesce(user_max, 1) then
      raise exception 'User has reached max_clans limit (%)' , user_max
        using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

create trigger enforce_max_clans_trg
  before insert on public.clans
  for each row
  execute function public.enforce_max_clans();

create or replace function public.enforce_max_persons()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    current_count int;
    clan_limit int;
  begin
    perform pg_advisory_xact_lock(
      hashtext('max_persons:' || new.clan_id::text)::bigint
    );

    select count(*) into current_count
    from public.persons
    where clan_id = new.clan_id and deleted_at is null;

    select max_persons into clan_limit
    from public.clans
    where id = new.clan_id;

    if current_count >= coalesce(clan_limit, 500) then
      raise exception 'Clan has reached max_persons limit (%)', clan_limit
        using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

create trigger enforce_max_persons_trg
  before insert on public.persons
  for each row
  execute function public.enforce_max_persons();

create or replace function public.enforce_max_users()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    current_count int;
    clan_limit int;
  begin
    perform pg_advisory_xact_lock(
      hashtext('max_users:' || new.clan_id::text)::bigint
    );

    select count(*) into current_count
    from public.clan_members
    where clan_id = new.clan_id;

    select max_users into clan_limit
    from public.clans
    where id = new.clan_id;

    if current_count >= coalesce(clan_limit, 3) then
      raise exception 'Clan has reached max_users limit (%)', clan_limit
        using errcode = 'check_violation';
    end if;
    return new;
  end;
  $$;

create trigger enforce_max_users_trg
  before insert on public.clan_members
  for each row
  execute function public.enforce_max_users();

-- auto_add_owner_as_admin --------------------------------------------------
-- When a clan is created, the owner automatically becomes an admin member.
-- Without this, the owner cannot SELECT their own freshly-created clan
-- (RLS SELECT requires is_clan_member), so INSERT ... RETURNING fails even
-- though the row is created.

create or replace function public.auto_add_owner_as_admin()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if NEW.owner_id is not null then
      insert into public.clan_members (clan_id, user_id, role, invited_by)
      values (NEW.id, NEW.owner_id, 'admin', NEW.owner_id)
      on conflict (clan_id, user_id) do nothing;
    end if;
    return NEW;
  end;
  $$;

create trigger auto_add_owner_as_admin_trg
  after insert on public.clans
  for each row
  execute function public.auto_add_owner_as_admin();

-- maintain_unaccent --------------------------------------------------------
-- persons.full_name_unaccent = lowercased unaccented name, for trigram search.

create or replace function public.maintain_unaccent()
  returns trigger
  language plpgsql
  as $$
  begin
    new.full_name_unaccent := lower(public.f_unaccent(new.full_name));
    new.updated_at := now();
    return new;
  end;
  $$;

create trigger persons_maintain_unaccent_trg
  before insert or update of full_name on public.persons
  for each row
  execute function public.maintain_unaccent();

-- Generation recompute ----------------------------------------------------
-- Generation = 1 for is_root persons. Otherwise = min(parent_gen) + 1
-- through birth_family_id → husband_id / wife_id. Done with depth-capped
-- recursive CTE (cap 30). Cycle protection: if a cycle exists, the CTE
-- terminates at the cap rather than looping forever.

create or replace function public.recompute_generation_for_clan(target_clan uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    -- Reset all non-root generations in this clan
    update public.persons
    set generation = case when is_root then 1 else null end
    where clan_id = target_clan;

    -- BFS from roots down through families
    with recursive walk(person_id, gen, depth) as (
      select id, 1, 1
      from public.persons
      where clan_id = target_clan and is_root = true and deleted_at is null

      union all

      select child.id, parent.gen + 1, parent.depth + 1
      from public.persons child
      join public.families f
        on child.birth_family_id = f.id
        and f.deleted_at is null
      join walk parent
        on parent.person_id = f.husband_id
        or parent.person_id = f.wife_id
      where parent.depth < 30
        and child.clan_id = target_clan
        and child.deleted_at is null
        and not child.is_root
    )
    update public.persons
    set generation = best.min_gen
    from (
      select person_id, min(gen) as min_gen
      from walk
      group by person_id
    ) best
    where public.persons.id = best.person_id
      and public.persons.clan_id = target_clan
      and not public.persons.is_root;
  end;
  $$;

create or replace function public.trg_recompute_generation()
  returns trigger
  language plpgsql
  as $$
  begin
    if TG_OP = 'DELETE' then
      perform public.recompute_generation_for_clan(OLD.clan_id);
      return OLD;
    else
      perform public.recompute_generation_for_clan(NEW.clan_id);
      return NEW;
    end if;
  end;
  $$;

-- Fire on persons when is_root / birth_family_id changes.
create trigger persons_recompute_generation_trg
  after insert or delete on public.persons
  for each row
  execute function public.trg_recompute_generation();

create trigger persons_recompute_generation_update_trg
  after update of is_root, birth_family_id on public.persons
  for each row
  execute function public.trg_recompute_generation();

-- Fire on families when husband_id / wife_id changes (cascades to children).
create trigger families_recompute_generation_trg
  after insert or delete on public.families
  for each row
  execute function public.trg_recompute_generation();

create trigger families_recompute_generation_update_trg
  after update of husband_id, wife_id on public.families
  for each row
  execute function public.trg_recompute_generation();

-- Soft delete --------------------------------------------------------------
-- Intercept DELETE on persons/families/branches → set deleted_at instead.
-- Hard delete still happens via CASCADE when the clan is deleted.

create or replace function public.trg_soft_delete()
  returns trigger
  language plpgsql
  as $$
  begin
    execute format(
      'update public.%I set deleted_at = now() where id = $1',
      TG_TABLE_NAME
    ) using OLD.id;
    -- Returning NULL cancels the actual DELETE
    return null;
  end;
  $$;

create trigger persons_soft_delete_trg
  before delete on public.persons
  for each row
  when (OLD.deleted_at is null)
  execute function public.trg_soft_delete();

create trigger families_soft_delete_trg
  before delete on public.families
  for each row
  when (OLD.deleted_at is null)
  execute function public.trg_soft_delete();

create trigger branches_soft_delete_trg
  before delete on public.branches
  for each row
  when (OLD.deleted_at is null)
  execute function public.trg_soft_delete();

-- Audit log ----------------------------------------------------------------
-- Logs every change to persons/families/branches. Soft delete (deleted_at
-- transitioning null → not null) is recorded as action='delete'.

create or replace function public.write_audit_log()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    e_type text;
    is_soft_delete boolean := false;
  begin
    e_type := case TG_TABLE_NAME
      when 'persons'  then 'person'
      when 'families' then 'family'
      when 'branches' then 'branch'
    end;

    if TG_OP = 'INSERT' then
      insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
      values (NEW.clan_id, e_type, NEW.id, 'insert', null, to_jsonb(NEW), auth.uid());
      return NEW;

    elsif TG_OP = 'UPDATE' then
      is_soft_delete :=
        OLD.deleted_at is null and NEW.deleted_at is not null;

      if is_soft_delete then
        insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
        values (OLD.clan_id, e_type, OLD.id, 'delete', to_jsonb(OLD), null, auth.uid());
      else
        insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
        values (NEW.clan_id, e_type, NEW.id, 'update', to_jsonb(OLD), to_jsonb(NEW), auth.uid());
      end if;
      return NEW;

    elsif TG_OP = 'DELETE' then
      -- Hard delete (typically only via CASCADE from clan delete)
      insert into public.audit_log(clan_id, entity_type, entity_id, action, before, after, changed_by)
      values (OLD.clan_id, e_type, OLD.id, 'delete', to_jsonb(OLD), null, auth.uid());
      return OLD;
    end if;
    return null;
  end;
  $$;

create trigger persons_audit_trg
  after insert or update or delete on public.persons
  for each row execute function public.write_audit_log();

create trigger families_audit_trg
  after insert or update or delete on public.families
  for each row execute function public.write_audit_log();

create trigger branches_audit_trg
  after insert or update or delete on public.branches
  for each row execute function public.write_audit_log();

-- bump_data_version --------------------------------------------------------
-- STATEMENT-level trigger: bumps clans.data_version once per statement, not
-- once per row. Avoids 7000 row-level updates on bulk import.

create or replace function public.bump_data_version()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if TG_OP = 'DELETE' then
      update public.clans c
      set data_version = c.data_version + 1
      where c.id in (select distinct clan_id from old_rows);
    elsif TG_OP = 'INSERT' then
      update public.clans c
      set data_version = c.data_version + 1
      where c.id in (select distinct clan_id from new_rows);
    else  -- UPDATE
      update public.clans c
      set data_version = c.data_version + 1
      where c.id in (
        select distinct clan_id from new_rows
        union
        select distinct clan_id from old_rows
      );
    end if;
    return null;
  end;
  $$;

create trigger persons_bump_version_ins
  after insert on public.persons
  referencing new table as new_rows
  for each statement
  execute function public.bump_data_version();

create trigger persons_bump_version_upd
  after update on public.persons
  referencing new table as new_rows old table as old_rows
  for each statement
  execute function public.bump_data_version();

create trigger persons_bump_version_del
  after delete on public.persons
  referencing old table as old_rows
  for each statement
  execute function public.bump_data_version();

create trigger families_bump_version_ins
  after insert on public.families
  referencing new table as new_rows
  for each statement
  execute function public.bump_data_version();

create trigger families_bump_version_upd
  after update on public.families
  referencing new table as new_rows old table as old_rows
  for each statement
  execute function public.bump_data_version();

create trigger families_bump_version_del
  after delete on public.families
  referencing old table as old_rows
  for each statement
  execute function public.bump_data_version();

create trigger branches_bump_version_ins
  after insert on public.branches
  referencing new table as new_rows
  for each statement
  execute function public.bump_data_version();

create trigger branches_bump_version_upd
  after update on public.branches
  referencing new table as new_rows old table as old_rows
  for each statement
  execute function public.bump_data_version();

create trigger branches_bump_version_del
  after delete on public.branches
  referencing old table as old_rows
  for each statement
  execute function public.bump_data_version();
