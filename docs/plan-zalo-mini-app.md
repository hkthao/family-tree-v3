# Kế hoạch: Zalo Mini App "Dòng Họ Việt"

Trạng thái (12/10/2026): Zalo App đã kích hoạt, tên miền `giapha.thaohk.com`
đã xác minh, Mini App đã tạo ở dạng nháp. Chưa có dòng code nào.

## Quyết định đã chốt

- **Chung repo, app riêng** trong `zalo/`. Dùng chung `src/lib/` (truy vấn,
  mô hình cây, âm lịch, xưng hô, kiểu dữ liệu); giao diện viết riêng.
- **Bản đầu chỉ xem.** Thêm/sửa, nhắc giỗ qua Zalo, xuất file để vòng sau.
- **Khoá bí mật Zalo App chỉ nằm ở máy chủ** (biến môi trường của edge
  function, đặt như `SMTP_*`), không vào repo hay bản dựng.

## Các bước

1. **Khung `zalo/`** — ✅ XONG phần dựng (12/10/2026): typecheck qua, bản
   dựng thử (có plugin của Zalo) gom được `src/lib/lunarDate` +
   `src/lib/tree/folderModel`, thư viện âm lịch lấy từ `node_modules` gốc,
   chỉ một bản React. ⏳ CHƯA chạy `zmp start` / thử trên giả lập và điện
   thoại thật — cần Mini App ID và đăng nhập công cụ Zalo.
   Lưu ý: `@` trong `zalo/` trỏ về `src/` của WEB; file riêng của Mini App
   nhập bằng đường dẫn tương đối. Đừng đặt hai file chỉ khác chữ hoa/thường
   (`app.tsx`/`App.tsx`) — ổ đĩa macOS coi là một.
2. **Đăng nhập Zalo** — ✅ ĐÃ VIẾT MÃ (12/10/2026), ⏳ CHƯA triển khai, CHƯA
   thử với Zalo thật. Gồm: migration `20261012100000_zalo_identities.sql`,
   edge function `zalo-auth` (kiểm token bằng Graph + `appsecret_proof`, sinh
   magic link không gửi mail), `zalo/src/auth.ts` (đổi `token_hash` lấy phiên).
   Còn phải làm trên máy chủ: áp migration bằng tay, đặt `ZALO_APP_SECRET`,
   chép function lên rồi khởi động lại.
   Tài khoản tạo từ Zalo mang email giả `zalo-<id>@zalo.giapha.thaohk.com` và
   dấu `app_metadata.zalo_user_id` — **các function gửi mail (nhắc sự kiện,
   bản tin tuần…) cần bỏ qua địa chỉ này**, chưa làm.
3. **Liên kết tài khoản sẵn có** — người đã có tài khoản email nhập mã OTP
   một lần để gắn Zalo vào tài khoản cũ, không sinh tài khoản trùng.
4. **Màn hình xem** — danh sách dòng họ của tôi → cây thư mục (tái dùng
   `folderModel` + `treeFolder`) → tìm người → hồ sơ một người.
5. **Nút "Mở bản web đầy đủ"** cho xuất sổ, nhập Excel, ghi âm.
6. **Khai tên miền gọi API** (Supabase self-host, nơi lưu ảnh) trong cấu
   hình Mini App, thử trên điện thoại thật, gửi duyệt.

## Rủi ro

- Bước 2 là cửa vào tài khoản: phải kiểm mã ở phía máy chủ, không tin ID do
  Mini App tự gửi lên. Cần review bảo mật trước khi phát hành.
- Xác thực chủ sở hữu (bắt buộc với mọi Mini App từ 15/10/2025): CÁ NHÂN
  được, điều kiện là tài khoản Zalo đã eKYC thành công; không cần OA hay
  giấy đăng ký kinh doanh. Gia phả không thuộc nhóm ngành cần giấy phép bổ
  sung (tài chính, y tế, bất động sản, thực phẩm…). Xử lý 3–5 ngày làm việc.
  Nguồn: tài liệu chính thức "Mini App Verification" của Zalo. Tài liệu
  KHÔNG nói cá nhân có bị giới hạn tính năng gì — chỉ biết chắc khi gửi duyệt.
- Mỗi lần cập nhật Mini App phải qua duyệt (3–5 ngày làm việc theo nguồn
  bên thứ ba), nên gom thay đổi theo đợt.
- Chính sách quyền riêng tư phải có trước khi gửi duyệt (app lưu thông tin
  cá nhân của người trong họ).

## Cần từ chủ dự án

- Mini App ID.
- Đặt khoá bí mật Zalo App lên máy chủ khi tới bước 2.
- Trang chính sách quyền riêng tư (hoặc xác nhận dùng trang sẵn có).
