# Kế hoạch: Địa chỉ thành viên & "Thống kê theo bản đồ"

> Plan tự-chứa để Claude Code triển khai trong session sau. Tiếng Việt mô tả;
> tên bảng/cột/route/biến giữ tiếng Anh. Trạng thái: **đã chốt hướng, chưa code.**

## Mục tiêu
Cho thành viên dòng họ ghi **địa chỉ đầy đủ** của từng người (tuỳ chọn), rồi xem
**bản đồ Việt Nam tô đậm theo tỉnh** + thống kê phân bố con cháu. Ý tưởng bố cục
lấy từ mục "Thống kê theo bản đồ" của Gia Phả Số Việt Nam (chỉ lấy ý tưởng,
KHÔNG dùng lại ảnh/SVG/logo của họ).

## Quyết định đã chốt (qua trao đổi với user)
- **Địa chỉ đầy đủ, nhập hay không tuỳ người dùng** — không bắt buộc; thiếu thì
  hiện trong ô "Trạng thái dữ liệu" để nhắc bổ sung.
- **Chỉ thành viên dòng họ mới xem được** (`is_clan_member`). Tuyệt đối không
  lộ ra: link share công khai, `share-view`, `persons_public_safe`, thẻ khoe
  (`/khoe/:token`), Zalo Mini App chế độ xem công khai, sitemap/SEO.
- **Bản đồ SVG tĩnh theo tỉnh**, không tile ngoài (CSP hiện chặn tile; cũng
  không gửi IP cho bên thứ ba). Bản đồ nền (MapLibre) để pha sau, chỉ cho Mộ phần.

## Mô hình dữ liệu

### Bảng mới `person_addresses` (TÁCH khỏi `persons` — chủ ý)
Tách bảng để địa chỉ không bao giờ lọt vào view/RPC công khai đang `select` từ
`persons`. RLS riêng, mặc định đóng.
- `person_id uuid pk` → `persons(id)` on delete cascade
- `clan_id uuid not null` (denormalize để RLS rẻ, giống các bảng khác)
- `province_code text` → `vn_provinces(code)` — chọn từ danh mục (không gõ tay)
- `ward_code text` → `vn_wards(code)` — chọn từ danh mục, lọc theo tỉnh đã chọn
- `street_detail text` — số nhà, thôn/xóm… (ô duy nhất gõ tay, tuỳ chọn)
- `country text default 'VN'` (người ở nước ngoài: `country` ≠ VN, không tính
  vào bản đồ tỉnh)
- `updated_at`, `updated_by`
- Địa chỉ **hiện tại** của người còn sống; người đã khuất không cần (nơi an
  nghỉ đã có ở `resting_places`).
- RLS: `select` cho `is_clan_member(clan_id)`; `insert/update/delete` cho
  `can_edit_clan(clan_id)` **hoặc** chính người dùng được liên kết với person
  đó (kiểm tra cơ chế liên kết account↔person hiện có trước khi viết policy).
- Có audit log như persons; **không** ghi giá trị địa chỉ vào log công khai.

### Danh mục hành chính — SEED SẴN để người dùng chỉ việc chọn
Hai bảng tham chiếu **đọc công khai cho user đăng nhập**, chỉ platform admin sửa:
- `vn_provinces(code pk, name, name_unaccent, region)` — 34 tỉnh/thành (sau
  sáp nhập hiệu lực 01/07/2025); `region` = bac/trung/nam để vẽ donut.
- `vn_wards(code pk, province_code fk, name, name_unaccent, kind)` — 3.321
  xã/phường/đặc khu. Hệ mới chỉ 2 cấp (tỉnh → xã/phường), **không có cấp huyện**.
- Nguồn dữ liệu: kho `thanglequoc/vietnamese-provinces-database` (bản v4.1.0 trở
  lên, có đủ 34 tỉnh + 3.321 xã/phường và GeoJSON bù Hoàng Sa/Trường Sa).
  **Kiểm giấy phép của kho trước khi nhập.** `undertheseanlp/address` có bảng
  ánh xạ địa danh cũ → mới, dùng để gợi ý cho dữ liệu cũ.
- Seed bằng script trong `scripts/` (đọc JSON → sinh migration/SQL), đối chiếu
  số lượng sau khi nhập (34 / 3.321). Ô chọn trên form có ô tìm kiếm (gõ không
  dấu), vì danh sách xã rất dài.
- Địa danh đổi theo thời gian: lưu `code` (ổn định) thay vì tên, tên hiển thị
  join từ bảng danh mục; có script cập nhật khi nhà nước điều chỉnh tiếp.

### Gợi ý cho dữ liệu cũ
Script một lần đoán `province_code` từ `persons.birth_place` (khớp tên tỉnh
bỏ dấu), đưa vào hàng chờ "đề xuất — chờ xác nhận", KHÔNG tự ghi đè.

## RPC thống kê
`clan_province_stats(p_clan uuid, p_include_deceased boolean)` — security
definer nhưng **tự kiểm tra `is_clan_member`**, chỉ trả số đếm theo tỉnh:
`{province_code, count}` + `missing_count` + `abroad_count`. Không trả tên người.
(Theo `getClanStats` ở `src/lib/queries/clan-stats.ts`.)

## UI
- Tab **"Thống kê theo bản đồ"** trong trang thống kê/Dashboard của họ.
- `ProvinceMap` — SVG 34 tỉnh + Hoàng Sa/Trường Sa đúng vị trí (bắt buộc,
  nhạy cảm chủ quyền). Tô theo thang số người; nhãn "Tỉnh · N người".
- Cột phải: Top tỉnh, donut Bắc/Trung/Nam, "Trạng thái dữ liệu" (có/thiếu địa
  chỉ), ô tick "Loại trừ người đã khuất".
- Form người (`NewPerson`/`EditPerson`): **một card riêng, tuỳ chọn** "Nơi ở
  hiện tại", tách khỏi các card thông tin cơ bản. Gồm ô chọn Tỉnh/Thành →
  Phường/Xã (cascade, có tìm kiếm) + ô chi tiết. Đầu card có dòng ghi chú rõ:
  *"Không bắt buộc. Nếu bạn nhập thông tin ở đây, tỉnh/thành sẽ được hiển thị
  trên Bản đồ thống kê của dòng họ (chỉ thành viên dòng họ xem được). Không
  nhập thì bạn sẽ không xuất hiện trên bản đồ."* Có nút "Xoá địa chỉ" để rút lại.
- Bản đồ chỉ tô theo **tỉnh**; phường/xã và chi tiết chỉ hiện ở hồ sơ người,
  không vẽ lên bản đồ.
- Chi tiết người (`PersonDetail`): hiện địa chỉ nếu có; vẫn nằm sau kiểm tra
  thành viên.

## Việc phải kiểm trước khi code
1. Giấy phép của kho dữ liệu hành chính + GeoJSON (cùng kho ở trên); chuyển
   GeoJSON → SVG path đơn giản hoá (giảm dung lượng) và kiểm Hoàng Sa/Trường Sa.
2. Cơ chế account↔person để cho người dùng tự sửa địa chỉ của mình.
3. Mọi nơi đang `select` bảng `persons` công khai — xác nhận không join
   `person_addresses` (grep `share-view`, `persons_public_safe`, Zalo, khoe).
4. Thêm test RLS: người ngoài họ / anon `select person_addresses` → rỗng.

## Triển khai & deploy (theo ghi chú hạ tầng self-host)
- Migration KHÔNG tự áp bởi `deploy-vps.yml`: áp tay qua ssh + docker exec psql,
  ghi `schema_migrations`.
- Nếu thêm field vào Zalo Mini App: chỉ đọc, đồng bộ theo quy ước "chức năng
  như web, trình bày cho mobile".

## Ngoài phạm vi (pha sau)
Bản đồ nền (MapLibre) cho Mộ phần, tuyến thăm mộ, tự động gợi ý địa chỉ qua
geocoding ngoài.
