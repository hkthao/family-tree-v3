-- ============================================================================
-- Web Push (VAPID) — subscriptions + per-user toggle.
--
-- Architecture decision: web push is layered on top of the existing
-- notification stack rather than running parallel:
--   - opt-in for events reuses event_subscriptions (no new prefs table).
--   - Edge Function `notify-events` is extended to also dispatch push
--     alongside email — same lunar engine, same notification_log row
--     (with channel='webpush') for idempotency.
--   - profiles.notify_via_push mirrors the pattern from
--     profiles.notify_monthly_lunar — a single global on/off toggle
--     for THIS channel.
-- ============================================================================

create table public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  -- Unique URL the push service routes through. Identifies the
  -- subscription; same endpoint = same device/browser combo.
  endpoint        text not null unique,
  -- Client public key + auth secret from PushSubscription.toJSON().keys.
  -- Required by web-push to encrypt the payload end-to-end.
  p256dh          text not null,
  auth            text not null,
  -- Best-effort device label so a future "manage devices" page can
  -- show "Chrome trên Android · Galaxy S24" instead of a UUID.
  user_agent      text,
  created_at      timestamptz not null default now(),
  -- Bookkeeping for cleanup (29.10).
  last_success_at timestamptz,
  failure_count   int not null default 0
);

create index push_subscriptions_user_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Only the row owner can read/write their subscriptions. Edge Functions
-- using service_role bypass RLS and read everyone's subs to fan out
-- pushes from cron.
create policy push_subscriptions_owner
  on public.push_subscriptions
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── profiles.notify_via_push toggle ────────────────────────────────
-- Per-user opt-in for the push channel itself. Default OFF — push is
-- a bonus layer, never a forced experience. Same pattern as
-- notify_monthly_lunar so the protect_profile_privileged_cols trigger
-- already passes this column through unchanged.

alter table public.profiles
  add column if not exists notify_via_push boolean not null default false;

-- ─── Owner-callable RPC: upsert subscription idempotently ───────────
-- Client side calls this after pushManager.subscribe() returns. The
-- function inserts a new row OR refreshes keys/user_agent on an
-- existing row (same endpoint). Returns the row id so the client can
-- track which sub it owns.

create or replace function public.upsert_my_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
  returns uuid
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    me uuid := auth.uid();
    sub_id uuid;
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;

    insert into public.push_subscriptions
      (user_id, endpoint, p256dh, auth, user_agent)
    values (me, p_endpoint, p_p256dh, p_auth, p_user_agent)
    on conflict (endpoint) do update
      set p256dh = excluded.p256dh,
          auth = excluded.auth,
          user_agent = excluded.user_agent,
          -- Reset failure counter — the new key proves the endpoint
          -- is alive again.
          failure_count = 0,
          last_success_at = null
      returning id into sub_id;

    return sub_id;
  end;
  $$;

revoke all on function public.upsert_my_push_subscription(text, text, text, text)
  from public, anon;
grant execute on function public.upsert_my_push_subscription(text, text, text, text)
  to authenticated;

-- ─── Owner-callable RPC: delete my subscription by endpoint ──────────

create or replace function public.delete_my_push_subscription(p_endpoint text)
  returns void
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    me uuid := auth.uid();
  begin
    if me is null then
      raise exception 'Not authenticated' using errcode = '42501';
    end if;

    delete from public.push_subscriptions
    where user_id = me
      and endpoint = p_endpoint;
  end;
  $$;

revoke all on function public.delete_my_push_subscription(text) from public, anon;
grant execute on function public.delete_my_push_subscription(text) to authenticated;
