-- Public-discovery mode (Section 28.11.A): admin A picks clan B +
-- person B directly when B is on the platform. The pending row has
-- both sides set; admin B sees it in their /inlaws list.
--
-- To render the row, admin B needs clan_a + person_a basic info — but
-- RLS on `clans` (private clan) and `persons` blocks them. This
-- SECURITY DEFINER RPC does a single guarded read-through.
--
-- Mirrors resolve_link_token's projection, but keyed by link_id and
-- accepts both pending and confirmed rows (so peeking from /inlaws
-- list works during the brief moment between confirm-click and
-- realtime refresh).

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
  select * into l from public.person_links where id = p_link_id;
  if not found then
    raise exception 'link not found';
  end if;

  -- Caller must be a member of either side.
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

revoke all on function public.get_inlaw_proposal_preview(uuid) from public, anon;
grant execute on function public.get_inlaw_proposal_preview(uuid) to authenticated;
