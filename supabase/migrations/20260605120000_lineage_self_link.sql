-- ============================================================================
-- "Đường trực hệ" — link a user account to the person that represents
-- them in the family tree, so the "Từ tôi về thuỷ tổ" lineage page
-- knows where to start walking up the tree.
-- ============================================================================
-- - Two columns on clan_members:
--     self_person_id        — the persons.id this member claims as "me"
--     self_person_verified  — admin flag; the lineage page works for
--                             the claimant immediately, but verified
--                             gates features like contribution
--                             attribution and public lineage shares.
--
-- - set_my_self_person(p_clan_id, p_person_id) RPC: members call this
--   to claim or clear their self-link. SECURITY DEFINER so it can
--   sidestep the admin-only UPDATE policy on clan_members; the
--   function itself enforces (a) caller is a member of the clan,
--   (b) the target person belongs to that clan, (c) no other member
--   has already claimed the same person. Setting back to false the
--   verified flag prevents an unverified re-claim from inheriting a
--   stale ✓.
--
-- - get_clan_members_info extended with self_person_id / verified /
--   full_name so the Members admin UI can show pending claims for
--   approval without an extra join from the client.
-- ============================================================================

alter table public.clan_members
  add column self_person_id uuid references public.persons(id) on delete set null,
  add column self_person_verified boolean not null default false;

-- Partial index — most rows have NULL here; only index the claimed ones.
create index clan_members_self_person_idx
  on public.clan_members (self_person_id)
  where self_person_id is not null;

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
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if not exists (
      select 1 from public.clan_members
      where clan_id = p_clan_id and user_id = me
    ) then
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
    update public.clan_members
    set self_person_id = p_person_id,
        self_person_verified = false
    where clan_id = p_clan_id and user_id = me;
  end;
  $$;

revoke all on function public.set_my_self_person(uuid, uuid) from public, anon;
grant execute on function public.set_my_self_person(uuid, uuid) to authenticated;

-- Surface self-link fields through the existing members info RPC so
-- the Members admin UI doesn't have to do a separate join.
-- DROP first because we're changing the return-table signature
-- (adding three columns) and CREATE OR REPLACE rejects that.
drop function if exists public.get_clan_members_info(uuid);

create or replace function public.get_clan_members_info(target_clan uuid)
  returns table (
    user_id uuid,
    role text,
    display_name text,
    invited_by uuid,
    created_at timestamptz,
    self_person_id uuid,
    self_person_verified boolean,
    self_person_full_name text
  )
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select
      cm.user_id,
      cm.role,
      p.display_name,
      cm.invited_by,
      cm.created_at,
      cm.self_person_id,
      cm.self_person_verified,
      sp.full_name as self_person_full_name
    from public.clan_members cm
    join public.profiles p on p.id = cm.user_id
    left join public.persons sp on sp.id = cm.self_person_id
    where cm.clan_id = target_clan
      and public.is_clan_member(target_clan)
    order by cm.created_at asc
  $$;

revoke all on function public.get_clan_members_info(uuid) from public, anon;
grant execute on function public.get_clan_members_info(uuid) to authenticated;
