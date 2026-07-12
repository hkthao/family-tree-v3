-- ============================================================================
-- platform_settings — cấu hình nền tảng dạng key/value (động, không cần deploy).
--
-- Dùng cho: demo_clan_id (dòng họ demo hiện nút "Xem thử" ở trang Đăng nhập)…
-- Đọc: CÔNG KHAI (kể cả khách chưa đăng nhập — vd trang /login cần đọc demo).
-- Đây là cấu hình KHÔNG nhạy cảm. Ghi: chỉ platform admin.
-- ============================================================================

create table public.platform_settings (
  key        text primary key,
  value      text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

alter table public.platform_settings enable row level security;

-- Đọc công khai (config không nhạy cảm).
create policy platform_settings_read on public.platform_settings
  for select using (true);

-- Ghi (thêm/sửa/xoá): chỉ platform admin.
create policy platform_settings_write on public.platform_settings
  for all using (public.is_platform_admin())
  with check (public.is_platform_admin());

grant select on public.platform_settings to anon, authenticated;
