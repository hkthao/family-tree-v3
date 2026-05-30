-- ============================================================================
-- family-tree-v3 — core schema
-- ============================================================================
-- Multi-tenant family tree. All data tables carry clan_id for isolation.
-- RLS policies and triggers live in subsequent migrations.
-- ============================================================================

-- Extensions ----------------------------------------------------------------

create extension if not exists unaccent;
create extension if not exists pg_trgm;

-- unaccent() is not immutable by default; wrapper so we can use it in
-- generated columns / indexes.
create or replace function public.f_unaccent(text)
  returns text
  language sql
  immutable
  parallel safe
  as $$ select public.unaccent('public.unaccent', $1) $$;

-- Tables --------------------------------------------------------------------

-- profiles: extends auth.users (1:1). NO email column — query auth.users
-- directly via RPC to avoid drift when user updates their email.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_platform_admin boolean not null default false,
  is_suspended boolean not null default false,
  max_clans int not null default 1,
  created_at timestamptz not null default now()
);

-- clans: a family/lineage. Soft tenant boundary.
create table public.clans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid references public.profiles(id) on delete set null,
  visibility text not null default 'private'
    check (visibility in ('private', 'public')),
  hide_living_for_nonmembers boolean not null default true,
  max_persons int not null default 500,
  max_users int not null default 3,
  data_version int not null default 0,
  created_at timestamptz not null default now()
);

-- clan_members: user role within a clan.
create table public.clan_members (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('admin', 'editor', 'viewer')),
  invited_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (clan_id, user_id)
);

-- branches: chi họ (sub-lineage). Circular FK to persons added later.
create table public.branches (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  name text not null,
  head_person_id uuid, -- FK added below (deferrable)
  ancestral_house text,
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- families: marriage unit. Circular FK to persons added later.
create table public.families (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  husband_id uuid, -- FK added below (deferrable)
  wife_id uuid,    -- FK added below (deferrable)
  union_type text check (union_type in ('marriage', 'remarriage', 'other')),
  notes text,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

-- persons: members of the family tree. Lunar fields stored as structured
-- integers (not text) so we can sort, query "ai có giỗ tháng 3 âm", and
-- convert lunar→solar for event reminders.
create table public.persons (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,

  full_name text not null,
  full_name_unaccent text, -- maintained by trigger

  gender text not null check (gender in ('M', 'F')),
  is_living boolean not null default true,
  is_root boolean not null default false,

  -- Solar dates
  birth_date date,
  death_date date,

  -- Lunar — structured. is_leap_month handles Vietnamese leap months.
  birth_lunar_year int,
  birth_lunar_month int check (birth_lunar_month between 1 and 12),
  birth_lunar_day int check (birth_lunar_day between 1 and 30),
  birth_lunar_is_leap boolean not null default false,

  death_lunar_year int,
  death_lunar_month int check (death_lunar_month between 1 and 12),
  death_lunar_day int check (death_lunar_day between 1 and 30),
  death_lunar_is_leap boolean not null default false,

  -- Death anniversary (giỗ) — no year because it repeats annually
  death_anniv_lunar_month int check (death_anniv_lunar_month between 1 and 12),
  death_anniv_lunar_day int check (death_anniv_lunar_day between 1 and 30),
  death_anniv_lunar_is_leap boolean not null default false,

  -- Vietnamese naming
  courtesy_name text,    -- tên tự
  posthumous_name text,  -- tên thụy
  nickname text,         -- tên húy / biệt hiệu

  branch_id uuid,            -- FK added below (deferrable)
  birth_family_id uuid,      -- FK added below (deferrable)
  generation int,            -- computed by trigger; null until parents linked

  photo_path text,
  bio text,
  birth_place text,
  burial_place text,

  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Circular FK wiring (DEFERRABLE INITIALLY DEFERRED so a single transaction
-- can insert person → family → backfill person.birth_family_id, etc.)
alter table public.branches
  add constraint branches_head_person_fk
  foreign key (head_person_id) references public.persons(id)
    on delete set null
    deferrable initially deferred;

alter table public.families
  add constraint families_husband_fk
  foreign key (husband_id) references public.persons(id)
    on delete set null
    deferrable initially deferred,
  add constraint families_wife_fk
  foreign key (wife_id) references public.persons(id)
    on delete set null
    deferrable initially deferred;

alter table public.persons
  add constraint persons_branch_fk
  foreign key (branch_id) references public.branches(id)
    on delete set null
    deferrable initially deferred,
  add constraint persons_birth_family_fk
  foreign key (birth_family_id) references public.families(id)
    on delete set null
    deferrable initially deferred;

-- share_links: time-limited public view tokens (admin-created).
create table public.share_links (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  token text unique not null,
  root_person_id uuid references public.persons(id) on delete set null,
  scope text not null default 'tree_view',
  created_by uuid references public.profiles(id) on delete set null,
  expires_at timestamptz not null,
  is_revoked boolean not null default false,
  created_at timestamptz not null default now()
);

-- audit_log: every change to persons/families/branches for restore.
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  entity_type text not null check (entity_type in ('person', 'family', 'branch')),
  entity_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  changed_by uuid references public.profiles(id) on delete set null,
  changed_at timestamptz not null default now()
);

-- events: custom clan events (reunion, memorial, ...) on top of derived
-- birthday/death_anniversary events. Exactly one of solar/lunar is set.
create table public.events (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  title text not null,
  event_type text not null default 'custom'
    check (event_type in ('custom', 'reunion', 'memorial')),
  date_solar date,
  lunar_year int,
  lunar_month int check (lunar_month between 1 and 12),
  lunar_day int check (lunar_day between 1 and 30),
  lunar_is_leap boolean not null default false,
  is_yearly boolean not null default true,
  related_person_id uuid references public.persons(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  -- Exactly one of solar / lunar must be set
  constraint events_one_calendar check (
    (date_solar is not null) <> (lunar_month is not null)
  )
);

-- event_subscriptions: user "follows" events at clan / branch / person scope.
create table public.event_subscriptions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  scope text not null check (scope in ('clan', 'branch', 'person')),
  target_id uuid, -- null when scope='clan'; branch_id or person_id otherwise
  event_types text[] not null default array['birthday', 'death_anniversary'],
  channels text[] not null default array['email'],
  lead_days int[] not null default array[7, 1],
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  constraint event_subs_target_required check (
    (scope = 'clan' and target_id is null)
    or (scope in ('branch', 'person') and target_id is not null)
  )
);

-- Partial unique indexes (PG NULL ≠ NULL so a plain UNIQUE wouldn't block
-- duplicate clan-scope subscriptions).
create unique index event_subs_clan_unique
  on public.event_subscriptions (user_id, clan_id)
  where scope = 'clan';
create unique index event_subs_target_unique
  on public.event_subscriptions (user_id, clan_id, target_id)
  where scope in ('branch', 'person');

-- notification_log: idempotency + audit for sent reminders.
-- event_key MUST include lead<N> — same anniversary fires 7-day and 1-day
-- reminders, both must succeed.
create table public.notification_log (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_key text not null,
  channel text not null check (channel in ('email', 'sms')),
  status text not null check (status in ('sent', 'failed')),
  sent_at timestamptz not null default now(),
  unique (user_id, event_key, channel)
);

-- Indexes -------------------------------------------------------------------

create index persons_clan_idx on public.persons (clan_id);
create index persons_clan_branch_idx on public.persons (clan_id, branch_id);
create index persons_clan_generation_idx on public.persons (clan_id, generation);
create index persons_clan_alive_idx on public.persons (clan_id) where deleted_at is null;
create index persons_unaccent_trgm_idx
  on public.persons using gin (full_name_unaccent gin_trgm_ops);

create index families_clan_idx on public.families (clan_id);
create index families_husband_idx on public.families (husband_id) where husband_id is not null;
create index families_wife_idx on public.families (wife_id) where wife_id is not null;

create index branches_clan_idx on public.branches (clan_id);

create index clan_members_clan_user_idx on public.clan_members (clan_id, user_id);
create index clan_members_user_idx on public.clan_members (user_id);

create index share_links_token_idx on public.share_links (token);
create index share_links_clan_idx on public.share_links (clan_id);

create index audit_log_clan_idx on public.audit_log (clan_id, changed_at desc);
create index audit_log_entity_idx on public.audit_log (entity_type, entity_id);

create index events_clan_idx on public.events (clan_id);
create index event_subs_clan_idx on public.event_subscriptions (clan_id);
create index event_subs_user_idx on public.event_subscriptions (user_id);
create index notification_log_user_idx on public.notification_log (user_id, sent_at desc);
