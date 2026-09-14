-- ============================================================================
-- Podcast — các tập đăng trên Trang Facebook của nền tảng, kéo về để nghe
-- ngay trong app.
--
-- Nội dung TOÀN NỀN TẢNG (giống Sổ tay Văn hoá), không thuộc dòng họ nào:
-- đọc cho mọi người, ghi chỉ platform admin, còn việc đồng bộ do edge
-- function chạy bằng service role.
--
-- Vì sao lưu lại thay vì gọi thẳng Facebook mỗi lần mở trang:
--   1. Token của Facebook nằm ở phía máy chủ, không thể để lộ ra trình duyệt.
--   2. Mỗi lần mở trang mà gọi Graph API là dính giới hạn tần suất của Meta.
--   3. Facebook đổi API hoặc token chết thì app vẫn còn danh sách cũ để hiện,
--      thay vì trắng trang.
-- ============================================================================

create table public.podcast_episodes (
  id uuid primary key default gen_random_uuid(),
  -- Khoá theo id video bên Facebook: đồng bộ lại nhiều lần vẫn không nhân bản.
  fb_video_id text not null unique,
  -- Tiêu đề rút từ dòng đầu phần mô tả; admin sửa lại được và bản sửa được
  -- GIỮ NGUYÊN qua các lần đồng bộ sau (xem cột title_edited).
  title text not null check (char_length(title) <= 300),
  description text,
  permalink_url text not null,
  -- Ảnh bìa lấy từ Facebook. URL của họ có hạn dùng nên mỗi lần đồng bộ ghi đè
  -- lại; hỏng ảnh thì trang vẫn chạy, chỉ mất cái hình.
  thumbnail_url text,
  duration_seconds numeric,
  published_at timestamptz not null,
  -- Admin ẩn tập không phù hợp mà không cần xoá — lần đồng bộ sau sẽ không
  -- lôi nó về lại.
  is_visible boolean not null default true,
  -- Admin đã sửa tiêu đề → đồng bộ sau đừng ghi đè lên công sức đó.
  title_edited boolean not null default false,
  synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index podcast_episodes_published_idx
  on public.podcast_episodes (published_at desc);

create trigger podcast_episodes_set_updated_at
  before update on public.podcast_episodes
  for each row execute function public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────────────
alter table public.podcast_episodes enable row level security;

-- Đọc: ai cũng xem được tập đang hiện; admin thấy cả tập đã ẩn.
create policy podcast_episodes_select on public.podcast_episodes
  for select to authenticated
  using (is_visible or public.is_platform_admin());

-- Khách chưa đăng nhập cũng xem được — podcast là thứ để lan ra ngoài, bắt
-- đăng nhập mới nghe được thì chẳng ai nghe.
grant select on public.podcast_episodes to anon;
create policy podcast_episodes_public_read on public.podcast_episodes
  for select to anon
  using (is_visible);

-- Ghi: chỉ platform admin (edge function dùng service role nên không qua đây).
create policy podcast_episodes_insert on public.podcast_episodes
  for insert to authenticated
  with check (public.is_platform_admin());
create policy podcast_episodes_update on public.podcast_episodes
  for update to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
create policy podcast_episodes_delete on public.podcast_episodes
  for delete to authenticated
  using (public.is_platform_admin());

-- ── Cấu hình ───────────────────────────────────────────────────────────────
-- Công tắc hiện/ẩn mục Podcast trong app, và dấu vết lần đồng bộ gần nhất.
--
-- Mốc đồng bộ phải ghi lại được thì mới cảnh báo được khi token Facebook
-- chết: nó chết ÂM THẦM, app vẫn chạy, chỉ là không bao giờ có tập mới nữa.
insert into public.platform_settings (key, value)
values
  ('podcast.enabled', 'true'),
  ('podcast.last_sync_at', '""'),
  ('podcast.last_sync_error', '""')
on conflict (key) do nothing;

-- ── Lịch đồng bộ ───────────────────────────────────────────────────────────
-- Mỗi 6 tiếng là đủ: podcast ra vài ngày một tập, gọi dày hơn chỉ tốn hạn
-- mức Graph API. Chỉ đặt lịch khi pg_cron + pg_net có sẵn (Supabase Cloud
-- có, docker local thì không).
--
-- Thân cron đọc hai GUC, người vận hành đặt một lần:
--   alter database postgres
--     set app.sync_podcast_url = 'https://<host>/functions/v1/sync-podcast';
--   alter database postgres set app.sync_podcast_token = '<CRON_TOKEN>';
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron')
     and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sync-podcast';

    perform cron.schedule(
      'sync-podcast',
      '17 */6 * * *',  -- lệch phút 17 để không đụng giờ chạy của các job khác
      $cron$
      select net.http_post(
        url := current_setting('app.sync_podcast_url', true),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Token', current_setting('app.sync_podcast_token', true)
        ),
        body := '{}'::jsonb
      );
      $cron$
    );
  end if;
end$$;
