-- Let non-members of a public clan read its events.
--
-- The existing `events_member_select` RLS policy only matched
-- is_clan_member or is_platform_admin, so a visitor browsing a
-- public clan saw nothing on /events (and zero anniversaries on the
-- dashboard "Lịch sự kiện" panel) — even though the spec was always
-- "public clans are read-only public surfaces, including events".
--
-- We replace the policy with a broader one that also matches when
-- the clan's visibility is 'public'. Editor / admin write policies
-- on the same table are untouched (still gated by can_edit_clan).
-- Private clans behave identically to before.

drop policy if exists "events_member_select" on public.events;

create policy "events_select"
  on public.events for select
  using (
    public.is_clan_member(clan_id)
    or public.is_platform_admin()
    or exists (
      select 1 from public.clans c
      where c.id = clan_id
        and c.visibility = 'public'
    )
  );
