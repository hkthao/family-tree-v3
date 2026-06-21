# Kế hoạch: Quản lý "Mộ phần & tro cốt"

> Plan tự-chứa để Claude Code triển khai trong session sau. Tiếng Việt mô tả;
> tên bảng/cột/route/biến giữ tiếng Anh. Trạng thái: **đã chốt, chưa code.**

## Mục tiêu
Quản lý nơi an nghỉ của thành viên dòng họ — bao cả **chôn cất (mộ)** và
**hỏa táng + gửi tro cốt** (phổ biến miền Nam): gửi chùa, nhà lưu tro / tháp
cốt, **tháp họ chứa tro cốt nhiều người** (vd vùng Sóc Trăng), rải tro.

## Quyết định đã chốt (qua trao đổi với user)
- **Phạm vi Pha 1 (MVP gọn)**: 3 bảng + CRUD + ảnh + GPS & "Chỉ đường" +
  "Lấy vị trí hiện tại" + gắn người + link 2 chiều với PersonDetail + nav.
  **Có** hiển thị trên **share công khai** (mở rộng edge `share-view`).
- **Tạm gác (pha sau)**: nhắc tảo mộ/chạp họ (reuse `events`/`notify-events`),
  bảng `cemeteries` có cấu trúc, **map nhúng**, QR đặt tại mộ, nhập hàng loạt.
- **Một nơi an nghỉ gắn NHIỀU người** (mộ đôi vợ chồng, mộ chung, **tháp họ**)
  → bảng nối nhiều-nhiều `resting_place_occupants`.
- **Tên hiển thị**: "Mộ phần & tro cốt".
- **Bản đồ**: KHÔNG nhúng map (CSP chặn tile ngoài). Lưu lat/long, nút "Chỉ
  đường" mở `https://www.google.com/maps?q=lat,long`, + "Lấy vị trí hiện tại"
  bằng `navigator.geolocation` khi đứng tại nơi an nghỉ.

## Mô hình dữ liệu (mẫu theo `supabase/migrations/20260611090000_clan_posts.sql`)

### Bảng `resting_places`
Scope `clan_id`; soft-delete `deleted_at`; `created_at/updated_at`; audit +
RLS như persons (đọc: `is_clan_member`; sửa: `can_edit_clan`).
- `id uuid pk`, `clan_id uuid` (cascade)
- `kind` enum `resting_place_kind`: `grave | ashes_temple | columbarium | scattered | other`
- `name text` — nhãn tự đặt, vd "Tháp họ Cao", "Mộ cụ Tổ" (tuỳ chọn)
- `location_name text` — nghĩa trang / tên chùa / tên cơ sở-tháp / nơi rải
- `location_detail text` — lô–hàng–số (mộ) HOẶC ngăn/tầng/kệ/số hũ (tro cốt)
- `address text` — địa chỉ
- `latitude double precision`, `longitude double precision` (nullable)
- `orientation text` — hướng mộ (chỉ ý nghĩa với grave; tuỳ chọn)
- `status` enum `resting_place_status`: `existing | relocated | lost` (mặc định existing)
- `built_year int`, `material text`, `notes text`
- (tuỳ chọn) denormalized `occupant_count int` + trigger như `clans.person_count`

**Form đổi nhãn theo `kind`**: grave → "Nghĩa trang/khu" + "Lô–hàng–số";
ashes_temple → "Tên chùa" + "Vị trí hũ"; columbarium → "Cơ sở/Tháp họ" +
"Ngăn/kệ/số hũ"; scattered → "Nơi rải" (ẩn location_detail).
**Tháp họ Sóc Trăng = 1 record kind=`columbarium` + nhiều occupants.**

### Bảng `resting_place_occupants` (nhiều-nhiều)
- `resting_place_id uuid` (cascade), `person_id uuid` (cascade), `clan_id uuid`
  (denormalized, sync trigger như clan_post_comments), `note text`
- unique `(resting_place_id, person_id)`

### Bảng `resting_place_photos`
- `resting_place_id uuid` (cascade), `path text`, `caption text`, `sort int`
- Bucket `grave-photos` (hoặc reuse `person-photos` với prefix), path
  `${clanId}/${restingPlaceId}/${uuid}.jpg`. Mirror `src/lib/photoUpload.ts`.

## Các bước triển khai (Pha 1) — theo thứ tự
1. **Migration** `supabase/migrations/<ts>_resting_places.sql`: 2 enum + 3 bảng +
   index `(clan_id)` + RLS (select: member/admin; insert/update/delete:
   `can_edit_clan`) + audit trigger (`write_audit_log` nếu áp được) + soft-delete
   trigger nếu muốn (cân nhắc) + denormalized clan_id sync trigger cho 2 bảng con.
   → `npx supabase migration up --local` + `npm run db:types`.
2. **Storage**: tạo bucket `grave-photos` (private) trong config/migration; nhân
   helper trong `src/lib/photoUpload.ts` (upload nhiều ảnh / 1 resting place).
3. **Queries** `src/lib/queries/restingPlaces.ts`: list (lọc theo kind/cơ sở +
   search), get (kèm occupants + photos), create/update/softDelete, add/remove
   occupant, add/remove photo. Type từ `database.types.ts`.
4. **UI**:
   - Route `src/App.tsx`: `<Route path="graves" element={<RestingPlaces />} />`
     (path `graves` cho ngắn; nhãn "Mộ phần & tro cốt").
   - Nav `src/components/AppDrawer.tsx` → nhóm "Dữ liệu": item "Mộ phần & tro cốt".
   - `src/pages/clan/RestingPlaces.tsx` — danh sách: lọc kind + cơ sở + tìm; thẻ
     (tên, kind badge, vị trí, số người an nghỉ, thumbnail, nút Chỉ đường).
   - `src/pages/clan/RestingPlaceDetail.tsx` — ảnh, GPS + Chỉ đường + Lấy vị trí
     hiện tại, danh sách người an nghỉ (link PersonDetail), trạng thái, ghi chú;
     nút sửa (editor).
   - Form thêm/sửa (route hoặc sheet): trường vị trí **thích ứng theo kind**, GPS
     (nhập tay + nút geolocation), ảnh (nhiều), person-picker gắn người, kind/status.
   - `src/pages/clan/PersonDetail.tsx`: dòng "Mộ phần / tro cốt" link sang nơi an
     nghỉ (nếu gắn occupant), cạnh `burial_place` text hiện có.
5. **QA local** (dừng ở đây cho user kiểm tra trước khi deploy): tạo/sửa/xoá,
   gắn nhiều người vào 1 tháp, GPS + chỉ đường, ảnh, link PersonDetail.
6. **Share công khai**: mở rộng edge `supabase/functions/share-view/index.ts` trả
   resting_places + occupants (che toạ độ/ảnh nếu là thông tin nhạy cảm? — cân
   nhắc; mộ thường công khai được). UI trang `src/pages/Share.tsx` hiển thị.
7. **Deploy**: `supabase db push` → (nếu sửa share) `supabase functions deploy
   share-view` → pipeline VPS (`gh workflow run deploy-vps.yml --ref main`).

## Tham chiếu code có sẵn để mirror
- Schema/RLS/audit/denormalized: `supabase/migrations/20260611090000_clan_posts.sql`
- Denormalized count trigger: `supabase/migrations/20260531044915_clans_person_count.sql`
- Ảnh: `src/lib/photoUpload.ts` (`uploadPersonPhoto`, `getSignedPhotoUrlMap`),
  component `src/components/PhotoUploadField.tsx`
- burial_place hiện tại: persons col `burial_place`; hiển thị
  `src/pages/clan/PersonDetail.tsx`, sửa ở `EditPerson.tsx`/`NewPerson.tsx`
- Nav: `src/components/AppDrawer.tsx` (`buildSections`), routes `src/App.tsx`
- Events/notify (cho pha sau tảo mộ): `supabase/functions/notify-events/`,
  `src/lib/upcomingEvents.ts`, bảng `events` + `event_subscriptions`

## Pha sau (ghi để nhớ)
- `cemeteries` table (gom khu/cơ sở có cấu trúc, GPS cơ sở).
- Lịch sử cải táng (bốc mộ/sang cát): bảng history hoặc status + ghi chú.
- Nhắc **tảo mộ / chạp họ**: `event_type='tomb_visit'`, reuse cron `notify-events`.
- **QR tại mộ/tháp** → quét ra hồ sơ người / nơi an nghỉ.
- Map nhúng (nếu giải được CSP/tile), nhập hàng loạt, mục trong sách PDF.
