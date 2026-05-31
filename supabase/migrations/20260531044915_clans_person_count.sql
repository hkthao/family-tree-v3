-- ============================================================================
-- clans.person_count: denormalised count of non-deleted persons per clan.
--
-- Used by the /clans community tab so users can filter by clan size. We
-- could compute this on read via a SUM(...) join, but the community list
-- is paginated server-side and we want the filter to push down too, so a
-- denormalised int column lets us do .gte/.lte/.range without grouping.
--
-- Maintained by an AFTER-row trigger on persons (mirrors the soft-delete
-- semantics: deleted_at toggling counts as a +1/-1).
-- ============================================================================

alter table public.clans
  add column if not exists person_count int not null default 0;

-- Backfill from current state
update public.clans c
   set person_count = (
     select count(*)::int
     from public.persons p
     where p.clan_id = c.id and p.deleted_at is null
   );

create or replace function public.bump_person_count()
  returns trigger
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  begin
    if TG_OP = 'INSERT' then
      if new.deleted_at is null then
        update public.clans
           set person_count = person_count + 1
         where id = new.clan_id;
      end if;
    elsif TG_OP = 'DELETE' then
      -- Only fires on a real (cascade) hard delete; soft-deletes go through
      -- UPDATE because the BEFORE DELETE trigger cancels the actual delete.
      if old.deleted_at is null then
        update public.clans
           set person_count = greatest(person_count - 1, 0)
         where id = old.clan_id;
      end if;
    elsif TG_OP = 'UPDATE' then
      if old.deleted_at is null and new.deleted_at is not null then
        update public.clans
           set person_count = greatest(person_count - 1, 0)
         where id = new.clan_id;
      elsif old.deleted_at is not null and new.deleted_at is null then
        update public.clans
           set person_count = person_count + 1
         where id = new.clan_id;
      end if;
    end if;
    return null;
  end;
  $$;

drop trigger if exists persons_bump_person_count_trg on public.persons;
create trigger persons_bump_person_count_trg
  after insert or update of deleted_at or delete on public.persons
  for each row
  execute function public.bump_person_count();
