-- Sổ tay Văn hoá chuyển nguồn bài viết từ bảng custom_entries sang tệp (content-site/content/so-tay → so-tay-data/*.json).
-- Bước 1 (migration này, an toàn): đổi bookmark sang khoá theo slug và bỏ nhánh 'custom' khỏi tìm kiếm toàn cục.
-- Bảng custom_entries GIỮ NGUYÊN (chỉ đọc) để rollback; sẽ DROP ở một migration riêng sau khi chạy ổn.
--
-- LƯU Ý khi áp lên prod: custom_bookmarks.entry_id hiện là uuid của custom_entries. Trước khi chạy phải có bảng ánh xạ
-- uuid → slug (xuất cùng lúc với bài từ DB bằng content-site/scripts/export-db.mjs) và cập nhật lại các dòng bookmark
-- (UPDATE ... SET entry_id = slug) NGAY SAU bước đổi kiểu cột; nếu không, bookmark cũ sẽ trỏ tới uuid không còn ý nghĩa.

alter table public.custom_bookmarks drop constraint if exists custom_bookmarks_entry_id_fkey;
alter table public.custom_bookmarks alter column entry_id type text using entry_id::text;
alter table public.custom_bookmarks add constraint custom_bookmarks_entry_id_len check (char_length(entry_id) between 1 and 160);
