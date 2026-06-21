-- QR tại mộ: cho phép share link trỏ tới một NƠI AN NGHỈ (mộ / tháp họ),
-- không chỉ một người. Dùng cho QR dán/khắc tại mộ — quét ra trang công
-- khai của mộ (thông tin + người an nghỉ + chỉ đường + ảnh).
--
-- Mirror cột root_person_id sẵn có; scope mới = 'resting_place'.

alter table public.share_links
  add column if not exists root_resting_place_id uuid
    references public.resting_places(id) on delete cascade;
