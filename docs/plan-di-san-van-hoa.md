# Plan — Di sản & Văn hoá dòng họ (Heritage)

## Mục tiêu
Module mới quản lý **giá trị phi vật thể** của dòng họ: từ đường/đền/chùa, tục lệ/gia
phong, giai thoại/công trạng, tư liệu/kỷ vật. Mỗi mục có nội dung kể chuyện + thư
viện ảnh + **ghi âm kể chuyện** + gắn người + (P2) gắn lễ hằng năm để nhắc.

## Đối tượng người dùng: NGƯỜI LỚN TUỔI (ưu tiên số 1)
Người giữ tri thức dòng họ phần lớn là các cụ — ngại gõ chữ, mắt kém, sợ thao tác
sai. Mọi quyết định UI ưu tiên: ít thao tác, ô nhập to, **kể bằng giọng nói/ảnh thay
vì gõ**.

## Quyết định đã chốt
- **Module riêng** (không gộp "Mộ phần") — clone pattern `resting_places`.
- **MVP gồm cả 4 loại**: `place`, `custom`, `story`, `artifact`.
- **Có chia sẻ công khai (QR/link)** ngay trong MVP — tái dùng `share_links` + `share-view`.
- **Soạn thảo đơn giản (KHÔNG markdown)** + **câu hỏi gợi ý** theo từng loại.
- **Chụp ảnh trực tiếp** (mở camera) + **ghi âm kể chuyện** (audio).
- **TỐI ƯU STORAGE là ràng buộc cứng** (VPS ít dung lượng) — xem mục riêng bên dưới.

## ⚙️ Tối ưu lưu trữ (ràng buộc cứng)
| Loại | Cách nén | Kích thước mục tiêu | Giới hạn |
|------|----------|---------------------|----------|
| Ảnh | JPEG, ≤1280px, quality 0.8 (như mộ phần) | ≤250 KB/ảnh | ~12 ảnh/mục |
| Audio | **Opus mono ~24–32 kbps** qua MediaRecorder (nén ngay ở trình duyệt) | ~3 KB/giây → 5′ ≈ 0.9 MB | ≤5 phút/đoạn, ≤5 đoạn/mục |
- **Không transcode phía server** (đỡ CPU/đĩa VPS) — lưu thẳng blob đã nén từ client.
- Lưu `bytes` + `duration_sec` mỗi file → hiển thị "đã dùng X MB" cho clan, chặn khi vượt.
- Dùng chung bucket `person-photos` (RLS theo `foldername[1]=clan_id`), path
  `{clanId}/heritage/{itemId}/{uuid}.{jpg|webm}`.
- MediaRecorder ưu tiên `audio/webm;codecs=opus`; fallback `audio/mp4` (Safari/iOS).

## Mô hình dữ liệu

### Migration `2026MMDDHHMMSS_heritage.sql`
```
create type heritage_category as enum ('place','custom','story','artifact');
create type heritage_status   as enum ('active','draft','archived');
create type heritage_media_kind as enum ('photo','audio');

-- bảng chính
create table public.heritage_items (
  id uuid pk default gen_random_uuid(),
  clan_id uuid not null references clans(id) on delete cascade,
  category heritage_category not null,
  title text not null,
  summary text,                      -- mô tả ngắn (list + preview share)
  body text,                         -- nội dung dạng PLAIN TEXT (tự tách đoạn), KHÔNG markdown
  location_name text,                -- chỉ dùng cho place
  address text,
  latitude double precision,
  longitude double precision,
  built_year int,
  status heritage_status not null default 'active',
  sort int not null default 0,
  cover_media_id uuid,               -- ảnh đại diện (FK heritage_media, set sau)
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz,
  constraint heritage_title_len check (char_length(title) <= 200)
);
create index on heritage_items (clan_id) where deleted_at is null;
create index on heritage_items (clan_id, category) where deleted_at is null;

-- media GỘP ảnh + audio (1 bảng, storage-aware)
create table public.heritage_media (
  id uuid pk default gen_random_uuid(),
  item_id uuid not null references heritage_items(id) on delete cascade,
  clan_id uuid not null,             -- denormalized (trigger đồng bộ)
  kind heritage_media_kind not null,
  path text not null,                -- person-photos bucket
  caption text,
  sort int not null default 0,
  bytes int,                         -- để thống kê + chặn vượt dung lượng
  duration_sec int,                  -- chỉ cho audio
  created_at timestamptz default now()
);
create index on heritage_media (item_id, sort);

-- gắn người liên quan (clone resting_place_occupants)
create table public.heritage_people (
  id uuid pk default gen_random_uuid(),
  item_id uuid not null references heritage_items(id) on delete cascade,
  person_id uuid not null references persons(id) on delete cascade,
  clan_id uuid not null,
  role_note text,                    -- vd "người lập từ đường", "nhân vật chính"
  created_at timestamptz default now(),
  unique(item_id, person_id)
);
```
- **Trigger denormalize `clan_id`** cho `heritage_media`/`heritage_people` (copy
  `resting_place_child_sync_clan`, đổi tên bảng tham chiếu → heritage_items).
- **Trigger `set_updated_at`** cho heritage_items.
- **RLS** (copy nguyên resting_places): SELECT `is_clan_member or is_platform_admin`;
  INSERT/UPDATE/DELETE `can_edit_clan`.

### Migration `2026MMDDHHMMSS_share_links_heritage.sql`
```
alter table public.share_links add column root_heritage_item_id uuid
  references heritage_items(id) on delete cascade;
```

## Thay đổi code

### 1. Queries — `src/lib/queries/heritage.ts` (clone `restingPlaces.ts`)
- Nhãn loại + **câu hỏi gợi ý** theo `category` (HƯỚNG DẪN người lớn tuổi):
  - place: "Từ đường ở đâu? Lập năm nào? Ai trông coi? Lễ chính ngày nào?"
  - custom: "Giỗ họ cúng ngày nào? Ai chủ trì? Có món/lễ gì bắt buộc? Con cháu cần làm gì?"
  - story: "Chuyện về ai? Xảy ra khi nào? Ý nghĩa/bài học cho con cháu?"
  - artifact: "Đây là vật gì? Của ai, từ đời nào? Hiện ai giữ?"
- `listHeritageItems(clanId, {category?, search?})` → kèm `cover_media_path`,
  `photo_count`, `audio_count`, `people_count`.
- `getHeritageItem(id)` → detail (media sort theo kind+sort, people kèm tên).
- `create/update/deleteHeritageItem` (soft-delete).
- `addMedia / removeMedia / reorderMedia / setCover` (chung cho photo+audio).
- `addHeritagePerson / removeHeritagePerson`.
- `getHeritageItemsForPerson(personId)` → hiện ở PersonDetail.
- `clanHeritageStorageBytes(clanId)` → tổng `bytes` để hiển thị/giới hạn.

### 2. Upload — `src/lib/photoUpload.ts` + `src/lib/audioRecord.ts` (mới)
- `uploadHeritagePhoto(clanId, itemId, file)` → path `{clanId}/heritage/{itemId}/{uuid}.jpg`,
  ≤250KB/1280px. Trả `{path, bytes}`.
- `src/lib/audioRecord.ts`: hook/helper dùng **MediaRecorder** (Opus mono ~24–32kbps),
  giới hạn 5′, trả Blob đã nén; `uploadHeritageAudio(clanId, itemId, blob)` →
  `{clanId}/heritage/{itemId}/{uuid}.webm`, trả `{path, bytes, duration_sec}`.

### 3. Trang (clone resting place pages, UI cho người lớn tuổi)
- `src/pages/clan/Heritage.tsx` — list, lọc tab theo loại, grid card ảnh cover,
  search, phân trang 15.
- `src/pages/clan/HeritageDetail.tsx` — tiêu đề + body (render plain text, chữ to,
  giãn dòng) + gallery ảnh (lightbox) + **trình phát audio** + người liên quan +
  (place) chỉ đường + nút **Chia sẻ (QR)** + Sửa/Xoá (gate `canEditClan`).
- `src/pages/clan/HeritageForm.tsx` — **ô nhập to, ít trường**, hiện câu hỏi gợi ý theo
  loại; nút **📷 Chụp ảnh** (`<input capture>`), **🎤 Ghi âm**; GPS chỉ khi loại=place.
  Trường nâng cao (năm, địa chỉ) thu gọn trong "Thêm chi tiết".

### 4. Routes — `src/App.tsx`
```
<Route path="heritage" element={<Heritage />} />
<Route path="heritage/new" element={<HeritageForm />} />
<Route path="heritage/:itemId" element={<HeritageDetail />} />
<Route path="heritage/:itemId/edit" element={<HeritageForm />} />
```

### 5. Menu — `src/components/AppDrawer.tsx` (mục "Dữ liệu")
- Thêm "Di sản & Văn hoá" → `/clans/:clanId/heritage`, icon mới (vd `IconScroll`).

### 6. Chia sẻ công khai
- `share-links.ts`: `createShareLink` nhận `root_heritage_item_id`;
  `getOrCreateHeritageShareLink(clanId, itemId)`.
- `supabase/functions/share-view/index.ts`: nhánh `root_heritage_item_id` → trả công
  khai (title, summary, body, ảnh + audio signed, người liên quan tối thiểu). Deploy lại.
- Trang công khai: nhồi vào `src/pages/Share.tsx` (chế độ heritage).

### 7. PersonDetail — mục "Di sản liên quan" (`getHeritageItemsForPerson`).

### 8. Icon — thêm `IconScroll`/`IconLandmark` + `IconMicrophone` (ghi âm) nếu chưa có.

## Phase sau (KHÔNG làm MVP này)
- **Chữ to / nút to / chế độ đọc** toàn module (đã hoãn).
- **P2 — Nhắc lễ hằng năm**: `events.heritage_item_id` + cron `notify-events`.
- **P3**: di sản trong sách PDF; bản đồ nhiều từ đường; video tư liệu; nhập hàng loạt.

## Verification (local trước → deploy prod)
1. `node_modules/.bin/supabase migration up` (local đang chạy) + `npm run db:types`.
2. `npm run dev` → admin → 1 clan → **Di sản & Văn hoá**.
3. Tạo mỗi loại; thử **chụp ảnh** + **ghi âm 1 đoạn** → kiểm tra kích thước file nhỏ
   (audio 1′ ≲ 0.2 MB), nghe lại được, ảnh hiện đúng.
4. List/lọc tab/grid/phân trang; detail chữ to dễ đọc; chỉ đường (place); gắn người.
5. Chia sẻ QR công khai → mở ẩn danh thấy đúng nội dung + nghe audio, KHÔNG lộ dữ liệu nội bộ.
6. Quyền `viewer` không thấy Sửa/Xoá; RLS chặn ghi. Kiểm tra "đã dùng X MB".
7. Deploy: áp migration lên VPS (psql) → `supabase functions deploy share-view`
   → `gh workflow run deploy-vps.yml --ref main`.

## File đụng tới
- Mới: `supabase/migrations/*_heritage.sql`, `*_share_links_heritage.sql`,
  `src/lib/queries/heritage.ts`, `src/lib/audioRecord.ts`,
  `src/pages/clan/{Heritage,HeritageDetail,HeritageForm}.tsx`.
- Sửa: `src/lib/photoUpload.ts`, `src/lib/queries/share-links.ts`,
  `supabase/functions/share-view/index.ts`, `src/App.tsx`,
  `src/components/AppDrawer.tsx`, `src/pages/clan/PersonDetail.tsx`,
  `src/components/icons/*`, `src/lib/database.types.ts` (regen), `src/pages/Share.tsx`.
