# Plan — Đa ngôn ngữ (i18n) cho Dòng Họ Việt

> Trạng thái: **nháp để chốt** (2026-11-13). Chưa viết dòng code nào. Số liệu bên dưới đo
> trực tiếp từ repo, không phải ước đoán.

## 1. Mục tiêu

Người trong họ ở nước ngoài (Mỹ, Úc, Pháp…) và người thân không đọc được tiếng Việt vẫn dùng
được app: xem cây, tra cứu quan hệ, nhận nhắc giỗ, xuất sổ. **Tiếng Việt vẫn là ngôn ngữ gốc và
mặc định** — mọi thứ chưa dịch tự rơi về tiếng Việt, không bao giờ hiện khoá trống.

Ngôn ngữ đầu tiên đề xuất: **Tiếng Anh (EN)**. Kiến trúc làm sao thêm ngôn ngữ thứ ba (Pháp, Hàn,
Nhật…) chỉ là thêm một tệp catalog + một mục trong bảng ngôn ngữ.

## 2. Đo đạc hiện trạng

| Hạng mục | Số liệu |
|---|---|
| Tệp TS/TSX (không tính test) | 452, trong đó **428 tệp chứa tiếng Việt** |
| Dòng chứa tiếng Việt, **bỏ comment** (≈ chuỗi giao diện) | **~9.200** |
| Thư viện i18n đang dùng | **không có** (`<html lang="vi">` cứng) |
| Chỗ định dạng ngày/số/locale | 92 chỗ `vi-VN` / `"vi"`, 68 chỗ `toLocale*`/`Intl` |
| Edge functions (email, push, bản tin tuần, thiệp…) | 1.632 dòng tiếng Việt, 20 function |
| PDF Sổ gia phả + các PDF khác (`src/lib/pdf`) | 646 dòng tiếng Việt |
| Zalo Mini App (`zalo/`) | 1.144 dòng — **chỉ phục vụ người Việt, giữ nguyên VI** |
| Hướng dẫn sử dụng (`src/pages/docs/articles`) | 4 tệp, ~1.400 dòng |
| Pháp lý (`PrivacyPolicy`, `TermsOfUse`) | ~380 dòng |
| Nội dung trong DB | Sổ tay văn hoá (`custom_entries`), thông báo, văn bản tự soạn của sổ (`clan_book_texts`) |
| Test Vitest | nhiều ca khẳng định **đúng chuỗi tiếng Việt** (menu, nhãn…) |
| Video hướng dẫn (Playwright) | ~2.600 dòng kịch bản, chạy trên giao diện VI |

Thư mục nặng nhất: `components` (121 tệp), `lib` (59), `pages/clan` (51), `lib/queries` (50 — thông
báo lỗi/nhãn trả về từ lớp truy vấn), `pages/admin` (22).

## 3. Phân loại nội dung — mỗi loại một cách xử lý

| Loại | Ví dụ | Cách làm |
|---|---|---|
| **A. Chuỗi giao diện** | nút, nhãn, toast, placeholder, thông báo lỗi | Catalog i18n, bọc tại chỗ |
| **B. Định dạng** | ngày, số, tiền `đ`, sắp xếp, "x ngày trước" | `Intl` theo locale đang chọn; một bộ helper dùng chung |
| **C. Thuật ngữ gia phả đặc thù Việt** | xưng hô (chú, bác, cô, cậu, dì, thím, mợ…), Đời, Chi, Thuỷ tổ, giỗ, âm lịch, Can Chi, họ–đệm–tên | **Không dịch máy.** Quy tắc "giữ từ gốc + chú giải": `Chú (father's younger brother)`. Có glossary được duyệt |
| **D. Văn bản dài** | Hướng dẫn, Chính sách, Điều khoản, Changelog | Tệp theo ngôn ngữ; pháp lý cần người có chuyên môn duyệt bản EN |
| **E. Dữ liệu người dùng nhập** | tên, tiểu sử, mô tả họ, ghi chú | **Không dịch** (chỉ nhãn trường được dịch) |
| **F. Ngoài trình duyệt** | email, push, PDF, ảnh thiệp, OG của link chia sẻ | Theo ngôn ngữ của **người nhận / người xuất** (xem §5) |

Loại **C** là phần rủi ro nhất: `lib/kinship.ts` (429 dòng) và `lunarDate.ts` (204 dòng) sinh ra chữ
tiếng Việt trực tiếp. Phải đổi sang "trả về khoá + tham số", rồi mỗi ngôn ngữ có bảng hiển thị.

## 4. Quyết định kiến trúc đề xuất

### 4.1 Thư viện: **Lingui** (so với i18next)

| | Lingui | i18next + react-i18next |
|---|---|---|
| Khoá | **Chính câu tiếng Việt** làm khoá gốc (`` t`Lưu` ``) | Phải đặt khoá thủ công cho ~9.000 chuỗi (`common.save`) |
| Di chuyển mã hiện có | Bọc tại chỗ, **ít đổi dòng nhất** | Mỗi chuỗi một lần đặt tên + tra cứu |
| Trích chuỗi | `lingui extract` tự quét, báo thiếu/dư | Phải tự giữ đồng bộ hoặc dùng công cụ ngoài |
| Số nhiều, chọn theo giới | ICU chuẩn | Có, cú pháp riêng |
| Kích thước | Nhỏ (biên dịch trước) | Lớn hơn |
| Rủi ro với repo | Cần plugin macro; Vite hiện dùng `@vitejs/plugin-react` (Babel) → **dùng được** `@lingui/babel-plugin-lingui-macro` | Không cần plugin |

→ Chọn **Lingui**, VI là ngôn ngữ nguồn. Lý do quyết định: khối lượng 9.000 chuỗi — chi phí
đặt khoá thủ công của i18next lớn hơn nhiều, và bản thân câu tiếng Việt đã là khoá.

### 4.2 Catalog và nạp
- `locales/vi/messages.po` (nguồn), `locales/en/messages.po`; biên dịch ra JS, **nạp lười theo
  ngôn ngữ** (mở bằng VI thì không tải gói EN). PWA precache giới hạn 2MB → catalog nằm ngoài precache.
- Thiếu bản dịch → hiện tiếng Việt (fallback), có log trong môi trường dev.

### 4.3 Chọn và lưu ngôn ngữ
1. Cột `profiles.locale` (`vi` | `en`…) — người dùng đã đăng nhập, **đồng bộ mọi thiết bị**, và để
   edge function biết gửi email/push bằng ngôn ngữ nào.
2. `localStorage` + `navigator.language` cho khách chưa đăng nhập.
3. Trang công khai (`/share/:token`, `/khoe/:token`, `/join`, `/lien-he`…): tham số `?lang=` thắng,
   rồi tới lựa chọn đã lưu, rồi tới trình duyệt.
4. **Không đổi đường dẫn** (không `/en/...`): giữ nguyên mọi link đã chia sẻ. Cập nhật
   `<html lang>` theo ngôn ngữ đang dùng.
5. Chỗ chọn: trang Tài khoản + mục trong menu ba chấm trên thanh đầu + chân trang công khai.

### 4.4 Định dạng
Một nơi duy nhất `lib/i18n/format.ts` (ngày, ngày giờ, tương đối, số, tiền VND, danh sách) dùng
`Intl` với locale hiện hành, thay cho 92 chỗ `vi-VN` rải rác. Sắp xếp tên dùng `localeCompare`
theo locale; **tìm kiếm không dấu (`unaccent`) giữ nguyên cho mọi ngôn ngữ** — người nước ngoài
gõ không dấu để tìm tên Việt rất thường gặp.

### 4.5 Thuật ngữ và tên người
- **Glossary** (`docs/glossary-i18n.md`): mỗi thuật ngữ gia phả có bản gốc, cách giữ/dịch trong EN,
  và ví dụ. Mọi bản dịch phải theo glossary; có kiểm tra tự động cho các từ khoá chính.
- **Thứ tự tên**: tuỳ chọn hiển thị "Họ Đệm Tên" (Việt, mặc định) hoặc "Tên Họ" (phương Tây); chỉ đổi
  cách hiển thị, không đổi dữ liệu lưu.
- **Xưng hô** (`kinship`): trả về `{ term: "chu", side: "paternal", ... }`; EN hiển thị
  `Chú — father's younger brother`. Người ngoài họ thường cần cả hai.
- **Âm lịch / Can Chi**: giữ nguyên tên Hán–Việt, thêm chú thích "Lunar" và phiên âm; không dịch nghĩa.

### 4.6 Ngoài trình duyệt
- **Edge functions** (email, push, bản tin tuần, nhắc giỗ): `_shared/i18n.ts` có mẫu theo
  ngôn ngữ; ngôn ngữ lấy từ `profiles.locale` của **người nhận**; thiếu thì VI.
- **PDF** (Sổ, Tra cứu quan hệ, Quỹ họ, thẻ QR): nhãn lấy từ cùng catalog theo ngôn ngữ của
  **người bấm xuất**; font Be Vietnam Pro đã phủ Latin nên EN dùng được ngay. Nếu sau này thêm
  tiếng Hàn/Nhật/Trung thì cần font riêng (ngoài phạm vi giai đoạn đầu). Phần văn bản tự soạn của
  từng dòng họ (`clan_book_texts`) **giữ nguyên** (dữ liệu người dùng).
- **Link chia sẻ** (`share-view`, ảnh OG, thiệp "Khoe"): tiêu đề/mô tả OG theo `?lang=` hoặc `Accept-Language`.
- **Nội dung DB**: `custom_entries` (Sổ tay), thông báo → thêm cột `locale`; một mục có thể có bản
  dịch song song; thiếu bản dịch thì hiện bản gốc kèm nhãn "Tiếng Việt".

### 4.7 Cố tình **không** làm
- **Zalo Mini App**: giữ tiếng Việt (nền tảng chỉ ở Việt Nam).
- **Trang quản trị nền tảng** (`pages/admin`, 22 tệp, nội bộ): giữ tiếng Việt, chỉ bọc khi cần.
- **Dịch dữ liệu người dùng** bằng máy.
- **Chữ viết từ phải sang trái** (RTL) và ngôn ngữ CJK ở giai đoạn đầu.

## 5. Cách chuyển 9.000 chuỗi mà không "đứng máy"

1. **Công cụ tìm** (kiểu `src/test/ui/conventions.test.ts` đang có): script liệt kê chuỗi tiếng Việt
   chưa bọc, theo thư mục — làm bảng tiến độ và cổng CI "không thêm chuỗi trần mới" sau khi một
   thư mục đã chuyển xong.
2. **Codemod bán tự động** cho các mẫu lặp: văn bản JSX, `placeholder=`, `aria-label=`, `title=`,
   `toast.success("…")`. Phần còn lại (chuỗi ghép, `${}`, số nhiều) làm tay.
3. **Dịch**: máy dịch nháp theo glossary → người bản ngữ trong họ duyệt phần thuật ngữ (nhóm C) →
   khoá bản dịch. Phần nhãn thông thường duyệt lướt.
4. **Theo thư mục, mỗi PR một cụm** (xem §6) — luôn chạy được, vì thiếu bản dịch là fallback VI.
5. **Chuỗi nằm trong lớp truy vấn** (`lib/queries`, thông báo lỗi): chuyển sang trả mã lỗi + tham số,
   giao diện dịch; tránh dịch trong tầng dữ liệu.
6. **Test**: mặc định chạy locale `vi` nên 1.000+ ca hiện có giữ nguyên; thêm test "ngôn ngữ giả"
   (pseudo-locale, mỗi chuỗi bọc `[!! … !!]`) để phát hiện chuỗi sót; kịch bản video vẫn quay bằng VI.

## 6. Phân kỳ

| Giai đoạn | Việc | Ước tính (1 dev) |
|---|---|---|
| **P0 Chốt** | Chọn ngôn ngữ, thư viện, người duyệt dịch; viết glossary | 1–2 ngày |
| **P1 Hạ tầng** | Lingui + plugin Vite, provider, catalog lười, `profiles.locale` (migration áp tay), bộ chọn ngôn ngữ, `format.ts`, cổng CI, pseudo-locale | 3–4 ngày |
| **P2 Lõi** | Đăng nhập/đăng ký, thanh đầu + menu + thanh tab, Tổng quan, Cây, Danh bạ, Chi tiết người, Tài khoản, Tra cứu quan hệ — ship EN "một phần, có fallback" | 5–7 ngày |
| **P3 Module còn lại** | Sự kiện, Quỹ họ, Bảng vàng, Mộ phần, Di sản, Ảnh ghép, Phòng ký ức, Bảng tin, Thành viên, Cài đặt, Công cụ/Nhập | 6–9 ngày |
| **P4 Thuật ngữ** | `kinship` + `lunarDate` + thứ tự tên + chú giải; test cho từng quan hệ | 4–5 ngày |
| **P5 Ngoài UI** | Email/push (edge functions), PDF, Hướng dẫn, Chính sách/Điều khoản (cần duyệt pháp lý), Sổ tay (cột `locale`) | 6–8 ngày |
| **P6 Công khai** | Trang chia sẻ, OG/thiệp theo ngôn ngữ, landing, `hreflang` | 2–3 ngày |

**Tổng ≈ 4–6 tuần** cho EN đầy đủ; **mốc có giá trị sớm nhất là hết P2 (~2 tuần)**: người nước
ngoài đã xem được cây, danh bạ, quan hệ bằng tiếng Anh. Thêm ngôn ngữ thứ hai sau đó chủ yếu là
chi phí dịch + duyệt, không phải chi phí mã.

## 7. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| Dịch sai thuật ngữ gia phả / xưng hô | Glossary + người bản ngữ duyệt nhóm C; không dịch máy phần này |
| Giao diện lẫn hai thứ tiếng trong lúc chuyển | Chấp nhận có chủ đích: ưu tiên chuyển **trọn từng màn**, không chuyển nửa màn |
| Bundle phình / vượt trần precache PWA 2MB | Catalog nạp lười, đo kích thước ở CI |
| Mã tạo chuỗi dùng macro lỗi trong Vite | Thử P1 trên 2–3 tệp trước khi mở rộng |
| Test gãy vì khẳng định chuỗi VI | Mặc định test chạy `vi`; pseudo-locale chạy riêng |
| Pháp lý EN không có giá trị / sai lệch | Chỉ công bố bản EN của Chính sách/Điều khoản sau khi có người duyệt; ghi rõ "bản tiếng Việt là bản chính" |
| Chi phí duy trì: mỗi chuỗi mới phải dịch | Cổng CI báo thiếu bản dịch; fallback VI để không chặn phát hành |
| Tìm kiếm / sắp xếp tên | Giữ `unaccent`; sắp xếp theo `localeCompare("vi")` cho tên người bất kể ngôn ngữ giao diện |

## 8. Cần chốt trước khi bắt tay làm

1. **Ngôn ngữ nào, theo thứ tự nào?** (đề xuất: EN trước).
2. **Chọn Lingui** hay i18next? (đề xuất: Lingui — lý do ở §4.1).
3. **Ai duyệt bản dịch** thuật ngữ gia phả và pháp lý?
4. Có cho phép **"một phần EN"** ở giai đoạn đầu (fallback VI), hay chỉ công bố khi đủ cả nhóm màn lõi?
5. **Email/push** có gửi theo ngôn ngữ người nhận ngay từ đầu, hay để P5?
6. Có làm **thứ tự tên Tên–Họ** tuỳ chọn không?
