-- ============================================================================
-- delete_my_account(): user-initiated account deletion.
--
-- Plan §8: blocked if the caller still owns any clan that has non-deleted
-- persons. The user must transfer ownership (or delete the clan) first;
-- otherwise we'd leave orphaned data with owner_id set to NULL by the
-- on-delete-set-null FK rule, which is confusing for the remaining members.
--
-- SECURITY DEFINER so the function can delete from auth.users (the caller
-- otherwise has no privilege there). The function is locked to auth.uid()
-- — there is no path to delete another user. Cascades take care of profiles,
-- clan_members, event_subscriptions, etc.
-- ============================================================================

create or replace function public.delete_my_account()
  returns void
  language plpgsql
  security definer
  set search_path = public, auth, pg_temp
  as $$
  declare
    me uuid := auth.uid();
    blocking_count int;
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;

    -- Refuse if the caller still owns any clan with members.
    select count(*) into blocking_count
    from public.clans c
    where c.owner_id = me
      and exists (
        select 1
        from public.persons p
        where p.clan_id = c.id
          and p.deleted_at is null
      );

    if blocking_count > 0 then
      raise exception
        'Cannot delete account: still own % clan(s) with members. Transfer or delete the clan first.',
        blocking_count
        using errcode = 'check_violation';
    end if;

    -- Transaction-local opt-in so the on-delete-set-null cascade on
    -- clans.owner_id is permitted by protect_clan_privileged_cols. The
    -- third arg (is_local = true) auto-clears the flag at commit/rollback.
    perform set_config('app.allow_owner_clear', 'true', true);

    -- Cascade fans out via FKs to profiles, clan_members,
    -- event_subscriptions, notification_log.
    delete from auth.users where id = me;
  end;
  $$;

revoke execute on function public.delete_my_account() from public;
grant execute on function public.delete_my_account() to authenticated;

-- ============================================================================
-- count_my_blocking_clans(): cheap precheck used by the /account UI to
-- decide whether to enable the "Delete account" button at all. Returns the
-- number of owned clans that still contain members.
-- ============================================================================

create or replace function public.count_my_blocking_clans()
  returns int
  language sql
  stable
  security invoker
  set search_path = public, pg_temp
  as $$
    select count(*)::int
    from public.clans c
    where c.owner_id = auth.uid()
      and exists (
        select 1 from public.persons p
        where p.clan_id = c.id and p.deleted_at is null
      );
  $$;

revoke execute on function public.count_my_blocking_clans() from public;
grant execute on function public.count_my_blocking_clans() to authenticated;

-- ============================================================================
-- protect_clan_privileged_cols: allow owner_id → NULL when an elevated
-- caller (e.g. delete_my_account) sets the transaction-local opt-in flag
-- app.allow_owner_clear. All other owner_id transitions still require
-- platform admin. max_persons / max_users / owner_id→someone-else stay
-- locked down for non-platform-admins.
-- ============================================================================

create or replace function public.protect_clan_privileged_cols()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    allow_owner_clear boolean := false;
  begin
    -- Service role / internal calls bypass entirely.
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
        allow_owner_clear :=
          (current_setting('app.allow_owner_clear', true) = 'true');

        if not (new.owner_id is null and allow_owner_clear) then
          raise exception 'Only platform admin can transfer clan ownership';
        end if;
      end if;
    end if;
    return new;
  end;
  $$;
