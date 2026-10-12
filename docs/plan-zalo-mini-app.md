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
2. **Đăng nhập Zalo** — edge function `zalo-auth`: nhận mã truy cập từ Mini
   App, hỏi Zalo lấy ID người dùng, đổi sang phiên Supabase. Bảng mới nối
   ID Zalo ↔ tài khoản. Cần migration (áp tay trên self-host).
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
- Chưa rõ tài khoản cá nhân (không có OA) được phát hành công khai tới đâu;
  chỉ biết chắc khi gửi duyệt.
- Mỗi lần cập nhật Mini App phải qua duyệt (3–5 ngày làm việc theo nguồn
  bên thứ ba), nên gom thay đổi theo đợt.
- Chính sách quyền riêng tư phải có trước khi gửi duyệt (app lưu thông tin
  cá nhân của người trong họ).

## Cần từ chủ dự án

- Mini App ID.
- Đặt khoá bí mật Zalo App lên máy chủ khi tới bước 2.
- Trang chính sách quyền riêng tư (hoặc xác nhận dùng trang sẵn có).
