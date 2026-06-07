-- Code-review Wave A — security + data-integrity hardening on the
-- cross-clan in-law links feature.
--
-- Three findings addressed here (the fourth — esc() in subject — lives
-- in supabase/functions/notify-inlaw/index.ts and ships separately).
--
-- 1. `protect_person_link_transitions` had no guard for the
--    confirmed → confirmed UPDATE path, leaving clan_b_id /
--    person_b_id / confirmed_by / confirmed_at mutable on an already-
--    confirmed link. Clan A admin could quietly rebind the link to a
--    different person on clan B without clan B's consent, audit
--    trail capturing it after the fact. Freeze those fields once
--    status = 'confirmed'.
--
-- 2. The revoke branch authorized against `new.clan_b_id`, which
--    pairs with #1 to let an attacker swap clan_b_id to a clan they
--    admin and then "revoke" — the auth check evaluates against the
--    substitute. Switch to `old.*` for the revoke admin check so the
--    consent gate stays tied to the original peer.
--
-- 3. `get_inlaw_proposal_preview` accepted ANY status, so a revoked
--    link still leaked the proposer's name / gender / birth-death
--    years to a previous member of either side. Filter to active
--    statuses (pending + confirmed) — matches what get_link_peek
--    and resolve_link_token already do.
--
-- 4. `get_inlaw_peer_relatives` returned the OTHER parent's UUID
--    even when that parent was soft-deleted, leaking the existence
--    of a tombstoned row that the sibling `spouses` query
--    intentionally hid. Null out `other_parent_id` when the
--    referenced person is soft-deleted.

------------------------------------------------------------------------
-- Fix #1 + #2 — transition trigger: freeze B side after confirm,
-- use old.clan_b_id for revoke auth.
------------------------------------------------------------------------
create or replace function public.protect_person_link_transitions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Immutable across all updates.
  if old.clan_a_id is distinct from new.clan_a_id
     or old.person_a_id is distinct from new.person_a_id
     or old.created_by is distinct from new.created_by
     or old.link_type is distinct from new.link_type
     or old.created_at is distinct from new.created_at
  then
    raise exception 'cannot change immutable fields of person_link';
  end if;

  -- After confirm, the B side and the confirmation attribution are
  -- frozen. Re-binding without cycling through pending → confirmed
  -- again would bypass clan B's admin consent gate.
  if old.status = 'confirmed' then
    if old.clan_b_id is distinct from new.clan_b_id
       or old.person_b_id is distinct from new.person_b_id
       or old.confirmed_by is distinct from new.confirmed_by
       or old.confirmed_at is distinct from new.confirmed_at
    then
      raise exception
        'cannot change clan_b/person_b or confirmation attribution on a confirmed link';
    end if;
  end if;

  -- Cannot rollback from confirmed/revoked to pending.
  if old.status in ('confirmed', 'revoked') and new.status = 'pending' then
    raise exception 'cannot move person_link back to pending';
  end if;

  -- pending → confirmed: B side must now be set, caller must be admin
  -- of clan_b. Stamp confirmed_by/at.
  if old.status = 'pending' and new.status = 'confirmed' then
    if new.clan_b_id is null or new.person_b_id is null then
      raise exception 'confirmed link must have B side set';
    end if;
    if not public.is_clan_admin(new.clan_b_id) then
      raise exception 'only clan B admin can confirm a link';
    end if;
    new.confirmed_by := auth.uid();
    new.confirmed_at := now();
    new.invite_token := null;
  end if;

  -- → revoked: admin of either side. Authorize against OLD's clan_b
  -- so a paired "swap clan_b then revoke" attack can't be authorized
  -- against a substitute clan the attacker happens to admin.
  if new.status = 'revoked' and old.status <> 'revoked' then
    if not (
      public.is_clan_admin(old.clan_a_id)
      or (old.clan_b_id is not null and public.is_clan_admin(old.clan_b_id))
      or public.is_platform_admin()
    ) then
      raise exception 'only admin of either side can revoke';
    end if;
    new.revoked_at := now();
    new.invite_token := null;
  end if;

  return new;
end;
$$;

------------------------------------------------------------------------
-- Fix #3 — get_inlaw_proposal_preview filters out revoked rows.
------------------------------------------------------------------------
create or replace function public.get_inlaw_proposal_preview(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l person_links;
  ca clans;
  pa persons;
begin
  -- Revoked links keep a row for audit but are no longer active —
  -- their preview should look the same as a deleted row.
  select * into l from public.person_links
   where id = p_link_id and status in ('pending', 'confirmed');
  if not found then
    raise exception 'link not found';
  end if;

  if not (
    public.is_clan_member(l.clan_a_id)
    or (l.clan_b_id is not null and public.is_clan_member(l.clan_b_id))
    or public.is_platform_admin()
  ) then
    raise exception 'not authorized';
  end if;

  select * into ca from public.clans where id = l.clan_a_id;
  select * into pa from public.persons
    where id = l.person_a_id and deleted_at is null;
  if pa.id is null then
    raise exception 'proposer person no longer available';
  end if;

  return jsonb_build_object(
    'link_id', l.id,
    'status', l.status,
    'clan_a_id', l.clan_a_id,
    'clan_a_name', ca.name,
    'person_a_id', l.person_a_id,
    'person_a_name', pa.full_name,
    'person_a_gender', pa.gender,
    'person_a_birth_year', extract(year from pa.birth_date)::int,
    'person_a_death_year', extract(year from pa.death_date)::int,
    'person_b_name_hint', l.person_b_name_hint,
    'note', l.note,
    'created_at', l.created_at
  );
end;
$$;

------------------------------------------------------------------------
-- Fix #4 — get_inlaw_peer_relatives masks other_parent_id when the
-- referenced parent is soft-deleted. (The spouses sibling query
-- already filters `deleted_at is null`; this brings children-side
-- consistency.)
------------------------------------------------------------------------
create or replace function public.get_inlaw_peer_relatives(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l person_links;
  peer_clan uuid;
  peer_person uuid;
  c clans;
  caller_is_peer_member boolean;
  hide_living boolean;
  peer_row public.persons;
  peer_card jsonb;

  parents jsonb := '[]';
  spouses jsonb := '[]';
  children jsonb := '[]';
begin
  select * into l from public.person_links
   where id = p_link_id and status = 'confirmed';
  if not found then
    raise exception 'link not found or not confirmed';
  end if;

  if public.is_clan_member(l.clan_a_id) then
    peer_clan := l.clan_b_id;
    peer_person := l.person_b_id;
  elsif public.is_clan_member(l.clan_b_id) then
    peer_clan := l.clan_a_id;
    peer_person := l.person_a_id;
  else
    raise exception 'not authorized';
  end if;

  select * into c from public.clans where id = peer_clan;
  caller_is_peer_member := public.is_clan_member(peer_clan);
  hide_living := c.hide_living_for_nonmembers and not caller_is_peer_member;

  select * into peer_row from public.persons
    where id = peer_person and clan_id = peer_clan and deleted_at is null;
  if peer_row.id is null then
    raise exception 'peer person no longer available';
  end if;

  peer_card := public._inlaw_person_card(peer_row, hide_living);
  peer_card := peer_card || jsonb_build_object('caller_can_visit', caller_is_peer_member);

  if peer_row.birth_family_id is not null then
    select coalesce(
      jsonb_agg(
        public._inlaw_person_card(p, hide_living)
        order by p.gender desc
      ),
      '[]'::jsonb
    ) into parents
    from public.persons p
    join public.families f on f.id = peer_row.birth_family_id
    where (p.id = f.husband_id or p.id = f.wife_id)
      and p.clan_id = peer_clan
      and p.deleted_at is null;
  end if;

  select coalesce(
    jsonb_agg(public._inlaw_person_card(sp, hide_living)),
    '[]'::jsonb
  ) into spouses
  from public.persons sp
  where sp.clan_id = peer_clan
    and sp.id <> peer_row.id
    and sp.deleted_at is null
    and exists (
      select 1 from public.families f
       where (f.husband_id = peer_row.id or f.wife_id = peer_row.id)
         and (f.husband_id = sp.id or f.wife_id = sp.id)
    );

  -- Children + other_parent_id. The other_parent lookup now also
  -- checks the referenced person isn't soft-deleted — otherwise we'd
  -- surface a tombstoned spouse's UUID even though the parallel
  -- `spouses` block hides them.
  select coalesce(
    jsonb_agg(
      public._inlaw_person_card(ch, hide_living)
        || jsonb_build_object(
          'other_parent_id',
          case
            when f.husband_id = peer_row.id and exists (
              select 1 from public.persons op
               where op.id = f.wife_id and op.deleted_at is null
            ) then f.wife_id
            when f.wife_id = peer_row.id and exists (
              select 1 from public.persons op
               where op.id = f.husband_id and op.deleted_at is null
            ) then f.husband_id
            else null
          end
        )
      order by ch.birth_date nulls last, ch.full_name
    ),
    '[]'::jsonb
  ) into children
  from public.persons ch
  join public.families f on f.id = ch.birth_family_id
  where ch.clan_id = peer_clan
    and ch.deleted_at is null
    and (f.husband_id = peer_row.id or f.wife_id = peer_row.id);

  return jsonb_build_object(
    'link_id', l.id,
    'peer_clan_id', peer_clan,
    'peer_clan_name', c.name,
    'peer', peer_card,
    'parents', parents,
    'spouses', spouses,
    'children', children
  );
end;
$$;
