# Đưa Sổ tay / Blog (nguồn tệp) lên prod

Bài Sổ tay trước đây nằm trong bảng `custom_entries`; nay nguồn là tệp `content-site/content/so-tay/*.md`. `deploy-vps.yml` KHÔNG áp
migration và không xuất dữ liệu DB, nên **trước khi deploy** phải làm tay hai việc dưới đây, nếu không: (1) các bài đang có trong DB prod
sẽ biến mất khỏi app, (2) nút lưu bài (bookmark) báo lỗi vì cột `custom_bookmarks.entry_id` vẫn là kiểu uuid.

Thay `<máy DB>` và `<container db>` bằng alias SSH và tên container đã dùng khi áp migration (xem ghi chú hạ tầng, không đưa IP/hostname thật vào repo).

## 1. Xuất bài đang có trên prod ra tệp
```bash
# a. dump bài còn hoạt động thành JSON (chỉ đọc)
ssh <máy DB> "docker exec -i <container db> psql -U postgres -d postgres -At -c \
  \"select coalesce(json_agg(t),'[]') from (select * from custom_entries where deleted_at is null) t\"" > /tmp/entries.json

# b. chuyển thành tệp .md (giữ nguyên trạng thái từng bài; KHÔNG ghi đè bài viết tay có infobox/ảnh/lead)
cd content-site && node scripts/export-db.mjs --file /tmp/entries.json --overwrite
git status content-site     # xem bài nào mới / đổi; đọc các dòng "GIỮ NGUYÊN…" nếu có trùng địa chỉ
```
Kết quả phụ ở `content-site/.export/` (đã `.gitignore`): `id-map.json` (uuid → slug) và `bookmarks-to-slug.sql`.
Bài "Lễ Vu Lan báo hiếu" được gộp vào bài `le-vu-lan` (khai báo `MERGE` trong script; thêm dòng nếu có bài trùng chủ đề khác).
Commit các tệp `.md` mới/đổi.

## 2. Áp migration bookmark + đổi bookmark cũ sang slug
```bash
cat supabase/migrations/20261125100000_so_tay_static_source.sql | ssh <máy DB> \
  'docker exec -i <container db> psql -U postgres -d postgres -q -1 -v ON_ERROR_STOP=1'
cat content-site/.export/bookmarks-to-slug.sql | ssh <máy DB> \
  'docker exec -i <container db> psql -U postgres -d postgres -q -1 -v ON_ERROR_STOP=1'
# ghi vào bảng theo dõi + nạp lại schema
ssh <máy DB> "docker exec -i <container db> psql -U postgres -d postgres -c \
  \"insert into supabase_migrations.schema_migrations(version,name) values('20261125100000','so_tay_static_source') on conflict do nothing; notify pgrst, 'reload schema';\""
```
Thứ tự này an toàn với bản app cũ đang chạy: cột chuyển sang `text` vẫn nhận uuid như trước.
Bảng `custom_entries` được GIỮ NGUYÊN (chỉ đọc) để quay lại; chỉ DROP ở migration riêng sau khi chạy ổn vài tuần.

## 3. Deploy
```bash
git push origin main
gh workflow run deploy-vps.yml --ref main
```
Workflow build image app (có stage build content-site cho dữ liệu Sổ tay) và build content-site gộp vào landing. Kiểm sau deploy:
`/blog.html`, `/le-hoi.html`, `/huong-dan.html` trên landing; `/so-tay` trong app (đủ bài, tìm kiếm không dấu, lưu bài).
Hàm `publish-so-tay` (nút Đăng) chưa cần: chỉ triển khai khi đã cấu hình token GitHub (xem docs/dang-bai-so-tay.md).

## Quay lại nếu có sự cố
Đưa image app về tag trước (xem `docs/` deploy; image gắn theo SHA), landing: chạy lại workflow ở commit trước. DB: migration chỉ đổi kiểu cột
bookmark, không mất dữ liệu; `custom_entries` còn nguyên.
