-- Phase C của plan.md §32.3 — Bảng tin dòng họ (Clan Board).
--
-- Lớp giao tiếp thành viên ↔ thành viên trong từng clan: tin sinh,
-- mất, sự kiện họp họ/giỗ/tảo mộ. Có moderation queue (member thường
-- BUỘC chờ duyệt, admin clan duyệt qua RPC + audit log).
--
-- Bài có thể đính kèm person_id (cáo phó) hoặc event_id (sự kiện) —
-- tích hợp với phần đã có (PersonDetail card, Today page).

-- ─── Enums ────────────────────────────────────────────────────────

create type public.clan_post_type
  as enum ('news', 'event', 'birth', 'death', 'notice');

create type public.clan_post_status
  as enum ('published', 'pending', 'hidden');

create type public.clan_comment_status
  as enum ('published', 'hidden');

-- ─── Tables ───────────────────────────────────────────────────────

create table public.clan_posts (
  id         uuid primary key default gen_random_uuid(),
  clan_id    uuid not null references public.clans(id) on delete cascade,
  author_id  uuid not null references auth.users(id),
  type       public.clan_post_type not null default 'news',
  title      text,
  body       text not null,
  -- Liên kết tuỳ chọn tới person/event đã có trong cùng clan.
  person_id  uuid references public.persons(id) on delete set null,
  event_id   uuid references public.events(id) on delete set null,
  event_date date,
  status     public.clan_post_status not null default 'published',
  pinned     boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint clan_posts_title_len
    check (title is null or char_length(btrim(title)) <= 200),
  constraint clan_posts_body_len
    check (char_length(btrim(body)) between 1 and 20000)
);

create index clan_posts_clan_recent_idx
  on public.clan_posts (clan_id, pinned desc, created_at desc)
  where status = 'published';

create index clan_posts_clan_pending_idx
  on public.clan_posts (clan_id, created_at desc)
  where status = 'pending';

create trigger clan_posts_set_updated_at
  before update on public.clan_posts
  for each row execute function public.set_updated_at();

create table public.clan_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.clan_posts(id) on delete cascade,
  -- Denormalized cho RLS gọn. KHÔNG cho client set: trigger 32.3.t1 ghi đè.
  clan_id    uuid not null references public.clans(id) on delete cascade,
  author_id  uuid not null references auth.users(id),
  body       text not null,
  status     public.clan_comment_status not null default 'published',
  created_at timestamptz not null default now(),
  constraint clan_post_comments_body_len
    check (char_length(btrim(body)) between 1 and 4000)
);

create index clan_post_comments_post_idx
  on public.clan_post_comments (post_id, created_at);

-- Trigger 32.3.t1: ép clan_id của comment = clan_id của post. Tránh
-- client gửi clan_id sai để bypass RLS chéo clan.
create or replace function public.clan_post_comments_sync_clan()
  returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  begin
    new.clan_id := (
      select clan_id from public.clan_posts where id = new.post_id
    );
    if new.clan_id is null then
      raise exception 'Bài không tồn tại';
    end if;
    return new;
  end; $$;

create trigger clan_post_comments_sync_clan_ins
  before insert on public.clan_post_comments
  for each row execute function public.clan_post_comments_sync_clan();

-- Audit log cho moderation (publish/reject/hide/unhide/pin/unpin).
create table public.clan_post_audit (
  id         bigserial primary key,
  post_id    uuid not null references public.clan_posts(id) on delete cascade,
  actor_id   uuid not null references auth.users(id),
  action     text not null
    check (action in ('publish','reject','hide','unhide','pin','unpin','edit')),
  old_status public.clan_post_status,
  new_status public.clan_post_status,
  note       text,
  created_at timestamptz not null default now()
);

create index clan_post_audit_post_idx
  on public.clan_post_audit (post_id, created_at desc);

-- ─── RLS ──────────────────────────────────────────────────────────

alter table public.clan_posts enable row level security;

-- READ: thành viên clan. Non-admin chỉ thấy 'published'; author thấy
-- bài 'pending' của mình; admin clan thấy mọi status.
create policy clan_posts_read
  on public.clan_posts for select
  to authenticated
  using (
    (public.is_clan_member(clan_id) or public.is_platform_admin())
    and (
      status = 'published'
      or author_id = auth.uid()
      or public.is_clan_admin(clan_id)
      or public.is_platform_admin()
    )
  );

-- INSERT:
--   - admin clan: tin chính thức ('published') hoặc nháp ('pending')
--   - member thường: BUỘC 'pending' (chống loạn & spam)
--   - user bị treo: chặn
create policy clan_posts_insert
  on public.clan_posts for insert
  to authenticated
  with check (
    public.is_clan_member(clan_id)
    and author_id = auth.uid()
    and not public.is_caller_suspended()
    and (
      public.is_clan_admin(clan_id)
      or public.is_platform_admin()
      or status = 'pending'
    )
  );

-- UPDATE:
--   - admin clan / platform admin: cập nhật bất kỳ cột.
--   - author: CHỈ sửa nội dung; KHÔNG đổi 'status'/'pinned' —
--     trigger 32.3.t2 ép cột bất biến cho non-admin.
create policy clan_posts_update
  on public.clan_posts for update
  to authenticated
  using (
    public.is_clan_admin(clan_id)
    or public.is_platform_admin()
    or author_id = auth.uid()
  )
  with check (
    public.is_clan_admin(clan_id)
    or public.is_platform_admin()
    or author_id = auth.uid()
  );

-- Trigger 32.3.t2: KEY SECURITY GUARD. RLS một mình không enforce
-- "cột nào được sửa" — trigger ép.
create or replace function public.clan_posts_guard_update()
  returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  declare is_priv boolean;
  begin
    is_priv := public.is_clan_admin(new.clan_id) or public.is_platform_admin();
    if not is_priv then
      new.status    := old.status;
      new.pinned    := old.pinned;
      new.clan_id   := old.clan_id;
      new.author_id := old.author_id;
      -- Vẫn cho sửa title/body/type/person_id/event_id/event_date.
    end if;
    return new;
  end; $$;

create trigger clan_posts_guard_update_trg
  before update on public.clan_posts
  for each row execute function public.clan_posts_guard_update();

-- DELETE: KHÔNG expose. Soft-delete = status='hidden' qua RPC.

alter table public.clan_post_comments enable row level security;

create policy clan_post_comments_read
  on public.clan_post_comments for select
  to authenticated
  using (
    (public.is_clan_member(clan_id) or public.is_platform_admin())
    and (
      status = 'published'
      or author_id = auth.uid()
      or public.is_clan_admin(clan_id)
    )
  );

create policy clan_post_comments_insert
  on public.clan_post_comments for insert
  to authenticated
  with check (
    public.is_clan_member(clan_id)
    and author_id = auth.uid()
    and not public.is_caller_suspended()
  );

create policy clan_post_comments_update
  on public.clan_post_comments for update
  to authenticated
  using (public.is_clan_admin(clan_id) or author_id = auth.uid())
  with check (public.is_clan_admin(clan_id) or author_id = auth.uid());

-- Guard cho comment: non-admin không đổi status/post_id/clan_id/author_id.
create or replace function public.clan_post_comments_guard_update()
  returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  begin
    if not (public.is_clan_admin(new.clan_id) or public.is_platform_admin()) then
      new.status    := old.status;
      new.clan_id   := old.clan_id;
      new.post_id   := old.post_id;
      new.author_id := old.author_id;
    end if;
    return new;
  end; $$;

create trigger clan_post_comments_guard_update_trg
  before update on public.clan_post_comments
  for each row execute function public.clan_post_comments_guard_update();

alter table public.clan_post_audit enable row level security;

create policy clan_post_audit_read
  on public.clan_post_audit for select
  to authenticated
  using (
    public.is_platform_admin()
    or public.is_clan_admin(
      (select clan_id from public.clan_posts where id = post_id)
    )
  );
-- Audit insert KHÔNG expose; chỉ RPC clan_post_moderate ghi.

-- ─── RPC moderation ───────────────────────────────────────────────

create or replace function public.clan_post_moderate(
  p_post_id uuid,
  p_action  text,
  p_note    text default null
) returns void
  language plpgsql security definer
  set search_path = public, pg_temp
  as $$
  declare
    v_post public.clan_posts;
    v_old  public.clan_post_status;
    v_new  public.clan_post_status;
    v_pin  boolean;
  begin
    select * into v_post from public.clan_posts where id = p_post_id;
    if not found then
      raise exception 'Không thấy bài';
    end if;

    if not (public.is_clan_admin(v_post.clan_id) or public.is_platform_admin()) then
      raise exception 'Không có quyền' using errcode = '42501';
    end if;

    v_old := v_post.status;
    v_new := v_old;
    v_pin := v_post.pinned;

    case p_action
      when 'publish' then v_new := 'published';
      when 'reject' then  v_new := 'hidden';
      when 'hide' then    v_new := 'hidden';
      when 'unhide' then  v_new := 'published';
      when 'pin' then     v_pin := true;
      when 'unpin' then   v_pin := false;
      else raise exception 'Action không hợp lệ: %', p_action;
    end case;

    update public.clan_posts
      set status = v_new, pinned = v_pin
      where id = p_post_id;

    insert into public.clan_post_audit
      (post_id, actor_id, action, old_status, new_status, note)
    values
      (p_post_id, auth.uid(), p_action, v_old, v_new, p_note);
  end; $$;

revoke all on function public.clan_post_moderate(uuid, text, text)
  from public, anon;
grant execute on function public.clan_post_moderate(uuid, text, text)
  to authenticated;
