-- ============================================================================
-- Partial solar dates for persons (birth_date / death_date).
--
-- Real-world use case: information from Vietnamese tombstones is often
-- partial — sometimes just a year, sometimes month+year, only rarely the
-- full day. The lunar columns are already decomposed (year/month/day);
-- solar columns were a single `date` and so couldn't represent that.
--
-- Approach: keep `birth_date` / `death_date` as `date` (so existing
-- queries and indexes still work, and sorting stays monotonic) and add
-- a precision sidecar column. When precision = 'year', day & month are
-- placeholders (01-01) and the UI must format using year only. Same for
-- 'month' (day = 01). When precision = 'day', the full date is real.
-- ============================================================================

alter table public.persons
  add column if not exists birth_date_precision text
    check (birth_date_precision in ('day', 'month', 'year'));

alter table public.persons
  add column if not exists death_date_precision text
    check (death_date_precision in ('day', 'month', 'year'));

-- Backfill: rows with a date are full-day precision; null date means null
-- precision so the matching CHECK constraint below can be added.
update public.persons
   set birth_date_precision = case when birth_date is null then null else 'day' end
 where birth_date_precision is null;

update public.persons
   set death_date_precision = case when death_date is null then null else 'day' end
 where death_date_precision is null;

-- Consistency: if the date is null, precision should be null too (and vice
-- versa). Enforce as a check.
alter table public.persons
  add constraint persons_birth_date_precision_match
  check ((birth_date is null) = (birth_date_precision is null));

alter table public.persons
  add constraint persons_death_date_precision_match
  check ((death_date is null) = (death_date_precision is null));
