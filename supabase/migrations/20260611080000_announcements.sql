-- Phase B của plan.md §32.2 — Announcements (thông báo hệ thống).
--
-- Broadcast channel từ platform admin tới mọi user. Cũng dùng làm
-- nguồn duy nhất cho trang changelog public (rows với is_public=true).

create type public.announcement_level
  as enum ('info', 'update', 'warning', 'critical');

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  level        public.announcement_level not null default 'info',
  published_at timestamptz,
  expires_at   timestamptz,
  is_public    boolean not null default false,
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint announcements_title_len
    check (char_length(btrim(title)) between 1 and 200),
  constraint announcements_body_len
    check (char_length(btrim(body)) between 1 and 20000),
  constraint announcements_expires_after_published
    check (expires_at is null or published_at is null or expires_at > published_at)
);

create index announcements_published_idx
  on public.announcements (published_at desc)
  where published_at is not null;

-- Generic updated_at bumper — đặt trong migration này lần đầu, dùng
-- lại cho clan_posts ở §32.3 sau.
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  as $$
  begin
    new.updated_at := now();
    return new;
  end; $$;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();

-- Đánh dấu đã đọc, dùng cho badge "chưa đọc" trên chuông.
create table public.announcement_reads (
  user_id         uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index announcement_reads_ann_idx
  on public.announcement_reads (announcement_id);

-- ─── RLS — khoá theo role tường minh ──────────────────────────────

alter table public.announcements enable row level security;

-- Authenticated user đọc tin đã đăng + chưa hết hạn.
create policy announcements_read_auth
  on public.announcements for select
  to authenticated
  using (
    published_at is not null and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- Anon CHỈ đọc tin is_public=true (nuôi trang changelog public).
create policy announcements_read_anon
  on public.announcements for select
  to anon
  using (
    is_public = true
    and published_at is not null and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- Platform admin xem cả nháp (mọi row).
create policy announcements_admin_read
  on public.announcements for select
  to authenticated
  using (public.is_platform_admin());

-- Chỉ platform admin được tạo/sửa/xoá.
create policy announcements_admin_write
  on public.announcements for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.announcement_reads enable row level security;

create policy announcement_reads_owner
  on public.announcement_reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ─── RPCs ─────────────────────────────────────────────────────────

-- Đếm số tin chưa đọc — tránh client tự ghép 2 query.
create or replace function public.announcements_unread_count()
  returns integer
  language sql stable
  security definer
  set search_path = public, pg_temp
  as $$
    select count(*)::int
    from public.announcements a
    where a.published_at is not null and a.published_at <= now()
      and (a.expires_at is null or a.expires_at > now())
      and not exists (
        select 1 from public.announcement_reads r
        where r.announcement_id = a.id and r.user_id = auth.uid()
      );
  $$;

-- Đánh dấu mọi tin đã đăng (chưa hết hạn) là đã đọc bởi caller. Trả
-- về số dòng được chèn mới (idempotent: rerun = 0).
create or replace function public.announcements_mark_all_read()
  returns integer
  language plpgsql
  security definer
  set search_path = public, pg_temp
  as $$
  declare n integer;
  begin
    if auth.uid() is null then
      raise exception 'Not authenticated';
    end if;
    insert into public.announcement_reads(user_id, announcement_id)
    select auth.uid(), a.id
    from public.announcements a
    where a.published_at is not null and a.published_at <= now()
      and (a.expires_at is null or a.expires_at > now())
    on conflict do nothing;
    get diagnostics n = row_count;
    return n;
  end; $$;

revoke all on function public.announcements_unread_count() from public, anon;
revoke all on function public.announcements_mark_all_read() from public, anon;
grant execute on function public.announcements_unread_count() to authenticated;
grant execute on function public.announcements_mark_all_read() to authenticated;
