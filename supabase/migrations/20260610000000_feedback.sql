-- User feedback channel.
--
-- A floating "Góp ý" button on every page writes here so a real
-- person can describe a bug / suggestion in their own words. Anon
-- (logged-out) users are explicitly allowed — the moment a visitor
-- hits a wall on a shared tree we don't want them to have to sign
-- up just to tell us. Platform admins read the firehose; users
-- never see each other's feedback.
--
-- We capture page_url + user_agent + app_version client-side so a
-- short message like "trang trắng" is still actionable.

create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  clan_id uuid references public.clans(id) on delete set null,
  message text not null,
  -- Free-form contact: email / phone / zalo handle, whatever the
  -- user wants us to reach them at. Optional.
  contact text,
  page_url text,
  user_agent text,
  app_version text,
  created_at timestamptz not null default now(),
  constraint feedback_message_len
    check (char_length(btrim(message)) between 1 and 5000),
  constraint feedback_contact_len
    check (contact is null or char_length(contact) <= 200)
);

create index feedback_created_at_idx
  on public.feedback (created_at desc);

alter table public.feedback enable row level security;

-- INSERT: anyone (anon + authenticated). If a user_id is set on the
-- row, it must match the caller — prevents spoofing somebody else's
-- handle into a complaint.
create policy feedback_insert_anyone
  on public.feedback for insert
  to anon, authenticated
  with check (
    user_id is null
    or user_id = auth.uid()
  );

-- SELECT: platform admins only. Users explicitly do NOT see other
-- users' feedback (privacy + spam shielding).
create policy feedback_select_platform_admin
  on public.feedback for select
  to authenticated
  using (public.is_platform_admin());
