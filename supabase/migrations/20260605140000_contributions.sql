-- ============================================================================
-- "Đóng góp có duyệt" — crowdsourced edits with admin review.
--
-- Workflow:
--   1. Anyone (member or guest via share link) submits a proposed edit
--      or new person via INSERT into public.contributions.
--   2. Admin / editor reviews via the /clans/:id/contributions page,
--      approves or rejects. Approving calls apply_contribution(id)
--      which mutates the target row(s) and writes an audit_log entry.
--
-- Schema notes:
--   - person_id is nullable: NULL when contribution_type='add_person'
--     (the new person doesn't exist yet) or after the target person
--     was soft-deleted (FK uses on delete set null so we keep history).
--   - proposed_data is jsonb to stay flexible across contribution types.
--     The shape depends on the type — validation lives in apply_*.
--   - submitter_user_id is null for guest submissions; one of
--     (submitter_user_id, submitter_name) must be set so we can always
--     attribute the proposal.
--   - submitter_ip is recorded for guest submissions so we can rate-
--     limit at the edge function layer.
--
-- RLS:
--   - INSERT (RLS-checked): authenticated clan members. Guests go
--     through the submit-contribution Edge Function with the service
--     role; the function enforces share-link validity + rate limits.
--   - SELECT: clan editors+admins see everything; submitters see
--     their own past submissions (for the future "My contributions"
--     page on /account).
--   - UPDATE / DELETE: clan admin only (editor cannot review).
-- ============================================================================

create table public.contributions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,

  -- Target person — null when adding a brand-new person.
  person_id uuid references public.persons(id) on delete set null,

  contribution_type text not null check (
    contribution_type in ('edit_person', 'add_note', 'add_person')
  ),
  proposed_data jsonb not null,

  -- Submitter identity
  submitter_user_id uuid references public.profiles(id) on delete set null,
  submitter_name text,
  submitter_contact text,
  submitter_relation text,
  submitter_note text,
  submitter_ip inet,

  -- Review state
  status text not null default 'pending' check (
    status in ('pending', 'approved', 'rejected', 'needs_info')
  ),
  reviewer_user_id uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,

  created_at timestamptz not null default now(),

  -- Either an authenticated user_id OR a guest name must be present;
  -- otherwise we have no way to attribute the proposal.
  constraint contributions_submitter_present check (
    submitter_user_id is not null or submitter_name is not null
  )
);

create index contributions_clan_status_idx
  on public.contributions (clan_id, status, created_at desc);

create index contributions_submitter_idx
  on public.contributions (submitter_user_id)
  where submitter_user_id is not null;

create index contributions_person_idx
  on public.contributions (person_id)
  where person_id is not null;

alter table public.contributions enable row level security;

revoke all on public.contributions from anon;
grant select, insert, update, delete on public.contributions to authenticated;

-- Authenticated members + admins can submit. submitter_user_id is
-- pinned to auth.uid() in the WITH CHECK so a member can't impersonate
-- another member.
create policy "contributions_member_insert"
  on public.contributions for insert
  to authenticated
  with check (
    auth.uid() is not null
    and submitter_user_id = auth.uid()
    and (
      public.is_clan_member(clan_id)
      or public.is_platform_admin()
    )
  );

-- Editors+admins see everything in their clan; submitters see their own.
create policy "contributions_select"
  on public.contributions for select
  to authenticated
  using (
    public.can_edit_clan(clan_id)
    or public.is_platform_admin()
    or submitter_user_id = auth.uid()
  );

-- Only clan admins can approve / reject / mark needs_info.
create policy "contributions_admin_update"
  on public.contributions for update
  to authenticated
  using (public.is_clan_admin(clan_id) or public.is_platform_admin())
  with check (public.is_clan_admin(clan_id) or public.is_platform_admin());

create policy "contributions_admin_delete"
  on public.contributions for delete
  to authenticated
  using (public.is_clan_admin(clan_id) or public.is_platform_admin());

-- ─── Apply / reject RPCs ───────────────────────────────────────────────
--
-- apply_contribution(p_id) — single atomic transaction:
--   1. Validate caller is an admin (or platform admin) for the clan
--   2. Validate contribution.status = 'pending'
--   3. Branch on contribution_type → mutate target row
--   4. Set status='approved', reviewer_user_id=auth.uid(), reviewed_at=now()
--
-- The mutation lands as if the admin made it directly — existing
-- audit triggers (on persons/families/branches) record the change with
-- the admin as changed_by. The contribution row itself stays around as
-- a paper trail showing who suggested it.

create or replace function public.apply_contribution(p_id uuid)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    me uuid := auth.uid();
    c record;
    payload jsonb;
    new_person_id uuid;
    relation jsonb;
    related_id uuid;
    parent_family_id uuid;
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    select * into c from public.contributions where id = p_id;
    if c is null then
      raise exception 'Đóng góp không tồn tại' using errcode = '22023';
    end if;
    if not (public.is_clan_admin(c.clan_id) or public.is_platform_admin()) then
      raise exception 'Chỉ admin được duyệt' using errcode = '42501';
    end if;
    if c.status <> 'pending' then
      raise exception 'Đóng góp đã được xử lý' using errcode = '22023';
    end if;

    payload := c.proposed_data;

    if c.contribution_type = 'edit_person' then
      if c.person_id is null then
        raise exception 'edit_person cần person_id' using errcode = '22023';
      end if;
      -- Merge proposed_data.changes onto the target person. We list
      -- the safe-to-overwrite columns explicitly — anything not in
      -- the changes object is left untouched.
      update public.persons p
      set
        full_name = coalesce(payload->'changes'->>'full_name', p.full_name),
        courtesy_name = coalesce(payload->'changes'->>'courtesy_name', p.courtesy_name),
        posthumous_name = coalesce(payload->'changes'->>'posthumous_name', p.posthumous_name),
        nickname = coalesce(payload->'changes'->>'nickname', p.nickname),
        gender = coalesce(payload->'changes'->>'gender', p.gender),
        is_living = coalesce((payload->'changes'->>'is_living')::boolean, p.is_living),
        birth_date = coalesce((payload->'changes'->>'birth_date')::date, p.birth_date),
        birth_date_precision = coalesce(payload->'changes'->>'birth_date_precision', p.birth_date_precision),
        death_date = coalesce((payload->'changes'->>'death_date')::date, p.death_date),
        death_date_precision = coalesce(payload->'changes'->>'death_date_precision', p.death_date_precision),
        birth_lunar_year = coalesce((payload->'changes'->>'birth_lunar_year')::int, p.birth_lunar_year),
        birth_lunar_month = coalesce((payload->'changes'->>'birth_lunar_month')::int, p.birth_lunar_month),
        birth_lunar_day = coalesce((payload->'changes'->>'birth_lunar_day')::int, p.birth_lunar_day),
        death_lunar_year = coalesce((payload->'changes'->>'death_lunar_year')::int, p.death_lunar_year),
        death_lunar_month = coalesce((payload->'changes'->>'death_lunar_month')::int, p.death_lunar_month),
        death_lunar_day = coalesce((payload->'changes'->>'death_lunar_day')::int, p.death_lunar_day),
        death_anniv_lunar_month = coalesce((payload->'changes'->>'death_anniv_lunar_month')::int, p.death_anniv_lunar_month),
        death_anniv_lunar_day = coalesce((payload->'changes'->>'death_anniv_lunar_day')::int, p.death_anniv_lunar_day),
        birth_place = coalesce(payload->'changes'->>'birth_place', p.birth_place),
        burial_place = coalesce(payload->'changes'->>'burial_place', p.burial_place),
        bio = coalesce(payload->'changes'->>'bio', p.bio)
      where p.id = c.person_id;

    elsif c.contribution_type = 'add_note' then
      if c.person_id is null then
        raise exception 'add_note cần person_id' using errcode = '22023';
      end if;
      -- Append the note to the bio with a separator. If the bio was
      -- empty we just use the note.
      update public.persons
      set bio = case
        when coalesce(bio, '') = '' then payload->>'note_addition'
        else bio || E'\n\n' || (payload->>'note_addition')
      end
      where id = c.person_id;

    elsif c.contribution_type = 'add_person' then
      -- Required: full_name + gender. Optional: dates, relation hint.
      if (payload->>'full_name') is null or (payload->>'gender') is null then
        raise exception 'add_person cần full_name + gender' using errcode = '22023';
      end if;
      insert into public.persons (
        clan_id, full_name, gender, is_living,
        birth_date, birth_date_precision, death_date, death_date_precision,
        bio, birth_place, burial_place
      ) values (
        c.clan_id,
        payload->>'full_name',
        payload->>'gender',
        coalesce((payload->>'is_living')::boolean, true),
        (payload->>'birth_date')::date,
        payload->>'birth_date_precision',
        (payload->>'death_date')::date,
        payload->>'death_date_precision',
        payload->>'bio',
        payload->>'birth_place',
        payload->>'burial_place'
      )
      returning id into new_person_id;

      -- Optional relationship to an existing person.
      relation := payload->'relation';
      if relation is not null and (relation->>'of_person_id') is not null then
        related_id := (relation->>'of_person_id')::uuid;
        if (relation->>'as') = 'spouse' then
          -- Create a marriage between new person and the existing one.
          -- Husband / wife slot is decided by genders.
          insert into public.families (clan_id, husband_id, wife_id, union_type)
          values (
            c.clan_id,
            case when (payload->>'gender') = 'M' then new_person_id else related_id end,
            case when (payload->>'gender') = 'F' then new_person_id else related_id end,
            'marriage'
          );
        elsif (relation->>'as') = 'child' then
          -- Find or create a birth_family with `related_id` as one
          -- parent (the other parent slot is left null and admin can
          -- fill in later if needed).
          parent_family_id := (
            select id from public.families
            where clan_id = c.clan_id
              and (husband_id = related_id or wife_id = related_id)
              and deleted_at is null
            order by created_at asc
            limit 1
          );
          if parent_family_id is null then
            insert into public.families (clan_id, husband_id, wife_id, union_type)
            values (
              c.clan_id,
              case when (
                select gender from public.persons where id = related_id
              ) = 'M' then related_id else null end,
              case when (
                select gender from public.persons where id = related_id
              ) = 'F' then related_id else null end,
              'marriage'
            )
            returning id into parent_family_id;
          end if;
          update public.persons
          set birth_family_id = parent_family_id
          where id = new_person_id;
        end if;
      end if;

      -- Attach the new person to the contribution for record-keeping
      -- so /contributions can link to the created row.
      update public.contributions set person_id = new_person_id where id = p_id;
    else
      raise exception 'Loại đóng góp không hỗ trợ: %', c.contribution_type;
    end if;

    update public.contributions
    set status = 'approved',
        reviewer_user_id = me,
        reviewed_at = now()
    where id = p_id;
  end;
  $$;

revoke all on function public.apply_contribution(uuid) from public, anon;
grant execute on function public.apply_contribution(uuid) to authenticated;

create or replace function public.reject_contribution(
  p_id uuid,
  p_status text,
  p_note text default null
)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    me uuid := auth.uid();
    c record;
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;
    if p_status not in ('rejected', 'needs_info') then
      raise exception 'p_status phải là rejected hoặc needs_info' using errcode = '22023';
    end if;
    select * into c from public.contributions where id = p_id;
    if c is null then
      raise exception 'Đóng góp không tồn tại' using errcode = '22023';
    end if;
    if not (public.is_clan_admin(c.clan_id) or public.is_platform_admin()) then
      raise exception 'Chỉ admin được xử lý' using errcode = '42501';
    end if;
    if c.status <> 'pending' then
      raise exception 'Đóng góp đã được xử lý' using errcode = '22023';
    end if;
    update public.contributions
    set status = p_status,
        reviewer_user_id = me,
        reviewed_at = now(),
        review_note = p_note
    where id = p_id;
  end;
  $$;

revoke all on function public.reject_contribution(uuid, text, text) from public, anon;
grant execute on function public.reject_contribution(uuid, text, text) to authenticated;
