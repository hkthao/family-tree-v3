-- ============================================================================
-- get_profile_emails: bridge auth.users.email back to a list of profile ids
-- without exposing the auth schema to clients.
--
-- Plan §6 says profiles deliberately doesn't store `email` (so it can't drift
-- from auth.users when the user changes their address). The /admin page
-- still needs to display emails next to display_name, so we expose a narrow
-- RPC that returns rows only when the caller is either a platform admin OR
-- shares a clan with each target user (so a clan admin can see emails of
-- their own clan_members for invite UX later).
-- ============================================================================

create or replace function public.get_profile_emails(user_ids uuid[])
  returns table (id uuid, email text)
  language plpgsql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    caller uuid := auth.uid();
  begin
    if caller is null then
      return;
    end if;

    if public.is_platform_admin() then
      return query
        select u.id, u.email::text
        from auth.users u
        where u.id = any(user_ids);
    else
      -- Limit to users who share at least one clan with the caller.
      return query
        select u.id, u.email::text
        from auth.users u
        where u.id = any(user_ids)
          and exists (
            select 1
            from public.clan_members m_self
            join public.clan_members m_other
              on m_self.clan_id = m_other.clan_id
            where m_self.user_id = caller
              and m_other.user_id = u.id
          );
    end if;
  end;
  $$;

revoke execute on function public.get_profile_emails(uuid[]) from public;
grant execute on function public.get_profile_emails(uuid[]) to authenticated;
