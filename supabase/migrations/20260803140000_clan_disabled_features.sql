-- Feature-flags theo dòng họ: admin ẩn bớt tính năng phụ để nav gọn.
-- Mô hình OPT-OUT: mảng key tính năng đang TẮT. Rỗng '{}' = bật hết →
-- không phá vỡ dòng họ hiện có (mặc định thấy đầy đủ như trước).
-- Chỉ tính năng phụ mới tắt được; lõi (cây/danh bạ/sự kiện/hôm nay/tổng
-- quan) luôn bật, không nằm trong danh sách này.
alter table public.clans
  add column if not exists disabled_features text[] not null default '{}';
