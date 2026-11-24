# Hàm `publish-so-tay` (đăng bài Sổ tay bằng commit GitHub) — ĐÃ GỠ GIAO DIỆN, CHƯA TRIỂN KHAI

> **Trạng thái:** trang soạn bài `/so-tay/soan`, nút nổi "Soạn bài" trong app và CMS Sveltia (`/admin/` của content-site) đã bị **gỡ**
> vì chưa đạt yêu cầu bảo mật/vận hành. Hàm `supabase/functions/publish-so-tay` (và test của nó) vẫn nằm trong repo để dùng lại cho
> kế hoạch **MCP**, nhưng **chưa triển khai lên prod, chưa cấu hình token GitHub**. Không có đường nào trong app gọi tới hàm này.
> Hiện bài Sổ tay/Blog được thêm bằng cách sửa tệp `content-site/content/so-tay/*.md` (hoặc skill `so-tay-viet-bai`), commit rồi deploy.
> Phần dưới mô tả thiết kế cũ của hàm, giữ để tham khảo.

## Luồng
1. App gọi Edge Function `publish-so-tay` (JWT + kiểm `profiles.is_platform_admin`).
2. Hàm kiểm tra dữ liệu (độ dài, chủ đề, chặn `<script>`/`<iframe>`/`onclick`/`javascript:`), dựng tệp
   `content-site/content/so-tay/<slug>.md` và **commit lên nhánh** qua GitHub API.
   - Đã có bài cùng slug → trả `409 exists`, app hỏi xác nhận rồi gửi lại với `overwrite`.
3. Chỉ khi **Đăng** (status `published`) hàm mới chạy workflow `deploy-vps.yml` (`workflow_dispatch`). Workflow build image app
   (kèm dữ liệu Sổ tay cho app) và build content-site, gộp vào landing → bài hiện ở **cả web lẫn app sau vài phút**.
   **Lưu chờ duyệt** chỉ commit, không deploy, bài chưa hiện ra ngoài.
4. Mỗi lần Đăng là một lần deploy đầy đủ (workflow có `concurrency` nên nhiều lần Đăng sẽ xếp hàng).

## Cấu hình máy chủ (một lần, KHÔNG đưa giá trị thật vào repo)
Biến môi trường cho hàm `publish-so-tay` (self-host: thêm vào `docker-compose.override.yml` của service edge-functions, giống
cách cấu hình SMTP cho các hàm gửi mail):

| Biến | Ý nghĩa |
|---|---|
| `GITHUB_TOKEN` | Fine-grained token chỉ cho repo này: **Contents: Read and write**, **Actions: Read and write** |
| `GITHUB_REPO` | `chủ/tên-repo` |
| `GITHUB_BRANCH` | Nhánh để commit, mặc định `main` (nếu nhánh có bảo vệ, dùng nhánh khác hoặc cho phép token) |
| `GITHUB_DEPLOY_WORKFLOW` | Tên tệp workflow, mặc định `deploy-vps.yml` |

Triển khai hàm theo quy trình self-host hiện có (chép thư mục `supabase/functions/publish-so-tay` và `_shared` vào volume
functions rồi khởi động lại container edge-functions), xác minh bằng JWT của một admin. Chưa triển khai: mới chạy ở local.

## Giới hạn / lưu ý
- Hàm ghi thẳng vào nhánh đã cấu hình bằng danh tính của token (commit hiện dưới tài khoản chủ token).
- Bài đăng bằng trang này luôn dùng khuôn tối thiểu (tiêu đề, mô tả, chủ đề, thẻ, tên gọi khác, vùng, thời điểm, nội dung).
  Các trường nâng cao (infobox, ảnh có ghi công, FAQ, nguồn) sửa trực tiếp trong tệp .md.
- Ghi đè bài đã có: hàm hỏi xác nhận; riêng bài có thông tin nhanh / ảnh / FAQ / nguồn / bài liên quan (như 10 bài lễ hội) bị **từ chối** (`409 rich`) vì khuôn tối thiểu sẽ làm mất các phần đó — sửa những bài này trực tiếp trong tệp .md.
