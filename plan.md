# family-tree-v3 — Implementation Plan

> Plan để Claude Code triển khai. Văn bản mô tả bằng tiếng Việt; mọi tên bảng/cột/biến/lệnh/thư viện giữ nguyên tiếng Anh để code chính xác.

---

## 1. Tổng quan & mục tiêu

`family-tree-v3` là một **web app SaaS đa-dòng-họ (multi-tenant)** để quản lý và hiển thị gia phả quy mô lớn (mỗi dòng họ tới ~7.000 người).

Đặc điểm chính:
- Web responsive, **ưu tiên mobile**, đóng gói PWA (mở bằng link, thêm vào màn hình chính, không cần app store).
- Một người dùng đăng ký được, **tạo nhiều dòng họ** (có giới hạn theo gói).
- Mỗi dòng họ có vai trò **admin / editor / viewer** và chế độ **riêng tư / công khai / link chia sẻ có hạn**.
- Tối ưu cho người lớn tuổi: **màn hình danh sách (list view) là màn hình chính**, chữ to, nút lớn, tương phản cao.
- Cây gia phả tương tác dùng thư viện `family-chart`.

Nguyên tắc xuyên suốt: **mọi chốt chặn bảo mật và giới hạn đặt ở backend (Supabase RLS + Edge Function), KHÔNG đặt ở frontend.** Frontend chạy trên máy người dùng nên không đáng tin để giữ quy tắc.

---

## 2. Tech stack

| Lớp | Lựa chọn |
|---|---|
| Frontend | React + TypeScript + Vite, Tailwind CSS + **shadcn/ui** (primitive accessible, sở hữu code), đóng gói PWA (`vite-plugin-pwa`) |
| Cây gia phả | `family-chart` (donatso, MIT) + `d3` |
| Backend + DB | Supabase (PostgreSQL + Auth + Storage + Row-Level Security) |
| Serverless | Supabase Edge Functions (cho share-link view; sau này có thể thêm PDF) |
| Import Excel | SheetJS (`xlsx`) chạy phía client |
| Hosting | Frontend trên Vercel hoặc Netlify; backend là Supabase hosted |
| Cache dữ liệu | TanStack Query (React Query) + persist sang IndexedDB (`@tanstack/react-query-persist-client`, `idb-keyval`) |
| Thông báo sự kiện | Email qua Resend/Postmark/SendGrid; SMS qua Twilio; cron qua `pg_cron` hoặc Supabase Scheduled Edge Function (mục 19) |
| Testing | Vitest (unit/logic) + React Testing Library (component) + Playwright (E2E) + pgTAP/integration trên Supabase local (RLS & DB) |
| CI | GitHub Actions: chạy toàn bộ test khi push/PR; sinh lại `database.types.ts` sau mỗi migration |
| Types | `supabase gen types typescript` sinh types tự động từ schema → import vào `supabase-js` |

Lưu ý về `family-chart`:
- Bản OSS (MIT) đủ cho MVP. Một số tính năng nâng cao (kinship engine xịn, tree filtering, advanced cards, performance optimizations) thuộc **bản Premium** — KHÔNG phụ thuộc vào Premium ở MVP.
- Hàm `calculateKinships` có trong bản OSS, dùng được cho tính năng "quan hệ họ hàng" cơ bản.

---

## 3. Kiến trúc tổng thể

```
Trình duyệt (React PWA, chạy trên máy người dùng)
   │   - giao diện + logic hiển thị
   │   - gọi trực tiếp Supabase qua supabase-js (đã đăng nhập)
   ▼
Supabase (hosted)
   - Postgres: dữ liệu các dòng họ
   - Auth: email / OTP email / OTP SMS
   - Storage: ảnh thành viên
   - RLS: phân quyền + cô lập dữ liệu giữa các dòng họ
   - Edge Function `share-view`: phục vụ khách KHÔNG đăng nhập qua link chia sẻ (đã lọc người sống)
```

Khách dùng **link chia sẻ** KHÔNG gọi thẳng Postgres — họ chỉ gọi Edge Function `share-view`, hàm này tự kiểm tra token + hạn rồi trả về dữ liệu đã được làm sạch.

---

## 4. Mô hình truy cập (rất quan trọng)

Mỗi dòng họ (`clan`) có một thuộc tính `visibility`:
- `private` (mặc định): chỉ thành viên được mời mới xem được.
- `public`: bất kỳ **người dùng đã đăng nhập** nào cũng xem được (chỉ xem).

Độc lập với `visibility`, admin của dòng họ có thể tạo **share-link** (xem mục 9): khách KHÔNG cần đăng nhập, chỉ xem màn hình cây, link có ngày hết hạn.

Bảng tổng hợp ai thấy gì:

| Người xem | clan `private` | clan `public` | qua share-link |
|---|---|---|---|
| Khách (chưa đăng nhập) | Không gì | Không gì | Chỉ màn hình cây; người sống bị ẩn; hết hạn thì khóa |
| User đã đăng nhập, KHÔNG phải thành viên | Không gì | Xem được; người sống bị ẩn thông tin nhạy cảm | — |
| Viewer (thành viên) | Xem đầy đủ | Xem đầy đủ | — |
| Editor | Xem + thêm/sửa | Xem + thêm/sửa | — |
| Admin của clan | Toàn quyền + mời người + đổi chế độ + tạo link | như trái | — |

"Thông tin nhạy cảm của người còn sống" = `birth_date`, `birth_lunar`, `photo_path`, `bio`, `birth_place`, `burial_place` và mọi thông tin liên hệ. Với người sống, khách/người ngoài chỉ thấy `full_name`, `gender`, `generation`, `branch`.

---

## 5. Phân quyền & vai trò

Có **hai tầng "admin" khác nhau**, không nhầm lẫn:
- **Platform admin** (người vận hành dịch vụ): `profiles.is_platform_admin = true`. Đặt giới hạn (`max_persons`, `max_users` của clan; `max_clans` của user). Không gắn với clan nào.
- **Clan admin**: vai trò `admin` trong một clan cụ thể (`clan_members.role`). Quản lý dòng họ đó.

Vai trò trong một clan (`clan_members.role`):
- `admin`: toàn quyền clan, mời/xoá thành viên, đổi `visibility`, tạo/thu hồi share-link.
- `editor`: thêm/sửa/xoá người trong gia phả.
- `viewer`: chỉ xem.

Giới hạn (do platform admin đặt):
- `profiles.max_clans`: mỗi user tạo được tối đa bao nhiêu clan.
- `clans.max_persons`: tối đa bao nhiêu người trong cây của clan đó.
- `clans.max_users`: tối đa bao nhiêu tài khoản (thành viên login) trong clan đó.

> "Số lượng thành viên" giới hạn **cả hai**: số người trong cây (`max_persons`) VÀ số tài khoản đăng nhập (`max_users`). Đây là hai con số riêng biệt.

---

## 6. Database schema (PostgreSQL / Supabase)

Tất cả bảng dữ liệu đều có `clan_id` để cô lập theo dòng họ. Bật RLS trên mọi bảng.

### `profiles` (mở rộng `auth.users`)
- `id uuid PK references auth.users(id)`
- `display_name text`
- `is_platform_admin boolean default false`
- `is_suspended boolean default false` *(platform admin khoá tài khoản; xem mục 8)*
- `max_clans int default 1`
- `created_at timestamptz default now()`

> KHÔNG lưu `email` trong `profiles` (tránh drift với `auth.users.email` khi user đổi mail). Cần email → join `auth.users` qua RPC `get_profile_emails(user_ids uuid[])` (SECURITY DEFINER, chỉ trả cho platform admin / cùng clan).

### `clans`
- `id uuid PK default gen_random_uuid()`
- `name text not null`
- `description text`
- `owner_id uuid references profiles(id)`
- `visibility text not null default 'private' check (visibility in ('private','public'))`
- `hide_living_for_nonmembers boolean default true`
- `max_persons int default 500`
- `max_users int default 3`
- `data_version int default 0` *(bump bởi trigger mỗi khi dữ liệu clan đổi — dùng cho cache; xem mục 12)*
- `created_at timestamptz default now()`

### `clan_members`
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `role text not null check (role in ('admin','editor','viewer'))`
- `invited_by uuid references profiles(id)`
- `created_at timestamptz default now()`
- `unique (clan_id, user_id)`

### `branches` (chi họ)
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `name text not null`
- `head_person_id uuid references persons(id) deferrable initially deferred` *(trưởng chi — FK vòng tròn với persons; xem ghi chú dưới)*
- `ancestral_house text` (thông tin nhà thờ chi)
- `notes text`
- `deleted_at timestamptz` *(soft delete; xem mục 7)*

### `families` (đơn vị hôn nhân — "Family Unit")
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `husband_id uuid references persons(id) deferrable initially deferred`  *(nullable — single parent)*
- `wife_id uuid references persons(id) deferrable initially deferred`     *(nullable)*
- `union_type text` (vd: `marriage`, `remarriage`, `other`)
- `notes text`
- `created_at timestamptz default now()`
- `deleted_at timestamptz`

Mô hình quan hệ: một người là **con** của đúng một `family` (`persons.birth_family_id`). Một người làm **vợ/chồng** trong nhiều `family` khác nhau → hỗ trợ đa thê / tái hôn tự nhiên (nhiều dòng `families` cùng `husband_id`).

> **FK vòng tròn**: `persons.birth_family_id → families` và `families.husband_id/wife_id → persons` tham chiếu lẫn nhau. Khai báo `DEFERRABLE INITIALLY DEFERRED` để có thể insert person trước (chưa biết family) → insert family (trỏ tới person) → update `persons.birth_family_id` trong cùng transaction. Tương tự cho `branches.head_person_id ↔ persons.branch_id`.

### `persons` (người trong gia phả)
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `full_name text not null`
- `full_name_unaccent text` *(tự sinh: lowercase + bỏ dấu, dùng cho tìm kiếm — duy trì bằng trigger)*
- `gender text not null check (gender in ('M','F'))` *(family-chart BẮT BUỘC M/F)*
- `is_living boolean default true`
- `is_root boolean default false` *(Thuỷ tổ — người dùng đánh dấu rõ ràng; phân biệt với "chưa nhập cha mẹ")*
- `birth_date date`
- `birth_lunar_year int`, `birth_lunar_month int`, `birth_lunar_day int`, `birth_lunar_is_leap boolean default false`
- `death_date date`
- `death_lunar_year int`, `death_lunar_month int`, `death_lunar_day int`, `death_lunar_is_leap boolean default false`
- `death_anniv_lunar_month int`, `death_anniv_lunar_day int`, `death_anniv_lunar_is_leap boolean default false` *(ngày giỗ âm lịch — không có year vì lặp hằng năm)*
- `courtesy_name text` *(tên tự)*
- `posthumous_name text` *(tên thụy)*
- `nickname text` *(tên húy / biệt hiệu)*
- `branch_id uuid references branches(id) deferrable initially deferred`
- `generation int` *(đời — tự tính & cache, KHÔNG nhập tay)*
- `birth_family_id uuid references families(id) deferrable initially deferred`
- `photo_path text` *(đường dẫn trong Supabase Storage)*
- `bio text`
- `birth_place text`
- `burial_place text`
- `deleted_at timestamptz` *(soft delete; hard delete chỉ khi xoá clan)*
- `created_at timestamptz default now()`
- `updated_at timestamptz default now()`

> **Âm lịch dạng cấu trúc** (không lưu text): để sort, so sánh, query "ai có giỗ tháng 3 âm", và để quy đổi âm→dương cho thông báo sự kiện (mục 19) — phụ thuộc này có ngay từ schema, không sửa sau.

### `share_links`
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `token text unique not null` *(ngẫu nhiên, dài — vd 32+ ký tự)*
- `root_person_id uuid references persons(id)` *(gốc nhánh chia sẻ; null = cả cây)*
- `scope text default 'tree_view'`
- `created_by uuid references profiles(id)`
- `expires_at timestamptz not null`
- `is_revoked boolean default false`
- `created_at timestamptz default now()`

### `audit_log` (nhật ký chỉnh sửa + khôi phục)
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `entity_type text` (`person` | `family` | `branch`)
- `entity_id uuid`
- `action text` (`insert` | `update` | `delete`)
- `before jsonb`
- `after jsonb`
- `changed_by uuid references profiles(id)`
- `changed_at timestamptz default now()`

### `events` (sự kiện tuỳ chỉnh — mục 19)
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `title text not null`
- `event_type text` (`custom` | `reunion` | `memorial` | ...)
- `date_solar date` *(nếu theo dương lịch — exactly one of solar/lunar được set)*
- `lunar_year int`, `lunar_month int`, `lunar_day int`, `lunar_is_leap boolean default false` *(nếu theo âm lịch)*
- `is_yearly boolean default true`
- `related_person_id uuid references persons(id)`
- `notes text`
- `created_at timestamptz default now()`
- `check ((date_solar is not null) <> (lunar_month is not null))` *(ép chính xác một trong hai)*

### `event_subscriptions` (đăng ký nhận thông báo — "follow")
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `scope text not null check (scope in ('clan','branch','person'))`
- `target_id uuid` *(null nếu scope = 'clan'; branch_id hoặc person_id nếu khác)*
- `event_types text[]` *(vd `{birthday, death_anniversary, custom}`)*
- `channels text[]` *(vd `{email, sms}`)*
- `lead_days int[]` *(vd `{7,1}` — báo trước 7 ngày và 1 ngày)*
- `is_enabled boolean default true`
- `created_at timestamptz default now()`
- Unique: dùng **partial indexes** thay vì `UNIQUE` thường (vì NULL ≠ NULL trong PG, sẽ không chặn được scope=`clan`):
  - `unique (user_id, clan_id) where scope = 'clan'`
  - `unique (user_id, clan_id, target_id) where scope in ('branch','person')`

### `notification_log` (chống gửi trùng + rà soát)
- `id uuid PK default gen_random_uuid()`
- `clan_id uuid references clans(id) on delete cascade`
- `user_id uuid references profiles(id) on delete cascade`
- `event_key text` *(vd `person:<id>:death_anniversary:2026-03-15:lead7` — **bắt buộc gồm `lead<N>`** vì cùng sự kiện gửi nhiều mốc 7d/1d, thiếu sẽ chặn nhầm)*
- `channel text` (`email` | `sms`)
- `status text` (`sent` | `failed`)
- `sent_at timestamptz default now()`
- `unique (user_id, event_key, channel)` *(đảm bảo idempotent)*

### Index gợi ý
- `persons (clan_id)`, `persons (clan_id, branch_id)`, `persons (clan_id, generation)`
- GIN trigram trên `full_name_unaccent` (`pg_trgm`)
- `families (clan_id)`, `clan_members (clan_id, user_id)`, `share_links (token)`
- `event_subscriptions (clan_id)`, `event_subscriptions (user_id)`

---

## 7. RLS & enforcement

Bật `alter table ... enable row level security` trên: `clans`, `clan_members`, `persons`, `families`, `branches`, `share_links`, `audit_log`, `events`, `event_subscriptions`, `notification_log`.

### Helper functions (SECURITY DEFINER)
- `clan_role(target_clan uuid) returns text` — trả role của `auth.uid()` trong clan, hoặc null.
- `is_clan_member(target_clan uuid) returns boolean`
- `can_edit_clan(target_clan uuid) returns boolean` — role in (`admin`,`editor`).
- `is_clan_admin(target_clan uuid) returns boolean`
- `is_platform_admin() returns boolean` — đọc `profiles.is_platform_admin` của `auth.uid()`.
- Mọi helper trên trả `false` nếu `profiles.is_suspended = true` của người gọi (tài khoản bị khoá thì không đọc/sửa được gì).

### Policies chính
- `persons` / `families` / `branches`:
  - `SELECT`: `is_clan_member(clan_id) OR (select visibility from clans where id = clan_id) = 'public'`
  - `INSERT/UPDATE/DELETE`: `can_edit_clan(clan_id)`
- `clan_members`:
  - `SELECT`: `is_clan_member(clan_id)`
  - `INSERT/UPDATE/DELETE`: `is_clan_admin(clan_id)`
- `clans`:
  - `SELECT`: `is_clan_member(id) OR visibility = 'public'`
  - `INSERT`: `auth.uid() is not null` (giới hạn `max_clans` ép bằng trigger)
  - `UPDATE`: `is_clan_admin(id)` cho các cột thường (`name`, `description`, `visibility`, `hide_living_for_nonmembers`); các cột giới hạn (`max_persons`, `max_users`, `owner_id`) chỉ `is_platform_admin` đổi được (ép bằng trigger so sánh OLD/NEW).
- `profiles`:
  - `SELECT`: dòng của chính mình (`id = auth.uid()`) HOẶC `is_platform_admin()`. (Tên hiển thị của đồng-thành-viên lấy qua RPC danh sách thành viên, không mở SELECT rộng.)
  - `UPDATE`: chính mình chỉ sửa được `display_name`; các cột đặc quyền (`max_clans`, `is_platform_admin`, `is_suspended`) chỉ `is_platform_admin()` đổi (ép bằng trigger so sánh OLD/NEW — chặn user thường tự nâng quyền hay tự nới giới hạn).
- `audit_log`: `SELECT` cho `is_clan_member`; ghi tự động bằng trigger (không cho client ghi trực tiếp).
- `share_links`: `SELECT/INSERT/UPDATE/DELETE` chỉ `is_clan_admin(clan_id)`.
- `events`: `SELECT` cho `is_clan_member(clan_id)`; `INSERT/UPDATE/DELETE` cho `can_edit_clan(clan_id)`.
- `event_subscriptions`: mọi thao tác chỉ của chính user (`user_id = auth.uid()`) VÀ khi tạo phải `is_clan_member(clan_id)` (chỉ thành viên mới theo dõi sự kiện clan).
- `notification_log`: chỉ hệ thống (service role / cron) ghi; user `SELECT` dòng của mình.
- **anon role (chưa đăng nhập): không có quyền SELECT trực tiếp lên bất kỳ bảng nào.** Khách chỉ truy cập qua Edge Function `share-view`.

### Triggers
- `enforce_max_clans` (before insert `clans`): lấy **advisory lock** `pg_advisory_xact_lock(hashtext('max_clans:' || owner_id::text))` rồi đếm clan của `owner_id`; nếu ≥ `profiles.max_clans` và không phải platform admin → raise. Lock chống race giữa các request đồng thời.
- `protect_profile_privileged_cols` (before update `profiles`): nếu `max_clans`/`is_platform_admin`/`is_suspended` thay đổi mà người gọi không phải `is_platform_admin()` → raise.
- `enforce_max_persons` (before insert `persons`): `pg_advisory_xact_lock(hashtext('max_persons:' || clan_id::text))` rồi đếm; nếu ≥ `clans.max_persons` → raise. Với bulk import cùng một transaction, lock chỉ giữ 1 lần — không lặp.
- `enforce_max_users` (before insert `clan_members`): tương tự `enforce_max_persons`.
- `maintain_unaccent` (before insert/update `persons`): set `full_name_unaccent = lower(f_unaccent(full_name))`.
- `recompute_generation`: khi `birth_family_id`, `is_root`, hoặc quan hệ family thay đổi → tính lại `generation` cho nhánh liên quan, **kèm depth cap (vd 30)** trong recursive CTE để chặn cycle nếu validation lọt lưới. `is_root = true` → generation = 1. Vượt cap → raise "phát hiện vòng lặp tổ tiên".
- `write_audit_log` (after insert/update/delete `persons`,`families`,`branches`): ghi vào `audit_log`. **Soft delete** (set `deleted_at`) thay vì hard delete cho 3 bảng này — audit log restore cần row gốc còn tồn tại để khôi phục.
- `bump_data_version` (after insert/update/delete **statement-level** trên `persons`,`families`,`branches`): bump 1 lần / statement, không 1 lần / row. Với bulk import 7.000 hàng: chỉ 1 update `clans` thay vì 7.000 → tránh bloat MVCC và serialize. Cân nhắc tách bảng `clan_data_versions(clan_id, version)` riêng để giảm bloat trên `clans`.

### Lọc người sống cho người ngoài (clan `public`)
Ưu tiên dùng **view** `persons_public_safe` thay vì RPC SECURITY DEFINER (bypass RLS = rủi ro lộ dữ liệu nếu có bug). View masking column-level:

```sql
create view persons_public_safe as
select id, clan_id, full_name, gender, generation, branch_id, is_living,
  case when is_living then null else birth_date end as birth_date,
  case when is_living then null else birth_place end as birth_place,
  case when is_living then null else photo_path end as photo_path,
  case when is_living then null else bio end as bio,
  -- ... các cột nhạy cảm khác
from persons
where deleted_at is null;
```

RLS trên view: `SELECT` cho `is_clan_member(clan_id) OR (select visibility from clans where id = clan_id) = 'public'`. Thành viên vẫn select trực tiếp `persons` (bảng) để lấy đầy đủ; người ngoài chỉ select được view. Frontend chọn nguồn theo `viewerScope`.

### Storage RLS (ảnh thành viên)
Bucket `person-photos` đường dẫn: `{clan_id}/{person_id}.jpg`. Policies:
- `SELECT`: `is_clan_member((storage.foldername(name))[1]::uuid)` HOẶC ảnh của person `is_living = false` và clan `visibility = 'public'`. (Không cho khách share-link đọc trực tiếp Storage — Edge Function `share-view` proxy ảnh nếu cần.)
- `INSERT/UPDATE/DELETE`: `can_edit_clan((storage.foldername(name))[1]::uuid)`.

Không để bucket public-read — nếu không, link ảnh sẽ truy cập được dù có ẩn người sống ở DB.

### Khi suspend user: revoke session
Khi platform admin set `is_suspended = true`, Edge Function `admin-action` gọi luôn `auth.admin.signOut(userId)` để invalidate JWT. Lý do: nếu chỉ dựa vào helper RLS check `is_suspended`, mỗi policy phải query `profiles` — tốn. Revoke session = JWT hết hạn ngay, user phải đăng nhập lại (và sẽ bị chặn ở bước `signIn` qua check `is_suspended`).

---

## 8. Auth & quản lý tài khoản

### Đăng nhập (Supabase Auth)
Bật các phương thức:
- Email + password.
- Email OTP (magic link hoặc mã OTP).
- Phone OTP qua SMS (cần cấu hình nhà cung cấp SMS, vd Twilio — **có phí**, để cấu hình sau, không chặn MVP).

Sau khi đăng ký, trigger tạo dòng `profiles` tương ứng (`handle_new_user`). Màn hình đăng nhập đơn giản, chữ to, hỗ trợ người lớn tuổi.

Tài khoản nằm ở 3 nơi: **credentials** (đăng nhập/mật khẩu/OTP/phiên) ở Supabase Auth (`auth.users`); **hồ sơ app** ở `profiles`; **vai trò trong từng clan** ở `clan_members`.

### Tài khoản cá nhân — route `/account` (mọi user đã đăng nhập)
- Sửa `display_name` (ghi vào `profiles`).
- Đổi email / mật khẩu / số điện thoại qua `supabase.auth.updateUser(...)`.
- Đăng xuất (kèm **xoá sạch cache + IndexedDB**, mục 12).
- Xoá tài khoản của chính mình: **chặn nếu user còn sở hữu clan có dữ liệu** — phải chuyển quyền sở hữu (đổi `owner_id`/đặt admin khác) hoặc xoá clan trước. Việc xoá user khỏi `auth.users` đi qua Edge Function (cần service role) và cascade `profiles`/`clan_members`.

### Quản trị nền tảng — route `/admin` (chỉ `is_platform_admin`)
Khu vực dành cho **bạn — người vận hành**. Frontend chặn vào `/admin` nếu không phải platform admin; backend vẫn là chốt thật (RLS + trigger ở mục 7).
- Danh sách tất cả user (`profiles`) + tìm kiếm; xem user thuộc những clan nào.
- Chỉnh `profiles.max_clans` cho từng user.
- Danh sách tất cả clan; chỉnh `clans.max_persons` / `clans.max_users` cho từng clan.
- **Khoá / mở khoá tài khoản** (`profiles.is_suspended`); khi khoá, user không đọc/sửa được gì (helper RLS trả false).
- Cấp / thu quyền platform admin (`is_platform_admin`) — thao tác nhạy cảm, chỉ platform admin hiện hữu làm được.

Các thao tác chỉ-đổi-cột (`max_clans`, `max_persons`, `max_users`, `is_suspended`, `is_platform_admin`) làm bằng update bình thường — RLS + trigger đã cho phép đúng platform admin. Riêng thao tác **cấp auth** (ban/đăng xuất cưỡng bức, xoá user khỏi `auth.users`) phải qua **Edge Function `admin-action`** dùng service role: function xác minh người gọi là platform admin (đọc JWT → `profiles.is_platform_admin`) rồi mới gọi `auth.admin.updateUserById` / `auth.admin.deleteUser`. KHÔNG để service role lộ ra client.

> Trong giai đoạn đầu, bạn có thể tạm quản các giới hạn này bằng tay trong Supabase dashboard; trang `/admin` thay thế cho cách thủ công đó (xem phasing, mục 21).

---

## 9. Share-link + Edge Function `share-view`

Admin clan tạo `share_links` (token ngẫu nhiên, `expires_at`, `root_person_id` tuỳ chọn). UI cho admin xem/sao chép/thu hồi (`is_revoked = true`) link.

Edge Function `share-view` (dùng service role key, KHÔNG lộ ra client):
1. Nhận `token`.
2. **Rate limit** theo IP (vd 60 req/phút) — token public, dễ bị scrape. Dùng Upstash Redis hoặc bảng `share_view_rate` trong Postgres.
3. Tìm `share_links` theo token; kiểm tra `is_revoked = false` và `now() < expires_at`. Sai → trả 403/410.
4. Truy vấn `persons` + `families` của `clan_id` (giới hạn theo `root_person_id` nếu có).
5. **Làm sạch**: với `is_living = true`, bỏ các cột nhạy cảm (mục 4).
6. Trả về JSON **đã ở định dạng family-chart** (mục 11).

Route frontend `/share/:token` gọi function này và render cây ở chế độ chỉ-xem (không nút sửa, không list view, không danh bạ).

---

## 10. Frontend

### Routes
- `/login`, `/signup`
- `/clans` — danh sách clan của tôi + nút tạo clan mới
- `/clans/:clanId` — dashboard + thống kê
- `/clans/:clanId/people` — **danh bạ thành viên (màn hình chính)**: nút chuyển giữa **list view** và **grid view** (xem mục "Chế độ xem"); cả hai đều phân trang
- `/clans/:clanId/tree` — cây family-chart (xem + sửa); có **bộ lọc tuỳ chỉnh** thay cho phân trang
- `/clans/:clanId/person/:personId` — chi tiết người
- `/clans/:clanId/import` — import Excel
- `/clans/:clanId/events` — sự kiện (sinh nhật, giỗ, kỷ niệm): xem theo **danh sách hoặc lịch** (có nút chuyển) + quản lý sự kiện tuỳ chỉnh + theo dõi (mục 19)
- `/clans/:clanId/members` — quản lý thành viên (admin)
- `/clans/:clanId/settings` — đổi `visibility`, quản lý share-link (admin)
- `/account` — tài khoản cá nhân: đổi tên hiển thị, email/mật khẩu, đăng xuất, xoá tài khoản (mọi user)
- `/admin` — quản trị nền tảng: danh sách user, chỉnh `max_clans`/`max_persons`/`max_users`, khoá/mở tài khoản (chỉ `is_platform_admin`)
- `/share/:token` — view công khai qua link (gọi Edge Function)

### Cấu trúc thư mục gợi ý
```
src/
  lib/supabase.ts          // khởi tạo supabase-js
  lib/familyChartAdapter.ts// transform DB <-> family-chart
  lib/validation.ts        // kiểm tra lỗi dữ liệu
  hooks/useClan.ts, useAuth.ts, usePersons.ts
  pages/ ...               // theo routes trên
  components/ ...          // TreeView, PersonForm, ListTable, SearchBar, ...
```

### Chế độ xem (list / grid / tree)

Người dùng xem dữ liệu theo 3 chế độ. **List và grid phân trang; tree dùng bộ lọc.**

**List view** (mặc định, hợp người lớn tuổi): bảng — Họ tên | Năm sinh | Đời | Chi. Có tìm kiếm, lọc đời/chi, sắp xếp.

**Grid view**: cùng dữ liệu nhưng hiển thị dạng thẻ (ảnh + tên + đời) theo lưới. Dùng chung query với list, chỉ khác layout.

List và grid là **một route `/people`** với nút bật/tắt kiểu hiển thị (lưu lựa chọn). KHÔNG tách thành hai query khác nhau.

**Phân trang (list + grid):** phân trang **phía server** bằng Supabase `.range(from, to)` kèm `{ count: 'exact' }` để lấy tổng số. Mọi bộ lọc (tìm kiếm không dấu, đời, chi) và sắp xếp đều áp ở phía server rồi mới phân trang — không tải hết 7.000 dòng về client cho list/grid. Mặc định ~50 dòng/trang; cho người dùng đổi.

**Tree view — lọc tuỳ chỉnh để tối ưu render (KHÔNG phân trang):** cây không phân trang theo trang số; thay vào đó giảm số node phải vẽ bằng các bộ lọc (xem mục 11):
- Chọn **người trung tâm** (focal person) qua ô tìm kiếm → cây vẽ quanh người đó.
- Chỉnh **độ sâu** tổ tiên / con cháu (`ancestry_depth` / `progeny_depth`).
- Lọc theo **chi** (chỉ vẽ một nhánh).
- (Tuỳ chọn) lọc theo **khoảng đời**.
Các bộ lọc này quyết định lượng dữ liệu nạp và số card hiển thị, giữ cây luôn mượt trên mobile.

### UX cho người lớn tuổi
- Danh bạ (list view) là mặc định sau khi vào clan.
- Font lớn (≥17px), nút lớn (min-height 48px), độ tương phản cao.
- Tìm kiếm nổi bật, hỗ trợ gõ không dấu.

### Thiết kế thị giác (visual design)

**Tinh thần**. App nói về tổ tiên, dòng họ, ngày giỗ — xứng đáng có cảm giác **trang trọng, ấm áp, hiện đại nhưng mộc**, như một cuốn gia phả được làm cẩn thận, không phải startup bóng bẩy. Tôn trọng di sản nhưng vẫn sạch và dễ dùng.

**Hệ component**: Tailwind + **shadcn/ui**. Primitive đã accessible sẵn, sở hữu và chỉnh được code. Với team 1 người: nhất quán, dễ truy cập sẵn (quan trọng với người lớn tuổi), nhanh.

**Bảng màu** (light mode làm chính — người lớn tuổi thường thích nền sáng):

| Token | Mục đích | Gợi ý hex |
|---|---|---|
| `bg-paper` | Nền **kem/giấy ấm**, không trắng gắt | `#FBF7F0` |
| `text-ink` | Chữ chính, gần đen ấm (không đen tuyệt đối) | `#2A2320` |
| `primary` (oxblood) | **Đỏ trầm / nâu đỏ** — gợi sơn son bàn thờ. Dùng **tiết chế** cho tiêu đề lớn và nút primary | `#7A2E2E` |
| `accent` | Vàng đồng, **rất ít**, cho điểm nhấn (nhãn "Thuỷ tổ", icon đặc biệt) | `#B8862A` |
| `destructive` | **Đỏ tươi**, khác hẳn oxblood — để không nhầm cảnh báo/lỗi với màu chính | `#D92E2E` |
| `muted` | Xám ấm cho meta text ("đã mất • 1985") | `#7A6F66` |
| `border` | Đường kẻ nhẹ | `#E8E0D2` |

Token này đặt trong `tailwind.config.ts` (`theme.extend.colors`) và đồng bộ với **CSS variables của shadcn** (`--primary`, `--background`, `--destructive`...) trong `globals.css`.

**Phương án thay thế** nếu thấy oxblood quá nặng: primary = **xanh rêu / chàm trầm** (vd `#3D4F3A` hoặc `#2C3E50`), accent = **vàng đất** (vd `#A88732`). Vẫn cùng tinh thần di sản, dịu hơn.

**Typography**.

Quan trọng với tiếng Việt: nhiều font dựng dấu xấu (dấu ngã, dấu mũ kép). Chọn font tested với dấu VN:
- **Body + dữ liệu**: `Be Vietnam Pro` — thiết kế **riêng cho tiếng Việt**, dấu rất đẹp. Load qua Google Fonts (`@fontsource/be-vietnam-pro` để self-host).
- **Tên dòng họ + tiêu đề lớn** (`<h1>`, tên clan trong header): `Noto Serif` (hoặc `Source Serif 4`) — chất "di sản" hơn sans-serif. Hỗ trợ tiếng Việt tốt.
- **Cỡ thân ≥17px** (`text-[17px]` hoặc set root `font-size: 17px`), co giãn theo cài đặt hệ thống của user (`rem` thay vì `px` cho mọi cỡ chữ phái sinh).
- Line-height rộng (`leading-relaxed` ~1.625), letter-spacing không quá chật.

```css
/* globals.css */
:root { font-size: 17px; } /* base, scale với prefers */
body { font-family: "Be Vietnam Pro", system-ui, sans-serif; }
h1, .clan-name { font-family: "Noto Serif", Georgia, serif; }
```

**Điều hướng (mobile-first)**.
- **Bottom tab bar** trên mobile: 4–5 mục **icon + nhãn** (không icon trơ — người lớn tuổi cần label rõ). Mặc định:
  - 📋 **Danh bạ** | 🌳 **Cây** | 🗓 **Sự kiện** | 👤 **Tài khoản**
  - Chỗ đổi dòng họ: dropdown ở header (tên clan hiện tại + chevron), hoặc một mục trong Tài khoản.
- Tab height ≥56px, icon 24px, nhãn 13–14px ngay dưới icon.
- Desktop: chuyển bottom tab thành sidebar trái.
- **Form một cột**, ô nhập **to** (min-height 48px), nhãn nằm **trên** (không placeholder-only — người lớn tuổi mất ngữ cảnh khi gõ), nhiều **khoảng trắng**.
- **Chuyển động tối giản**: không parallax, không animation kéo dài; transition 150–200ms cho hover/focus là đủ. Tôn trọng `prefers-reduced-motion`.

**Chi tiết tế nhị — người đã mất**.
- Đánh dấu **nhã nhặn**: text nhỏ màu `muted`, vd `"đã mất • 1985"` ngay dưới tên. **KHÔNG** icon nến, thập tự, ô đen, border tang — quá nặng.
- Card người sống vs đã mất chỉ khác bằng dòng meta + ảnh có thể giảm opacity nhẹ (0.85), KHÔNG đổi màu nền/border mạnh.
- Người `is_root` (Thuỷ tổ): nhãn nhỏ "Thuỷ tổ" bằng `accent` vàng đồng — **vinh danh nhưng kiệm**.

**Accessibility**.
- Contrast ratio đạt WCAG **AA** cho thân (≥4.5:1), **AAA** cho tiêu đề khi khả thi (≥7:1) — kiểm bằng `axe`/Chrome DevTools.
- Focus ring rõ ràng (shadcn mặc định OK; KHÔNG xoá `outline`).
- Tap target ≥44×44px (Apple HIG) cho mọi nút/link.
- Hỗ trợ `prefers-reduced-motion`, `prefers-color-scheme` (dark mode có thể làm sau, không chặn MVP).

---

## 11. Tích hợp family-chart

Cài: `npm install family-chart d3`

Import:
```js
import * as f3 from 'family-chart'
import 'family-chart/dist/styles/family-chart.css'
```

### Định dạng dữ liệu (BẮT BUỘC đúng)
family-chart cần một mảng object:
```js
{
  id: "uuid",
  data: { gender: "M", /* các trường hiển thị tuỳ ý */ "full name": "...", "birthday": "1980" },
  rels: {
    parents:  ["id1", "id2"],   // tối đa 2
    spouses:  ["id", ...],      // nhiều — hỗ trợ đa thê
    children: ["id", ...]
  }
}
```
`gender` bắt buộc `"M"` hoặc `"F"`.

### Adapter DB → family-chart (`familyChartAdapter.ts`)
Từ `persons` + `families` dựng mảng trên:
- `parents`: lấy `birth_family_id` → `[husband_id, wife_id]` (lọc null).
- `spouses`: mọi `families` mà person là `husband_id` hoặc `wife_id` → id người phối ngẫu còn lại.
- `children`: mọi `persons` có `birth_family_id` thuộc family mà person là vợ/chồng.

Adapter ngược lại (family-chart → DB) khi lưu chỉnh sửa.

### Khởi tạo & hiển thị
```js
const chart = f3.createChart('#tree', data)
chart.setCardSvg()                     // dùng SVG card cho mobile (nhẹ hơn HTML card)
     .setCardDisplay([["full name"],["birthday"]])
chart.updateTree({ initial: true })
```

### Hiệu năng & lọc tuỳ chỉnh (đã khảo sát source)
- family-chart **không vẽ cả 7.000 node** — nó vẽ cây quanh một người trung tâm và cắt nhánh theo `ancestry_depth` / `progeny_depth`. Đây là cơ chế tối ưu render chính, **thay cho phân trang**.
- **Bộ lọc tuỳ chỉnh** mà người dùng điều khiển (đưa vào UI tree):
  - Người trung tâm: `f3.createChart(...)` với `main_id` = id người được chọn.
  - Độ sâu: tham số `ancestry_depth`, `progeny_depth` khi tính cây.
  - Lọc theo chi: chỉ nạp `persons`/`families` có `branch_id` tương ứng rồi mới dựng cây.
- Đặt `progeny_depth` nhỏ (1–2), cho người dùng chạm để mở rộng từng nhánh → giữ số card hiển thị thấp.
- Dùng **SVG card** trên mobile, giảm `transition_time` khi cập nhật lớn.
- Bật zoom 2 ngón (zoom_polite) để không cướp thao tác cuộn trang.
- Cách nạp dữ liệu: nếu đã lọc theo chi/độ sâu thì chỉ cần nạp đúng tập con liên quan (nhẹ). Với cả cây nhỏ vẫn có thể nạp hết (vài MB) rồi để family-chart cắt nhánh khi vẽ; chọn cách nào tuỳ kích thước nhánh đang xem.

### Ẩn người sống
Cách tin cậy nhất: **làm sạch dữ liệu ở adapter trước khi đưa vào chart**, dựa trên (người xem có phải thành viên) + `is_living`. Không phụ thuộc cấu hình private-card của thư viện.

### Chỉnh sửa trên cây
- Editor/admin dùng EditTree (`chart.editTree()`) để thêm con/vợ-chồng/sửa/xoá; nối callback lưu về Supabase (qua adapter ngược) rồi refetch + re-render.
- Hoặc dùng form riêng (PersonForm) ghi thẳng vào bảng `persons`/`families` — cách này dễ kiểm soát validation hơn; ưu tiên cho MVP.

### Quan hệ họ hàng
`calculateKinships` (bản OSS) cho tính năng "X là gì của Y" cơ bản. Bản nâng cao là Premium — không dùng ở MVP.

---

## 12. Cache & làm mới dữ liệu

Dữ liệu gia phả gần như chỉ đọc (sau khi admin nhập xong rất ít đổi), nên cache mạnh để **giảm tối đa request**, kèm cơ chế **làm mới chủ động** cho người dùng.

### Tầng cache chính: TanStack Query (React Query)
- Mọi truy vấn dữ liệu đi qua React Query: cache trong bộ nhớ theo `queryKey`, tự gộp request trùng, tự cache.
- Vì dữ liệu ít đổi: đặt `staleTime` dài (vd vài giờ) và **tắt** `refetchOnWindowFocus`, `refetchOnReconnect`, `refetchOnMount` → app gần như không tự gọi lại server.
- `gcTime` dài để giữ cache lâu trong phiên.

### Cache bền giữa các phiên: IndexedDB
- Dùng `@tanstack/react-query-persist-client` + persister lưu vào **IndexedDB** (qua `idb-keyval`; KHÔNG dùng localStorage vì dữ liệu vài MB có thể vượt giới hạn ~5MB).
- Mở lại app → hiển thị ngay từ cache, **không cần gọi mạng**; chỉ tải lại khi người dùng bấm làm mới hoặc khi phát hiện server có thay đổi (xem dưới).

### Làm mới thông minh bằng version (giảm tải tối đa)
- Thêm cột `clans.data_version int default 0` (hoặc `data_updated_at timestamptz`). **Trigger** bump giá trị này mỗi khi `persons`/`families`/`branches` của clan thay đổi (đi kèm trigger ghi `audit_log` ở mục 7).
- Client chỉ cần fetch **một giá trị version nhỏ** của clan (rất nhẹ). Nếu version == version đã cache → **không tải lại** tập dữ liệu lớn. Khác → mới tải lại persons/families.
- Đây là cách "làm mới" rẻ nhất: kiểm tra version trước, chỉ tải nặng khi thực sự có thay đổi.

### Làm mới chủ động (UX)
- Nút **"Làm mới dữ liệu"** (icon refresh) ở màn hình danh bạ và cây. Bấm → kiểm tra version → nếu khác thì `queryClient.invalidateQueries` cho clan đó và tải lại.
- Hiển thị **"Cập nhật lúc HH:MM"** (thời điểm đồng bộ gần nhất) để người dùng biết độ mới.
- **Tự động làm mới sau khi sửa**: khi editor/admin thêm/sửa/xoá thành công → invalidate ngay query của clan đó, để chính người sửa thấy dữ liệu mới mà không phải bấm gì.

### Quyền & an toàn cache (bắt buộc)
- `queryKey` phải gồm **ngữ cảnh quyền của người xem** (vd `['persons', clanId, viewerScope]`) — để dữ liệu đầy đủ (thành viên) và dữ liệu đã ẩn người sống (người ngoài) KHÔNG dùng chung một cache entry.
- **Xoá toàn bộ cache (kể cả IndexedDB) khi đăng xuất** và khi đổi tài khoản — tránh người khác dùng chung máy thấy dữ liệu riêng tư đã cache.
- View qua share-link không persist cache nhạy cảm.

### Lưu ý
- Service Worker (PWA) chỉ cache **vỏ app** (tĩnh). KHÔNG dùng SW để cache response dữ liệu (tránh trùng lặp cache và rò rỉ quyền). Cache dữ liệu do React Query + IndexedDB lo.

---

## 13. Đặc thù tiếng Việt

### Tìm kiếm không dấu
- Bật extension: `create extension if not exists unaccent;` và `pg_trgm`.
- Tạo immutable wrapper `f_unaccent(text)` (vì `unaccent` không immutable mặc định) để dùng được trong generated/index.
- `persons.full_name_unaccent` duy trì bằng trigger; index GIN trigram trên cột này.
- Tìm kiếm: so khớp `full_name_unaccent ILIKE '%' || lower(f_unaccent(:q)) || '%'`.

### Đời (generation) tự tính
- Neo: Thuỷ tổ — người được đánh dấu rõ ràng bằng `is_root = true` → đời 1. **Phân biệt** với `birth_family_id IS NULL` (chưa nhập cha mẹ) — KHÔNG mặc định coi orphan là gốc, để generation = NULL chờ nhập đủ.
- `generation = generation(cha) + 1`. Tính bằng recursive CTE; cache vào `persons.generation`; tính lại khi quan hệ đổi.
- **Depth cap** trong CTE (vd 30) để chặn vòng lặp nếu validation bỏ sót.
- KHÔNG cho nhập tay (tránh mâu thuẫn). Dùng đời để hỗ trợ kiểm tra lỗi.

### Lịch âm
- Lưu cả dương lẫn âm dạng **cấu trúc** (`*_lunar_year/month/day/is_leap`), không lưu text — để sort, so sánh, query theo tháng âm, và quy đổi cho thông báo sự kiện.
- Quy đổi/hiển thị âm-dương tự động: **phase sau** (dùng thư viện chuyển đổi âm lịch khi làm — vd `@nghiavuive/lunar_date_vn` hoặc tương đương).

### Trường tên Việt
`courtesy_name` (tên tự), `posthumous_name` (tên thụy), `nickname` (tên húy) — tuỳ chọn, hiển thị ở trang chi tiết.

---

## 14. Import Excel

- Dùng SheetJS parse phía client.
- Mẫu cột **bắt buộc cột ID tạm**: `ID | Họ tên | Giới tính | Năm sinh | Năm mất | ID Cha | ID Mẹ | Chi | Ghi chú`.
  - `ID` do người dùng đặt trong file (vd `P001`, `P002`...) — match cha/mẹ **chính xác theo ID này**, KHÔNG match theo tên (tên trùng nhau trong dòng họ là chuyện thường).
  - Sau khi insert vào DB, map ID tạm → UUID, dựng `families`.
- Quy trình: parse → map cột → **validate** (mục 15: thiếu ID, ID cha/mẹ không tồn tại, vòng lặp...) → preview cho người dùng duyệt → bulk insert trong **một transaction** (FK deferrable cho phép insert persons + families xen kẽ).
- Chặn theo `max_persons` (trigger backend báo; advisory lock giúp bulk import không serialize giữa request).

---

## 15. Kiểm tra lỗi dữ liệu (`validation.ts`)

Cảnh báo (không nhất thiết chặn) khi:
- Cha/mẹ sinh sau con.
- Người mất trước khi con sinh.
- Vợ/chồng trùng chính mình.
- Thiếu `gender`.
- Vòng lặp quan hệ (A là tổ tiên của chính A).

Chạy khi import và khi sửa; hiện cảnh báo rõ ràng.

---

## 16. Testing tự động (ưu tiên cao — team 1 người)

Vì chỉ có một người, **test tự động là bắt buộc**, không kiểm thủ công. Ưu tiên test ở chỗ rủi ro cao và "vỡ thầm lặng": **(1) RLS / cô lập dữ liệu giữa các clan là quan trọng nhất** (một lỗi = lộ dữ liệu riêng tư), (2) adapter DB↔family-chart, (3) tính `generation`, (4) validation, (5) phân trang & lọc.

### Các tầng test
1. **Unit (Vitest)** — logic thuần, chạy nhanh, chạy thường xuyên: `familyChartAdapter` (cả hai chiều), `validation` rules, tính `generation`, helper tìm kiếm không dấu, logic hết hạn share-link.
2. **Component (Vitest + React Testing Library)**: `PersonForm`, `ListTable`, `GridView`, điều khiển phân trang, nút chuyển list/grid, panel lọc cây.
3. **DB & RLS (pgTAP hoặc integration test trên Supabase local với nhiều user giả qua supabase-js)** — phần quan trọng nhất:
   - user của clan A KHÔNG đọc được `persons` của clan B.
   - `viewer` KHÔNG insert/update được; `editor` sửa được nhưng KHÔNG quản được thành viên.
   - người ngoài đọc clan `public` chỉ nhận dữ liệu **đã ẩn** người còn sống.
   - `anon` (chưa đăng nhập) KHÔNG đọc trực tiếp được bảng nào.
   - trigger giới hạn: vượt `max_persons` / `max_users` / `max_clans` bị chặn.
   - user thường KHÔNG tự sửa được `max_clans`/`is_platform_admin`/`is_suspended` của mình (trigger chặn); chỉ platform admin sửa được.
   - tài khoản `is_suspended = true` không đọc/sửa được gì.
   - chỉ platform admin vào được `/admin` và đổi được giới hạn của user/clan khác.
   - `event_subscriptions`: user chỉ tạo/sửa đăng ký của chính mình; người KHÔNG phải thành viên clan không theo dõi được sự kiện clan đó.
4. **E2E (Playwright, chạy ở viewport mobile)** — luồng thật đầu-cuối: đăng ký/đăng nhập → tạo clan → thêm người → xem list/grid + chuyển trang → lọc cây theo người trung tâm/độ sâu/chi → import Excel → tạo & mở share-link → share-link hết hạn bị khoá.
5. **Cache**: editor sửa xong thì dữ liệu tự mới (invalidate); version không đổi thì KHÔNG tải lại tập lớn; **đăng xuất rồi đăng nhập user khác thì cache (kể cả IndexedDB) đã bị xoá, không lộ dữ liệu cũ**.

### Hỗ trợ test
- **Seed/fixtures**: script (dùng `@faker-js/faker`) tạo clan giả với vài trăm → vài nghìn người để test phân trang và hiệu năng cây.
- **Supabase local** (`supabase start`) cho test DB/RLS/E2E; reset DB giữa các test.
- Coverage nhắm cao ở `src/lib/` (adapter, validation, generation).

### CI (GitHub Actions)
Mỗi push/PR chạy: lint → unit → component → (khởi Supabase local) DB/RLS → E2E. Có thể tách E2E thành job riêng.

### Quy ước cho Claude Code
**Viết test cùng lúc với mỗi tính năng, không dồn lại.** Mỗi mục trong từng Phase chỉ coi là "xong" khi đã có test tương ứng. Viết test RLS ngay sau khi tạo policy ở Phase 0.

---

## 17. PWA

- `vite-plugin-pwa` + `manifest` (tiếng Việt, tên "Gia phả", icon).
- Service worker cache vỏ app (HTML/JS/CSS) để mở nhanh khi mạng yếu.
- **Không** làm offline-editing/sync ở v1 (phức tạp — để sau).

### Bảo mật frontend (XSS / CSP)
- Cấu hình **Content-Security-Policy** header ở host (Vercel/Netlify): `default-src 'self'; img-src 'self' data: <supabase-storage-host>; connect-src 'self' <supabase-url>; script-src 'self'`. Chặn inline script + cross-origin.
- React mặc định escape giá trị trong JSX → an toàn. **Không bao giờ** `dangerouslySetInnerHTML` với dữ liệu user (bio, nickname, full_name). Nếu cần render rich text trong bio sau này → dùng `DOMPurify`.
- Sanitize đầu vào ảnh: kiểm MIME thực + giới hạn kích thước trước khi upload Storage.

---

## 18. Thống kê (dashboard)

Tính từ `persons` theo `clan_id`: tổng thành viên, số nam/nữ, số đời (max `generation`), số chi, số người còn sống/đã mất.

---

## 19. Quản lý sự kiện & thông báo

Theo dõi và nhắc trước các ngày quan trọng của dòng họ; user **đăng ký nhận** (kiểu "follow") qua email hoặc SMS.

### Loại sự kiện
- **Tự suy ra từ dữ liệu người**: sinh nhật (người còn sống), ngày giỗ (`death_anniversary_lunar`), ngày mất.
- **Sự kiện tuỳ chỉnh**: ngày kỷ niệm, họp họ, lễ của dòng họ — lưu ở bảng `events`.

### Phụ thuộc lịch âm (quan trọng)
Giỗ và nhiều sự kiện ghi theo **âm lịch**; muốn báo trước theo dương lịch phải **quy đổi âm→dương cho năm hiện tại/kế tiếp** để biết ngày dương thực tế rồi mới lên lịch. ⇒ Tính năng này **phụ thuộc phần quy đổi âm lịch (mục 13)** — phải làm quy đổi trước khi gửi thông báo theo giỗ.

### Theo dõi (subscribe — kiểu "follow")
User chọn theo dõi ở phạm vi: **một người** / **một chi** / **cả dòng họ**. Cấu hình mỗi đăng ký: loại sự kiện muốn nhận, kênh (email/SMS), **báo trước mấy ngày** (vd 7 ngày và 1 ngày). Lưu ở `event_subscriptions`. **Chỉ thành viên clan mới theo dõi được sự kiện của clan đó** (an toàn riêng tư — không để người ngoài nhận sinh nhật người còn sống).

### Kênh thông báo
- **Email**: cần dịch vụ gửi mail riêng (vd Resend / Postmark / SendGrid) — Supabase Auth chỉ gửi mail xác thực, không gửi mail tuỳ ý.
- **SMS**: qua nhà cung cấp (Twilio…) — **có phí** (dùng chung hạ tầng với OTP SMS).

### Cơ chế gửi (scheduled job)
- **Cron hằng ngày** (extension `pg_cron` hoặc Supabase Scheduled Edge Function) chạy 1 lần/ngày.
- Tính các sự kiện sắp tới (quy đổi âm→dương cho năm nay), đối chiếu `lead_days` của từng đăng ký → gửi qua kênh đã chọn (gọi Edge Function gửi mail/SMS bằng service role).
- Ghi `notification_log` để **không gửi trùng** (idempotent) và để rà soát.

### UI
- Nút **"Theo dõi"** ở trang chi tiết người (`/person/:id`) + cấu hình theo dõi ở cấp clan.
- `/clans/:clanId/events` — màn hình sự kiện có nút **chuyển giữa hai chế độ** (lưu lựa chọn, giống list/grid bên danh bạ):
  - **Danh sách**: các sự kiện sắp tới xếp theo ngày gần nhất (sinh nhật, giỗ, kỷ niệm) — hợp người lớn tuổi, dễ đọc.
  - **Lịch (calendar)**: xem theo tháng, đánh dấu ngày có sự kiện; nên hiển thị **cả âm lịch lẫn dương lịch** trên mỗi ô (giỗ vốn theo âm lịch). Có thể dùng `react-big-calendar` hoặc `FullCalendar`, hoặc tự dựng lưới tháng đơn giản.
  - Cả hai chế độ kèm quản lý sự kiện tuỳ chỉnh cho editor/admin.
- Tuỳ chọn kênh nhận (email/SMS) ở `/account`.

---

## 20. Xuất PDF (phase sau)

- **Sách gia phả**: render HTML → PDF bằng Puppeteer trong Edge/serverless function; có mục lục, ảnh, tiểu sử, đánh số trang.
- **Sơ đồ cây**: lấy SVG từ family-chart → PDF; **chỉ theo từng chi/nhánh** (không ép cả họ vào một tờ A0).
- Cần serverless → xếp sau MVP.

---

## 21. Lộ trình theo phase

> **Mỗi mục đều kèm test (unit/component/DB-RLS/E2E) — xem mục 16. Chưa có test thì chưa coi là xong.**

### Phase 0 — Setup
Khởi tạo repo (`family-tree-v3`), Vite + React + TS + Tailwind, dự án Supabase, biến môi trường, migration schema (mục 6), bật extension, viết RLS + helper functions + triggers (mục 7), trang Auth (mục 8). **Viết test RLS ngay sau khi có policy.** Dựng Supabase local + seed script + khung CI.

### Phase 1 — MVP (cốt lõi)
1. Quản lý clan: danh sách, tạo clan (ép `max_clans`), settings cơ bản, đổi `visibility`.
2. Thành viên & vai trò: mời/đổi/xoá (admin), ép `max_users`.
3. CRUD `persons` + `families` + `branches`; tính `generation` tự động.
4. **Danh bạ**: list view + grid view (chung route, có nút chuyển) + **phân trang phía server** + tìm kiếm không dấu + lọc đời/chi + sắp xếp.
5. **Tree view** family-chart: SVG card + **lọc tuỳ chỉnh** (người trung tâm, độ sâu, chi) thay phân trang + chỉnh sửa cho editor.
6. Import Excel + validation.
7. Thống kê dashboard.
8. Ẩn người sống cho người ngoài ở clan `public` (RPC `get_clan_tree`).
9. **Cache**: React Query (staleTime dài, tắt auto-refetch) + persist IndexedDB + version-check + nút "Làm mới" + tự invalidate sau khi sửa + xoá cache khi đăng xuất (mục 12).
10. **Tài khoản cá nhân** `/account`: đổi tên hiển thị, email/mật khẩu, đăng xuất (xoá cache), xoá tài khoản (chặn nếu còn sở hữu clan có dữ liệu).

### Phase 2
Share-link + Edge Function `share-view` + route `/share/:token`; audit_log + khôi phục; **quản trị nền tảng `/admin`** (chỉnh giới hạn từng user/clan, khoá tài khoản) + Edge Function `admin-action` cho thao tác ban/xoá user; xuất PDF sách. *(Trước Phase 2, tạm quản giới hạn bằng Supabase dashboard.)*

### Phase 3
PDF sơ đồ cây theo chi; quy đổi/hiển thị âm lịch; **quản lý sự kiện & thông báo** (theo dõi người/chi/clan, nhắc trước qua email/SMS, cron + notification_log — mục 19; phụ thuộc quy đổi âm lịch nên làm sau bước đó); UI tra cứu quan hệ (kinship); import/export GEDCOM; OCR gia phả giấy.

---

## 22. Giả định & điểm cần xác nhận sau

- Share-link: chỉ admin tạo; hạn mặc định **30 ngày**; thu hồi được bất cứ lúc nào; scope `tree_view`; người sống bị ẩn.
- Clan `public`: với người ngoài, **ẩn** thông tin nhạy cảm của người còn sống (`hide_living_for_nonmembers = true` mặc định).
- Số giới hạn mặc định (tạm): `max_clans = 1`, `max_persons = 500`, `max_users = 3` — platform admin chỉnh sau; chưa tích hợp cổng thanh toán.
- Lịch âm: lưu cả hai từ đầu; quy đổi tự động để Phase 3.
- SMS OTP cần cấu hình nhà cung cấp (có phí) — bật khi sẵn sàng, không chặn MVP.
- Xoá tài khoản: **chặn** nếu user còn sở hữu clan có dữ liệu — phải chuyển quyền hoặc xoá clan trước (tránh dữ liệu mồ côi).
- Khoá tài khoản: set `profiles.is_suspended = true` **và** gọi `auth.admin.signOut(userId)` qua Edge Function — JWT invalidate ngay, lần đăng nhập sau bị chặn ở bước signIn (check `is_suspended`).
- Soft delete cho `persons`/`families`/`branches` (cột `deleted_at`); hard delete chỉ xảy ra khi xoá clan (cascade). Audit log restore khôi phục từ `before` jsonb + clear `deleted_at`.
- Sự kiện & thông báo (mục 19): chỉ **thành viên clan** mới theo dõi/nhận; cần dịch vụ gửi email riêng và SMS (có phí); **phụ thuộc quy đổi âm lịch** nên xếp Phase 3 sau bước quy đổi.

---

## 23. Ngoài phạm vi v1

Offline editing/sync; app native mobile; merge realtime nhiều người sửa cùng lúc; cổng thanh toán/billing; GEDCOM; OCR; phụ thuộc family-chart Premium.

---

## 24. Lệnh khởi tạo gợi ý

```bash
npm create vite@latest family-tree-v3 -- --template react-ts
cd family-tree-v3
npm install
npm install @supabase/supabase-js family-chart d3 xlsx
npm install @tanstack/react-query @tanstack/react-query-persist-client idb-keyval
npm install -D tailwindcss postcss autoprefixer vite-plugin-pwa
# Fonts (self-host để không phụ thuộc Google Fonts khi mạng yếu)
npm install @fontsource/be-vietnam-pro @fontsource/noto-serif
# shadcn/ui (chạy sau khi đã có Tailwind cấu hình)
#   npx shadcn@latest init
#   npx shadcn@latest add button input label card dialog dropdown-menu ...
# Testing
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
npm install -D @playwright/test @faker-js/faker
npx playwright install
npx tailwindcss init -p
# Supabase CLI (cho test DB/RLS/E2E trên local)
#   supabase init && supabase start
# Supabase cloud: tạo project, lấy URL + anon key, đưa vào .env (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
# Viết migration SQL (schema + RLS + functions + triggers) trong supabase/migrations/
# Sinh TypeScript types từ schema (chạy lại sau mỗi migration; đưa vào CI):
#   supabase gen types typescript --local > src/lib/database.types.ts
```

### Quy ước migration
- **Forward-only**: mỗi migration là một file SQL có timestamp prefix; KHÔNG sửa file đã chạy production. Cần rollback → viết migration mới đảo ngược.
- Mỗi migration phải **idempotent ở mức an toàn**: dùng `create ... if not exists`, `alter table ... add column if not exists` khi có thể.
- Test migration trên Supabase local trước khi push lên cloud; CI chạy `supabase db reset` + chạy lại toàn bộ migration để đảm bảo chuỗi luôn replay được từ đầu.

`.env` (không commit):
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
Service role key chỉ dùng trong Edge Function, KHÔNG bao giờ để ở frontend.

---

## 25. Supabase local & Docker (môi trường dev/CI)

Mục này định nghĩa cách dev và CI chạy backend cô lập, không cần đụng Supabase cloud. Quan trọng cho test RLS / DB / E2E (mục 16).

### Yêu cầu hệ thống
- **Docker Desktop** chạy nền (Supabase CLI dựng container Postgres + Auth + Storage + Realtime + Studio + Edge Function runtime).
- **Supabase CLI** ≥ phiên bản hiện hành. Cài qua Homebrew (`brew install supabase/tap/supabase`) hoặc npm (`npm install -D supabase` rồi `npx supabase ...`). Đặt vào `devDependencies` để CI dùng đúng phiên bản.
- Cấu hình tối thiểu Docker: 4 CPU, 6 GB RAM (Supabase stack khá nặng).

### Khởi tạo lần đầu

```bash
npx supabase init        # tạo thư mục supabase/ với config.toml
npx supabase start       # pull images + start containers (lần đầu vài phút)
npx supabase status      # in URL/keys local (anon, service_role, JWT secret)
```

Sau `supabase start`, ghi output `API URL` (vd `http://127.0.0.1:54321`) và `anon key` vào `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon-key-từ-supabase-status>
```

`.env.local` **KHÔNG commit**; `.env.example` commit để team biết format.

### Cấu trúc thư mục `supabase/`

```
supabase/
  config.toml              # cấu hình project local (ports, auth, storage, ...)
  migrations/              # *.sql có timestamp prefix (forward-only, mục 24)
    20260101000000_init_schema.sql
    20260101000001_rls_policies.sql
    20260101000002_triggers.sql
    ...
  seed.sql                 # seed data chạy sau migrations khi `db reset`
  functions/
    share-view/index.ts    # Edge Function (mục 9)
    admin-action/index.ts  # Edge Function (mục 8)
  tests/                   # pgTAP tests (nếu dùng) — mục 16
```

### `config.toml` — các mục cần chỉnh

```toml
[api]
port = 54321              # đổi nếu xung đột

[db]
port = 54322
major_version = 15        # PG15+ để dùng NULLS NOT DISTINCT (nếu chọn)

[auth]
site_url = "http://localhost:5173"  # khớp với Vite dev port
additional_redirect_urls = ["http://localhost:5173/**"]
jwt_expiry = 3600
enable_signup = true

[auth.email]
enable_confirmations = false   # tắt cho dev để đăng ký nhanh; bật ở prod
# enable_otp = true để test magic link / OTP email local

[auth.sms]
enable_signup = false          # SMS OTP cần provider thật — không bật local

[storage]
file_size_limit = "10MiB"      # chặn ảnh quá lớn ngay từ local

[functions.share-view]
verify_jwt = false             # share-view phục vụ khách KHÔNG đăng nhập

[functions.admin-action]
verify_jwt = true              # admin-action bắt buộc JWT hợp lệ
```

Inbucket (mail catcher local) chạy mặc định ở `http://127.0.0.1:54324` — kiểm thử email confirmation / magic link mà không cần SMTP thật.

### Workflow migration

```bash
# Tạo migration mới
npx supabase migration new add_persons_table

# Edit supabase/migrations/<timestamp>_add_persons_table.sql

# Áp dụng + reset DB sạch (xoá data, chạy lại toàn bộ migrations + seed.sql)
npx supabase db reset

# Sinh lại TypeScript types
npx supabase gen types typescript --local > src/lib/database.types.ts
```

**Forward-only**: không sửa migration đã commit. Cần rollback → tạo migration mới đảo ngược.

### Seed data cho dev/test

`supabase/seed.sql` chạy sau migrations khi `db reset`. Nhưng seed bằng SQL tay khó scale → dùng **script Node** với `@faker-js/faker` (mục 16):

```
scripts/seed-fixtures.ts
```

Script gọi `supabase-js` với **service_role key của local** (an toàn vì chỉ chạy local, không deploy), tạo:
- 1 platform admin user
- 3 clan giả (small/medium/large: 50 / 500 / 5000 persons) để test phân trang và hiệu năng cây
- User cho mọi role (admin/editor/viewer) ở mỗi clan
- Một vài share-link active + expired
- Vài event_subscriptions

Chạy: `npm run seed` (sau `supabase db reset`).

### Edge Functions local

```bash
# Serve tất cả functions (auto-reload khi sửa)
npx supabase functions serve

# Serve riêng 1 function với env riêng
npx supabase functions serve share-view --env-file ./supabase/functions/.env.local
```

`supabase/functions/.env.local` chứa biến môi trường cho function (vd `RESEND_API_KEY` cho gửi mail) — KHÔNG commit.

Test function: `curl http://127.0.0.1:54321/functions/v1/share-view?token=abc123`.

### Test RLS với nhiều user giả

Trong test (mục 16), tạo nhiều client `supabase-js` với JWT khác nhau:

```ts
// Tạo user qua admin API (service_role)
const admin = createClient(URL, SERVICE_ROLE_KEY)
const { data: user } = await admin.auth.admin.createUser({ email, password })

// Tạo client "đeo" JWT của user đó
const userClient = createClient(URL, ANON_KEY)
await userClient.auth.signInWithPassword({ email, password })

// Mọi query qua userClient đi qua RLS như client thật
```

Mỗi test reset DB (`supabase db reset --linked=false`) hoặc dùng transaction rollback (nhanh hơn nhiều) — tuỳ test runner.

### CI (GitHub Actions)

`.github/workflows/test.yml` — Supabase CLI tự pull Docker images trên runner Ubuntu:

```yaml
- uses: supabase/setup-cli@v1
  with: { version: latest }
- run: supabase start
- run: supabase db reset            # chạy hết migrations + seed
- run: npm run test:unit
- run: npm run test:rls             # integration test RLS
- run: npm run test:e2e             # Playwright
- run: supabase stop
```

CI mỗi push/PR phải chạy được toàn bộ từ migrations rỗng — chống lỗi "chỉ chạy được trên máy tôi".

### Persistence & port conflicts
- `supabase start` giữ data giữa các lần start. Muốn xoá sạch: `supabase stop --no-backup` rồi `supabase start`.
- Xung đột port (54321, 54322, 54324, 54323 Studio): chỉnh trong `config.toml` rồi `supabase stop && supabase start`.
- Studio (UI quản DB local) ở `http://127.0.0.1:54323` — xem data, chạy SQL ad-hoc.

### Tách môi trường local vs cloud

| Môi trường | URL | Khi nào dùng |
|---|---|---|
| Local (`supabase start`) | `http://127.0.0.1:54321` | Dev hằng ngày, test, CI |
| Staging (Supabase project riêng) | `https://<staging>.supabase.co` | Preview deploy, smoke test trước prod |
| Prod | `https://<prod>.supabase.co` | Live |

Mỗi môi trường file `.env` riêng (`.env.local`, `.env.staging`, `.env.production`). KHÔNG dùng chung anon key. Service role key chỉ ở backend (Edge Function secrets), KHÔNG bao giờ ở frontend.

### Liên kết với project cloud

Khi sẵn sàng deploy schema lên cloud:

```bash
npx supabase link --project-ref <project-ref>     # liên kết một lần
npx supabase db push                              # push migrations local → cloud
npx supabase functions deploy share-view          # deploy 1 function
npx supabase secrets set RESEND_API_KEY=...       # set env cho function trên cloud
```

**Không** chạy `db push` thẳng lên prod khi chưa test ở staging. CI quy ước: PR merge vào `staging` branch → auto deploy lên Supabase staging; tag release → deploy lên prod.

---

## 26. Trạng thái triển khai — log thay đổi so với plan gốc

Cập nhật **2026-05-31**. Phần này ghi lại cái gì đã xong, cái gì đã đổi
hướng đi so với các mục 1–25 ở trên, và cái gì vẫn chưa làm. Mục đích:
giữ plan là nguồn tham chiếu duy nhất cho người vào dự án sau.

### 26.1 Trạng thái phase

| Phase | Trạng thái | Ghi chú |
|---|---|---|
| Phase 0 — Setup | ✅ Xong | Repo, Vite + React + TS + Tailwind + shadcn, Supabase local, 7 migration đầu (schema → RLS → triggers → member_management → clan_stats → account_self_delete → admin_emails_rpc). RLS test suite chạy ở CI. |
| Phase 1 — MVP | ✅ Xong | Clans CRUD + members + persons/families/branches + danh bạ (list+grid+filters) + tree (search + focal + depth + orientation) + import Excel + dashboard + hide-living public view + cache version-check + tài khoản đầy đủ. |
| Phase 2 — post-MVP | ✅ phần lớn xong | Share-link + share-view Edge Function (rate-limit 60req/phút), audit_log + khôi phục (RPC `restore_audit_entry`), /admin + admin-action Edge Function (suspend / unsuspend / signout / grant_platform_admin / delete). Chỉ còn **PDF export** (mục 20) hoãn. |
| Phase 3 | ⏳ Chưa làm | Quy đổi âm-dương, events + thông báo, kinship UI, GEDCOM, OCR. |

### 26.2 Migrations đã apply (theo thứ tự)

1. `20260530130631_core_schema.sql` — bảng + FK + extension
2. `20260530131033_rls_policies.sql` — policies + helpers + `persons_public_safe` view + Storage RLS
3. `20260530131316_triggers.sql` — limit enforcement, audit log, generation recompute, soft delete, unaccent, data_version bump
4. `20260530141401_member_management.sql` — `invite_member_by_email` RPC
5. `20260530143832_clan_stats.sql` — RPC dashboard
6. `20260530144551_account_self_delete.sql` — `delete_my_account` + `count_my_blocking_clans` + opt-in flag để cascade `clans.owner_id → NULL`
7. `20260530150931_partial_dates.sql` — `birth_date_precision` / `death_date_precision` + check ràng buộc
8. `20260530151940_persons_public_safe_fix.sql` — view chạy ở `security_invoker=false` + thêm cột precision/lunar/unaccent
9. `20260530152602_bulk_import.sql` — `bulk_import_persons` RPC (one-transaction + advisory lock + defer FK)
10. `20260530153500_share_view_rate.sql` — bảng rate-limit + `prune_share_view_rate`
11. `20260530154310_audit_restore.sql` — `restore_audit_entry` RPC, soft-delete inverse model
12. `20260530154742_admin_emails_rpc.sql` — `get_profile_emails` SECURITY DEFINER
13. `20260531040641_platform_admin_full_access.sql` — **mở rộng quyền** (xem 26.4)
14. `20260531044307_clans_name_unaccent.sql` — cột + trigger + GIN trigram để search clan không dấu
15. `20260531044915_clans_person_count.sql` — `clans.person_count` denormalised + trigger increment/decrement

### 26.3 Edge Functions đã deploy local

| Tên | `verify_jwt` | Mục đích |
|---|---|---|
| `share-view` | false | Tra cứu token, mask living, trả JSON cho family-chart. Rate-limit theo IP 60 req/phút. |
| `admin-action` | true | Re-verify caller là platform admin rồi gọi `auth.admin.signOut` / `auth.admin.deleteUser` / cập nhật `is_suspended` / `is_platform_admin`. Cấm caller tự huỷ bản thân. |

### 26.4 Phân quyền — thay đổi so với mục 5 & 7

**Platform admin nay là superset của mọi clan role.** Plan gốc nói platform
admin chỉ quản giới hạn (`max_clans/max_persons/max_users`) và không "gắn"
với clan nào. Triển khai thực tế mở rộng: 3 helper RLS đều OR thêm
`is_platform_admin()`, tức platform admin có quyền tương đương clan admin
ở mọi clan (read + write + manage members + share-link + audit restore).

- `is_clan_member(target)` = `is_platform_admin() OR clan_role(target) IS NOT NULL`
- `can_edit_clan(target)` = `is_platform_admin() OR clan_role(target) IN ('admin','editor')`
- `is_clan_admin(target)` = `is_platform_admin() OR clan_role(target) = 'admin'`
- `is_platform_admin()` cũng kiểm tra `is_suspended = false` để tài khoản bị khoá mất luôn quyền vượt cấp.

UI mirror: `ClanDetail` gắn thêm `isPlatformAdmin`; hook `useClanContext`
expose `effectiveRole / canEditClan / isClanAdmin` để mọi page gating
chung một nguồn.

`/clans` cho platform admin liệt kê **mọi clan trong hệ thống** (không
chỉ membership). Banner "bạn đang xem với quyền platform admin".

`clans_insert` cũng nới: platform admin được set `owner_id` cho user khác
(dùng cho support / khôi phục).

### 26.5 Schema bổ sung so với mục 6

- **`persons.birth_date_precision` / `death_date_precision`** (`day` | `month` | `year` | null) đi cùng cột `date`. Check constraint ràng buộc cùng null hoặc cùng set. Khi `year`, lưu placeholder `yyyy-01-01`; khi `month`, `yyyy-mm-01`. Helper `src/lib/partialDate.ts` round-trip.
- **`clans.name_unaccent`** + trigger + GIN trigram → search `/clans` không dấu.
- **`clans.person_count`** denormalised int, maintain bằng trigger trên `persons` (insert/update.deleted_at toggle/cascade-delete). Dùng cho filter "Quy mô" ở tab Cộng đồng.

### 26.6 Frontend — sai lệch / bổ sung so với mục 10

- **Left drawer permission-aware** ở `src/components/AppDrawer.tsx`. Trên `<lg`: hamburger mở overlay; trên `≥lg`: **luôn hiện như sidebar cố định** (`lg:translate-x-0`). BottomTabBar và hamburger `lg:hidden`. Mọi page root có `lg:pl-72`. Drawer footer 1 row: avatar + tên + email + nút logout icon-only.
- **`/clans` 2 tab + size filter** (chưa nói trong plan):
  - Của tôi (membership) — Cộng đồng (clan public chưa join + ALL clan với platform admin).
  - Bucket Quy mô: Mới khởi tạo `<5`, Nhỏ `5–19`, Vừa `20–49`, Lớn `≥50`.
  - Server pagination (`.range`), search debounce 300ms, unaccent.
- **Search input tái sử dụng** `src/components/SearchInput.tsx` (icon 🔍 inline, h-10) trên `/clans`, `/people`, `/tree` (focal), `/admin` (user + clan).
- **Icon mọi nút**: `src/components/icons.tsx` — 25 SVG stroke Lucide-style. Mỗi nút action mang icon tương ứng (Plus / Pencil / Trash / Check / X / Refresh / Search / Login / Logout / Lock / Unlock / Shield / Upload / Download / Copy / Undo / ArrowLeft / ArrowRight / Users / UserPlus / List / Grid / Settings / LayoutVertical / LayoutHorizontal).
- **Route nesting**: mọi route `/clans/:clanId/people/*` và `/clans/:clanId/members` là child của `<ClanLayout>` (không top-level), chia sẻ drawer + header + footer-tab → không reflow giữa Danh bạ ↔ Detail ↔ Edit.
- **`?from=tree` propagation**: action icon trên tree card append query param → PersonDetail/EditPerson/AddSpouse/AddChild đọc và preserve qua chuỗi navigation → back chính xác về `/tree` thay vì `/people`.

### 26.7 Tree (family-chart) — chốt thiết kế thực tế (mục 11)

- Container có `class="f3"` + `text-foreground` + inline `--male-color #D4DDE4` / `--female-color #E8D2CC` để palette khớp paper/oxblood.
- Container size responsive: `h-[70vh] min-h-[480px] max-h-[820px]`.
- `setCardSvg()` trả về CardSvg instance — mọi config (`setCardDisplay`, `setCardDim`, `setOnCardUpdate`) chain trên instance đó, KHÔNG trên Chart. (Bug suýt mất nửa ngày debug.)
- `card_dim: w=260, h=72, img 50×50, text_x=64`.
- Line 1: full name (trái, 13px).
- Line 2: `YYYY - YYYY` lifespan với `?` cho năm chưa biết, trái, 11px muted (`#7A6F66`).
- Badge **Đời N** góc phải trên: pill oxblood `#7A2E2E` + chữ TRẮNG `#FFFFFF` (CSS rule `.gen-badge text` thắng `.f3 svg text { fill: currentColor }`).
- Avatar tròn: `clip-path: circle(50%)` override `card_image_clip` của library. PNG male/female ở `public/avatars/` set qua `data.avatar`.
- Hover action icons (chỉ admin/editor): pencil → `/people/:id/edit?from=tree`, plus → `/people/:id?from=tree`. CSS `opacity:0 → 1` khi `.card_cont:hover`.
- Connecting lines: library hardcode `stroke="#fff"`, override CSS bằng `stroke #7A6F66 opacity .55`; path-to-focal ăn oxblood.
- **Orientation toggle** vertical/horizontal (lưu localStorage `family-tree:tree-orientation`). Spacing per orientation:
  - Vertical: `setCardXSpacing(290) setCardYSpacing(160)`
  - Horizontal: `setCardXSpacing(320) setCardYSpacing(100)`
- Resize observer + `requestAnimationFrame` trước `updateTree({initial:true})` để fit-on-init đo đúng.

### 26.8 Seed — tăng quy mô (mục 25)

`scripts/seed-fixtures.ts` hiện sinh **50 clan**:
- `admin@example.test` platform admin (`max_clans=10`)
- `small-admin@example.test` clan 50 người (private)
- `medium-admin@example.test` clan **100 người, public** (target test thủ công)
- `clan-001-admin@example.test` … `clan-048-admin@example.test`: 48 clan với phân bố quy mô (đa số 5–20 ng, vài clan 30–50, vài clan <5 để hứng empty-state)
- Clan ≥20 ng có thêm `*-editor` + `*-viewer`
- 11 clan có share-links (1 active + 1 expired)
- Tổng ~850 person. Mọi tài khoản pass `demo-password-1234`.

### 26.9 CI hardening

- `vitest.config.ts`: `fileParallelism: false` — integration tests share một PostgREST/Kong, parallel gây flake "invalid response from upstream" và "JWT issued at future".
- `createTestUser` retry signIn nếu probe SELECT báo "JWT issued at future" (drift sub-giây giữa Docker container).
- CI workflow: poll `/storage/v1/version` health 30s sau `supabase start` + retry 3 lần `supabase db reset` để né 502 từ Kong khi Storage chưa ready.
- Persister cache `buster: "v2"` ở `main.tsx` để cache IndexedDB cũ tự drop khi schema đổi.

### 26.10 Bug fixes có ý nghĩa lâu dài

- `RequireAuth` probe `profiles` row; thiếu row → force `signOutAndClearCache` → tránh `clans_owner_id_fkey` violation khi JWT survive sau `db:reset`.
- `bump_data_version` chuyển sang STATEMENT-level (đã trong plan) — verified bulk import 7000 row chỉ bump version 1 lần / statement, không bloat MVCC.
- `delete_my_account` set txn-local flag `app.allow_owner_clear`; `protect_clan_privileged_cols` cho cascade `owner_id → NULL` đi qua khi flag bật. Mọi transfer owner_id khác vẫn yêu cầu platform admin.
- `protect_*_privileged_cols`: bypass khi `auth.uid() is null` (service role / internal call).

### 26.11 Còn chưa làm

- Mục 19 (events & thông báo) toàn bộ — phụ thuộc quy đổi âm-dương.
- Mục 13 — quy đổi âm-dương thực tế (cột vẫn lưu nhưng UI hiển thị chỉ đọc dương lịch).
- Mục 20 — PDF export sách / sơ đồ cây.
- PWA: `vite-plugin-pwa` đã install nhưng chưa cấu hình manifest + service worker production-ready.
- Quy đổi/render âm lịch trên PersonDetail.
