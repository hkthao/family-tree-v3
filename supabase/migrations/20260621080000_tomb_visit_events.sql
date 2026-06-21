-- Phase 2 "Mộ phần & tro cốt": nhắc TẢO MỘ / CHẠP HỌ.
--
-- Reuses the whole events + notify-events pipeline. Adds a dedicated
-- event_type 'tomb_visit' (so reminders are labelled "Tảo mộ / Chạp họ"
-- and can be followed as their own category) plus an optional link to a
-- resting place, so a reminder can point at a specific mộ / tháp họ.
--
-- Tảo mộ / chạp họ is a collective ritual, so it's ON by default for
-- clan-scope subscriptions (new default + backfill existing clan subs).

alter table public.events
  drop constraint events_event_type_check,
  add constraint events_event_type_check
    check (event_type in ('custom', 'reunion', 'memorial', 'tomb_visit'));

alter table public.events
  add column if not exists resting_place_id uuid
    references public.resting_places(id) on delete set null;

alter table public.event_subscriptions
  alter column event_types
  set default array['birthday', 'death_anniversary', 'tomb_visit'];

-- Backfill: every existing clan-scope follower also gets tảo mộ/chạp họ.
update public.event_subscriptions
   set event_types = array_append(event_types, 'tomb_visit')
 where scope = 'clan'
   and not ('tomb_visit' = any(event_types));
