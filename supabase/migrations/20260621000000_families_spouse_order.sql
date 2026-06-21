-- families.spouse_order — explicit ranking of a person's spouses
-- ("vợ cả / vợ hai / vợ ba").
--
-- A person with multiple marriages (đa thê / tái hôn) has one
-- `families` row per spouse. Until now those rows had no ordering, so
-- PersonDetail and the tree showed spouses in whatever order Postgres
-- returned them (effectively creation order, and unstable). Vietnamese
-- genealogy cares about which wife is the cả / hai / ba, so we add an
-- explicit rank.
--
-- Convention:
--   - 1 = vợ/chồng cả, 2 = vợ hai, …
--   - NULL = "chưa xếp" → consumers fall back to created_at asc.
--   - The rank is on the marriage (family) row, so it reads the same
--     from either partner's side; in practice it's set from the
--     husband's PersonDetail when he has several wives.
--   - No uniqueness constraint — lets users fix ranks in pieces.

alter table public.families
  add column if not exists spouse_order int
    check (spouse_order is null or spouse_order > 0);

-- Recreate families_public_safe to expose spouse_order + created_at so
-- the public share / tree can order spouses identically to the
-- authenticated app. (Same column set as before, plus the two new
-- ordering fields.)
create or replace view public.families_public_safe
  with (security_invoker = false) as
  select
    f.id,
    f.clan_id,
    f.husband_id,
    f.wife_id,
    f.union_type,
    f.spouse_order,
    f.created_at
  from public.families f
  where f.deleted_at is null
    and exists (
      select 1 from public.clans c
      where c.id = f.clan_id
        and (
          c.visibility = 'public'
          or public.is_clan_member(c.id)
          or public.is_platform_admin()
        )
    );

revoke all on public.families_public_safe from public;
revoke all on public.families_public_safe from anon;
grant select on public.families_public_safe to authenticated;

-- Refresh get_inlaw_peer_relatives so the cross-clan family card sorts
-- spouses by the new rank (matches the local-side ordering).

create or replace function public.get_inlaw_peer_relatives(
  p_link_id uuid,
  p_viewing_clan_id uuid default null
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    l record;
    peer_clan uuid;
    peer_person uuid;
    c record;
    peer_row public.persons;
    hide_living boolean;
    caller_is_peer_member boolean;
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

    if p_viewing_clan_id is not null then
      if p_viewing_clan_id = l.clan_a_id then
        peer_clan := l.clan_b_id;
        peer_person := l.person_b_id;
      elsif p_viewing_clan_id = l.clan_b_id then
        peer_clan := l.clan_a_id;
        peer_person := l.person_a_id;
      else
        raise exception 'viewing_clan does not match this link';
      end if;
    elsif coalesce(public.is_clan_member(l.clan_a_id), false) then
      peer_clan := l.clan_b_id;
      peer_person := l.person_b_id;
    elsif coalesce(public.is_clan_member(l.clan_b_id), false) then
      peer_clan := l.clan_a_id;
      peer_person := l.person_a_id;
    else
      raise exception 'not authorized';
    end if;

    if not (
      coalesce(public.is_clan_member(l.clan_a_id), false)
      or coalesce(public.is_clan_member(l.clan_b_id), false)
    ) then
      raise exception 'not authorized';
    end if;

    select * into c from public.clans where id = peer_clan;
    caller_is_peer_member := coalesce(
      public.is_clan_member(peer_clan), false);
    hide_living := c.hide_living_for_nonmembers and not caller_is_peer_member;

    select * into peer_row from public.persons
      where id = peer_person and clan_id = peer_clan and deleted_at is null;
    if peer_row.id is null then
      raise exception 'peer person no longer available';
    end if;

    peer_card := public._inlaw_person_card(peer_row, hide_living);
    peer_card := peer_card || jsonb_build_object('caller_can_visit', caller_is_peer_member);

    -- Parents
    select coalesce(jsonb_agg(
      public._inlaw_person_card(p, hide_living)
    ), '[]'::jsonb) into parents
    from public.persons p
    join public.families f on f.id = peer_row.birth_family_id
      and f.deleted_at is null
    where (p.id = f.husband_id or p.id = f.wife_id)
      and p.clan_id = peer_clan
      and p.deleted_at is null;

    -- Spouses — ordered by spouse_order (vợ cả/hai/ba) then created_at,
    -- matching the local-side ordering.
    select coalesce(jsonb_agg(
      public._inlaw_person_card(sp, hide_living)
      order by sf.spouse_order nulls last, sf.created_at
    ), '[]'::jsonb) into spouses
    from public.persons sp
    join public.families sf on
      (sf.husband_id = peer_row.id or sf.wife_id = peer_row.id)
      and sf.deleted_at is null
    where sp.clan_id = peer_clan
      and sp.deleted_at is null
      and sp.id <> peer_row.id
      and (sp.id = sf.husband_id or sp.id = sf.wife_id);

    -- Children + other_parent_id, ordered by birth_order first then
    -- birth_date — matches the local-side sort exactly.
    select coalesce(
      jsonb_agg(
        public._inlaw_person_card(ch, hide_living)
          || jsonb_build_object(
            'other_parent_id',
            case
              when chf.husband_id = peer_row.id and exists (
                select 1 from public.persons op
                 where op.id = chf.wife_id and op.deleted_at is null
              ) then chf.wife_id
              when chf.wife_id = peer_row.id and exists (
                select 1 from public.persons op
                 where op.id = chf.husband_id and op.deleted_at is null
              ) then chf.husband_id
              else null
            end
          )
        order by ch.birth_order nulls last,
                 ch.birth_date nulls last,
                 ch.full_name
      ),
      '[]'::jsonb
    ) into children
    from public.persons ch
    join public.families chf on chf.id = ch.birth_family_id
      and chf.deleted_at is null
    where ch.clan_id = peer_clan
      and ch.deleted_at is null
      and (chf.husband_id = peer_row.id or chf.wife_id = peer_row.id);

    return jsonb_build_object(
      'link_id', p_link_id,
      'peer_clan_id', peer_clan,
      'peer_clan_name', c.name,
      'peer_clan_generation_offset', c.generation_offset,
      'peer', peer_card,
      'parents', parents,
      'spouses', spouses,
      'children', children
    );
  end;
  $$;
