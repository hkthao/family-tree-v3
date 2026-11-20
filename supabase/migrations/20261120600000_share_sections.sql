-- Trang chia sẻ (/share/:token) hiển thị thêm các phần do ADMIN chọn — tab "Tổng quan" dạng card.
-- Mặc định KHÔNG chia sẻ phần nào ngoài cây gia phả (như trước); admin tick từng phần ở Cài đặt.
-- Chỉ áp dụng cho link chia sẻ; trang xem công khai (/xem/clans/…) giữ public_show_* riêng.
--
--   info     — thông tin dòng họ (mô tả, thuỷ tổ, số đời / người, từ đường, giỗ tổ, quê gốc)
--   board    — bảng tin (bài đã đăng, mới nhất)
--   map      — bản đồ (CHỈ số đếm theo tỉnh, không địa chỉ)
--   heritage — di sản
--   graves   — mộ phần & tro cốt (tên, khu vực; KHÔNG toạ độ)
--   honor    — bảng vàng công đức
--   mosaic   — ảnh ghép đại gia đình (bức mới nhất)

alter table public.clans
  add column if not exists share_sections text[] not null default '{}'
    check (share_sections <@ array['info', 'board', 'map', 'heritage', 'graves', 'honor', 'mosaic']::text[]);

comment on column public.clans.share_sections is
  'Các phần hiện ở tab Tổng quan của link chia sẻ (ngoài cây gia phả). Admin chọn; rỗng = chỉ cây.';
