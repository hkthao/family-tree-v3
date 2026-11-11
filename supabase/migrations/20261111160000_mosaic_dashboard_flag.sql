-- Chọn bức ảnh ghép hiển thị ở màn Tổng quan. Không bức nào được chọn thì Tổng quan lấy
-- bức đầu tiên trong danh sách.
alter table public.clan_mosaics
  add column if not exists show_on_dashboard boolean not null default false;
