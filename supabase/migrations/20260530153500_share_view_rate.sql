-- ============================================================================
-- share_view_rate: lightweight per-IP rate limiter for the share-view
-- Edge Function. Public tokens are easy to scrape; without throttling, a
-- determined bot can pull a full clan in seconds (plan §9).
--
-- Bucket model: one row per (ip, window_start). The Edge Function bumps
-- `request_count` for the current minute bucket; if it exceeds 60 it
-- returns 429.
-- ============================================================================

create table if not exists public.share_view_rate (
  id bigserial primary key,
  ip text not null,
  window_start timestamptz not null,
  request_count int not null default 1,
  unique (ip, window_start)
);

create index if not exists share_view_rate_window_idx
  on public.share_view_rate (window_start);

-- The Edge Function uses service role, so no RLS needed. Lock the table
-- away from anon/authenticated regardless.
revoke all on public.share_view_rate from anon;
revoke all on public.share_view_rate from authenticated;
alter table public.share_view_rate enable row level security;
-- (No policies → all client access blocked. Only service role can read/write.)

-- Helper to prune old buckets. Called opportunistically from the Edge
-- Function; not a cron job (don't want to fail open if a job dies).
create or replace function public.prune_share_view_rate()
  returns void
  language sql
  security definer
  set search_path = public, pg_temp
  as $$
    delete from public.share_view_rate
     where window_start < now() - interval '10 minutes';
  $$;

revoke execute on function public.prune_share_view_rate() from public;
