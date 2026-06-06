-- Phase 3 inlaws: browse extended family across clans.
--
-- get_inlaw_peer_relatives(link_id) returns the peer person plus their
-- direct relatives (parents, spouses, children) — a one-hop "mini
-- family" view that lets users explore the other side of an in-law
-- link without leaving their own clan's tree.
--
-- Same access model as get_link_peek:
--   - Caller must be a member of either side of the link.
--   - Living relatives are masked when the target clan hides living
--     info AND the caller isn't a member of that clan.

-- Compact card used for parents / spouses / children list entries.
-- Hides identifying fields when the row is living + hide_living applies.
create or replace function public._inlaw_person_card(
  p public.persons, hide_living boolean
)
returns jsonb
language sql
stable
as $$
  select case
    when p.is_living and hide_living then
      jsonb_build_object(
        'id', p.id,
        'clan_id', p.clan_id,
        'masked', true,
        'is_living', true,
        'gender', p.gender
      )
    else
      jsonb_build_object(
        'id', p.id,
        'clan_id', p.clan_id,
        'masked', false,
        'is_living', p.is_living,
        'gender', p.gender,
        'full_name', p.full_name,
        'generation', p.generation,
        'birth_year', extract(year from p.birth_date)::int,
        'death_year', extract(year from p.death_date)::int
      )
  end;
$$;

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

  -- Caller side / peer side
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

  -- Peer person — the focal of the mini-family card.
  select * into peer_row from public.persons
    where id = peer_person and clan_id = peer_clan and deleted_at is null;
  if peer_row.id is null then
    raise exception 'peer person no longer available';
  end if;

  peer_card := public._inlaw_person_card(peer_row, hide_living);
  -- Annotate the focal with caller_can_visit so the UI knows whether
  -- a deep-link to the peer clan's person page would actually load.
  peer_card := peer_card || jsonb_build_object('caller_can_visit', caller_is_peer_member);

  -- Parents — both spots in the birth family
  if peer_row.birth_family_id is not null then
    select coalesce(
      jsonb_agg(
        public._inlaw_person_card(p, hide_living)
        order by p.gender desc -- father before mother
      ),
      '[]'::jsonb
    ) into parents
    from public.persons p
    join public.families f on f.id = peer_row.birth_family_id
    where (p.id = f.husband_id or p.id = f.wife_id)
      and p.clan_id = peer_clan
      and p.deleted_at is null;
  end if;

  -- Spouses — every family the peer is a parent in, the OTHER parent
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

  -- Children — every child whose birth_family includes the peer
  select coalesce(
    jsonb_agg(
      public._inlaw_person_card(ch, hide_living)
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

revoke all on function public.get_inlaw_peer_relatives(uuid) from public, anon;
grant execute on function public.get_inlaw_peer_relatives(uuid) to authenticated;
