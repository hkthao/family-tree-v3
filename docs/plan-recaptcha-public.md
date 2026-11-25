# Plan: Google reCAPTCHA cho các trang public để chống spam

Trạng thái (25/11/2026): **bước 2–3 đã code ở local, chạy ở chế độ TẮT mặc định** — `supabase/functions/_shared/recaptcha.ts` (+ test `recaptcha.test.ts`) đã gắn vào `community-submit`
(action `guest_face` / `guest_answer` / `guest_memory`, trường form `captcha_token`) và `submit-contribution` (action `guest_contribution`, trường JSON `captcha_token`), đặt TRƯỚC mọi truy vấn DB.
Biến môi trường của function: `RECAPTCHA_MODE=off|log|enforce` (mặc định off), `RECAPTCHA_SECRET`, `RECAPTCHA_MIN_SCORE` (0,5), `RECAPTCHA_BLOCK_SCORE` (0,3), `RECAPTCHA_HOSTNAMES` (csv),
`RECAPTCHA_FAIL_OPEN` (mặc định mở; `0` = đóng), `RECAPTCHA_TIMEOUT_MS` (3000). Mỗi lần xác minh in một dòng log JSON `{"evt":"captcha",…}` (không có mã thông báo / IP). Đã dùng các mặc định đề xuất cho
câu hỏi mở 3 (mở có kiểm soát) và 4 (ngưỡng 0,5 / 0,3, chỉ ghi log, chưa có bảng `captcha_events`); câu 1, 2, 5 vẫn chờ bạn. **Bước 4 đã code (local):** `src/lib/recaptcha.ts` (nạp script khi cần, lấy mã lúc bấm gửi, không bao giờ ném lỗi / treo), `CaptchaNotice` (dòng bắt buộc của Google + ẩn huy hiệu), gắn vào `submitGuestMemory` / `submitGuestFace` / `submitGuestContribution`; site key qua `VITE_RECAPTCHA_SITE_KEY` (Dockerfile + deploy-vps.yml đã có build-arg; thêm secret GitHub cùng tên). Cập nhật Chính sách quyền riêng tư. Tên miền đăng ký với Google: tên miền của ứng dụng (+ `localhost` nếu muốn thử ở máy); `RECAPTCHA_HOSTNAMES` của function phải khớp. **Bước 5 đã code (local):** function `feedback-submit` (captcha action `feedback`, bẫy bot, thời gian điền tối thiểu 1,5 giây, trần 5/giờ + 20/ngày theo băm IP, trần chung 200/giờ cho khách, tối đa 3 link; người đăng nhập gửi kèm JWT thật thì không bị hỏi), cột `feedback.submitter_ip_hash`, trang `/lien-he` + `submitFeedback` cho khách đi qua function, migration `20261126130000` THU HỒI quyền INSERT của anon (người đăng nhập vẫn ghi trực tiếp với user_id của mình). **THỨ TỰ DEPLOY: function `feedback-submit` + bản web mới TRƯỚC, migration sau.** Chưa chạy thử function qua HTTP vì edge runtime local không nạp function mới (cần khởi động lại cả stack Supabase); lõi `core.ts` đã có test. **Chưa làm:** Auth (bước 7). Soạn ngày 25/11/2026. Hiện **chưa có captcha nào** trong repo (đã grep). Mục tiêu: chặn bot gửi rác vào những nơi
**khách chưa đăng nhập ghi được dữ liệu**, mà không làm khó người lớn tuổi.

## 1. Kiểm kê bề mặt public (đã đọc code / cấu hình)

| Bề mặt | Ghi dữ liệu? | Bảo vệ hiện có | Rủi ro | Đề xuất |
|---|---|---|---|---|
| `community-submit` (function) — ký ức, câu trả lời, khoanh mặt do khách gửi qua link chia sẻ / link mời góp / trang Cùng góp | Có (DB + tệp) | Bẫy bot `website`, thời gian điền tối thiểu, chặn link trong chữ, trần theo IP và theo link mỗi giờ, trần theo ngày + **tự tạm dừng link**, khách mới luôn chờ duyệt (`_shared/spamGuard.ts`) | Cao: link bị lộ → nhiều IP khác nhau | **reCAPTCHA v3** |
| `submit-contribution` (function) — đề xuất sửa thông tin của khách | Có | Kiểm token + trần theo IP | Trung bình | **reCAPTCHA v3** |
| Phản hồi / liên hệ (`/lien-he`, ô góp ý): `submitFeedback` **INSERT thẳng vào bảng** bằng quyền anon (RLS cho phép anon) | Có | Chỉ RLS; **không có cổng phía máy chủ** | Cao: bot spam bảng `feedback` + email thông báo | Chuyển sang function `feedback-submit` có captcha, rồi **thu hồi** quyền insert của anon |
| Đăng ký / đăng nhập / quên mật khẩu (Supabase Auth) | Có (tạo tài khoản, gửi email) | Giới hạn tốc độ của Auth; captcha **chưa bật** (`[auth.captcha]` đang comment trong `config.toml`) | Cao: tạo tài khoản rác, spam email xác nhận | Xem mục 3 — **GoTrue chỉ hỗ trợ hCaptcha / Turnstile, không hỗ trợ reCAPTCHA** |
| `share-view`, `og-post`, `calendar-feed` | Chỉ đọc | Giới hạn tốc độ (60 / 240 mỗi phút mỗi IP) | Cào dữ liệu | **KHÔNG gắn captcha** (làm hỏng trình quét mạng xã hội và ứng dụng lịch); giữ giới hạn tốc độ + cache |
| `zalo-auth`, `zalo-link`, `zalo-webhook` | Có | Chữ ký / kiểm tra phía Zalo | Thấp | Không đổi |

Khi làm sẽ rà lại danh sách function bằng `verify_jwt = false` trong `supabase/config.toml` (đã thấy: `calendar-feed`, `share-view`, `og-post`, `community-submit`,
`submit-contribution`, `zalo-auth`, `zalo-link`; còn cần kiểm `notify-*`) để chắc không sót chỗ ghi nào.

## 2. Quyết định kỹ thuật

- **Loại:** reCAPTCHA **v3** (vô hình, trả điểm 0–1) cho biểu mẫu của khách. Lý do: người lớn tuổi không phải bấm ô / chọn ảnh. Điểm thấp (< ngưỡng) → **không chặn
  ngay** mà ép đóng góp vào hàng chờ duyệt + hiện thử thách v2 (ô "Tôi không phải người máy") nếu vẫn thấp. Cần hai cặp khoá (v3 và v2) — hoặc dùng **reCAPTCHA Enterprise**
  (một cặp khoá, có điểm + thử thách). Chốt ở câu hỏi mở 1; kiểm tra điều khoản và hạn mức miễn phí hiện hành của Google trước khi chọn.
- **Xác minh phía máy chủ**, không tin trình duyệt: function gọi `https://www.google.com/recaptcha/api/siteverify` bằng khoá bí mật; kiểm `success`, `action` khớp biểu mẫu,
  `hostname` thuộc danh sách tên miền của ứng dụng, `score ≥ ngưỡng`, `challenge_ts` còn mới. Mã thông báo dùng **một lần**, hết hạn sau ~2 phút → lấy mã **ngay lúc bấm gửi**,
  không lấy trước khi mở form.
- **Chế độ vận hành** qua biến môi trường của function: `RECAPTCHA_MODE=off|log|enforce`.
  `off` = bỏ qua; `log` = xác minh + ghi điểm nhưng không chặn (dùng để chỉnh ngưỡng); `enforce` = chặn. Đây cũng là công tắc lùi khi có sự cố.
- **Khi Google không trả lời / lỗi mạng:** không khoá người dùng thật. Mặc định **mở có kiểm soát**: cho qua nhưng ép vào hàng chờ duyệt + áp trần chặt hơn
  (cùng cơ chế `spamGuard`), ghi lại để theo dõi. Có thể đổi sang đóng hẳn bằng biến môi trường.
- **Thứ tự trong function:** kích thước request → **captcha** → `spamGuard` (đếm trần, chạm DB) → ghi dữ liệu. Captcha chặn trước để bot rẻ tiền không tốn truy vấn DB.
- **Khoá:** site key đặt ở `VITE_RECAPTCHA_SITE_KEY` (công khai), secret ở biến môi trường của function (`RECAPTCHA_SECRET`, không vào repo). Mỗi môi trường (local / prod) một
  cặp; local và CI dùng **khoá thử nghiệm do Google công bố** (luôn cho qua) để test chạy ổn định. Đăng ký đúng danh sách tên miền.

## 3. Đăng ký / đăng nhập (Supabase Auth)
GoTrue tích hợp sẵn chỉ nhận **hCaptcha hoặc Cloudflare Turnstile**. Ba hướng, đề xuất chọn A:
- **A (đề xuất):** bật Turnstile (hoặc hCaptcha) ngay trong cấu hình Auth cho đăng ký / quên mật khẩu — ít code nhất, GoTrue tự xác minh. reCAPTCHA dùng cho các function của mình.
  Hai nhà cung cấp nhưng mỗi nơi dùng đúng công cụ tích hợp sẵn.
- **B:** tự viết function `signup` có reCAPTCHA rồi tạo người dùng bằng khoá dịch vụ. Một nhà cung cấp duy nhất nhưng **tự gánh** phần xác nhận email, đăng nhập Google, đặt lại mật khẩu — rủi ro cao.
- **C:** chưa thêm captcha cho Auth; theo dõi số tài khoản rác vài tuần, giữ giới hạn tốc độ. Hợp lý nếu chưa thấy spam đăng ký.

## 4. Giao diện và trải nghiệm
- Hook `useRecaptcha(action)` nạp script `api.js?render=<siteKey>` **chỉ khi một biểu mẫu có captcha được mở / lấy tiêu điểm**, không nạp toàn trang (tốc độ + quyền riêng tư).
  `execute(siteKey, { action })` lúc gửi; gửi mã trong trường `captcha_token`.
- Huy hiệu reCAPTCHA: có thể ẩn bằng CSS **nếu** hiện dòng chữ bắt buộc của Google ("Trang này được bảo vệ bởi reCAPTCHA… Chính sách quyền riêng tư và Điều khoản") ở cuối biểu mẫu.
- Lỗi: thông báo tiếng Việt rõ ràng ("Chưa xác minh được bạn là người thật, hãy thử lại"), không đổ lỗi; thử lại tự lấy mã mới. Thử thách v2 hiện ngay trong form khi cần.
- Nút gửi chỉ khoá trong lúc đang gửi. Không bắt người dùng đã đăng nhập làm captcha ở các biểu mẫu của thành viên.
- Biểu mẫu áp dụng (action): `guest_memory`, `guest_answer`, `guest_face`, `guest_contribution`, `feedback` (+ `signup` nếu chọn B).
- Trang Cùng góp của website dòng họ (`/cung-gop`) dùng chung khối đóng góp của màn Share nên hưởng luôn.

## 5. Quyền riêng tư và pháp lý
- reCAPTCHA gửi dữ liệu trình duyệt tới Google và đặt cookie: **cập nhật** trang Chính sách quyền riêng tư (`PrivacyPolicy`) và Điều khoản, nêu rõ mục đích chống spam.
- CSP / nginx của máy chủ web phải cho phép `www.google.com` và `www.gstatic.com` (cấu hình trên máy chủ, ghi trong `docs/`, không đưa hạ tầng vào repo).
- Không gửi dữ liệu cá nhân của dòng họ vào Google; chỉ mã thông báo + địa chỉ IP (Google tự thu).

## 6. Theo dõi
- Ghi mỗi lần xác minh: `action`, điểm, kết quả, có phải `log`-mode, mã lỗi (bảng nhỏ `captcha_events` giữ ~30 ngày, hoặc log function nếu muốn nhẹ) — để chỉnh ngưỡng và thấy đợt tấn công.
- Số liệu cần xem: tỉ lệ bị chặn, phân bố điểm theo `action`, số lần Google lỗi, số đóng góp bị ép chờ duyệt vì điểm thấp.
- Báo trong app (như cơ chế "link tạm dừng" của `spamGuard`) khi tỉ lệ chặn tăng đột biến.

## 7. Các bước làm
1. **Chốt câu hỏi mở**, tạo khoá cho local / prod, ghi vào hướng dẫn cấu hình.
2. `supabase/functions/_shared/recaptcha.ts` (xác minh + chế độ `off|log|enforce` + mở có kiểm soát) và test đơn vị (giả `fetch`: thành công, điểm thấp, sai `action`, sai `hostname`, hết hạn, Google lỗi / chậm).
3. Gắn vào `community-submit` và `submit-contribution` ở chế độ **`log`**; thêm ghi điểm. Triển khai và quan sát vài ngày.
4. Hook `useRecaptcha` + gắn vào các biểu mẫu khách (kèm dòng chữ bản quyền, lỗi tiếng Việt, thử thách v2 khi cần) + test DOM.
5. Chuyển phản hồi ẩn danh sang function `feedback-submit` có captcha; sau khi chạy ổn **thu hồi** quyền INSERT của anon trên `feedback` (migration + test RLS).
6. Bật `enforce` từng function một, theo dõi tỉ lệ chặn; có thể hạ về `log` / `off` ngay bằng biến môi trường.
7. Quyết định Auth (mục 3) và làm theo hướng đã chọn.
8. Cập nhật Chính sách quyền riêng tư + tài liệu vận hành (cách đổi khoá, chế độ, đọc log).

Mọi bước: test local → **dừng chờ bạn test** → mới deploy (function copy vào thư mục functions của self-host; biến môi trường đặt qua cấu hình compose của function).

## 8. Câu hỏi mở
1. **v3 + v2 dự phòng** hay **Enterprise**? (Enterprise gọn khoá hơn nhưng cần tài khoản Google Cloud và theo dõi hạn mức.)
2. Auth: chọn **A** (Turnstile / hCaptcha), **B** (tự viết signup) hay **C** (chờ xem spam)?
3. Khi Google lỗi: **mở có kiểm soát** (đề xuất) hay đóng hẳn?
4. Ngưỡng điểm ban đầu (đề xuất 0,5; dưới 0,3 chặn; 0,3–0,5 ép chờ duyệt) và có cần ghi `captcha_events` vào DB hay chỉ log?
5. Trang landing và các tên miền phụ (nếu có form) có dùng chung khoá không?
