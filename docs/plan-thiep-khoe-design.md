# Plan: Thiết kế lại phần "Thiệp" (khoe thành viên, mời góp) và trang `/khoe/:token`

Trạng thái (25/11/2026): **thiết kế T1–T4, T6 đã vẽ** trên canvas Design (`Khoe`, `KhoeMobile`, `KhoeHetHan`, `KhoeTao`, `KhoeOg`; T5 và T7 chưa vẽ).
**Đã code ở local:** function `og-khoe` (OG theo từng thiệp, ảnh thiệp thật) + `og-post?kind=person` (OG hồ sơ người), test, hướng dẫn nginx. **Chưa code:** viết lại `KhoeCard.tsx`, hộp thoại 3 bước,
ảnh OG 1200×630, hiển thị lượt xem cho người tạo, gia hạn, Trung tâm chia sẻ. **Đã có (local):** trang `/khoe` mới (T1–T3), migration `20261126120000_card_shares_views.sql` (cột `view_count`, `last_viewed_at`, `og_image_path`, hàm `khoe_register_view` cho khách) + trang gọi hàm mỗi phiên một lần. **Cập nhật 25/11/2026 (đã duyệt thiết kế):** `/khoe/:token` giờ chạy TRONG khung trang dòng họ (một tab "Thiệp", `focus: "card"`), đọc qua `share-view?khoe=<token>` (`share-view/khoe.ts`: chỉ thiệp còn hạn, 404 trơn) thay vì SELECT trực tiếp; lỗi máy chủ có thẻ "Thử lại" riêng, không nhầm thành hết hạn. Địa chỉ `/khoe/:token` giữ nguyên (+ `/khoe/:token/*`). **Ảnh OG 1200×630 riêng đã xong (local):** `KhoeOgImage` + `nodeToJpegBlob`, `publishKhoeCard` tải `-og.jpg` và ghi `og_image_path`, `og-khoe` ưu tiên ảnh OG, `cleanup-card-shares` dọn cả hai. Soạn ngày 25/11/2026. Cùng ngôn ngữ thiết kế với website dòng họ
(`docs/plan-trang-dong-ho.md`): tông rượu vang / đồng, sáng–tối, chữ serif cho tiêu đề, nút `sm`, gạch chân tab mảnh.

## 1. Hiện trạng (đã đọc code)

| Thành phần | File | Việc đang làm |
|---|---|---|
| Hộp thoại "Tạo thiệp chia sẻ" | `src/components/ShareCardDialog.tsx` (689 dòng) | Dựng thiệp "khoe thành viên": tiêu đề / nhãn / phụ đề, ảnh thành viên làm nền, kiểu chữ, khổ **Vuông** (đăng tường) hoặc **Dọc** (story); tải PNG, chia sẻ qua hộp chia sẻ hệ điều hành, hoặc **tạo link khoe có hạn** (1 tuần / 1 tháng / 3 tháng) |
| Xuất bản thiệp | `src/lib/cards/publishCard.ts` | Tải PNG lên bucket công khai `card-shares`, thêm dòng `card_shares` (token 32 ký tự, `expires_at` ≤ 90 ngày) |
| Trang xem thiệp | `src/pages/KhoeCard.tsx` (`/khoe/:token`, noindex) | Một cột hẹp: tiêu đề, phụ đề, **ảnh thiệp**, khối "Tạo gia phả dòng họ của bạn". Hết hạn → "Liên kết không còn hiệu lực" |
| Thiệp mời góp | `components/community/InviteCard.tsx`, `InviteCardDialog.tsx` | Thiệp mời người thân cùng đóng góp (nhiều kiểu / đối tượng / chủ đề, mã QR) — link đích là link mời góp (`scope=contribute`) |
| Ảnh xem trước (OG) | `public/khoe-og.html` + nginx | **Trang OG tĩnh chung** cho mọi `/khoe/:token` (ảnh `og-banner` chung, không có ảnh thiệp thật), nginx chuyển trình quét sang đây |
| Dọn hết hạn | function `cleanup-card-shares` + cron | Xoá ảnh + dòng khi quá hạn |
| Bảng | `card_shares` (RLS: ai cũng đọc khi chưa hết hạn; thành viên tạo; người tạo / người sửa được họ gỡ) | Không có đếm lượt xem |

Điểm yếu cần giải: (1) trang `/khoe` tách rời phong cách website, không dẫn được tới dòng họ; (2) khi dán link vào Zalo / Facebook **không hiện ảnh thiệp thật**
(OG chung); (3) người tạo không biết ai xem, còn bao lâu, không gỡ sớm / gia hạn thuận tiện; (4) hộp thoại 689 dòng dày đặc, các loại link
(cây, QR mộ, QR di sản, mời góp, khoe) nằm rải rác ở nhiều nơi.

## 2. Mục tiêu thiết kế

1. Trang `/khoe/:token` đẹp, nhẹ, **đúng một việc**: cho người nhận xem thiệp, lưu / chia sẻ lại được, và có đường dẫn tự nhiên vào dòng họ.
2. Dán link khoe vào Zalo / Facebook ra **ảnh thiệp thật + tiêu đề** (OG theo từng thiệp).
3. Hộp thoại tạo thiệp gọn, xem trước lớn, đi theo 3 bước dễ cho người lớn tuổi.
4. Một **Trung tâm chia sẻ** gom mọi loại link đã tạo: còn hạn, lượt xem, gỡ / gia hạn.
5. Không làm lộ thêm thông tin riêng tư (người còn sống, quan hệ, giới tính).

## 3. Bản thiết kế cần làm (artboard trong canvas Design)

| # | Màn | Ghi chú |
|---|---|---|
| T1 | Trang `/khoe/:token` — máy tính, sáng + tối | Đầu trang tối giản (logo + tên họ), ảnh thiệp lớn (khổ vuông / dọc), tiêu đề + phụ đề, hàng nút `sm`: **Tải ảnh · Chia sẻ · Sao chép link**, dòng "Link còn N ngày", khối mời: "Xem cây gia phả họ <X>" (chỉ khi dòng họ công khai) + "Tạo gia phả cho họ bạn" |
| T2 | Trang `/khoe/:token` — điện thoại 390px | Ảnh tràn lề, nút dưới ảnh xếp 1–2 hàng, khối mời gọn |
| T3 | Trạng thái hết hạn / đã gỡ / sai link | Một thẻ giữa trang + nút "Về trang chủ"; không lộ lý do cụ thể |
| T4 | Hộp thoại tạo thiệp (ngăn kéo) | 3 bước: **① Chọn kiểu** (thành viên / tin vui / giỗ…, khổ vuông / dọc) → **② Tuỳ chỉnh** (người, chữ, kiểu chữ, màu — xem trước lớn bên cạnh) → **③ Chia sẻ** (Zalo, Facebook, tải ảnh, link có hạn). Điện thoại: xem trước ở trên, bước ở dưới |
| T5 | Thiệp mời góp | Cùng bộ chủ đề màu với T4; mã QR + dòng "Quét để góp chuyện"; kiểm tra in A5 / khổ story |
| T6 | Mẫu OG 1200×630 | Bố cục riêng cho ảnh xem trước: thiệp đặt giữa nền thương hiệu, tên họ + tiêu đề, không chữ nhỏ (đọc được ở cỡ thu nhỏ của Zalo) |
| T7 | Trung tâm chia sẻ | Danh sách link: loại (khoe / cây / mộ / di sản / mời góp), người tạo, ngày tạo, hạn, lượt xem; hành động: sao chép, gia hạn, gỡ. Gộp vào Cài đặt dòng họ hoặc ngăn kéo "Chia sẻ" hiện có |

Quy tắc chung: nút `size="sm"`, mọi nút có icon (trừ Huỷ / Đóng), tiêu đề thẻ tối đa 2 dòng, tên họ dài bị cắt có `title`, vùng chạm ≥ 44px,
tương phản chữ ≥ 4,5:1 cả sáng lẫn tối.

## 4. Dữ liệu và kỹ thuật

### 4.1 Ảnh xem trước theo từng thiệp
- Function mới `og-khoe` (theo mẫu `og-post`, `docs/og-post-nginx.md`): `GET ?token=…` → HTML nhỏ có `og:title`, `og:description`, `og:image` = **ảnh thiệp thật**,
  `og:url` = địa chỉ `/khoe/:token`. Cổng: dòng còn hạn (`expires_at > now()`); mọi lỗi → 404 trơn. Thay trang tĩnh chung `khoe-og.html` (giữ làm dự phòng).
- Ảnh OG: khổ Vuông / Dọc không hợp tỉ lệ 1,91:1 của Facebook. Khi **xuất bản**, dựng thêm bản OG 1200×630 (mẫu T6) bằng cùng bộ dựng ảnh phía trình duyệt,
  lưu cột mới `card_shares.og_image_path` (JPEG ≤ ~150 KB, dung lượng VPS có hạn); không có thì dùng ảnh thiệp gốc.
- nginx: thêm khối chuyển trình quét như `og-post` (cấu hình nằm trên máy chủ, không đưa hạ tầng vào repo).

### 4.2 Trang `/khoe/:token`
- Viết lại `KhoeCard.tsx` theo T1–T3, dùng chung khung nhẹ (header + footer) của website, **không** dùng menu đầy đủ.
- Đọc qua function (`part=khoe` hoặc `og-khoe`-cùng-logic) thay vì SELECT trực tiếp bảng bằng anon, để đếm lượt xem + che dữ liệu (xem 4.3). Chỉ trả `title`, `subtitle`,
  đường dẫn ảnh, `expires_at`, tên họ và cờ "dòng họ công khai + id họ" (để hiện nút "Xem cây gia phả").
- Hết hạn: đếm ngược "còn N ngày"; hết hạn / đã gỡ → T3.

### 4.3 Lượt xem, gia hạn, gỡ
- Thêm `card_shares.view_count int default 0`, `last_viewed_at`. Tăng trong function (bộ đếm theo IP + token để không bị đội số), **không** tăng với trình quét.
- Gia hạn: người tạo / người sửa được họ cập nhật `expires_at` (tối đa 90 ngày kể từ lúc gia hạn). Gỡ sớm: đã có (xoá dòng + cron dọn ảnh).
- Trung tâm chia sẻ (T7) đọc `card_shares` + `share_links` của dòng họ theo quyền hiện có.

### 4.4 Quyền riêng tư
- **Người còn sống:** hiện tại thiệp khoe thành viên có thể dựng cho bất kỳ ai. Đề xuất: thiệp của người còn sống chỉ cho **chính người đó hoặc admin** tạo, và hiện cảnh báo
  "Ảnh và tên sẽ công khai tới khi hết hạn". Cần chốt (câu hỏi mở 1).
- Thiệp chỉ chứa ảnh + chữ người tạo nhập; trang `/khoe` không lộ quan hệ, giới tính, ngày sinh (giữ như hiện nay).
- Chống lạm dụng: chỉ thành viên đã đăng nhập mới tạo được (RLS hiện có); thêm trần số thiệp còn hạn mỗi thành viên (đề xuất 20) và trần dung lượng ảnh;
  trang đọc có giới hạn tốc độ như `share-view`. Không cần reCAPTCHA ở đây (xem `docs/plan-recaptcha-public.md`).

## 5. Đo lường (Umami, theo phễu tăng trưởng)
`khoe_created` (kiểu, khổ, hạn), `khoe_shared` (kênh), `khoe_viewed` (phía máy chủ, có `bot=false`), `khoe_cta_click` (xem cây / tạo gia phả). Mục đích: xem thiệp khoe
có kéo được người mới đăng ký hay không — nút thắt hiện nay là **chia sẻ → đăng ký**.

## 6. Các bước làm
1. **Thiết kế** T1–T7 trên canvas Design (máy tính, 390px, sáng–tối), duyệt với chủ dự án.
2. Chốt câu hỏi mở.
3. Migration: `card_shares.og_image_path`, `view_count`, `last_viewed_at` (+ test RLS). Áp tay lên self-host như các migration khác.
4. `og-khoe` + dựng ảnh OG ở bước xuất bản + test; thêm khối nginx (hướng dẫn trong `docs/`).
5. Viết lại `KhoeCard.tsx` (T1–T3) + đọc qua function + đếm lượt xem; test DOM + chụp trình duyệt.
6. Viết lại hộp thoại tạo thiệp theo T4 (tách `ShareCardDialog` thành các bước nhỏ) và thiệp mời góp theo T5; giữ nguyên chức năng xuất ảnh / chia sẻ.
7. Trung tâm chia sẻ (T7).
8. Test local → **dừng chờ bạn test** → mới deploy (migration áp tay, copy function, sửa nginx).

## 7. Câu hỏi mở
1. Thiệp của **người còn sống**: chỉ chính họ / admin được tạo (đề xuất) hay ai trong họ cũng tạo được như hiện nay?
2. Link khoe có nên **gia hạn được** không, hay luôn tối đa 3 tháng rồi tạo mới?
3. Trung tâm chia sẻ đặt ở đâu: Cài đặt dòng họ, hay ngăn kéo "Chia sẻ" hiện có?
4. Có muốn trang khoe hiện **tên người tạo** (ví dụ "do <Tên> chia sẻ") hay ẩn danh?
