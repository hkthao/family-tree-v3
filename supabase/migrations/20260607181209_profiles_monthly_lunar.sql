-- profiles.notify_monthly_lunar — per-user opt-in for mùng 1 (lunar
-- day 1) and rằm (lunar day 15) "thắp hương" reminder emails.
--
-- These aren't clan-specific events — every lunar 1st and 15th
-- applies to anyone observing Vietnamese ritual months. So it's a
-- per-user preference, not part of event_subscriptions (which scope
-- to clan/branch/person).
--
-- Cron (notify-events) checks today's lunar day each morning; if 1 or
-- 15, fans out to all users with this flag set. notification_log
-- dedupes via event_key = 'monthly_lunar:YYYY-MM-DD'.

alter table public.profiles
  add column if not exists notify_monthly_lunar boolean not null default false;

-- Self-update policy already exists: users can update their own
-- display_name. The protect_profile_privileged_cols trigger lets
-- non-privileged columns through, so no policy change needed for
-- self-toggling notify_monthly_lunar.

-- ── Confirm the trigger leaves this column alone ──────────────────
-- Re-emit the trigger so it explicitly accepts notify_monthly_lunar
-- changes regardless of caller role. The existing list of guarded
-- columns is: max_clans, is_platform_admin, is_suspended.

-- (No change needed — `protect_profile_privileged_cols` only blocks
-- changes to those 3 columns. Other columns including this new one
-- pass through for the row's owner via the profiles UPDATE policy.)
