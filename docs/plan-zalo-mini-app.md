# Kế hoạch: Zalo Mini App "Dòng Họ Việt"

Trạng thái (24/10/2026): các màn hình đã viết xong và chạy trên điện thoại
thật qua bản dev. Bản đầu vượt phạm vi "chỉ xem": đã có sửa hồ sơ, thêm
vợ/chồng/con, xoá người, xuất Sổ gia phả PDF, quản lý tài khoản. Còn lại là
**đóng gói và gửi duyệt** (xem "Đưa lên Zalo" ở cuối).

## Quyết định đã chốt

- **Chung repo, app riêng** trong `zalo/`. Dùng chung `src/lib/` (truy vấn,
  mô hình cây, âm lịch, xưng hô, kiểu dữ liệu); giao diện viết riêng.
- **Bản đầu chỉ xem.** Thêm/sửa, nhắc giỗ qua Zalo, xuất file để vòng sau.
- **Khoá bí mật Zalo App chỉ nằm ở máy chủ** (biến môi trường của edge
  function, đặt như `SMTP_*`), không vào repo hay bản dựng.

## Nguyên tắc thiết kế (chủ dự án chốt 12/10/2026, bản sau cùng)

**Đồng nhất về CHỨC NĂNG với bản web; phần trình bày được làm lại cho hợp
điện thoại.** Mỗi màn hình Mini App phải có đủ các chức năng xem (và các
thiết lập) của trang web tương ứng, dùng chung logic trong `src/lib`. Bố cục
thì không buộc chép web: ưu tiên kiểu quen tay trên điện thoại (danh sách
thiết lập, công tắc, dòng bấm để mở, thẻ gọn, thanh tab dưới đáy).

Giữ từ web: phông (Be Vietnam Pro + Noto Serif), bộ icon
`src/components/icons.tsx`, bảng màu sáng/tối, đỏ rượu vang `#7A2230`, góc
bo nhỏ (8px), ít khoảng trống. Đã thử và bị chê: bo tròn nhiều + thẻ có bóng.

Lịch sử: ban đầu yêu cầu là "giống bản web khi xem trên mobile" (chép cả bố
cục); sau khi làm tới màn Tài khoản thì nới thành nguyên tắc trên.

## Các bước

1. **Khung `zalo/`** — ✅ XONG phần dựng (12/10/2026): typecheck qua, bản
   dựng thử (có plugin của Zalo) gom được `src/lib/lunarDate` +
   `src/lib/tree/folderModel`, thư viện âm lịch lấy từ `node_modules` gốc,
   chỉ một bản React. ⏳ CHƯA chạy `zmp start` / thử trên giả lập và điện
   thoại thật — cần Mini App ID và đăng nhập công cụ Zalo.
   Lưu ý: `@` trong `zalo/` trỏ về `src/` của WEB; file riêng của Mini App
   nhập bằng đường dẫn tương đối. Đừng đặt hai file chỉ khác chữ hoa/thường
   (`app.tsx`/`App.tsx`) — ổ đĩa macOS coi là một.
2. **Đăng nhập Zalo** — ✅ XONG, đã thử trên điện thoại thật (12/10/2026).
   Migration `zalo_identities`, edge function `zalo-auth`, `zalo/src/auth.ts`.
   Hai điều học được: (a) Zalo Graph từ chối IP ngoài VN (-501) nên function
   gọi vòng qua nginx của máy web `giapha.thaohk.com` (`ZALO_GRAPH_PROXY_*`);
   (b) Mini App phải trỏ về Supabase THẬT (`zalo/.env.local`), không phải
   bản chạy trên máy lập trình.
   Tài khoản tạo từ Zalo mang email giả `zalo-<id>@zalo.giapha.thaohk.com` và
   dấu `app_metadata.zalo_user_id`. Các function gửi mail bỏ qua địa chỉ này
   qua `canReceiveMail` (`_shared/mail.ts`) — ✅ 24/10/2026; chuông và push
   vẫn đi.
3. **Liên kết tài khoản sẵn có** — ✅ ĐÃ VIẾT + TRIỂN KHAI, ⏳ CHƯA thử trên
   điện thoại. Migration `zalo_link_codes` + hàm `zalo_find_user_id_by_email`,
   edge function `zalo-link` (tự gửi mã 6 số qua SMTP — không dùng OTP của
   GoTrue vì thư mặc định của nó chỉ có link, không có mã), màn hình
   `zalo/src/LinkAccount.tsx`. Tài khoản Zalo tạm KHÔNG bị xoá sau khi liên
   kết (có thể đã đứng tên dữ liệu) — chỉ mất đường đăng nhập.
4. **Màn hình xem** — ✅ ĐÃ VIẾT (12/10/2026), ⏳ CHƯA thử trên điện thoại.
   `zalo/src/screens/`: Clans (dòng họ của tôi) → Tree (cây thư mục + tìm
   theo tên + "chưa gắn vào cây") → Person (hồ sơ + quan hệ). Dùng nguyên
   `treeFolder`, `folderModel`, `families`, `persons`, `clans` của web; chỉ
   phần vẽ viết riêng. Điều hướng bằng chồng màn hình trong state. Không
   dùng react-query và `photoUpload` của web (kéo theo thư viện không cần).
   Chưa có: dâu/rể ở dòng họ thông gia (ô viền đứt), nút Back của Zalo.
5. **Nút "Mở bản web đầy đủ"** — ✅ có ở màn Hồ sơ (mở đúng trang người đó
   trên web). Chưa có ở màn Cây (xuất sổ, nhập Excel).
6. **Khai tên miền gọi API** (Supabase self-host, nơi lưu ảnh) trong cấu
   hình Mini App, thử trên điện thoại thật, gửi duyệt.

## Đối chiếu thêm/sửa/xoá với web (24/10/2026)

Đã chạy thật trên Supabase máy lập trình, đối chiếu dữ liệu trong DB:

- Sửa hồ sơ: đủ trường như web (thêm Thuỷ tổ, con thứ, tuổi thọ, loại khỏi
  việc cần làm), trừ ảnh đại diện.
- Thêm cha/mẹ, vợ/chồng, con: có cả "Người mới" lẫn "Chọn người đã có";
  máy chủ chặn gắn sai quan hệ (đã thử: con gái làm vợ của cha).
- Xoá: xoá mềm, có nhật ký để khôi phục — như web.

Còn thiếu so với web: tạo dòng họ mới, ảnh đại diện, sắp xếp thứ tự vợ/chồng,
thêm/sửa sự kiện riêng của họ.

**Không làm trong Mini App (chủ dự án chốt 24/10/2026):** chức năng admin hệ
thống, và các màn phân quyền/bảo mật của họ — Thành viên, link mời, Liên kết
thông gia, Cài đặt dòng họ; và Đóng góp (duyệt đề xuất). Những việc này chỉ
làm trên web.

Tab "Thêm" (màn dòng họ) liệt kê các mục còn lại của menu trái web; đã có:
Hôm nay, Xuất sổ PDF, Việc cần làm, Mộ phần & tro cốt (trừ mã QR dán tại mộ
và trang quản lý danh sách cơ sở — để trên web). Thứ tự làm tiếp: Quỹ họ,
Bảng tin.

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
- ~~Trang chính sách quyền riêng tư~~ — dùng `/chinh-sach-rieng-tu` của web,
  đã thêm mục "Đăng nhập bằng Zalo" (24/10/2026).

## Đưa lên Zalo (checklist phát hành)

Phía code (Claude làm):

- [x] Mail không gửi vào email giả của tài khoản Zalo.
- [x] Chính sách quyền riêng tư nói rõ lấy gì từ Zalo.
- [x] Màn "Chính sách riêng tư" ngay trong Mini App (Tài khoản → Thông tin),
      cùng nội dung trang web — người duyệt thấy được mà không phải rời app.
- [ ] Triển khai lại edge function gửi mail (notify-events, notify-inlaw,
      notify-contribution, weekly-digest, ai-chat) lên self-host.
- [ ] Merge `feat/zalo-mini-app` vào `main` để web lên trang chính sách mới.
- [ ] Review bảo mật `zalo-auth` / `zalo-link` trước khi phát hành.

Phía chủ dự án (cần tài khoản Zalo):

- [ ] Xác thực chủ sở hữu Mini App (eKYC cá nhân), 3–5 ngày làm việc.
- [ ] Khai tên miền được gọi trong cấu hình Mini App:
      tên miền Supabase self-host (lấy từ `VITE_SUPABASE_URL` trong
      `zalo/.env.local` — API + ảnh) và `giapha.thaohk.com`.
- [ ] Điền link chính sách nếu cấu hình Mini App có ô cho nó (chưa rõ ô nằm
      đâu): `https://giapha.thaohk.com/chinh-sach-rieng-tu`.
- [ ] `cd zalo && npx zmp login` rồi `npm run deploy` để đẩy bản dựng lên.
- [ ] Thử bản Testing trên điện thoại thật: đăng nhập mới, liên kết tài
      khoản sẵn có, mở cây lớn, xuất PDF.
- [ ] Chuẩn bị ảnh chụp màn hình, mô tả ngắn, icon; gửi duyệt.
