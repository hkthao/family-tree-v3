-- Cross-clan in-law links (Section 28 of plan.md).
--
-- Each clan keeps its own local copy of the dâu/rể as a normal person
-- record. The `person_links` table is an annotation layer on top: "this
-- local person X in clan A is the same human as person Y in clan B".
-- It is NEVER used as a structural FK in trees or families — the
-- single rule that drives this design.
--
-- See plan.md §28 for the rationale.

------------------------------------------------------------------------
-- 1. Composite uniqueness so person_links FKs can prove clan ownership
------------------------------------------------------------------------
alter table public.persons
  add constraint persons_id_clan_uniq unique (id, clan_id);

------------------------------------------------------------------------
-- 2. Table
------------------------------------------------------------------------
create table public.person_links (
  id            uuid primary key default gen_random_uuid(),
  link_type     text not null default 'same_person'
                  check (link_type in ('same_person')),
  status        text not null default 'pending'
                  check (status in ('pending', 'confirmed', 'revoked')),

  -- Side A — proposer
  clan_a_id     uuid not null,
  person_a_id   uuid not null,

  -- Side B — filled at confirm time (token mode), or at insert (direct
  -- mode, future).
  clan_b_id     uuid,
  person_b_id   uuid,

  -- One-time token admin A shares out-of-band so admin B can resolve
  -- without admin A needing to know clan_b_id up front. Cleared after
  -- confirm or revoke.
  invite_token  text unique,

  -- Free-text hint admin A leaves for admin B so B knows which of
  -- their persons to pick.
  person_b_name_hint text,
  note          text,

  created_by    uuid not null references auth.users(id),
  confirmed_by  uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  revoked_at    timestamptz,

  -- Person must belong to its declared clan — composite FK against
  -- persons_id_clan_uniq. cascade-delete: when a person row is hard
  -- deleted (clan delete cascade), all their links go too.
  foreign key (person_a_id, clan_a_id) references public.persons(id, clan_id)
    on delete cascade,
  foreign key (person_b_id, clan_b_id) references public.persons(id, clan_id)
    on delete cascade,

  -- A confirmed link must have both sides.
  check (
    status <> 'confirmed'
    or (clan_b_id is not null and person_b_id is not null and confirmed_at is not null)
  ),
  -- A pending link must have either an invite_token (token mode) or B
  -- side set (direct mode, used by future public-discovery flow).
  check (
    status <> 'pending'
    or invite_token is not null
    or (clan_b_id is not null and person_b_id is not null)
  ),
  -- Different clans / different persons.
  check (clan_b_id is null or clan_a_id <> clan_b_id),
  check (person_b_id is null or person_a_id <> person_b_id)
);

-- Symmetric uniqueness: same (a, b) pair never has two active links,
-- regardless of which side proposed.
create unique index person_links_pair_uniq
  on public.person_links (
    least(person_a_id, person_b_id),
    greatest(person_a_id, person_b_id)
  )
  where status <> 'revoked' and person_b_id is not null;

create index person_links_a_idx on public.person_links (clan_a_id, person_a_id);
create index person_links_b_idx on public.person_links (clan_b_id, person_b_id)
  where clan_b_id is not null;
create index person_links_token_idx on public.person_links (invite_token)
  where invite_token is not null;

------------------------------------------------------------------------
-- 3. RLS — admin both sides see + edit metadata, but bulk persons of
--    the other clan stay behind RLS. Cross-clan peek goes through
--    get_link_peek (security definer) only.
------------------------------------------------------------------------
alter table public.person_links enable row level security;

-- SELECT: members of either side see the link row metadata.
create policy plinks_select on public.person_links for select
  using (
    public.is_clan_member(clan_a_id)
    or (clan_b_id is not null and public.is_clan_member(clan_b_id))
    or public.is_platform_admin()
  );

-- INSERT: only admin A may propose. Must start pending. created_by is
-- pinned to auth.uid().
create policy plinks_insert on public.person_links for insert
  with check (
    public.is_clan_admin(clan_a_id)
    and status = 'pending'
    and created_by = auth.uid()
  );

-- UPDATE: admin of either side, but the transition rules below
-- (trigger) keep them from cheating. Direct UPDATE through PostgREST is
-- only used for revoke + B-side fill via confirm RPC.
create policy plinks_update on public.person_links for update
  using (
    public.is_clan_admin(clan_a_id)
    or (clan_b_id is not null and public.is_clan_admin(clan_b_id))
    or public.is_platform_admin()
  )
  with check (
    public.is_clan_admin(clan_a_id)
    or (clan_b_id is not null and public.is_clan_admin(clan_b_id))
    or public.is_platform_admin()
  );

-- DELETE: only admin A may hard-delete a still-pending row. Confirmed
-- rows transition to status='revoked' (audit trail) rather than vanish.
create policy plinks_delete on public.person_links for delete
  using (
    status = 'pending'
    and public.is_clan_admin(clan_a_id)
  );

------------------------------------------------------------------------
-- 4. Transition trigger — locks down what each side may change.
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

  -- Cannot rollback from confirmed/revoked to pending.
  if old.status in ('confirmed', 'revoked') and new.status = 'pending' then
    raise exception 'cannot move person_link back to pending';
  end if;

  -- pending -> confirmed: B side must now be set, caller must be admin
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
    new.invite_token := null; -- one-time use
  end if;

  -- -> revoked: admin of either side.
  if new.status = 'revoked' and old.status <> 'revoked' then
    if not (
      public.is_clan_admin(new.clan_a_id)
      or (new.clan_b_id is not null and public.is_clan_admin(new.clan_b_id))
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

create trigger person_links_protect_transitions
  before update on public.person_links
  for each row execute function public.protect_person_link_transitions();

------------------------------------------------------------------------
-- 5. get_link_peek — single read-through path for "show the person on
--    the other side." Returns minimal projection, applies hide_living.
------------------------------------------------------------------------
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

  -- Caller must be a member of one of the two sides.
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

  -- Apply hide_living of the target clan to non-members.
  if rec.is_living
     and c.hide_living_for_nonmembers
     and not public.is_clan_member(other_clan)
  then
    return jsonb_build_object(
      'masked', true,
      'clan_id', other_clan,
      'clan_name', c.name,
      'person_id', other_person,
      'is_living', true
    );
  end if;

  return jsonb_build_object(
    'masked', false,
    'clan_id', other_clan,
    'clan_name', c.name,
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

revoke all on function public.get_link_peek(uuid) from public, anon;
grant execute on function public.get_link_peek(uuid) to authenticated;

------------------------------------------------------------------------
-- 6. resolve_link_token — public preview of a pending invite by token.
--    Used by the /inlaws/confirm/:token page before the user logs in.
--    Never exposes raw clan_a_id beyond the name string.
------------------------------------------------------------------------
create or replace function public.resolve_link_token(p_token text)
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
  select * into l from public.person_links
    where invite_token = p_token and status = 'pending';
  if not found then
    raise exception 'invalid or expired token';
  end if;

  select * into ca from public.clans where id = l.clan_a_id;
  select * into pa from public.persons where id = l.person_a_id and deleted_at is null;
  if pa.id is null then
    raise exception 'proposer person no longer available';
  end if;

  return jsonb_build_object(
    'link_id', l.id,
    'clan_a_name', ca.name,
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

revoke all on function public.resolve_link_token(text) from public;
grant execute on function public.resolve_link_token(text) to anon, authenticated;

------------------------------------------------------------------------
-- 7. confirm_link_by_token — authoritative finalize step.
--    Caller must be admin of p_clan_b. p_person_b must belong to it.
--    Token must still be pending. Atomic.
------------------------------------------------------------------------
create or replace function public.confirm_link_by_token(
  p_token text,
  p_clan_b uuid,
  p_person_b uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  l person_links;
begin
  if auth.uid() is null then
    raise exception 'must be logged in to confirm';
  end if;
  if not public.is_clan_admin(p_clan_b) then
    raise exception 'only clan admin may confirm a link';
  end if;

  if not exists (
    select 1 from public.persons
     where id = p_person_b and clan_id = p_clan_b and deleted_at is null
  ) then
    raise exception 'person does not belong to clan';
  end if;

  select * into l from public.person_links
    where invite_token = p_token and status = 'pending'
    for update;
  if not found then
    raise exception 'invalid or already-used token';
  end if;

  if l.clan_a_id = p_clan_b then
    raise exception 'cannot link a clan to itself';
  end if;

  -- Same uniqueness rule the partial index enforces — give a friendlier
  -- error before we hit the index.
  if exists (
    select 1 from public.person_links
     where status <> 'revoked'
       and person_b_id is not null
       and least(person_a_id, person_b_id) = least(l.person_a_id, p_person_b)
       and greatest(person_a_id, person_b_id) = greatest(l.person_a_id, p_person_b)
       and id <> l.id
  ) then
    raise exception 'these two persons are already linked';
  end if;

  update public.person_links
     set clan_b_id   = p_clan_b,
         person_b_id = p_person_b,
         status      = 'confirmed'
   where id = l.id;

  return l.id;
end;
$$;

revoke all on function public.confirm_link_by_token(text, uuid, uuid) from public, anon;
grant execute on function public.confirm_link_by_token(text, uuid, uuid) to authenticated;

------------------------------------------------------------------------
-- 8. Realtime support — let clients react to new pending links.
------------------------------------------------------------------------
alter publication supabase_realtime add table public.person_links;
