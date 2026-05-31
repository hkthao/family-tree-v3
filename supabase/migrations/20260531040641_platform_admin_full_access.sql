-- ============================================================================
-- Platform admin: full access to every clan's data.
--
-- The original is_clan_member / can_edit_clan / is_clan_admin helpers only
-- consulted clan_members — so a platform admin who wasn't explicitly
-- added to a clan couldn't INSERT/UPDATE/DELETE persons/families/branches
-- there. SELECT was already covered case-by-case in the policies.
--
-- This migration treats is_platform_admin as a superset of every clan
-- role. With the helpers updated, every policy that uses them (and there
-- are many: persons, families, branches, share_links, clan_members) now
-- transparently grants the platform admin full access.
--
-- Suspension still wins: clan_role returns null when is_caller_suspended
-- is true, but is_platform_admin() also returns false in that case (the
-- profile flag is independent of suspension — both must be checked).
-- Updated below as well.
-- ============================================================================

-- is_platform_admin honours suspension so a locked-out account can't bypass
-- helpers even if profiles.is_platform_admin is still true.
create or replace function public.is_platform_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select coalesce(
      (select is_platform_admin and not is_suspended
         from public.profiles
        where id = auth.uid()),
      false
    );
  $$;

-- "Are they a member of this clan, OR a platform admin?" — used by every
-- SELECT policy on clan-scoped data.
create or replace function public.is_clan_member(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select public.is_platform_admin()
        or public.clan_role(target_clan) is not null;
  $$;

-- "Can they edit?" — used by every INSERT/UPDATE/DELETE policy on persons,
-- families, branches. Platform admin gets editor-equivalent power.
create or replace function public.can_edit_clan(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select public.is_platform_admin()
        or public.clan_role(target_clan) in ('admin', 'editor');
  $$;

-- "Are they clan admin?" — used by clan_members management, share-link
-- CRUD, settings-page guards.
create or replace function public.is_clan_admin(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select public.is_platform_admin()
        or public.clan_role(target_clan) = 'admin';
  $$;

-- Loosen clans_insert so a platform admin can create a clan on behalf of
-- someone else (for support flows, demo content, restoring after a delete).
-- Non-admin users must still set owner_id to themselves.
drop policy if exists "clans_insert_authenticated" on public.clans;
create policy "clans_insert_authenticated"
  on public.clans for insert
  with check (
    auth.uid() is not null
    and (owner_id = auth.uid() or public.is_platform_admin())
  );
