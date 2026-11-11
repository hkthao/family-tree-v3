# Plan — "Ảnh đại gia đình ghép mảnh" (Family Puzzle Mosaic)

> Ý tưởng: mỗi thành viên upload ảnh của mình → mỗi ảnh là **một mảnh ghép** trong
> một **bức ảnh lớn của dòng họ**. Hình mẫu: tranh ghép puzzle (mảnh có răng cưa),
> nhưng mảnh là ảnh của từng người, ghép lại thành một tấm chung.

## Hai cách hiểu "ghép thành 1 mảng lớn" — cần chốt

| | A. **Mosaic ảnh** (khuyến nghị) | B. **Puzzle một ảnh nền** |
|---|---|---|
| Mỗi mảnh | là ảnh của chính người upload, cắt vuông/răng cưa | là 1 phần của ảnh nền duy nhất |
| Kết quả | tấm lớn gồm N ảnh con xếp lưới/puzzle; nhìn xa có thể ra hình (logo họ, hình cây) | ảnh nền hiện dần khi người ta "ghép" mảnh |
| Ý nghĩa | **mỗi người là một mảnh thật sự** → hợp gia phả | mảnh chỉ là ô che, ảnh người upload không hiện |
| Độ khó | vừa | thấp–vừa |

→ Chọn **A**, vẽ viền mảnh kiểu puzzle (răng cưa) cho giống hình mẫu. Tuỳ chọn sau:
phủ một "ảnh nền mờ" lên mosaic (photomosaic) để nhìn xa ra hình.

## Quyền & luồng dùng
- **Mọi thành viên họ** (kể cả `viewer`) upload được **mảnh của mình**; sửa/xoá mảnh
  của mình. **admin/editor** upload hộ, xoá/ẩn bất kỳ mảnh, sắp xếp lại.
- Mỗi thành viên mặc định **1 mảnh** (có thể nới tới N, cấu hình ở Cài đặt họ).
- Mảnh gắn với `person_id` (tuỳ chọn) → bấm mảnh thấy tên, nhảy tới hồ sơ người đó.
- Một họ có thể có **nhiều "bức"** (ví dụ "Tết 2027", "Đại gia đình 2026"), mỗi bức
  có khung/đề + trạng thái mở/đóng nhận mảnh.
- Duyệt: mặc định hiện ngay; admin bật "cần duyệt" được (tái dùng mẫu `needs_review`).

## Trải nghiệm
1. Trang **Ảnh đại gia đình** (`/c/:clan/ghep-anh`): danh sách bức + nút "Tạo bức".
2. Trang bức: canvas mosaic xem full, **pinch-zoom/kéo**, mảnh trống hiện ô gỗ như
   hình mẫu + nút **"Thêm mảnh của tôi"** (mở SidePanel: chọn ảnh → cắt/căn khung →
   chọn người liên quan → lưu).
3. Bấm mảnh → xem ảnh lớn + tên + người upload (Dialog/SidePanel).
4. **Xuất/chia sẻ**: tải PNG toàn bức, link share công khai (tái dùng cơ chế trang
   `Share` + CTA đăng ký, vì funnel share→signup là nút thắt).
5. Cập nhật: khi có mảnh mới, thông báo bảng tin họ ("A vừa thêm mảnh vào…").

## Thuật toán bố cục
- **Lưới tự co theo số mảnh**: N mảnh → `cols = ceil(sqrt(N * W/H))`; mảnh thừa/ô trống
  hiện ô gỗ "chờ". Khi N đổi, bố cục tính lại (mảnh giữ **thứ tự**, không nhảy loạn;
  thứ tự theo `position` lưu DB).
- **Răng cưa**: mỗi cạnh chung giữa 2 mảnh có "lồi/lõm" xác định bằng hash cạnh
  (deterministic) → 2 mảnh kề luôn khớp. Vẽ bằng SVG path/`clipPath`.
- **Sắp xếp**: mặc định theo đời (thế hệ) rồi tuổi → hàng trên là cụ, hàng dưới là cháu;
  tuỳ chọn: theo thời gian upload / kéo-thả tay (admin).
- Render: **Canvas 2D** (không cần Three.js) cho xem + xuất PNG; chỉ nạp mảnh trong
  khung nhìn, thumbnail trước – ảnh gốc khi zoom.

## Dữ liệu (đề xuất migration mới)

```sql
create table clan_mosaics (            -- một "bức"
  id uuid pk, clan_id uuid not null,
  title text not null, description text,
  cols_hint int, aspect text default '4:3',   -- tỉ lệ tổng thể
  status text check (status in ('open','closed')) default 'open',
  require_review bool default false,
  max_per_member int default 1,
  created_by uuid, created_at, updated_at
);
create table clan_mosaic_tiles (       -- một "mảnh"
  id uuid pk, mosaic_id uuid not null, clan_id uuid not null,
  user_id uuid not null,               -- người upload (quyền sửa/xoá)
  person_id uuid null,                 -- người trong ảnh (tuỳ chọn)
  photo_path text not null,            -- bucket person-photos, thumb + gốc
  caption text, position int not null,
  status text default 'approved',      -- pending|approved|hidden
  crop jsonb,                          -- {x,y,scale} căn khung
  created_at, updated_at
);
```
- **RLS** theo mẫu hiện có: SELECT cho thành viên họ; INSERT khi là thành viên và
  chưa vượt `max_per_member`; UPDATE/DELETE chủ mảnh hoặc `admin/editor`.
  Nhớ dùng `(select auth.uid())` (đã tối ưu initplan) và **audit/version trigger
  nhẹ** như bảng khác, tránh nghẽn khi nhiều người upload cùng lúc.
- **Storage**: tái dùng bucket `person-photos` + `src/lib/photoUpload.ts` (nén phía
  client, tạo thumbnail). Không thêm bucket → không động hạ tầng self-host.
- **Quota ảnh** theo gói/credit hiện có (VPS ít storage): giới hạn ≤ 1,5MB/mảnh sau
  nén, trần số mảnh/bức (vd. 300).
- ⚠️ Migration **áp tay** lên self-host (xem memory *Migrations thủ công self-host*).

## Module code
```
src/lib/queries/mosaics.ts          // react-query: list/get/create/tile CRUD
src/pages/clan/Mosaics.tsx          // danh sách bức
src/pages/clan/MosaicDetail.tsx     // canvas + thêm mảnh
src/components/mosaic/
  MosaicCanvas.tsx                  // vẽ lưới + răng cưa, zoom/pan
  jigsawPath.ts                     // sinh path răng cưa deterministic
  layout.ts                         // lưới tự co, thứ tự
  TileForm.tsx                      // SidePanel: chọn ảnh, crop, gắn người
  exportPng.ts                      // xuất ảnh toàn bức
```
Điều hướng: thêm mục cạnh "Phòng ký ức"/"Di sản"; trang public share dưới `/share`.

## Phân kỳ
1. **MVP**: bảng + RLS, upload 1 mảnh/người, lưới + răng cưa, xem/zoom, xoá/ẩn (admin).
2. Gắn người, sắp xếp theo đời, xuất PNG, thông báo bảng tin.
3. Duyệt mảnh, nhiều bức, link share công khai + CTA.
4. Photomosaic (ảnh nền mờ), hiệu ứng "ghép mảnh bay vào" khi có mảnh mới, đưa ảnh
   bức vào Phòng ký ức 3D.
5. (Zalo Mini App: chỉ xem — theo `feedback_zalo_scope_no_admin`.)

## Rủi ro
- Nhiều người upload cùng lúc → dùng trigger nhẹ, không audit nặng.
- Ảnh mặt người = dữ liệu cá nhân → chỉ thành viên họ thấy; link share công khai là
  **opt-in**, admin bật; mảnh `hidden` không lộ ra ngoài.
- Bức quá nhiều mảnh trên mobile → thumbnail + chỉ vẽ vùng thấy.
- Ảnh người upload kích thước lệch → cắt `object-fit: cover` + `crop` căn tay.

## Câu hỏi mở
1. Chọn A (mosaic ảnh từng người) hay B (puzzle một ảnh nền)?
2. 1 mảnh/người hay không giới hạn?
3. Có cần duyệt ảnh trước khi hiện không?
4. Bức tổng có cố định tỉ lệ (vd. 16:9 in ra treo tường) hay tự co theo số mảnh?
