-- ============================================================================
-- Sổ tay Văn hoá v2: nguồn gốc ĐA GIÁ TRỊ + liên kết bài liên quan.
--   • origin (1 giá trị) → origins custom_origin[] (nhiều lớp: Đạo giáo, Phật
--     giáo, dân gian, Trung Hoa…).
--   • related_ids uuid[]: các bài liên quan (nền cho "hành trình liên kết").
-- Ảnh minh hoạ trong thân bài KHÔNG cần cột mới — lưu trong sections jsonb
-- ([{heading, body, image_url?, image_caption?}]).
-- ============================================================================

alter table public.custom_entries
  add column origins public.custom_origin[] not null default '{}',
  add column related_ids uuid[] not null default '{}';

-- Giữ dữ liệu cũ: gói origin đơn thành mảng.
update public.custom_entries
  set origins = array[origin]
  where origin is not null;

alter table public.custom_entries drop column origin;
