-- Batched + resumable gia-phả import (large trees, e.g. #10872 ~4800
-- people) that won't fit one Edge Function wall-clock.
--
-- The giapha-import function works as a job driven by the client:
--   start    → fetch tree, list all ids, create the job + target clan
--   step (×N)→ scrape+parse the next batch, append a chunk row
--   finalize → assemble all chunks → admin_import_giapha() in ONE txn
--
-- State lives in these tables so closing the tab mid-run doesn't lose
-- progress — the job can be finalized later. Only the service role
-- (the Edge Function) touches them; clients see progress via the
-- function's responses, so RLS is on with no policies.

create table if not exists public.giapha_import_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  clan_id uuid references public.clans(id) on delete cascade,
  source_id text not null,
  source_url text,
  all_ids jsonb not null default '[]',   -- int[] of person ids on the source
  total int not null default 0,
  scraped int not null default 0,
  status text not null default 'scraping'
    check (status in ('scraping', 'ready', 'importing', 'done', 'error')),
  error text,
  result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.giapha_import_chunks (
  job_id uuid not null references public.giapha_import_jobs(id) on delete cascade,
  seq int not null,
  people jsonb not null,
  primary key (job_id, seq)
);

alter table public.giapha_import_jobs enable row level security;
alter table public.giapha_import_chunks enable row level security;
-- No policies: only the service-role Edge Function reads/writes these.

-- ─── set-based import in one transaction ────────────────────────────
-- Inserts families (spouseless) → persons (with birth_family_id) →
-- wires family husband/wife, then recomputes generations ONCE.
--
-- The per-row generation triggers recompute the WHOLE clan on every
-- insert/update → O(n²) and blows the statement timeout at a few
-- hundred people. So we disable the four generation triggers for the
-- import, then call recompute_generation_for_clan() a single time. The
-- FKs are DEFERRABLE INITIALLY DEFERRED, so we SET CONSTRAINTS ALL
-- IMMEDIATE before re-enabling triggers (ALTER TABLE refuses to run
-- while a table has pending deferred trigger events). unaccent /
-- search-text triggers stay enabled. Service-role only (the Edge
-- Function already verified platform admin).

create or replace function public.admin_import_giapha(
  p_clan_id uuid,
  p_persons jsonb,
  p_families jsonb
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    n_persons int;
    n_families int;
  begin
    set local statement_timeout = 0;

    alter table public.persons disable trigger persons_recompute_generation_trg;
    alter table public.persons disable trigger persons_recompute_generation_update_trg;
    alter table public.families disable trigger families_recompute_generation_trg;
    alter table public.families disable trigger families_recompute_generation_update_trg;

    insert into public.families (id, clan_id, husband_id, wife_id, union_type, spouse_order)
    select (e->>'id')::uuid, p_clan_id, null, null, 'marriage',
           nullif(e->>'spouse_order', '')::int
    from jsonb_array_elements(p_families) e;

    insert into public.persons (
      id, clan_id, full_name, gender, is_living, is_root,
      birth_date, birth_date_precision, death_date, death_date_precision,
      birth_family_id, nickname, courtesy_name, birth_place, burial_place, bio,
      death_lunar_year, death_lunar_month, death_lunar_day, death_lunar_is_leap,
      death_anniv_lunar_month, death_anniv_lunar_day, death_anniv_lunar_is_leap
    )
    select
      (e->>'id')::uuid, p_clan_id, e->>'full_name', e->>'gender',
      coalesce((e->>'is_living')::boolean, true),
      coalesce((e->>'is_root')::boolean, false),
      nullif(e->>'birth_date', '')::date, nullif(e->>'birth_date_precision', ''),
      nullif(e->>'death_date', '')::date, nullif(e->>'death_date_precision', ''),
      nullif(e->>'birth_family_id', '')::uuid,
      nullif(e->>'nickname', ''), nullif(e->>'courtesy_name', ''),
      nullif(e->>'birth_place', ''), nullif(e->>'burial_place', ''),
      nullif(e->>'bio', ''),
      nullif(e->>'death_lunar_year', '')::int, nullif(e->>'death_lunar_month', '')::int,
      nullif(e->>'death_lunar_day', '')::int,
      coalesce((e->>'death_lunar_is_leap')::boolean, false),
      nullif(e->>'death_anniv_lunar_month', '')::int,
      nullif(e->>'death_anniv_lunar_day', '')::int,
      coalesce((e->>'death_anniv_lunar_is_leap')::boolean, false)
    from jsonb_array_elements(p_persons) e;

    update public.families f
       set husband_id = nullif(e->>'husband_id', '')::uuid,
           wife_id = nullif(e->>'wife_id', '')::uuid
    from jsonb_array_elements(p_families) e
    where f.id = (e->>'id')::uuid;

    -- Clear pending deferred-FK events so ENABLE TRIGGER can run.
    set constraints all immediate;

    alter table public.persons enable trigger persons_recompute_generation_trg;
    alter table public.persons enable trigger persons_recompute_generation_update_trg;
    alter table public.families enable trigger families_recompute_generation_trg;
    alter table public.families enable trigger families_recompute_generation_update_trg;

    perform public.recompute_generation_for_clan(p_clan_id);

    n_persons := jsonb_array_length(p_persons);
    n_families := jsonb_array_length(p_families);
    return jsonb_build_object('persons', n_persons, 'families', n_families);
  end;
  $$;

revoke all on function public.admin_import_giapha(uuid, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.admin_import_giapha(uuid, jsonb, jsonb) to service_role;
