-- Annotate each child returned by get_inlaw_peer_relatives with the
-- OTHER parent's id, so InlawMiniTree can anchor children to the
-- correct (peer, spouse) pair instead of flattening them all under
-- the first-listed spouse.
--
-- Pre-change: children was [card, card, ...] with each card from
--   _inlaw_person_card (id, gender, full_name, ...).
-- Post-change: children is [card || {other_parent_id}, ...].
--   other_parent_id is null when the child has only the peer recorded
--   as a parent (single-parent family unit).

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

  -- Children — same as before, but also surface other_parent_id so
  -- the mini-tree can attribute each child to (peer, correct_spouse)
  -- rather than the previous (peer, first_spouse) compromise.
  select coalesce(
    jsonb_agg(
      public._inlaw_person_card(ch, hide_living)
        || jsonb_build_object(
          'other_parent_id',
          case
            when f.husband_id = peer_row.id then f.wife_id
            when f.wife_id   = peer_row.id then f.husband_id
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
