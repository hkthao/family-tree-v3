-- heritage_items.sections ----------------------------------------------------
-- Nội dung di sản nhiều ĐOẠN có tiêu đề (vd Chúc thư: LỜI NÓI ĐẦU, Chúc thư,
-- Dịch từ chúc thư, Phụ lục…). Mảng JSON [{heading, body}].
--
-- CỘNG THÊM, không đụng dữ liệu cũ: cột `body`/`summary` giữ nguyên. Mục cũ
-- (sections rỗng) vẫn hiển thị bằng body như trước; mục mới dùng sections.
-- RLS kế thừa từ heritage_items (không cần policy mới).

alter table public.heritage_items
  add column sections jsonb not null default '[]'::jsonb;
