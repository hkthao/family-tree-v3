# Runbook deploy: trang dòng họ + thiệp khoe + phản hồi ẩn danh + bảo mật công khai

Nhánh `feat/trang-dong-ho`. Dùng placeholder cho mọi địa chỉ / đường dẫn máy chủ (`<db-host>`, `<functions-dir>`…); chi tiết thật nằm ở ghi chú vận hành ngoài repo.
Trước khi bắt đầu: **sao lưu DB** và đọc `docs/bao-mat-trang-cong-khai.md` (rủi ro còn lại).

## 0. Kiểm trước (đã chạy ở local, chạy lại trên nhánh trước khi gộp)
- `npm run typecheck`, `npx vitest run --exclude "src/test/rls/**"` (RLS chỉ chạy trên DB test, KHÔNG chạy trên DB đã có dữ liệu thật), `npm run build`.
- 6 migration đều **idempotent** (chạy lại không lỗi).
- Có thể tắt toàn bộ giao diện mới bằng cách để trống `VITE_CLAN_SITE` (màn Share cũ chạy như trước) — các địa chỉ mới vẫn mở được vì màn cũ bỏ qua đường dẫn con.

## 1. Chuẩn bị cấu hình (chưa ảnh hưởng người dùng)
- GitHub secrets: `VITE_RECAPTCHA_SITE_KEY` (khoá công khai). **Chưa** đặt `VITE_CLAN_SITE` (để bật mặc định ở bước 8).
- Ghi lại biến môi trường sẽ đặt cho function (bước 4): `SITE_ORIGIN`, `RECAPTCHA_SECRET` (tự dán trên máy chủ, không vào chat / repo), `RECAPTCHA_MODE=log`, `RECAPTCHA_HOSTNAMES=<tên miền ứng dụng>`.

## 2. Migration — đợt A (an toàn với bản web CŨ)
Áp thủ công theo đúng thứ tự, mỗi file: `psql … -v ON_ERROR_STOP=1 < file.sql`, rồi ghi vào `supabase_migrations.schema_migrations` (CI KHÔNG áp migration).
1. `20261126100000_share_sections_merge_public_flags.sql` — gộp cờ vào `share_sections` (ưu tiên riêng tư: dòng họ công khai phải tick lại Di sản / Mộ phần / Sự kiện nếu muốn hiện; xem `docs/plan-trang-dong-ho.md` mục 2.2).
2. `20261126110000_share_sections_profiles.sql` — khoá `profiles`.
3. `20261126120000_card_shares_views.sql` — cột lượt xem + `og_image_path`, hàm `khoe_register_view`.

## 3. Sao lưu function hiện tại
Copy thư mục functions hiện có sang `<functions-dir>.bak-<ngày>` để lùi nhanh.

## 4. Edge function (thư mục `supabase/functions/` → `<functions-dir>`)
Copy (ghi đè) các thư mục: `_shared/` (có `recaptcha.ts`, `vendor/postMarkdown.ts`; **đã xoá** `zalo*.ts`), `share-view/` (nhiều file mới: `access.ts`, `parts.ts`, `scope.ts`, `khoe.ts`, `paging.ts`), `og-post/`, `og-khoe/`, `feedback-submit/`, `community-submit/`, `submit-contribution/`, `cleanup-card-shares/`.
- Thêm `[functions.og-post]`, `[functions.og-khoe]`, `[functions.feedback-submit]` (`verify_jwt = false`) vào cấu hình functions của máy chủ (theo `supabase/config.toml`).
- Biến môi trường: `SITE_ORIGIN` cho `og-post` + `og-khoe`; `RECAPTCHA_*` cho `community-submit`, `submit-contribution`, `feedback-submit` (bắt đầu `RECAPTCHA_MODE=log`).
- Khởi động lại container edge-functions. Function Zalo (`zalo-auth`, `zalo-link`, `zalo-webhook`) đã bị xoá khỏi repo: xoá thủ công ở máy chủ khi muốn dọn.
- **Kiểm bằng khoá anon:** `share-view?clan=<id công khai>` trả cây; `share-view?khoe=<token lạ>` → 404 JSON; `og-post?clan=…&id=…` ra HTML có `og:title`; `feedback-submit` POST thiếu `elapsed_ms` → 400.

## 5. Bản web (CI)
Gộp nhánh vào `main` → workflow `deploy-vps` dựng + chạy image mới. Trước đó phải xong bước 1–4 (bản web mới gọi `share-view?part=`, `?khoe=`, `feedback-submit`).
- Kiểm: trang chủ, `/lien-he`, `/chinh-sach-rieng-tu` (có mục reCAPTCHA), một link `/share/<token>` và `/khoe/<token>` cũ vẫn mở được.

## 6. Migration — đợt B (CHỈ sau khi bản web mới đã chạy)
4. `20261126130000_feedback_guest_via_function.sql` — thu hồi INSERT của anon trên `feedback`.
5. `20261126140000_card_shares_private_read.sql` — thiệp khoe không đọc thẳng được; kho ảnh chỉ thành viên ghi.
6. `20261126150000_resting_places_hide_sensitive_from_anon.sql` — mộ phần chỉ thành viên đọc bảng.
- Kiểm sau từng cái: gửi thử `/lien-he` khi chưa đăng nhập (200); mở `/khoe/<token còn hạn>` (hiện thiệp); `GET /rest/v1/card_shares` bằng khoá anon trả rỗng / lỗi quyền; trang Mộ phần của một dòng họ công khai vẫn hiện danh sách.

## 7. Máy chủ web (nginx) và log
- Thẻ OG cho trình quét: các khối trong `docs/og-post-nginx.md` (`/share/<token>/bang-tin/*`, `/xem/clans/*/bang-tin/*`, `/nguoi/*`, `/khoe/*`); **bỏ khối cũ** chuyển `/khoe/` sang trang OG tĩnh.
- **Đặt lại `X-Forwarded-For`** bằng IP kết nối thật (không nối vào giá trị khách gửi) — nếu không, trần tốc độ ở 4 function khách bị né được.
- CSP (nếu có) cho phép `www.google.com`, `www.gstatic.com`.
- Kiểm: `curl -A facebookexternalhit/1.1 <địa chỉ bài>` ra thẻ OG; `curl <địa chỉ bài>` ra ứng dụng như thường; dán link khoe vào công cụ gỡ lỗi chia sẻ của Facebook / gửi thử Zalo.

## 8. Bật giao diện mới mặc định (khi đã yên tâm)
Đặt GitHub secret `VITE_CLAN_SITE=1`, chạy lại workflow. Lùi: xoá secret, chạy lại workflow (hoặc người dùng thêm `?site=0`).

## 9. reCAPTCHA: log → enforce
Sau vài ngày `RECAPTCHA_MODE=log`, xem log function (`{"evt":"captcha",…}`): điểm người thật thường ≥ 0,5. Rồi chuyển `enforce`. Sự cố → hạ về `log` / `off`, khởi động lại function.

## 10. MCP
Dựng lại và triển khai `mcp-server` (có `list_share_links` mới, `get_clan_info` kèm `share_sections`) theo quy trình máy chủ MCP.

## Lùi (rollback)
- **Web / giao diện:** bỏ `VITE_CLAN_SITE`, hoặc chạy lại image trước (`docker run <image>:<sha trước>`).
- **Function:** khôi phục thư mục sao lưu ở bước 3, khởi động lại.
- **Migration đợt B** (nếu buộc phải lùi):
  - 130000: `drop policy feedback_insert_authenticated on public.feedback; create policy feedback_insert_anyone on public.feedback for insert to anon, authenticated with check (user_id is null or user_id = auth.uid()); grant insert on public.feedback to anon;`
  - 140000: `drop policy card_shares_manager_read on public.card_shares; create policy card_shares_public_read on public.card_shares for select to anon, authenticated using (expires_at > now());` và tạo lại 3 policy kho ảnh `card-shares select/insert/update auth` (`bucket_id = 'card-shares'`).
  - 150000: tạo lại `resting_places_select`, `rpo_select`, `rpp_select` bản cũ trong `20261126100000_…sql`, `grant select … to anon`.
- Migration đợt A là cộng thêm / siết quyền đọc theo hướng riêng tư; không cần lùi.
