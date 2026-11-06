-- Thêm chuyên mục "Văn khấn & văn tế" cho Sổ tay Văn hoá.
-- ALTER TYPE ... ADD VALUE không dùng được trong cùng transaction với câu dùng giá trị mới;
-- file này chỉ thêm giá trị, không insert bài.
alter type public.custom_category add value if not exists 'van_khan';
