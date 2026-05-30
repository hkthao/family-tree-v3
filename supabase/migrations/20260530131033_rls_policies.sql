-- ============================================================================
-- RLS policies, helper functions, public-safe view, storage policies
-- ============================================================================
-- All security perimeters live here. Frontend cannot be trusted — RLS is
-- the only real authorization layer.
-- ============================================================================

-- Helper functions ----------------------------------------------------------
-- SECURITY DEFINER so they can read profiles.is_suspended without RLS
-- recursion. STABLE because they query DB but no side effects.
-- Every helper returns false / null when the caller is suspended.

create or replace function public.is_caller_suspended()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select coalesce(
      (select is_suspended from public.profiles where id = auth.uid()),
      false
    )
  $$;

create or replace function public.is_platform_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select case
      when public.is_caller_suspended() then false
      else coalesce(
        (select is_platform_admin from public.profiles where id = auth.uid()),
        false
      )
    end
  $$;

create or replace function public.clan_role(target_clan uuid)
  returns text
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$
    select case
      when public.is_caller_suspended() then null
      else (
        select role
        from public.clan_members
        where clan_id = target_clan and user_id = auth.uid()
        limit 1
      )
    end
  $$;

create or replace function public.is_clan_member(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$ select public.clan_role(target_clan) is not null $$;

create or replace function public.can_edit_clan(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$ select public.clan_role(target_clan) in ('admin', 'editor') $$;

create or replace function public.is_clan_admin(target_clan uuid)
  returns boolean
  language sql
  stable
  security definer
  set search_path = public, pg_temp
  as $$ select public.clan_role(target_clan) = 'admin' $$;

-- Grant execute on helpers to authenticated (anon must NOT call them since
-- they reveal clan membership existence).
revoke all on function public.is_caller_suspended() from public, anon;
revoke all on function public.is_platform_admin() from public, anon;
revoke all on function public.clan_role(uuid) from public, anon;
revoke all on function public.is_clan_member(uuid) from public, anon;
revoke all on function public.can_edit_clan(uuid) from public, anon;
revoke all on function public.is_clan_admin(uuid) from public, anon;
grant execute on function public.is_caller_suspended() to authenticated;
grant execute on function public.is_platform_admin() to authenticated;
grant execute on function public.clan_role(uuid) to authenticated;
grant execute on function public.is_clan_member(uuid) to authenticated;
grant execute on function public.can_edit_clan(uuid) to authenticated;
grant execute on function public.is_clan_admin(uuid) to authenticated;

-- Enable RLS ----------------------------------------------------------------

alter table public.profiles            enable row level security;
alter table public.clans               enable row level security;
alter table public.clan_members        enable row level security;
alter table public.branches            enable row level security;
alter table public.families            enable row level security;
alter table public.persons             enable row level security;
alter table public.share_links         enable row level security;
alter table public.audit_log           enable row level security;
alter table public.events              enable row level security;
alter table public.event_subscriptions enable row level security;
alter table public.notification_log    enable row level security;

-- Revoke from anon (chưa-đăng-nhập). Khách share-link đi qua Edge Function
-- với service role, không bao giờ hit bảng trực tiếp.
revoke all on public.profiles, public.clans, public.clan_members,
              public.branches, public.families, public.persons,
              public.share_links, public.audit_log, public.events,
              public.event_subscriptions, public.notification_log
       from anon;

-- profiles ------------------------------------------------------------------
-- A user can read their own profile, or all profiles if platform admin.
-- (Co-member names go through a dedicated RPC; we do NOT open SELECT broadly.)
create policy "profiles_self_select"
  on public.profiles for select
  using (id = auth.uid() or public.is_platform_admin());

-- A user can update their own profile (privileged cols protected by trigger).
-- Platform admin can update any profile.
create policy "profiles_self_update"
  on public.profiles for update
  using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

-- Inserts to profiles only happen via handle_new_user trigger (next migration),
-- which runs as table owner — no client policy needed.

-- clans ---------------------------------------------------------------------
create policy "clans_member_or_public_select"
  on public.clans for select
  using (
    public.is_clan_member(id)
    or owner_id = auth.uid()
    or visibility = 'public'
    or public.is_platform_admin()
  );

create policy "clans_insert_authenticated"
  on public.clans for insert
  with check (auth.uid() is not null and owner_id = auth.uid());

-- UPDATE: clan admin can change normal cols. Platform admin can change anything
-- including limits. Privileged columns (max_persons/users, owner_id) are
-- protected by trigger from non-platform admins.
create policy "clans_admin_update"
  on public.clans for update
  using (public.is_clan_admin(id) or public.is_platform_admin())
  with check (public.is_clan_admin(id) or public.is_platform_admin());

create policy "clans_admin_delete"
  on public.clans for delete
  using (public.is_clan_admin(id) or public.is_platform_admin());

-- clan_members --------------------------------------------------------------
create policy "clan_members_member_select"
  on public.clan_members for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

create policy "clan_members_admin_insert"
  on public.clan_members for insert
  with check (public.is_clan_admin(clan_id) or public.is_platform_admin());

create policy "clan_members_admin_update"
  on public.clan_members for update
  using (public.is_clan_admin(clan_id) or public.is_platform_admin())
  with check (public.is_clan_admin(clan_id) or public.is_platform_admin());

create policy "clan_members_admin_delete"
  on public.clan_members for delete
  using (public.is_clan_admin(clan_id) or public.is_platform_admin());

-- persons / families / branches --------------------------------------------
-- Members see everything. Non-members on public clans use the
-- persons_public_safe view (below) for masked data.

create policy "persons_select"
  on public.persons for select
  using (
    public.is_clan_member(clan_id)
    or public.is_platform_admin()
  );

create policy "persons_editor_insert"
  on public.persons for insert
  with check (public.can_edit_clan(clan_id));

create policy "persons_editor_update"
  on public.persons for update
  using (public.can_edit_clan(clan_id))
  with check (public.can_edit_clan(clan_id));

create policy "persons_editor_delete"
  on public.persons for delete
  using (public.can_edit_clan(clan_id));

create policy "families_select"
  on public.families for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

create policy "families_editor_insert"
  on public.families for insert
  with check (public.can_edit_clan(clan_id));

create policy "families_editor_update"
  on public.families for update
  using (public.can_edit_clan(clan_id))
  with check (public.can_edit_clan(clan_id));

create policy "families_editor_delete"
  on public.families for delete
  using (public.can_edit_clan(clan_id));

create policy "branches_select"
  on public.branches for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

create policy "branches_editor_insert"
  on public.branches for insert
  with check (public.can_edit_clan(clan_id));

create policy "branches_editor_update"
  on public.branches for update
  using (public.can_edit_clan(clan_id))
  with check (public.can_edit_clan(clan_id));

create policy "branches_editor_delete"
  on public.branches for delete
  using (public.can_edit_clan(clan_id));

-- share_links ---------------------------------------------------------------
-- Only clan admin manages share_links. The actual share-view (anonymous
-- viewer) goes through Edge Function with service role; no client read.
create policy "share_links_admin_all"
  on public.share_links for all
  using (public.is_clan_admin(clan_id) or public.is_platform_admin())
  with check (public.is_clan_admin(clan_id) or public.is_platform_admin());

-- audit_log -----------------------------------------------------------------
-- Members can read audit log for their clan. Inserts only via trigger
-- (table owner) — no client policy.
create policy "audit_log_member_select"
  on public.audit_log for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

-- events --------------------------------------------------------------------
create policy "events_member_select"
  on public.events for select
  using (public.is_clan_member(clan_id) or public.is_platform_admin());

create policy "events_editor_insert"
  on public.events for insert
  with check (public.can_edit_clan(clan_id));

create policy "events_editor_update"
  on public.events for update
  using (public.can_edit_clan(clan_id))
  with check (public.can_edit_clan(clan_id));

create policy "events_editor_delete"
  on public.events for delete
  using (public.can_edit_clan(clan_id));

-- event_subscriptions -------------------------------------------------------
-- Only the user themselves manages their own subscriptions, and only for
-- clans they're a member of.
create policy "event_subs_self_select"
  on public.event_subscriptions for select
  using (user_id = auth.uid());

create policy "event_subs_self_insert"
  on public.event_subscriptions for insert
  with check (
    user_id = auth.uid() and public.is_clan_member(clan_id)
  );

create policy "event_subs_self_update"
  on public.event_subscriptions for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_clan_member(clan_id));

create policy "event_subs_self_delete"
  on public.event_subscriptions for delete
  using (user_id = auth.uid());

-- notification_log ----------------------------------------------------------
-- User can read their own log. Writes happen via service role from the
-- scheduled cron Edge Function — no client policy.
create policy "notification_log_self_select"
  on public.notification_log for select
  using (user_id = auth.uid());

-- View: persons_public_safe -------------------------------------------------
-- For non-members viewing a public clan: masks sensitive columns when the
-- person is still living. Implemented as a view (not a SECURITY DEFINER RPC)
-- so RLS on the underlying persons table still applies — defense in depth.
--
-- A public clan's persons rows are visible to authenticated users via the
-- "persons_select" policy ONLY for members. For non-members we need a
-- separate path: this view re-checks visibility and masks columns.
create or replace view public.persons_public_safe
  with (security_invoker = true) as
  select
    p.id,
    p.clan_id,
    p.full_name,
    p.gender,
    p.generation,
    p.branch_id,
    p.is_living,
    p.is_root,
    -- Mask sensitive columns when living
    case when p.is_living then null else p.birth_date end as birth_date,
    case when p.is_living then null else p.death_date end as death_date,
    case when p.is_living then null else p.birth_place end as birth_place,
    case when p.is_living then null else p.burial_place end as burial_place,
    case when p.is_living then null else p.photo_path end as photo_path,
    case when p.is_living then null else p.bio end as bio,
    case when p.is_living then null else p.courtesy_name end as courtesy_name,
    case when p.is_living then null else p.posthumous_name end as posthumous_name,
    case when p.is_living then null else p.nickname end as nickname
  from public.persons p
  where p.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = p.clan_id
        and (
          c.visibility = 'public'
          or public.is_clan_member(c.id)
          or public.is_platform_admin()
        )
    );

grant select on public.persons_public_safe to authenticated;
revoke all on public.persons_public_safe from anon;

-- Storage policies ---------------------------------------------------------
-- Bucket: person-photos. Path: {clan_id}/{person_id}.<ext>
-- foldername(name)[1] = clan_id segment.

create policy "person_photos_member_select"
  on storage.objects for select
  using (
    bucket_id = 'person-photos'
    and public.is_clan_member(
      ((storage.foldername(name))[1])::uuid
    )
  );

create policy "person_photos_editor_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'person-photos'
    and public.can_edit_clan(
      ((storage.foldername(name))[1])::uuid
    )
  );

create policy "person_photos_editor_update"
  on storage.objects for update
  using (
    bucket_id = 'person-photos'
    and public.can_edit_clan(
      ((storage.foldername(name))[1])::uuid
    )
  );

create policy "person_photos_editor_delete"
  on storage.objects for delete
  using (
    bucket_id = 'person-photos'
    and public.can_edit_clan(
      ((storage.foldername(name))[1])::uuid
    )
  );
