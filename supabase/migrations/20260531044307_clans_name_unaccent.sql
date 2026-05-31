-- ============================================================================
-- clans.name_unaccent: lowercased + diacritic-stripped clan name for the
-- /clans search box. Mirrors the persons.full_name_unaccent trigger so
-- search behaves the same across the app — "ho nguyen" matches "Họ Nguyễn".
-- ============================================================================

alter table public.clans
  add column if not exists name_unaccent text;

create or replace function public.clans_maintain_name_unaccent()
  returns trigger
  language plpgsql
  as $$
  begin
    new.name_unaccent := lower(public.f_unaccent(new.name));
    return new;
  end;
  $$;

drop trigger if exists clans_maintain_name_unaccent_trg on public.clans;
create trigger clans_maintain_name_unaccent_trg
  before insert or update of name on public.clans
  for each row
  execute function public.clans_maintain_name_unaccent();

-- Backfill existing rows
update public.clans
   set name_unaccent = lower(public.f_unaccent(name))
 where name_unaccent is null;

-- Index for ilike — small table for now but cheap to have
create index if not exists clans_name_unaccent_idx
  on public.clans using gin (name_unaccent gin_trgm_ops);
