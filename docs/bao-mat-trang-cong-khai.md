# Rà soát bảo mật các trang công khai trước khi deploy (25/11/2026)

Phạm vi: trang dòng họ (`/share/:token/*`, `/xem/clans/:id/*`), thiệp khoe (`/khoe/:token`), thẻ OG (`og-post`, `og-khoe`), các function nhận dữ liệu
của khách (`community-submit`, `submit-contribution`, `feedback-submit`), RLS + kho ảnh liên quan. Không đưa địa chỉ máy chủ / khoá vào tài liệu này.

## Đã sửa trong đợt rà soát
| # | Phát hiện | Cách xử lý |
|---|---|---|
| 1 | `card_shares_public_read`: bất kỳ ai có khoá anon (công khai) liệt kê được MỌI thiệp còn hạn của mọi dòng họ, kèm `token` → token bí mật mất tác dụng | Migration `20261126140000`: bỏ policy, chỉ người tạo / người sửa được dòng họ đọc; `/khoe` đọc qua `share-view?khoe=` (service role, chỉ thiệp còn hạn, 404 trơn) |
| 2 | Kho ảnh `card-shares`: mọi người đã đăng nhập liệt kê / ghi đè ảnh của dòng họ khác | Cùng migration: chỉ thành viên dòng họ ghi / liệt kê trong thư mục `<clan_id>/` của họ; ảnh vẫn xem được qua URL công khai. Test RLS `card_shares.test.ts` |
| 3 | `/lien-he`: khách INSERT thẳng vào `feedback` bằng quyền anon, không có cổng máy chủ | Function `feedback-submit` (captcha, bẫy bot, thời gian điền, trần theo băm IP + trần chung, ≤ 3 link); migration `20261126130000` thu hồi INSERT của anon |
| 4 | Biểu mẫu khách (kỷ niệm / trả lời / khoanh mặt / đề xuất sửa) chỉ có bẫy bot + trần | reCAPTCHA v3 phía máy chủ (`_shared/recaptcha.ts`) + phía trình duyệt; mặc định `RECAPTCHA_MODE=off`, bật `log` rồi `enforce` |
| 5 | Danh sách mộ phần / tìm kiếm hiện tên người đã bị xoá mềm | `share-view/parts.ts` lọc `deleted_at` |
| 6 | Nút "Facebook" trên bài viết đẩy thẳng link có token (chìa khoá mở cả trang dòng họ) lên Facebook | Chỉ hiện ở trang công khai; link riêng chỉ còn "Chia sẻ" của hệ điều hành + Sao chép |

Đã kiểm, không thấy lỗi: Markdown bài viết (`rehype-raw` + `rehype-sanitize` mặc định, chỉ thêm `figure/figcaption/img`; chặn script, `on*`, `javascript:`);
thẻ OG (`escapeHtml` mọi trường, đường dẫn ảnh mã hoá từng đoạn, người còn sống → 404); `part=person` (người còn sống chỉ tên + đời, link cây con bị chặn ngoài phạm vi,
không toạ độ); mọi truy vấn lọc `clan_id`; token 32 ký tự không đoán được; `robots.txt` + `noindex` cho `/share/` và `/khoe/`.

## Rủi ro còn lại — cần bạn quyết / làm khi deploy
1. **IP của khách (rate limit) lấy từ phần ĐẦU của `X-Forwarded-For`** — nếu máy chủ web chuyển tiếp nguyên giá trị khách gửi lên thì có thể giả IP để né trần
   (share-view, community-submit, submit-contribution, feedback-submit). Khi deploy: cấu hình proxy ĐẶT LẠI `X-Forwarded-For` bằng IP kết nối thật (không nối thêm vào giá trị của khách).
2. **RLS cho phép đọc thẳng qua REST (khoá anon) các bảng `resting_places` (kể cả toạ độ, địa chỉ chi tiết), `events` (kể cả ghi chú), `heritage_*`** của dòng họ công khai
   khi khoá tương ứng bật. Trang dòng họ cố ý ẩn toạ độ / địa chỉ mộ, nhưng ai gọi REST vẫn thấy. Muốn thật sự ẩn: thay bằng view chỉ có cột an toàn (việc riêng, chưa làm). Hiện là hành vi cũ, admin chủ động bật khoá.
3. **`khoe_register_view` gọi được bằng khoá anon, không giới hạn** → có thể bơm số lượt xem (chỉ ảnh hưởng con số). Chấp nhận; nếu cần thì thêm trần theo IP trong function.
4. **`Cache-Control: public, max-age=60`** trên phản hồi share-view: link vừa thu hồi vẫn còn dùng được tối đa ~1 phút ở bộ nhớ đệm.
5. **Ảnh trong bài Markdown tải từ máy chủ ngoài** → máy chủ ảnh thấy IP người xem (không thấy token vì trình duyệt chỉ gửi origin ở `Referer`). Mức thấp.
6. **Token nằm trong URL** → có trong log truy cập của máy chủ web; xoay log định kỳ, đừng gửi log ra ngoài.
7. **Chưa có CSP** ở máy chủ web. Khi thêm CSP phải cho phép `www.google.com`, `www.gstatic.com` (reCAPTCHA) và nguồn ảnh Supabase.
8. **Nội dung admin gõ (`info`, `events`, `honor`, bài viết) hiện nguyên văn** khi khoá bật — cố ý; admin chịu trách nhiệm không đưa thông tin riêng tư vào các khoá đó.
9. reCAPTCHA đang tắt cho tới khi đặt `RECAPTCHA_SECRET` + `RECAPTCHA_MODE`; chỉ chuyển `enforce` sau vài ngày `log` thấy điểm hợp lý.

## Thứ tự deploy an toàn
1. Edge function: `share-view`, `og-post`, `og-khoe` (+ `SITE_ORIGIN`), `feedback-submit`, `community-submit`, `submit-contribution`, `cleanup-card-shares` (+ `_shared/`), và bản web mới (có `VITE_RECAPTCHA_SITE_KEY`).
2. Migration theo thứ tự: `…100000` (gộp cờ) → `…110000` (profiles) → `…120000` (lượt xem thiệp) → **`…130000` (thu hồi INSERT anon của feedback)** → **`…140000` (siết thiệp khoe + kho ảnh)**. Hai cái cuối chỉ áp SAU khi bước 1 chạy, nếu không bản web cũ không gửi được phản hồi / không mở được thiệp.
3. nginx: OG cho `/share/<token>/bang-tin/*`, `/nguoi/*`, `/khoe/*` (`docs/og-post-nginx.md`); đặt lại `X-Forwarded-For`.
4. Biến môi trường function reCAPTCHA (`RECAPTCHA_MODE=log` trước) — xem `docs/plan-recaptcha-public.md`.
5. Kiểm sau deploy: mở một link `/khoe/…` còn hạn và một link hết hạn; gửi thử `/lien-he` khi chưa đăng nhập; gọi REST `card_shares` bằng khoá anon phải trả rỗng; `curl -A facebookexternalhit` ra thẻ OG.
