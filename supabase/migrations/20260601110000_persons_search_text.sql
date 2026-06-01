-- ============================================================================
-- Expand person search beyond full_name.
--
-- listPersons currently does
--   .ilike('full_name_unaccent', '%needle%')
-- against a GIN trigram index. That's great for "tìm tên" but leaves
-- the search box deaf to the other narrative fields users actually
-- fill in: nicknames (Tí, Bống...), the courtesy / posthumous names
-- common to older generations, bio prose, and the place fields.
-- A user typing "Hà Nội" should find every person whose birth or
-- burial place mentions it; typing "Tí" should surface every nickname.
--
-- This migration:
--   1. Adds persons.search_text — lower(f_unaccent(...)) of the
--      concatenated narrative columns. Maintained by trigger, same
--      pattern as full_name_unaccent.
--   2. Trigram GIN index so ILIKE on it stays fast at 50k+ rows.
--   3. Backfills existing rows.
-- ============================================================================

alter table public.persons
  add column if not exists search_text text;

create or replace function public.maintain_unaccent()
  returns trigger
  language plpgsql
  as $$
  begin
    new.full_name_unaccent := lower(public.f_unaccent(new.full_name));
    new.search_text := lower(public.f_unaccent(
      coalesce(new.full_name, '') || ' ' ||
      coalesce(new.courtesy_name, '') || ' ' ||
      coalesce(new.posthumous_name, '') || ' ' ||
      coalesce(new.nickname, '') || ' ' ||
      coalesce(new.bio, '') || ' ' ||
      coalesce(new.birth_place, '') || ' ' ||
      coalesce(new.burial_place, '')
    ));
    new.updated_at := now();
    return new;
  end;
  $$;

-- Re-create the trigger so it fires on UPDATE of any field that feeds
-- into search_text, not just full_name. INSERT is unchanged.
drop trigger if exists persons_maintain_unaccent_trg on public.persons;
create trigger persons_maintain_unaccent_trg
  before insert or update of
    full_name, courtesy_name, posthumous_name, nickname,
    bio, birth_place, burial_place
  on public.persons
  for each row
  execute function public.maintain_unaccent();

-- Trigram GIN index — same flavor as full_name_unaccent's.
create index if not exists persons_search_text_idx
  on public.persons using gin (search_text gin_trgm_ops);

-- Backfill existing rows. Compute the value directly rather than
-- relying on the trigger — the trigger only fires when one of the
-- watched columns is updated, and bumping updated_at alone wouldn't
-- count.
update public.persons
   set search_text = lower(public.f_unaccent(
     coalesce(full_name, '') || ' ' ||
     coalesce(courtesy_name, '') || ' ' ||
     coalesce(posthumous_name, '') || ' ' ||
     coalesce(nickname, '') || ' ' ||
     coalesce(bio, '') || ' ' ||
     coalesce(birth_place, '') || ' ' ||
     coalesce(burial_place, '')
   ))
 where search_text is null;
