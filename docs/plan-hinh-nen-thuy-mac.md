# Kế hoạch: Hình nền thuỷ mặc cho người dùng chọn

> Plan tự-chứa để triển khai trong session sau. Tiếng Việt mô tả; tên file/biến giữ tiếng Anh.
> Trạng thái: **đề xuất, chưa code — cần chốt 4 câu hỏi ở cuối.**

## Mục tiêu
Cho người dùng chọn một **hình nền tranh thuỷ mặc** (núi sương, trúc, sen, tùng hạc…) cho app, hợp
với bản sắc gia phả/văn hoá Việt và palette rượu vang + mực hiện có. Chọn ở một chỗ, áp dụng toàn app,
nhớ lựa chọn. **Không được làm giảm khả năng đọc** — đây là ràng buộc số một.

## Hiện trạng (đã khảo sát)
- Màu theo token HSL trong `src/index.css` (`:root` sáng, `.dark` tối); `lib/theme.ts` lưu `localStorage`
  khoá `family-tree:theme`, có `subscribeTheme`; UI chọn ở `Account.tsx` (`ThemeToggle`) + nút nhanh
  `ThemeQuickToggle` ở header.
- Nền trang là `bg-background` đặc trên `<div>` của `ClanLayout` / header; nội dung là các thẻ `bg-card`
  đặc, container `max-w-4xl` ⇒ trên laptop hình nền chỉ lộ ra **hai bên lề và khe giữa các thẻ**.
- Đã có `public/textures/*.svg` (hoạ tiết lặp, dùng cho khung ảnh) và `public/watermarks/*.png` — là
  tiền lệ cho việc phục vụ asset tĩnh; chưa có cơ chế "hình nền toàn app".
- Menu trái cố định 288px (`lg:pl-72`), có thể ẩn bằng ☰ (`lib/sidebarHidden.ts`).

## Thiết kế

### 1. Lớp nền (không đụng token màu)
Một phần tử cố định, nằm dưới mọi thứ, render một lần ở layout gốc:
```
<div aria-hidden class="fixed inset-0 -z-10 bg-cover bg-center" style="background-image:url(...)"/>
+ một lớp phủ (scrim) dùng đúng --background với alpha, để chữ luôn đọc được
```
- Thẻ (`bg-card`) **giữ đặc** ⇒ nội dung chính không đổi, không phải rà từng màn.
- Phần nền trực tiếp (lề, khe giữa thẻ, header) mới thấy tranh. Header/menu trái: `bg-background/90`
  + `backdrop-blur` nhẹ thay cho nền đặc, để tranh thấp thoáng nhưng chữ vẫn rõ.
- Lớp phủ = `hsl(var(--background) / α)`; α mặc định 0.82 (sáng) / 0.88 (tối), người dùng chỉnh được
  (xem 3). Nhờ dùng token nên tự đúng cả sáng/tối.
- Tranh lấy tông mực: ở chế độ tối dùng `mix-blend-mode`/độ sáng thấp hoặc **bản tối riêng** (xem
  Asset) — tranh thuỷ mặc nền trắng ngà sẽ chói nếu chỉ phủ mờ.

### 2. Lưu trữ
- **v1: `localStorage` theo thiết bị**, giống theme: `family-tree:bg` = `{ id, dim }`. Module
  `src/lib/background.ts` (cùng khuôn `theme.ts`: `getBackground / setBackground / subscribeBackground /
  initBackground`), `initBackground()` gọi ở `main.tsx`, đặt `data-bg` + biến CSS `--bg-image`,
  `--bg-dim` lên `<html>` (cùng cách `sidebarHidden`), tránh nháy lúc tải.
- **v2 (tuỳ chọn):** đồng bộ qua `profiles.ui_prefs jsonb` để theo người dùng sang thiết bị khác. Chưa
  cần ở v1 — thêm cột + migration thủ công trên prod (xem memory migrations self-host) là chi phí không
  nhỏ cho một thứ trang trí.

### 3. Giao diện chọn
- **Account → mục "Giao diện"** (cạnh `ThemeToggle`): lưới thumbnail 3–4 cột, ô đầu "Không dùng hình
  nền"; thanh trượt **"Độ mờ lớp phủ"** (mặc định giữa, giới hạn để không bao giờ tắt hẳn lớp phủ ⇒ giữ
  tương phản tối thiểu); xem trước ngay khi bấm.
- Không thêm nút lên header (đã chật). Có thể thêm lối tắt trong menu tài khoản ở chân drawer sau.
- Theo `docs/design-language.md`: icon trên control, `grid-cols-1` cho màn hẹp, nhãn tiếng Việt.

### 4. Asset
- 6–8 tranh, mỗi tranh **WebP ~1920px ≤ 180 KB** + bản **1080px ≤ 90 KB** cho điện thoại
  (`image-set`/`@media`), đặt `public/backgrounds/<id>-{lg,sm}.webp`, + thumbnail 320px.
- Chỉ tải **tranh đang chọn** (thumbnail của thư viện lazy). Không đưa vào bundle JS.
- Mỗi tranh có cặp sáng/tối nếu cần (hoặc một tranh + `filter: invert/brightness` — thử trước, thường
  xấu; ưu tiên bản tối vẽ lại bằng cách đảo tông trong script xử lý ảnh).
- Nguồn tranh: xem câu hỏi 1. Ghi nguồn/giấy phép vào `docs/credits.md` (đã có file này).

### 5. Những chỗ KHÔNG áp nền
- **Cây gia phả / canvas / in ấn / xuất ảnh** (`.f3`, `Print*`, export PNG/PDF): nền trơn để không lẫn
  vào hình xuất ra. Bọc bằng class `bg-background` đặc ở các vùng này.
- Trang công khai (`/khoe/:token`, share, landing) và Zalo Mini App: ngoài phạm vi v1.
- `prefers-reduced-data` / `Save-Data`: không tải tranh. `prefers-contrast: more`: tắt tranh.
- Chế độ chiếu/ khoe ảnh (Phòng 3D) có nền riêng — loại trừ.

### 6. Hiệu năng & truy cập
- Một `<div>` fixed, không `background-attachment: fixed` (giật trên iOS) ⇒ dùng `position: fixed`.
- Tranh `decoding="async"`/preload chỉ khi đã chọn; không chặn render đầu.
- Tương phản: mọi chữ nằm trên thẻ đặc hoặc trên header/menu có `/90` ⇒ giữ AA. Kiểm bằng ảnh chụp
  Playwright cho **mỗi tranh × sáng/tối × điện thoại/laptop**, đo tương phản vùng nền trực tiếp
  (nhãn nhóm menu, tiêu đề trang đứng trên nền).

## Các bước thực hiện
1. **Asset**: chọn/xử lý tranh → WebP (sm/lg/thumb), bản tối; script `scripts/build-backgrounds.sh`;
   ghi nguồn vào `docs/credits.md`.
2. **`lib/background.ts` + CSS**: store, `initBackground` ở `main.tsx`, lớp `.app-bg` + scrim trong
   `index.css`; test đơn vị (đọc/ghi/khoá hỏng/đăng ký).
3. **Gắn vào layout**: `ClanLayout` + `AppHeader` render lớp nền; header/drawer chuyển `bg-background/90`
   + blur khi có nền; loại trừ cây/in ấn.
4. **UI chọn** trong `Account.tsx` (`BackgroundPicker`): lưới, slider, "Không dùng".
5. **Kiểm**: `typecheck`, test UI/conventions, Playwright chụp ma trận (tranh × sáng/tối × thiết bị),
   rà tương phản; thử Save-Data.
6. **Docs**: thêm mục "Hình nền" vào `docs/design-language.md`; thêm vào changelog.

Ước lượng: 1–1,5 ngày (phần lớn là chọn/xử lý tranh và rà tương phản), không cần migration ở v1.

## Rủi ro
- **Đọc kém trên nền** nếu chọn tranh quá đậm → kẹp cứng độ mờ tối thiểu + kiểm ma trận ảnh chụp.
- **Dung lượng**: 8 tranh × 2 cỡ ≈ 2 MB trong `public/` (chỉ tải khi chọn) — chấp nhận được.
- **Bản quyền** tranh → xem câu hỏi 1.
- **Chế độ tối** khó làm đẹp với tranh nền sáng → cần bản tối riêng, tốn công nhất.
- Trên laptop, tranh chỉ lộ hai bên lề ⇒ cảm nhận "ít tác dụng" ở màn rộng; có thể tăng độ lộ bằng cách
  để phần nền giữa các thẻ nửa trong (không đổi thẻ).

## Câu hỏi cần chốt
1. **Nguồn tranh?** (a) AI/vẽ procedural SVG tự tạo — không vướng bản quyền, đồng bộ phong cách;
   (b) tranh phạm vi công cộng (Wikimedia/bảo tàng) — đẹp, thật, cần ghi nguồn; (c) ảnh bạn cung cấp.
2. **Lưu theo thiết bị (v1) hay theo tài khoản (cần migration)?** Đề xuất: thiết bị trước.
3. **Phạm vi:** chỉ trong app đăng nhập (đề xuất), hay cả trang công khai/landing?
4. **Chế độ tối:** làm bản tranh tối riêng (đẹp, tốn công) hay chỉ phủ tối lên cùng một tranh (nhanh)?
