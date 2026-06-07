-- Fix get_inlaw_peer_relatives for dual-clan callers.
--
-- Previously: the function picked "peer side" by testing
-- is_clan_member(clan_a_id) FIRST. For a caller who's a member of
-- BOTH clans (typical for platform admins, or a user who owns both
-- dòng họ), that test always passes for clan_a → peer is always
-- clan_b regardless of which tree the user is actually viewing.
--
-- Concrete repro: user on Họ Huỳnh tree, link is (clan_a=Huỳnh,
-- clan_b=Trần). Caller-is-member(Huỳnh)=true → peer=Trần. OK.
-- BUT for the sibling link (clan_a=Trần, clan_b=Huỳnh) the user
-- ALSO sees from Họ Huỳnh, yet the RPC returned peer=Huỳnh (wrong
-- side) — the dialog showed the LOCAL family instead of the peer.
--
-- Fix: take an optional `p_viewing_clan_id`. When provided, peer =
-- the OTHER side from that clan deterministically. When null, fall
-- back to the legacy is_clan_member heuristic.

drop function if exists public.get_inlaw_peer_relatives(uuid);

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

    -- Caller side / peer side — prefer the explicit viewing clan
    -- when the client passes one. That removes the ambiguity for
    -- users who happen to be members of both clans.
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

    -- Caller must be a member of at least one side regardless of
    -- which side they declared they're viewing from.
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

    -- Children + other_parent_id. The other_parent lookup checks the
    -- referenced person isn't soft-deleted — otherwise we'd surface a
    -- tombstoned spouse's UUID even though the parallel `spouses`
    -- block hides them.
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
        order by ch.birth_date nulls last, ch.full_name
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
      'peer', peer_card,
      'parents', parents,
      'spouses', spouses,
      'children', children
    );
  end;
  $$;

revoke all on function public.get_inlaw_peer_relatives(uuid, uuid)
  from public, anon;
grant execute on function public.get_inlaw_peer_relatives(uuid, uuid)
  to authenticated;
