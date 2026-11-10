-- Thông tin biên soạn của sổ gia phả (in ở trang giới thiệu + bìa).
alter table public.clan_book_texts
  add column if not exists origin_place         text,  -- nguyên quán / tổ quán
  add column if not exists ancestral_hall       text,  -- nhà thờ họ: tên, địa chỉ
  add column if not exists ancestor_anniversary text,  -- ngày giỗ tổ (âm lịch)
  add column if not exists chief_name           text,  -- trưởng họ / người chủ trì
  add column if not exists compilers            text,  -- ban biên soạn
  add column if not exists compiled_year        text,  -- năm biên soạn
  add column if not exists contact              text;  -- liên hệ

alter table public.clan_book_texts
  add constraint clan_book_meta_len check (
    char_length(coalesce(origin_place, '')) <= 300
    and char_length(coalesce(ancestral_hall, '')) <= 300
    and char_length(coalesce(ancestor_anniversary, '')) <= 100
    and char_length(coalesce(chief_name, '')) <= 200
    and char_length(coalesce(compilers, '')) <= 500
    and char_length(coalesce(compiled_year, '')) <= 20
    and char_length(coalesce(contact, '')) <= 300
  );
