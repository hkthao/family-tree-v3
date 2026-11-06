-- Danh mục đơn vị hành chính (tỉnh/thành → xã/phường), hệ 2 cấp từ 01/07/2025.
-- Bảng tham chiếu cho địa chỉ thành viên (xem docs/plan-thong-ke-ban-do.md).
-- Đọc: mọi user đăng nhập. Ghi: chỉ platform admin.

create table public.vn_provinces (
  code          text primary key,
  name          text not null,
  name_unaccent text not null,
  region        text not null check (region in ('bac', 'trung', 'nam')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint vn_provinces_name_len check (char_length(btrim(name)) between 1 and 100)
);

create table public.vn_wards (
  code          text primary key,
  province_code text not null references public.vn_provinces(code) on update cascade,
  name          text not null,
  name_unaccent text not null,
  kind          text not null default 'xa' check (kind in ('xa', 'phuong', 'dac_khu')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint vn_wards_name_len check (char_length(btrim(name)) between 1 and 100)
);

create index vn_wards_province_idx on public.vn_wards (province_code, name_unaccent);

create trigger vn_provinces_set_updated_at
  before update on public.vn_provinces
  for each row execute function public.set_updated_at();
create trigger vn_wards_set_updated_at
  before update on public.vn_wards
  for each row execute function public.set_updated_at();

alter table public.vn_provinces enable row level security;
alter table public.vn_wards enable row level security;

create policy vn_provinces_read on public.vn_provinces
  for select to authenticated using (true);
create policy vn_provinces_admin_write on public.vn_provinces
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());

create policy vn_wards_read on public.vn_wards
  for select to authenticated using (true);
create policy vn_wards_admin_write on public.vn_wards
  for all to authenticated
  using (public.is_platform_admin()) with check (public.is_platform_admin());
