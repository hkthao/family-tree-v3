-- Đính kèm peer_clan_generation_offset vào response của get_link_peek
-- và get_inlaw_peer_relatives. Khi user xem peer person (cross-clan)
-- và peer clan đó set "Thủy tổ là Đời 0", FE biết để render đúng.
--
-- Lưu ý signature: get_inlaw_peer_relatives đã thành 2-arg (p_link_id,
-- p_viewing_clan_id default null) từ migration 20260608010000. Phải
-- giữ đúng 2-arg để PostgREST không gặp overload-ambiguous error
-- (PGRST203) khi caller gọi với 1 arg.
--
-- Backward compatible: chỉ ADD field vào jsonb response. RPC signature
-- không đổi.

create or replace function public.get_link_peek(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
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
-- level. Giữ nguyên signature 2-arg + logic peer detection từ
-- migration 20260608030000_persons_birth_order, chỉ thêm field
-- generation_offset vào response.
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

    -- Spouses
    select coalesce(jsonb_agg(
      public._inlaw_person_card(sp, hide_living)
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
