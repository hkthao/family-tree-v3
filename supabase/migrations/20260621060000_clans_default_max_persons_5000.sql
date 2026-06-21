-- Raise the default member (person) cap per clan from 500 → 5000.
-- New clans get 5000; existing clans are bumped UP to 5000 (never
-- lowered, so any intentionally-higher custom cap is kept).

alter table public.clans alter column max_persons set default 5000;

update public.clans set max_persons = 5000 where max_persons < 5000;
