-- ============================================================================
-- Member management helpers
-- ============================================================================
-- Two SECURITY DEFINER RPCs that let clan admins manage membership:
--
-- - get_clan_members_info: joins clan_members + profiles so the UI can show
--   member display names without opening a wide SELECT on profiles to peer
--   users. Caller must be a member of the clan.
--
-- - invite_member_by_email: looks up auth.users by email (a table the client
--   cannot read directly), then inserts a clan_members row with role + inviter.
--   Caller must be a clan admin. Returns a small jsonb result instead of
--   raising so the UI can render typed errors ("user_not_found", "already_member").
-- ============================================================================

create or replace function public.get_clan_members_info(target_clan uuid)
  returns table (
    user_id uuid,
    role text,
    display_name text,
    invited_by uuid,
    created_at timestamptz
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select cm.user_id, cm.role, p.display_name, cm.invited_by, cm.created_at
    from public.clan_members cm
    join public.profiles p on p.id = cm.user_id
    where cm.clan_id = target_clan
      and public.is_clan_member(target_clan)
    order by cm.created_at asc
  $$;

revoke all on function public.get_clan_members_info(uuid) from public, anon;
grant execute on function public.get_clan_members_info(uuid) to authenticated;

create or replace function public.invite_member_by_email(
  target_clan uuid,
  target_email text,
  member_role text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    target_user uuid;
    inviter uuid := auth.uid();
  begin
    if not public.is_clan_admin(target_clan) then
      raise exception 'Only clan admins can invite members'
        using errcode = 'insufficient_privilege';
    end if;
    if member_role not in ('admin', 'editor', 'viewer') then
      raise exception 'Invalid role: %', member_role;
    end if;

    select id into target_user
    from auth.users
    where lower(email) = lower(trim(target_email))
    limit 1;

    if target_user is null then
      return jsonb_build_object('ok', false, 'error', 'user_not_found');
    end if;

    begin
      insert into public.clan_members(clan_id, user_id, role, invited_by)
      values (target_clan, target_user, member_role, inviter);
    exception
      when unique_violation then
        return jsonb_build_object('ok', false, 'error', 'already_member');
      -- enforce_max_users fires here; bubble its message up
    end;

    return jsonb_build_object(
      'ok', true,
      'user_id', target_user,
      'role', member_role
    );
  end;
  $$;

revoke all on function public.invite_member_by_email(uuid, text, text) from public, anon;
grant execute on function public.invite_member_by_email(uuid, text, text) to authenticated;
