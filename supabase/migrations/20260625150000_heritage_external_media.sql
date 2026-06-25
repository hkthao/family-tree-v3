-- Cho phép heritage_media trỏ tới LINK NGOÀI (ảnh/audio/video host ở nơi
-- khác: YouTube, Drive, URL ảnh…) thay vì tải lên bucket. Dùng khi dung
-- lượng VPS đã đầy hoặc muốn nhúng video. Link ngoài KHÔNG tính vào trần
-- (bytes để null).
--
-- - Thêm loại 'video' vào enum.
-- - path trở thành nullable; thêm external_url; ràng buộc có đúng một nguồn.

alter type public.heritage_media_kind add value if not exists 'video';

alter table public.heritage_media alter column path drop not null;
alter table public.heritage_media add column external_url text;

-- Mỗi media phải có ÍT NHẤT một nguồn: file đã tải (path) hoặc link ngoài.
alter table public.heritage_media
  add constraint heritage_media_source_chk
  check (path is not null or external_url is not null);
