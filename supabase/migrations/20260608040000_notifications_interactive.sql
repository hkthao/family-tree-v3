-- Two-way push notifications — table + action helper RPC.
--
-- Push payload is limited to ~4KB and is end-to-end encrypted (we
-- can't read it server-side), so we can't ship full action context
-- in the payload itself. Instead:
--
--   1. Server inserts a `notifications` row with full context
--      (kind, target_id, action list, one-time token).
--   2. Push payload carries ONLY `{notification_id, action_token}`.
--   3. SW reads the row via an anon endpoint (validating token).
--   4. SW renders notification with `actions[]` (Android + iOS 16.4+).
--   5. User taps an action → SW POSTs to push-action with
--      `{notification_id, action_token, action_id}`.
--   6. push-action validates token + dispatches by (kind, action_id).
--   7. Row's `consumed_at` is stamped to block replay.
--
-- One-time token model is intentional: we don't need JWT in the SW
-- context (which is unreliable), and the token only authorises the
-- exact action listed on the row.

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Domain category: 'contribution_pending' (admin gets approve/reject),
  -- 'contribution_decided' (submitter gets "view"), 'inlaw_pending',
  -- 'monthly_lunar', 'event_reminder'. Drives the action dispatcher
  -- table in push-action; unknown kinds are ignored.
  kind text not null,
  -- Optional target — contribution id / link id / person id / etc.
  -- Action handler looks this up alongside kind to know what row to
  -- mutate. Null OK (vd monthly_lunar reminders aren't tied to any
  -- single row).
  target_id uuid,
  -- Extra context the SW needs to render the notification (title,
  -- body, deep-link url). Free-form jsonb because shape varies by
  -- kind. Stored server-side so the push payload stays minimal.
  payload jsonb not null default '{}'::jsonb,
  -- Available actions as an array of strings (eg ['approve',
  -- 'reject']). Empty array = no actions, click-only.
  actions text[] not null default array[]::text[],

  -- One-time secret bound to this notification. Generated server-side,
  -- never logged, included only in the push payload + action POST.
  -- Length check matches person_links.invite_token convention.
  action_token text not null unique
    check (length(action_token) >= 22),

  created_at timestamptz not null default now(),
  -- Stamped when the SW or app reads the row via the consume helper.
  -- Used for "you have unread notifications" badges later.
  read_at timestamptz,
  -- Stamped when an action_id was dispatched. Subsequent action
  -- POSTs on the same row → 409 Conflict (no replay).
  consumed_at timestamptz,
  consumed_action text
);

create index notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index notifications_token_idx
  on public.notifications (action_token);

alter table public.notifications enable row level security;

-- Owner can read their own notifications via UI. SW reads via the
-- token endpoint (service-role bypass), so no policy needed for that
-- path. Writes happen ONLY from server side (Edge Functions w/
-- service_role) — no insert/update policy granted to authenticated.

create policy notifications_owner_select
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

revoke all on public.notifications from anon;
grant select on public.notifications to authenticated;

-- ─── Anon-callable: resolve a notification by token ────────────────
-- The SW has no user JWT; it gets `notification_id + token` from the
-- push payload and needs to render the notification body. Anon-OK
-- because the token is unguessable (>=22 chars). Returns just the
-- fields the SW needs.

create or replace function public.get_notification_by_token(
  p_notification_id uuid,
  p_action_token text
)
  returns jsonb
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    n record;
  begin
    select n.id, n.kind, n.target_id, n.payload, n.actions,
           n.created_at, n.consumed_at
      into n
      from public.notifications n
     where n.id = p_notification_id and n.action_token = p_action_token
     limit 1;
    if not found then
      raise exception 'Notification not found or token mismatch'
        using errcode = '22023';
    end if;
    return jsonb_build_object(
      'id', n.id,
      'kind', n.kind,
      'target_id', n.target_id,
      'payload', n.payload,
      'actions', n.actions,
      'consumed_at', n.consumed_at
    );
  end;
  $$;

revoke all on function public.get_notification_by_token(uuid, text)
  from public;
grant execute on function public.get_notification_by_token(uuid, text)
  to anon, authenticated;

-- ─── Mark a notification consumed (internal — service role only) ──
-- Atomically claims the row so two clicks on the same notification
-- (vd hai thiết bị cùng nhận) don't double-dispatch. Returns true
-- when this caller "won" the race; false when row was already
-- consumed (caller should respond with 409).

create or replace function public.consume_notification_action(
  p_notification_id uuid,
  p_action_token text,
  p_action text
)
  returns boolean
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    rows_updated int;
  begin
    update public.notifications
       set consumed_at = now(),
           consumed_action = p_action
     where id = p_notification_id
       and action_token = p_action_token
       and consumed_at is null
       and p_action = any(actions);
    get diagnostics rows_updated = row_count;
    return rows_updated > 0;
  end;
  $$;

revoke all on function public.consume_notification_action(uuid, text, text)
  from public, anon, authenticated;
-- Service role can call by default (bypasses revoke at the privilege
-- level), but make it explicit for clarity.

-- ─── Sweep helper: drop consumed/old rows ─────────────────────────
-- pg_cron will call this weekly. notifications table grows linearly
-- with email volume; keep 90 days for the "history" view we may add.

create or replace function public.prune_notifications(
  retention_days int default 90
)
  returns int
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare
    deleted_count int;
  begin
    delete from public.notifications
     where created_at < now() - make_interval(days => retention_days);
    get diagnostics deleted_count = row_count;
    return deleted_count;
  end;
  $$;

revoke all on function public.prune_notifications(int) from public, anon;
grant execute on function public.prune_notifications(int) to postgres;
