-- ============================================================================
-- Platform admin can also claim a self_person without first being added
-- as a clan_member. The original migration required membership, which
-- is the right rule for regular users but locks out the platform owner
-- who never joins clans explicitly — every RLS check in the system has
-- an "or is_platform_admin()" escape hatch, this one was missing.
--
-- When the caller is a platform admin and has no clan_members row for
-- the target clan, we INSERT a viewer row alongside the self_person_id
-- so the data lands somewhere persistent. A platform admin still sees
-- everything via the policy override, the viewer role just gives the
-- self-claim a place to live in the existing schema.
-- ============================================================================

create or replace function public.set_my_self_person(
  p_clan_id uuid,
  p_person_id uuid
)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    me uuid := auth.uid();
    is_member boolean;
    is_admin boolean;
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    is_member := exists (
      select 1 from public.clan_members
      where clan_id = p_clan_id and user_id = me
    );
    is_admin := public.is_platform_admin();
    if not (is_member or is_admin) then
      raise exception 'Bạn không phải thành viên dòng họ này'
        using errcode = '42501';
    end if;
    if p_person_id is not null then
      if not exists (
        select 1 from public.persons
        where id = p_person_id
          and clan_id = p_clan_id
          and deleted_at is null
      ) then
        raise exception 'Không tìm thấy người này trong dòng họ'
          using errcode = '22023';
      end if;
      if exists (
        select 1 from public.clan_members
        where clan_id = p_clan_id
          and self_person_id = p_person_id
          and user_id <> me
      ) then
        raise exception 'Người này đã có thành viên khác chọn'
          using errcode = '23505';
      end if;
    end if;
    if is_member then
      update public.clan_members
      set self_person_id = p_person_id,
          self_person_verified = false
      where clan_id = p_clan_id and user_id = me;
    else
      -- Platform admin claiming on a clan they don't belong to —
      -- create a viewer row to anchor the self-link. The platform
      -- admin already had full access via RLS overrides; the role
      -- here is just a schema requirement, not a permission grant.
      insert into public.clan_members(
        clan_id, user_id, role, self_person_id, self_person_verified
      )
      values (p_clan_id, me, 'viewer', p_person_id, false);
    end if;
  end;
  $$;
