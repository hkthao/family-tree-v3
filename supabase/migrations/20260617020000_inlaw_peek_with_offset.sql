-- Đính kèm peer_clan_generation_offset vào response của get_link_peek
-- và get_inlaw_peer_relatives. Khi user xem peer person (cross-clan)
-- và peer clan đó set "Thủy tổ là Đời 0", FE biết để render đúng.
--
-- Backward compatible: chỉ ADD field vào jsonb response. RPC signature
-- không đổi.

create or replace function public.get_link_peek(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l person_links;
  other_clan uuid;
  other_person uuid;
  rec persons;
  c clans;
begin
  select * into l from public.person_links
   where id = p_link_id and status = 'confirmed';
  if not found then
    raise exception 'link not found or not confirmed';
  end if;

  if public.is_clan_member(l.clan_a_id) then
    other_clan := l.clan_b_id;
    other_person := l.person_b_id;
  elsif public.is_clan_member(l.clan_b_id) then
    other_clan := l.clan_a_id;
    other_person := l.person_a_id;
  else
    raise exception 'not authorized';
  end if;

  select * into rec from public.persons
    where id = other_person and clan_id = other_clan;
  if rec.id is null or rec.deleted_at is not null then
    raise exception 'peer person no longer available';
  end if;

  select * into c from public.clans where id = other_clan;

  if rec.is_living
     and c.hide_living_for_nonmembers
     and not public.is_clan_member(other_clan)
  then
    return jsonb_build_object(
      'masked', true,
      'clan_id', other_clan,
      'clan_name', c.name,
      'generation_offset', c.generation_offset,
      'person_id', other_person,
      'is_living', true
    );
  end if;

  return jsonb_build_object(
    'masked', false,
    'clan_id', other_clan,
    'clan_name', c.name,
    'generation_offset', c.generation_offset,
    'person_id', other_person,
    'full_name', rec.full_name,
    'gender', rec.gender,
    'generation', rec.generation,
    'birth_year', extract(year from rec.birth_date)::int,
    'death_year', extract(year from rec.death_date)::int,
    'is_living', rec.is_living
  );
end;
$$;

-- Mini-family — same idea, gắn peer_clan_generation_offset vào top
-- level. _inlaw_person_card giữ nguyên (chỉ trả raw generation theo
-- person; FE trừ offset của peer_clan_generation_offset khi render).
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
    'peer_clan_generation_offset', c.generation_offset,
    'peer', peer_card,
    'parents', parents,
    'spouses', spouses,
    'children', children
  );
end;
$$;
