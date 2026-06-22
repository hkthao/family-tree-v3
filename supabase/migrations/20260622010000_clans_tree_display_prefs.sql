-- Tuỳ chọn hiển thị cấp dòng họ (trước đây là toggle per-user trên cây).
-- Quản trị dòng họ bật/tắt, áp cho cả cây trên màn hình lẫn sơ đồ cây
-- trong sách PDF xuất ra:
--   display_death_details  : người đã mất hiện thêm ngày giỗ + tuổi thọ
--   display_living_full_dob: người sống hiện đầy đủ ngày-tháng-năm sinh
-- Mặc định tắt để giữ thẻ gọn như cũ.

alter table public.clans
  add column if not exists display_death_details boolean not null default false,
  add column if not exists display_living_full_dob boolean not null default false;
