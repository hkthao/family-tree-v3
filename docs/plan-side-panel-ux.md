# Kế hoạch: nhập liệu / thông báo / cài đặt / chat trong ngăn kéo (Side Panel)

Trạng thái: **bản nháp chờ chốt 3 quyết định ở mục 9**. Ngày soạn 2026-11-04.

## 1. Mục tiêu

Người dùng làm được nhiều việc **ngay trên một trang**, không phải đi sang route khác rồi bấm Back nhiều lần.

- Thêm / sửa dữ liệu (người, mộ phần, di sản, bài đăng, sự kiện…) mở trong ngăn kéo, danh sách / cây phía sau giữ nguyên vị trí cuộn, bộ lọc, mức zoom.
- Thông báo, Cài đặt, Trợ lý chat cũng mở trong ngăn kéo thay vì chuyển trang.
- Lưu xong: đóng ngăn kéo (hoặc "Lưu & thêm tiếp"), danh sách phía sau tự cập nhật.

Đo thành công (Umami event): số lần đổi route để hoàn thành "thêm người", tỉ lệ bỏ dở form, thời gian từ bấm "+" tới lưu.

## 2. Hiện trạng (đã khảo sát)

| Nhóm | Hiện tại | Ghi chú |
|---|---|---|
| Thêm / sửa người | Route `people/new` (548 dòng), `people/:id/edit` (694), `add-spouse` (455), `add-child` (556), `add-parent` (478) | Đã có `QuickAddSheet` (1293 dòng) + `RelationSheet` dùng ở Cây / Chi tiết người / Việc làm → **tái dùng, không viết lại** |
| Nội dung | `graves/new|:id/edit` (397), `heritage/new|:id/edit` (473), `board/new|:id/edit` (44 / 80), `inlaws/new` (898, wizard), `NewClan` (175) | Honor / Quỹ / Sự kiện / Phòng ký ức đã là form inline trong trang |
| Thông báo | `NotificationBell` (dropdown) + route `/announcements`, `/announcements/:id` | Push notification trỏ vào các URL này |
| Cài đặt | `/account` (985 dòng), `clans/:id/settings` (621) | Dài, nhiều khối |
| Chat | Route `tro-ly` (`AiChat`) **và** `AiChatDock` (nổi, bottom-right) | Hai nơi song song |
| Đã làm hôm nay | `FilterDrawer` (phải), `SectionCard`, `Fab` | Là nền để mở rộng |

## 3. Nguyên tắc thiết kế

1. **Route vẫn còn** (deep link, push, chia sẻ, video hướng dẫn Playwright dùng URL). Ngăn kéo là lớp trình bày thêm lên trên, không thay thế route.
2. **Một thân form, hai vỏ**: tách phần thân form thành component dùng chung; trang route chỉ là vỏ mỏng bọc cùng component. Không nhân đôi logic.
3. **Back = đóng ngăn kéo.** Mở panel đẩy 1 history entry (`?panel=…`); nút Back của trình duyệt / điện thoại đóng panel chứ không rời trang.
4. **Không mất dữ liệu đang nhập**: đóng khi form đang sửa thì hỏi xác nhận; nháp lưu `sessionStorage` theo form.
5. **Giữ ngữ cảnh**: panel không che nút điều hướng chính; chat là **không modal** (vẫn thao tác được trang phía sau).

## 4. Kiến trúc

```
<PanelHost>            // mount một lần ở ClanLayout + layout tài khoản
  context: stack[] = [{ id, title, size, dirty, node }]
  open(spec) / close() / replace(spec) / back()
  <SidePanel side="right|left" size="sm|md|lg|full" modal>
```

- **`SidePanel`**: khung (header có Back/Đóng, thân cuộn, footer cố định Lưu/Huỷ). Mobile: chiếm 100% chiều rộng, cao full (hoặc bottom sheet cho thao tác ngắn); tablet 28rem; desktop 32–40rem, có nút "mở rộng" cho form lớn. Focus-trap, Esc, `aria-modal`, trả focus về nút gọi.
- **`usePanel()`**: `openPanel("person:new", { clanId, relation, … })`. Registry map `id → lazy component` (code-split, không phình bundle trang).
- **Đồng bộ URL**: `?panel=person:new&…` tham số tuần tự hoá được (id + tham số, không phải nội dung nháp). Tải lại trang khôi phục panel; link gửi người khác mở đúng panel.
- **Stack**: panel mở panel khác (vd. Sửa người → Thêm vợ/chồng) hiện nút "‹ Quay lại" trong header thay vì chồng nhiều lớp.
- **Dirty guard**: form báo `setDirty(true)`; đóng / Back / chuyển panel sẽ hỏi (dùng `ConfirmDialog` có sẵn).
- **Sau khi lưu**: `invalidateClanData`, toast, đóng (hoặc giữ mở + reset khi bấm "Lưu & thêm tiếp"). Tuỳ chọn trả về `onDone(result)` để trang phía sau cuộn/làm nổi bản ghi vừa tạo.
- **z-index**: panel (z-50) trên Fab (z-30), dưới dialog xác nhận; linh vật và nút Trợ lý ẩn / lùi khi panel modal mở.

## 5. Lộ trình theo pha

### P0 — Nền (M)
`SidePanel`, `PanelHost`, `usePanel`, đồng bộ `?panel=`, dirty guard, focus/Esc, test (vitest + một spec Playwright mobile/desktop). Gộp `FilterDrawer` vào cùng khung để dùng chung animation / a11y. Cập nhật `docs/design-language.md`.

### P1 — Thêm / sửa người (L, giá trị cao nhất)
- Tách `PersonForm` (từ `NewPerson`/`EditPerson`) + hợp nhất với `QuickAddSheet`/`RelationSheet` thành **một** bộ: thêm người, thêm con / vợ chồng / cha mẹ, sửa người.
- `Fab` ở Danh bạ và nút ở Cây / Chi tiết người mở panel; route cũ vẫn render cùng form.
- "Lưu & thêm tiếp" cho nhập hàng loạt người thân.

### P2 — Nội dung dòng họ (M mỗi mục)
Mộ phần (+ Cơ sở), Di sản, Bài đăng bảng tin (new/edit), Sự kiện tuỳ chỉnh, Phòng ký ức, Công đức, Quỹ họ → mở bằng `Fab`/nút sửa trong panel. `InlawsNew` (wizard 898 dòng) và `NewClan` **để sau**: chuyển khi đã chia bước gọn; Nhập Excel, AI sinh dữ liệu, Gộp người **giữ trang riêng** (quy trình dài, cần toàn màn hình).

### P3 — Thông báo (S–M)
Chuông mở panel danh sách (lọc: chưa đọc / tất cả, đánh dấu đã đọc, bấm một thông báo xem chi tiết **trong panel**). Giữ `/announcements*` làm đích của push; trên desktop tự mở panel tương ứng.

### P4 — Cài đặt (M–L)
`/account` và `clans/:id/settings` chia thành các mục (Giao diện, Thông báo, Tài khoản, Họ…) với thanh mục lục trong panel cỡ lớn; mỗi khối lưu độc lập. Mở từ avatar / menu; route cũ giữ.

### P5 — Trợ lý chat (M)
Hợp nhất `AiChatDock` và route `tro-ly`: chat là panel **không modal, ghim được**, hội thoại giữ nguyên khi đổi trang; `/tro-ly` chỉ mở panel. Giữ nút "Trợ lý" nổi như lối vào.

### P6 — Dọn dẹp (S)
Thay các `<Link to=…/new>` còn lại bằng `openPanel`, bỏ luồng "Quay lại" thừa, cập nhật tài liệu hướng dẫn / video (các spec Playwright dùng URL nên vẫn chạy; cập nhật chỗ nào bấm nút), đo lại chỉ số mục 1.

Thứ tự đề xuất: P0 → P1 → P3 → P5 → P2 → P4 → P6 (P1 chứng minh mô hình, P3/P5 là phần ít rủi ro dữ liệu, P2/P4 nhiều form nhất).

## 6. Giữ làm trang riêng (không đưa vào panel)
Nhập Excel, AI sinh dữ liệu, Gộp người, Cây gia phả, trang chi tiết (người, mộ phần, di sản), đăng nhập / đăng ký, trang chia sẻ công khai, Zalo Mini App (app riêng).

## 7. Rủi ro và cách xử lý

| Rủi ro | Xử lý |
|---|---|
| Form dài (ngày âm/dương, ảnh, quan hệ) chật trong 32–40rem | Footer cố định, chia nhóm gập, nút "mở rộng"; mobile full-screen |
| Mất nháp khi đóng nhầm / Back | Dirty guard + nháp `sessionStorage` |
| Panel chồng panel | Stack có nút Quay lại; tối đa 2 cấp |
| Phá luồng push / link / video hướng dẫn | Route giữ nguyên; panel chỉ là lớp thêm; có test điều hướng |
| Xung đột nổi (Fab, Trợ lý, linh vật) | Quy ước z-index; ẩn khi panel modal; chat không modal |
| Bundle phình | Registry `lazy()`, chỉ tải khi mở |
| Truy cập / bàn phím | Focus trap, Esc, `aria-modal`, trả focus; kiểm bằng axe + thử bàn phím |
| Chạy song hai kiểu (route + panel) lệch hành vi | Một thân form dùng chung, có test chung |

## 8. Kiểm thử
- Unit: `PanelHost` (stack, dirty guard, đồng bộ URL), từng form body (đã có test logic ngày / quan hệ thì tái dùng).
- Playwright (mobile + desktop): mở panel → nhập → lưu → danh sách có bản ghi; Back đóng panel; tải lại khôi phục panel; đóng khi dirty hỏi xác nhận.
- Hồi quy: các route cũ vẫn mở được và lưu được; push URL `/announcements/:id` mở đúng.

## 9. Cần chốt trước khi làm

1. **Bên nào?** Yêu cầu là "ngăn kéo bên trái", nhưng desktop đang có menu điều hướng cố định bên trái (`lg:pl-72`), còn `FilterDrawer` mở bên phải. **Đề xuất: ngăn kéo bên phải** (menu trái giữ nguyên, nhất quán với bộ lọc); `SidePanel` có prop `side` nên đổi sang trái là một dòng nếu bạn vẫn muốn (khi đó trên desktop panel sẽ đè lên menu).
2. **Giữ route cũ làm fallback?** Đề xuất **có** (deep link, push, video hướng dẫn).
3. **Chat không modal, ghim được?** Đề xuất **có**; Thông báo / Cài đặt / form là modal.

Sau khi chốt: làm P0 + P1 thành một đợt đầu để xem thực tế trước khi mở rộng.
