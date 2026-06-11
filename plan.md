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

### UI-level gating (defense-in-depth)

RLS ở DB layer là chốt cứng — không ai dựng request bypass được. Nhưng UI cũng cần gate đúng để không hiện nút action chỉ để bấm xong báo 403. Tóm tắt route + action nào cho ai (non-member của clan `public` là trường hợp gây nhầm nhất):

| Surface | Non-member (public clan) | Member (viewer+) | Editor / Admin |
|---|---|---|---|
| `/tree` | Xem (masked view) | Xem đầy đủ | + thêm/sửa/xoá người trên cây |
| `/people` | Xem list (masked view) | Xem + lọc + search | + bulk edit, gán nhánh, etc. |
| Dashboard | Xem (stats fallback từ tree khi RPC trả 0) | Xem đầy đủ | + nút import / thêm người |
| `/events` | Xem lịch (RLS broaden) | + theo dõi | + tạo/sửa sự kiện |
| `/today` | Redirect về Dashboard | Xem | — |
| `/person/:id` | Xem (masked view) | Xem đầy đủ | + sửa, QR (admin), xoá |
| **Action bị ẩn cho non-member**: |  |  |  |
| Nút "Xuất sổ PDF" (Tree + Dashboard) | ❌ | ✅ | ✅ |
| Nút "Chia sẻ" (Tree) | ❌ | ✅ | ✅ |
| Nút "Xuất lịch (.ics)" (Events) | ❌ | ✅ | ✅ |
| Tab "Việc cần làm" (`/todo`) | Redirect | ✅ | ✅ |
| `/kinship` máy tính xưng hô | Redirect | ✅ | ✅ |
| `/admin` / `/settings` / `/members` / `/audit` / `/inlaws` / `/contributions` | Redirect | Tùy role | ✅ |
| `/import`, `/ai-generate`, `/new`, `/edit` | Redirect | Viewer redirect; editor+ vào | ✅ |
| Drawer todo badge dot, milestone toast | Ẩn | Hiện | Hiện |

Quy tắc chung: nếu một route/RPC raise `42501` cho non-member (vd `count_clan_todo`, `count_clan_completion_gaps`, `get_clan_todo_summary`), UI phải gate query bằng `enabled: !!userId && effectiveRole(clan) !== null`. Nếu nguyên trang là member-only, redirect bằng `<Navigate to={\`/clans/\${clan.id}\`} replace />` ngay sau khi `useClanContext` đã load — tránh hiện trang đầy lỗi 403 trong console rồi mới chuyển hướng.

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
Ưu tiên dùng **view** `persons_public_safe` thay vì RPC SECURITY DEFINER (bypass RLS = rủi ro lộ dữ liệu nếu có bug). View masking column-level cho các cột nhạy cảm khi `is_living = true`:

```sql
create view persons_public_safe as
select id, clan_id, full_name, gender, generation, branch_id, is_living, is_root,
  case when is_living then null else birth_date end as birth_date,
  case when is_living then null else birth_place end as birth_place,
  case when is_living then null else photo_path end as photo_path,
  case when is_living then null else bio end as bio,
  -- … (toàn bộ field tên/nơi/ngày sinh+mất + lunar variants)
  birth_family_id,            -- cần để Tree vẽ parent-child link
  birth_order                 -- cần để xếp anh chị em
from persons
where deleted_at is null
  and exists (
    select 1 from clans c
    where c.id = persons.clan_id
      and (c.visibility = 'public' or is_clan_member(c.id) or is_platform_admin())
  );
```

`security_invoker = false` — view chạy với quyền owner. Toàn bộ visibility check do WHERE clause trên view tự lo. GRANT SELECT chỉ cho `authenticated`; REVOKE từ `anon`.

Có một view chị em `families_public_safe` cùng pattern — chỉ expose `id, clan_id, husband_id, wife_id, union_type` (không có thông tin cá nhân). Tree cần cả 2 view để vẽ được cho non-member.

Thành viên (`is_clan_member`) vẫn select trực tiếp `persons`/`families` để lấy đầy đủ (vd `todo_excluded`, `full_name_unaccent`); người ngoài chỉ select được view. Frontend chọn nguồn ở client qua hook `effectiveRole(clan) === null` rồi thread `source: "persons" | "persons_public_safe"` qua `getTreeData`, `getPerson`, `getPersonRelationships`, `listPersons` — kèm trong `queryKey` để cache không poison giữa hai nhánh.

### Visibility cho các bảng phụ trợ

Các bảng/policy đặc biệt khác cần đồng pattern (chỉ thành viên mới được SELECT, hoặc public clan mới được peek):

- **`families` / `branches`**: members-only SELECT (giống `persons`). Non-member của public clan đọc qua `families_public_safe`.
- **`events`**: ban đầu là members-only (`events_member_select`). Đã đổi sang policy `events_select` rộng hơn — cho phép `visibility='public'` (xem migration `20260610030000_events_public_select.sql`). Write policies (insert/update/delete) vẫn `can_edit_clan`. Non-member của public clan thấy lịch sự kiện read-only; vẫn không xuất `.ics` được (gate ở UI).
- **`event_subscriptions`**: chỉ chủ subscription, write/read đều `auth.uid() = user_id`.
- **`audit_log`**: members-only SELECT (`is_clan_member`); restore RPC `is_clan_admin`.
- **`clan_members`**: SELECT cho member của cùng clan (để thấy đồng nghiệp) + platform_admin.
- **`person_links`** (cross-clan in-law): xem mục 28 — admin-only mặc định, có cấu hình riêng.
- **`feedback`**: anyone INSERT (kể cả anon — early users chưa login), chỉ platform_admin SELECT.
- **`contributions`**: anyone đã login INSERT (đề xuất sửa), admin/editor SELECT/UPDATE để duyệt.

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
| Phase 2 — post-MVP | ✅ Xong | Share-link + share-view Edge Function (rate-limit 60req/phút), audit_log + khôi phục (RPC `restore_audit_entry`), /admin + admin-action Edge Function (suspend / unsuspend / signout / grant_platform_admin / delete), PDF export sổ gia phả (client-side @react-pdf/renderer, lazy-loaded). |
| Phase 3 | 🚧 Đang làm | Milestone A (lunar + Can Chi) ✅. Milestone B (Events page) ✅. Milestone C (Subscribe UI) ✅. Milestone D (cron + Resend) ✅. GEDCOM 5.5.1 export + import với custom tags cho fields tiếng Việt (`_LUNAR_BIRTH`, `_GIO`, `_COURTESY`, `_NICKNAME`, `_POSTHUMOUS`, `_BRANCH`, `_ROOT`, `_GEN`) ✅. Còn lại: kinship UI, OCR. |

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

- ~~Kinship calculator ("máy tính xưng hô")~~ — ✅ ship dạng "Tra cứu xưng hô" (commit `ae72ccf`). Logic BFS LCA + bảng rule cô/dì/chú/bác/cậu/anh-chị-em-họ + trang riêng + nút shortcut trên PersonDetail.
- ~~Lunar input cho **AddSpouse / AddChild** (quick-add form)~~ — ✅ đã port sang `CalendarDateInput` (2026-06-06). `PartialDateInput` cũ deleted, 4 form (NewPerson / EditPerson / AddSpouse / AddChild) nay đều hỗ trợ tab Dương / Âm + checkbox tháng nhuận + preview line. `addChildToFamily` query mở rộng nhận `birth_lunar_*`.

> Đã bỏ khỏi roadmap: **SMS provider** cho channel `sms` (chưa có vendor, có phí; channel còn trong schema nhưng không wire) — và **OCR ảnh gia phả cũ** (effort cao, ROI thấp; user nhập tay vẫn nhanh hơn cho dataset Vietnamese nhiều bút lông).

> Đã làm trước đây (sửa log cũ): hiển thị âm-dương song song trên PersonDetail (`LunarDetailRow`) — milestone A của Phase 3, commit `116a7fe` + `54ed0b0`. Cột schema `*_lunar_*` đã được cả import Excel/GEDCOM lẫn UI tự derive khi solar=day-precision.

### 26.12 Tính năng mới (sau 2026-06-05)

Bốn nhóm tính năng ship sau khi seed prod, mở rộng phạm vi từ "sổ điện
tử" sang "trải nghiệm dòng họ chủ động":

#### A. QR cá nhân — mã QR cho từng người
- Tận dụng bảng `share_links` sẵn có với cột `scope='single_person'`
  + `root_person_id`. Không cần schema mới.
- Edge `share-view` extend: branch theo scope, trả focal + cha/mẹ + vợ/
  chồng + con (1 hop) thay vì cả descendant subtree. Living vẫn mask.
- Page `/share/:token` detect scope → render `SharedPersonCard`
  (card read-only) thay vì family-chart.
- Helper `getOrCreatePersonShareLink(clanId, personId)` — reuse link
  cũ nếu chưa revoke, mặc định 365 ngày (in lên bia cần lâu).
- Trang `/clans/:id/qr-export` (admin) — filter chi/đời/đã-mất,
  multi-select, xuất PDF A4 2×3 grid (6 thẻ A6/trang) qua
  `@react-pdf/renderer` (lazy chunk).

#### B. Đường trực hệ — "từ tôi về thuỷ tổ"
- Migration: `clan_members.self_person_id` (uuid → persons) +
  `self_person_verified` (admin xác nhận).
- RPC `set_my_self_person(p_clan_id, p_person_id)` SECURITY DEFINER —
  member claim/clear; platform admin không phải member vẫn dùng được
  (auto-insert clan_members row role='viewer').
- `src/lib/lineage.ts`: pure `traceLineage(persons, families, fromId,
  choices)` — walk birth_family lên gốc với cycle guard + per-fork
  override (paternal mặc định, maternal qua choices map).
- Page `/clans/:id/my-lineage` — reuse family-chart với data đã lọc
  thành 1 chuỗi dọc (synthetic single-parent family ở mỗi tầng).
  Toolbar "Bên nội / Bên ngoại" cho từng điểm rẽ.
- Members page extend: row "Tự xưng: X · Chờ xác nhận" + nút admin
  ✓ Xác nhận.

#### C. "Hôm nay" — at-a-glance giỗ + sinh nhật
- Page `/clans/:id/today` — 3 bucket: Hôm nay (emphasised) · 7 ngày
  tới · 30 ngày tới. Tái sử dụng `computeUpcomingEvents` +
  `computeUpcomingAnniversaries` đã có (cron `notify-events` dùng
  chung) → cron + page đồng bộ.
- Extract `UpcomingEventRow` shared component (refactor từ inline
  trong Events.tsx) với prop `emphasised` cho tile "Hôm nay" lớn hơn.
- Drawer item "Hôm nay" ngay sau "Tổng quan".

#### D. Đóng góp có duyệt — crowdsource edits
- Bảng `contributions` (id, clan_id, person_id?, type, payload jsonb,
  submitter_*, status, reviewer_*, submitter_ip). 3 loại:
  `edit_person`, `add_note`, `add_person` (+ relation hint).
- RLS: member INSERT (auth.uid pinned), editor+submitter SELECT,
  admin UPDATE/DELETE.
- RPC `apply_contribution(p_id)` SECURITY DEFINER — branch theo type,
  apply atomic vào persons/families. Audit trigger có sẵn ghi log.
- RPC `reject_contribution(p_id, status, note)` cho rejected /
  needs_info.
- Edge `submit-contribution` cho guest qua share-link path:
  rate-limit 5/10min/IP, validate link còn hiệu lực + person thuộc
  clan, INSERT service role.
- Edge `notify-contribution`: status-driven, đọc DB là single source
  of truth. pending → email admin; approved/rejected/needs_info →
  email submitter (auth.users.email khi auth, submitter_contact khi
  guest). Resend templates (3 variants).
- `ContributeDialog` 3-mode (edit_person / add_note / add_person +
  spouse|child). 2-layer scroll wrapper để tránh title bị giấu khi
  form dài hơn viewport.
- Trang `/clans/:id/contributions` (list, filter pills) + detail
  `/:contribId` (submitter card + `ContributionDiffView` per-type:
  row-per-field strikethrough→tint cho edit, "bio sau khi duyệt" cho
  add_note, card mới cho add_person + relation hint).
- Drawer badge "Đóng góp (N)" qua `countPendingContributions()` —
  cache 30s.

#### E. UI consistency sweep
- AppHeader logo `lg:hidden` (drawer đã có, tránh duplicate).
- 5 trang top-level (Account, Docs, Admin, Clans, NewClan) →
  `max-w-4xl py-6 px-4 space-y-6` đồng nhất với ClanLayout.
- Toàn bộ `size="lg"` Buttons → default size + icon `h-4 w-4 mr-1.5`
  (Login, Signup, Settings, AiGenerate, SocialAuth, NewClan).
- EmptyState `tertiary` đổi từ ghost → outline để 3 CTA cùng weight.
- ContributeDialog xoá Tiểu sử field khỏi mode "Sửa thông tin" — buộc
  user dùng tab "Bổ sung tiểu sử" cho mọi cập nhật bio (clearer
  separation).

#### Migration list bổ sung

16. `20260605120000_lineage_self_link.sql` — clan_members self_person
    cols + RPC `set_my_self_person`, extend `get_clan_members_info`.
17. `20260605130000_lineage_platform_admin.sql` — patch RPC để
    platform admin claim được trên clan họ không là thành viên.
18. `20260605140000_contributions.sql` — bảng + RLS + RPC `apply` /
    `reject`.

#### Edge functions bổ sung

| Tên | `verify_jwt` | Mục đích |
|---|---|---|
| `submit-contribution` | false | Guest submit đề xuất qua share-link; rate-limit IP, INSERT service role, gọi `notify-contribution` |
| `notify-contribution` | false | Status-driven email dispatcher; pending → admin emails, resolved → submitter contact |

#### Env mới

- `APP_BASE_URL` — gốc URL prod (cho link trong email từ
  `notify-contribution`).

### 26.13 Lunar date input cho form chính (2026-06-06)

`NewPerson` + `EditPerson` giờ nhận input theo **cả 2 lịch**: tab
"Dương / Âm" trên field ngày sinh / ngày mất, checkbox "Tháng nhuận"
khi ở lunar mode, preview line "= 15/3 ÂL — năm Canh Thân" hoặc "=
30/4/1980 dương lịch" để user sanity-check.

- Component mới `CalendarDateInput` (`src/components/CalendarDateInput.tsx`)
  thay `PartialDateInput` trong 2 form chính. AddSpouse / AddChild
  vẫn dùng `PartialDateInput` solar-only (quick-add, chưa cần lunar).
- Helper `src/lib/personDates.ts` round-trip giữa form state
  (`CalendarDateValue`) ↔ DB columns. Solar mode chấp nhận partial
  precision (year-only / year+month) như cũ; lunar mode bắt buộc full
  ymd vì conversion âm→dương cần đủ 3 thành phần. Lunar partial sẽ
  hint user đổi sang dương.
- `loadCalendarDateValue` chọn mode khởi tạo theo dữ liệu cũ: solar
  null + lunar set (thường từ Excel/GEDCOM bia mộ) → khởi tạo ở lunar
  tab để user thấy đúng cái họ nhập.
- `createPerson` / `updatePerson` (`src/lib/queries/persons.ts`) nhận
  thêm 11 cột lunar (`birth_lunar_*`, `death_lunar_*`,
  `death_anniv_lunar_*`); helper `buildDeathAnniversary` tự sinh giỗ
  tháng/ngày âm khi user nhập ngày mất full-day.
- Khi solar=day-precision, lunar columns được auto-derive và lưu
  song song để display luôn đọc DB (không fallback runtime convert).

---

## 27. Production deploy — Supabase Cloud + Netlify

Pipeline tự động từ `main` → Supabase Cloud + Netlify, gated bằng full test suite.

### 27.1 Hạ tầng

| Lớp | Provider | URL |
|---|---|---|
| Postgres + Auth + Storage + Edge Functions | Supabase Cloud | `<ref>.supabase.co` |
| SPA static + CDN | Netlify | `<site>.netlify.app` |
| Email transactional (Auth) | Resend (khuyến nghị) | qua custom SMTP của Supabase Auth |
| Source + CI | GitHub Actions | repo `family-tree-v3` |

### 27.2 Pipeline GitHub Actions

Hai workflow chained:

**`.github/workflows/test.yml`** — chạy mọi push + PR:
- `supabase start` ephemeral local stack
- `supabase db reset` apply mọi migration
- `gen types` + diff check `database.types.ts` (chống drift)
- `npm run build` (tsc + vite)
- `npm run test:rls` — full integration suite (queries/* + rls/*)

**`.github/workflows/deploy.yml`** — chained sau test:
- Trigger: `on.workflow_run: workflows: [test]: types: [completed]: branches: [main]`
- Gate cứng: `if: github.event.workflow_run.conclusion == 'success'` — test fail → deploy skip
- `workflow_dispatch` bypass gate (manual re-deploy không cần code change)
- 3 jobs sequential:
  1. **verify**: pure unit tests (`src/test/lib/`) + vite build với placeholder env
  2. **supabase**: `supabase link` → `db push` (migration) → loop `supabase functions deploy <name>` cho mọi function trong `supabase/functions/*/`
  3. **netlify**: `npm ci` → `npm run build` với real env → `nwtgck/actions-netlify` publish `dist/`

Concurrency: group `deploy-prod`, `cancel-in-progress: false` — deploy đang chạy không bị giết giữa chừng.

Backend (supabase) gate frontend (netlify) → user không hit SPA mới khi schema chưa migrate.

### 27.3 Secrets (GitHub Settings → Secrets → Actions)

| Secret | Nguồn | Ghi chú |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | Supabase Account → Access Tokens | personal token `sbp_*` |
| `SUPABASE_PROJECT_REF` | `<ref>` của `<ref>.supabase.co` | |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database | dùng cho `db push` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API | OPTIONAL — cloud edge function tự inject |
| `NETLIFY_AUTH_TOKEN` | Netlify User → Applications | `nfp_*` |
| `NETLIFY_SITE_ID` | Netlify Site → Site information | UUID |
| `VITE_SUPABASE_URL` | Project URL | baked vào SPA bundle |
| `VITE_SUPABASE_ANON_KEY` | Project API → publishable key | safe to be public |

Helper: `scripts/setup-deploy-secrets.sh` đọc `.env.deploy` (gitignored), gọi `gh secret set -f` push một phát. Template ở `.env.deploy.example`.

### 27.4 `netlify.toml` (root)

- `[build]` command = `npm run build`, publish = `dist`
- SPA fallback: `/* → /index.html status=200` — deep link hard-refresh không 404
- Cache headers:
  - `/assets/*`, `/fonts/*` — `max-age=31536000, immutable` (hashed bundles)
  - `/icons/*` — `max-age=604800`
  - `/sw.js` — `max-age=0, must-revalidate` (SW phải re-fetch để rollout version mới)
  - `/manifest.webmanifest` — content-type + 1-day cache

### 27.5 Post-deploy one-time setup

Sau deploy đầu tiên, chạy 1 lần trong Supabase Dashboard:

**A. GUC cho `notify-events` cron** (Dashboard → SQL Editor):
```sql
alter database postgres set app.notify_events_url =
  'https://<ref>.supabase.co/functions/v1/notify-events';
alter database postgres set app.notify_events_token = '<random-token>';
```

**B. Edge function env** (Dashboard → Edge Functions → notify-events → Settings):
- `CRON_TOKEN` = cùng giá trị với `app.notify_events_token` ở A
- `RESEND_API_KEY` = nếu muốn gửi email thực; bỏ trống → function dry-run (vẫn ghi notification_log).

**C. Auth Site URL** (Dashboard → Authentication → URL Configuration):
- Site URL: production URL Netlify
- Redirect URLs: production URL + `http://localhost:5173/**` (dev)
- Nếu bỏ qua → confirmation email + magic link trỏ về `localhost:3000`, click vào dead.

**D. Email templates** (Dashboard → Authentication → Email Templates):
Paste 6 template HTML từ `supabase/email-templates/*.html` (tiếng Việt, palette oxblood + bronze + paper khớp app).

**E. Netlify Auto Build** (Netlify Dashboard → Site → Build & deploy → Continuous deployment → Stop builds):
Disable Netlify's own Git deploy vì GitHub Actions pipeline đã quản — tránh double-deploy.

### 27.6 Edge function import strategy

Edge function chạy Deno runtime. Lần deploy đầu fail vì `https://esm.sh/...` 522 (CDN overload). Đổi sang `jsr:@supabase/supabase-js@2` (Deno-native registry) ổn định hơn. NPM-only packages dùng `npm:` specifier (vd `npm:@dqcai/vn-lunar@1.0.1`).

### 27.7 Email branding

`supabase/email-templates/` chứa 6 file HTML (confirm-signup, magic-link, reset-password, change-email, invite, reauth). Layout: card 560px nền trắng, top accent strip 3px bronze `#B8862A`, wordmark "GIA PHẢ" uppercase tracked bronze, h1 oxblood Noto Serif, CTA button oxblood/cream. Inline styles (Gmail/Outlook strip `<style>` block). README ở cùng folder giải thích cách paste vào Dashboard.

### 27.8 MCP server (developer ergonomics)

`.mcp.json` ở repo root config Model Context Protocol server `@supabase/mcp-server-supabase` chạy ở chế độ `--read-only`. Đọc `SUPABASE_ACCESS_TOKEN` + `SUPABASE_PROJECT_REF` từ env của user. Agent (Claude Code, etc.) có thể list schema, execute SELECT, get function logs trực tiếp mà không cần psql/dashboard.

---

## 28. Liên kết thông gia giữa các dòng họ (cross-clan in-law links)

Trạng thái: **chưa làm**, kế hoạch (2026-06-06). Xếp **Phase 2** (sau share-link) vì dùng cùng pattern `SECURITY DEFINER` + mô hình đồng thuận admin.

### 28.1 Bối cảnh & nguyên tắc cốt lõi

Khi hai dòng họ (clan) cùng dùng nền tảng và có quan hệ dâu/rể, người dùng muốn "nối" hai cây để thấy mối liên hệ. Nhưng toàn bộ app dựa trên việc **mỗi clan bị cô lập tuyệt đối bằng RLS**. Vì vậy nguyên tắc số một, không được vi phạm:

> **KHÔNG bao giờ để cấu trúc cây của một clan phụ thuộc vào dữ liệu của clan khác.**

Hệ quả của nguyên tắc này:
- **Cấm foreign key chéo clan** trong `persons` / `families`. Nếu record ở clan A trỏ thẳng (FK cấu trúc) sang record clan B, thì khi clan B chuyển private / bị xoá / người dùng không có quyền → RLS trả null → cây render lỗi. Hoặc buộc phải nới RLS → lộ dữ liệu riêng tư. Cả hai đều là lỗi nghiêm trọng.
- **Liên kết hai họ là một LỚP CHÚ THÍCH có đồng thuận, nằm TRÊN hai cây độc lập** — không phải một thành phần cấu trúc của cây nào.
- `family-chart` luôn chỉ nhận dữ liệu của **đúng một clan**. Không bao giờ kéo subtree của clan khác vào (giữ luôn được giới hạn hiệu năng ~7.000 người/cây).

### 28.2 Mô hình 3 lớp

**Lớp 1 — Mỗi clan tự chứa dâu/rể của mình (không FK chéo).**
Trong họ Nguyễn, cô dâu vốn thuộc họ Trần vẫn là một `person` **cục bộ** của clan Nguyễn (đánh dấu là dâu, `generation` tính theo hệ quy chiếu họ Nguyễn). Trong họ Trần, cô ấy là một record đầy đủ riêng. Hai dòng dữ liệu **độc lập hoàn toàn**; mỗi cây render đúng kể cả khi clan kia biến mất.

**Lớp 2 — Quan hệ "cùng một người" để ở bảng cầu nối riêng `person_links`.**
Đây chỉ là **metadata** nói "person cục bộ X ở clan A chính là person Y ở clan B", tách hẳn khỏi `persons`/`families`. Gỡ link → cả hai cây vẫn nguyên vẹn.

**Lớp 3 — Liên kết phải được admin CẢ HAI clan đồng ý; chỉ hé dữ liệu tối thiểu qua một cửa `SECURITY DEFINER`.**
Link ở trạng thái `pending` cho tới khi admin bên kia `confirmed`. Khi đã confirmed, **không nới RLS** — dùng đúng pattern như `share-view`: một RPC `SECURITY DEFINER` kiểm tra link rồi trả về một projection tối thiểu, đã làm sạch (đã áp quy tắc ẩn người còn sống của clan đích).

### 28.3 Schema — bảng `person_links`

Yêu cầu trước: `persons` cần có `unique (id, clan_id)` để dùng composite FK đảm bảo person thuộc đúng clan.

```sql
-- đảm bảo person_a thực sự thuộc clan_a, person_b thuộc clan_b (qua composite FK)
alter table persons add constraint persons_id_clan_uniq unique (id, clan_id);

create table person_links (
  id            uuid primary key default gen_random_uuid(),
  link_type     text not null default 'same_person'
                  check (link_type in ('same_person')),  -- mở rộng sau nếu cần
  status        text not null default 'pending'
                  check (status in ('pending','confirmed','revoked')),

  -- bên A là bên KHỞI TẠO (admin clan A bấm "đề nghị nối")
  clan_a_id     uuid not null,
  person_a_id   uuid not null,
  -- bên B là bên XÁC NHẬN (admin clan B duyệt)
  clan_b_id     uuid not null,
  person_b_id   uuid not null,

  created_by    uuid not null references auth.users(id),
  confirmed_by  uuid references auth.users(id),
  note          text,

  created_at    timestamptz not null default now(),
  confirmed_at  timestamptz,
  revoked_at    timestamptz,

  -- person phải thuộc đúng clan của nó (chốt ở DB, không tin frontend)
  foreign key (person_a_id, clan_a_id) references persons(id, clan_id) on delete cascade,
  foreign key (person_b_id, clan_b_id) references persons(id, clan_id) on delete cascade,

  constraint different_clans  check (clan_a_id <> clan_b_id),
  constraint different_person check (person_a_id <> person_b_id)
);

-- chống trùng: cùng một cặp người không tạo link 2 lần (bất kể chiều A/B)
create unique index person_links_pair_uniq
  on person_links (least(person_a_id, person_b_id), greatest(person_a_id, person_b_id))
  where status <> 'revoked';

create index person_links_a_idx on person_links (clan_a_id, person_a_id);
create index person_links_b_idx on person_links (clan_b_id, person_b_id);
```

### 28.4 RLS cho `person_links`

Dùng các helper đã có (`is_clan_member(clan_id)`, `is_clan_admin(clan_id)`). Quy tắc:

```sql
alter table person_links enable row level security;

-- ĐỌC: thành viên của BẤT KỲ bên nào cũng thấy được dòng link
--      (chỉ thấy metadata link, KHÔNG phải dữ liệu person bên kia)
create policy plinks_select on person_links for select
  using ( is_clan_member(clan_a_id) or is_clan_member(clan_b_id) );

-- TẠO: chỉ admin của clan_a (bên khởi tạo) mới đề nghị nối
create policy plinks_insert on person_links for insert
  with check ( is_clan_admin(clan_a_id) and status = 'pending' and created_by = auth.uid() );

-- XÁC NHẬN: chỉ admin clan_b mới chuyển pending -> confirmed
--           (kiểm tra giá trị cũ/mới làm chặt thêm bằng trigger, xem 28.5)
create policy plinks_confirm on person_links for update
  using ( is_clan_admin(clan_b_id) or is_clan_admin(clan_a_id) )
  with check ( is_clan_admin(clan_b_id) or is_clan_admin(clan_a_id) );
```

> **Quan trọng:** RLS cho phép admin hai bên *thấy và sửa dòng link*, nhưng **tuyệt đối không** cho họ đọc bảng `persons` của clan kia. Việc lấy dữ liệu person bên kia chỉ qua RPC ở 28.6.

### 28.5 Trigger bảo vệ chuyển trạng thái

RLS không diễn đạt tốt logic "ai được đổi field nào". Thêm `BEFORE UPDATE` trigger:

- `pending -> confirmed`: chỉ khi `is_clan_admin(clan_b_id)`; tự set `confirmed_by = auth.uid()`, `confirmed_at = now()`.
- `-> revoked`: admin **một trong hai** clan được thu hồi; set `revoked_at = now()`.
- Cấm sửa `clan_*_id` / `person_*_id` sau khi tạo (nối nhầm thì revoke rồi tạo mới).
- Cấm tự confirm chính link mình tạo nếu mình không phải admin clan_b (chống admin một họ tự nối lén sang họ khác).

### 28.6 RPC hé dữ liệu tối thiểu (`SECURITY DEFINER`)

Đây là "cửa duy nhất" để một bên nhìn người bên kia, theo đúng pattern `share-view`.

```sql
create or replace function get_link_peek(p_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  l person_links;
  other_clan uuid;
  other_person uuid;
  rec persons;
  hide_living boolean;
begin
  select * into l from person_links
   where id = p_link_id and status = 'confirmed';
  if not found then
    raise exception 'link not found or not confirmed';
  end if;

  -- caller phải là thành viên của MỘT trong hai bên
  if is_clan_member(l.clan_a_id) then
    other_clan := l.clan_b_id; other_person := l.person_b_id;
  elsif is_clan_member(l.clan_b_id) then
    other_clan := l.clan_a_id; other_person := l.person_a_id;
  else
    raise exception 'not authorized';
  end if;

  select * into rec from persons where id = other_person and clan_id = other_clan;
  -- person bên kia có thể đã soft-delete; coi như không tồn tại.
  if rec.id is null or rec.deleted_at is not null then
    raise exception 'peer person no longer available';
  end if;

  -- áp quy tắc ẩn người còn sống của CLAN ĐÍCH nếu caller KHÔNG là member clan đó
  select c.hide_living_for_nonmembers into hide_living from clans c where c.id = other_clan;
  if rec.is_living and hide_living and not is_clan_member(other_clan) then
    return jsonb_build_object(
      'masked', true,
      'clan_id', other_clan,
      'person_id', other_person,
      'is_living', true
    );
  end if;

  -- projection TỐI THIỂU, đã làm sạch (không trả ghi chú nhạy cảm, quan hệ, v.v.)
  return jsonb_build_object(
    'masked', false,
    'clan_id', other_clan,
    'person_id', other_person,
    'full_name', rec.full_name,
    'generation', rec.generation,          -- theo hệ quy chiếu CLAN ĐÍCH
    'birth_year', extract(year from rec.birth_date),
    'death_year', extract(year from rec.death_date),
    'is_living', rec.is_living
  );
end;
$$;
```

> Hàm chạy với quyền owner nên vượt RLS *một cách có kiểm soát*: nó **tự** kiểm tra tư cách caller + trạng thái link + quy tắc ẩn, rồi chỉ trả về đúng vài trường an toàn. Không có đường nào khác để clan A đọc `persons` của clan B.

### 28.7 Trải nghiệm người dùng

- Trên card person trong cây, nếu có link confirmed → hiện **badge nhỏ** "↔ thuộc họ Trần".
- Bấm badge:
  - Nếu caller **cũng là thành viên clan đích** → **deep-link** sang đúng người đó trong cây clan đích (`/clan/:id/person/:pid`).
  - Nếu không → mở một **thẻ tối thiểu** từ `get_link_peek` (tên, đời, năm sinh/mất theo gốc clan kia). Nếu `masked = true` → chỉ hiển thị "Người còn sống — họ X chưa công khai".
- Luồng tạo link (admin clan A): tìm clan đích → tìm person đích (qua tìm kiếm công khai có giới hạn, hoặc dán mã/đường link person) → gửi đề nghị → clan B nhận thông báo → admin clan B duyệt/từ chối.

### 28.8 Quy tắc bắt buộc (chống phá app)

- **KHÔNG đồng bộ `generation` giữa hai họ.** Đời là hệ quy chiếu riêng từng clan (cùng một người: đời 5 bên Nguyễn, đời 8 bên Trần). Mỗi bên hiển thị theo gốc của mình, không hoà giải.
- **KHÔNG auto-merge.** Link `same_person` chỉ chú thích, tuyệt đối không gộp record (quyền sở hữu/chỉnh sửa sẽ rối ngay).
- **Máy tính xưng hô (#2) giữ trong phạm vi MỘT clan.** Quan hệ xuyên họ không làm ở MVP.
- **Trang public / share-link không bao giờ rò dữ liệu clan kia qua link.** Badge trên trang công khai chỉ dẫn tới đúng những gì clan kia *tự* công khai; nếu clan kia private → badge không hiển thị gì có thể truy ra dữ liệu.
- **Trường hợp phổ biến nhất vẫn đơn giản:** nhà thông gia *chưa* dùng app → không có link nào, chỉ là record dâu/rể cục bộ bình thường. Tính năng link chỉ kích hoạt khi **cả hai clan đều ở trên nền tảng**.

### 28.9 Test (bổ sung vào mục test tự động)

Đây là tính năng động tới bảo mật, **phải có test RLS riêng**:
- Admin clan A tạo được link `pending`; **member thường** clan A thì không.
- Chỉ admin clan B confirm được; admin A confirm hộ → bị chặn.
- Link `pending` → `get_link_peek` trả lỗi (chưa hé gì).
- Link confirmed: member clan A đọc được projection tối thiểu của person clan B; **không** đọc được trực tiếp bảng `persons` clan B.
- Người còn sống ở clan B (hide_living = true) → caller ngoài clan B chỉ nhận `masked`.
- Người **không thuộc cả hai clan** gọi `get_link_peek` → bị chặn.
- Revoke link → peek trả lỗi; cả hai cây vẫn render bình thường.

### 28.10 Lộ trình & ngoài phạm vi

- **Phase:** xếp **Phase 2** (sau share-link, vì tái dùng pattern `SECURITY DEFINER` và mô hình đồng thuận admin). Không phải tính năng MVP.
- **Ngoài phạm vi v1 của tính năng này:** liên kết kiểu khác ngoài `same_person` (vd. "cùng tổ tiên xa"); tính quan hệ họ hàng xuyên clan; hiển thị gộp hai cây trên cùng một màn hình; tự động phát hiện trùng người giữa hai họ để gợi ý nối (làm sau khi có nhiều clan dữ liệu thật).

### 28.11 Bổ sung sau review

Các điểm chốt thêm khi triển khai — không phá kiến trúc, chỉ điền chỗ trống:

**A. Discovery — admin A tìm person bên B thế nào?**
28.7 nói chung chung "tìm clan đích → tìm person đích". Cụ thể, hỗ trợ **hai cách song song**, admin A chọn mode khi tạo proposal:

1. **Public discovery** (nếu clan B `visibility=public`): A search clan trong tab "Cộng đồng" → mở danh bạ clan B (đã ẩn người sống) → chọn person → gửi đề nghị. Backend snapshot `clan_b_id`, `person_b_id` vào row pending. Admin B nhận notification, duyệt.
2. **Token invite** (cho cả khi clan B `private`): A tạo proposal **chưa chốt person bên kia** — bảng tạm có thêm cột `invite_token text unique` + bỏ NOT NULL cho `clan_b_id`/`person_b_id` ở giai đoạn pending-by-token. A share token qua kênh ngoài app (Zalo, email). B paste token vào trang `/inlaws/confirm/:token` → resolve qua Edge function (không cần auth ở bước resolve, chỉ trả `note` + tên A) → B chọn person của mình → submit → row fill đủ field + status='confirmed' (vẫn đi qua trigger 28.5 để ép admin clan_b mới được confirm).

   Schema vẫn giữ NOT NULL cho 2 field này ở `confirmed`/`revoked` (ép qua CHECK conditional, hoặc 2 row lifecycle riêng). Cụ thể migration sẽ chốt khi code.

**B. Notify admin B**
Khi link `pending` tạo, gửi email cho tất cả admin clan_b qua **`notify-events` Edge function pattern** đã có + `notification_log` để idempotent. Bonus: badge "(N) liên kết chờ" trong drawer giống "Đóng góp" — query `count(*)` từ `person_links where clan_b_id IN (clans tôi admin) and status='pending'`, cache 30s.

**C. Audit**
Trigger giống `persons`/`families`/`branches`: `after insert/update/delete on person_links` ghi `audit_log` với `entity_type='person_link'`, `before`/`after` jsonb. Tận dụng UI nhật ký hiện hữu — chỉ cần extend `ENTITY_LABEL` ở `src/pages/clan/Audit.tsx`.

**D. Soft-delete tương tác**
Đã chốt trong `get_link_peek` ở 28.6 (kiểm `deleted_at is null`, raise nếu peer mất). Khi person được restore qua audit → link tự "sống lại" (FK còn nguyên, peek lại trả data).

**E. Cascade khi clan/person bị xoá hẳn**
FK `on delete cascade` đã xử mức DB. UX bên kia: khi list links thấy row vẫn ở đó (nếu cascade chưa kích hoạt) nhưng peek raise → render "Bên kia đã xoá dữ liệu". Test phải cover trường hợp clan B hard-delete (xảy ra khi xoá clan toàn diện).

**F. Test bổ sung (vào 28.9)**
- **Admin A revoke khi đã confirmed**: link biến mất ở cả hai bên; B nhận notify "đã thu hồi liên kết" (qua kênh tương tự).
- **Notify idempotent**: gửi email nhiều lần cho cùng proposal không tạo log trùng.
- **Token mode** (nếu implement): B paste token rồi paste lại lần 2 sau khi confirm → endpoint trả "đã sử dụng".
- **Hard-delete person**: link cascade-cleanup; cây mỗi bên render bình thường.

**G. Route name**
- `/clans/:id/inlaws` — list link của clan (cả pending + confirmed, có tab)
- `/clans/:id/inlaws/new` — đề nghị nối (chọn mode discovery vs token)
- `/inlaws/confirm/:token` — public route confirm qua token (mode 2)
- Notification email cho mode 1 trỏ thẳng vào `/clans/:b/inlaws?pending=:linkId` để B mở danh sách → review từng row.

### 28.12 Trạng thái triển khai

**Phase 1 backend + UI**: ✅ (2026-06-06).

Migration: `20260606200218_inlaw_links.sql` — composite UNIQUE
`persons(id, clan_id)`, bảng `person_links`, RLS, trigger
`protect_person_link_transitions`, RPC `get_link_peek` /
`resolve_link_token` / `confirm_link_by_token`, realtime publication.

Queries lib: `src/lib/queries/person-links.ts` — list / propose /
confirm / revoke / peek + types.

Pages:
- `/clans/:id/inlaws` — tabs Đã liên kết / Đang chờ, copy invite,
  revoke, cancel.
- `/clans/:id/inlaws/new` — 3-step propose (pick person → details →
  show token URL).
- `/inlaws/confirm/:token` — public preview (anon-callable
  `resolve_link_token`), login redirect, pick clan + person + confirm.

PersonDetail Card `Liên kết thông gia` qua `get_link_peek` cho mỗi
confirmed link liên quan tới person hiện hành (masked / unmasked).

Drawer item dưới "Quản trị". Route registered ở `App.tsx`. Help map
chừa slot doc article (chưa viết).

**Đã bổ sung sau MVP**:
- ✅ RLS test suite (16 cases ở `src/test/rls/inlaws.test.ts`) — phát hiện + fix bug `is_clan_admin`/`can_edit_clan` trả NULL (migration `20260606204646`).
- ✅ Audit trigger (migration `20260606205259`) — mỗi propose/confirm/revoke ghi 1 row vào `audit_log` dưới `clan_a_id`. `entity_type='person_link'`. Restore qua `restore_audit_entry` intentionally skip (trigger chặn rollback to pending).
- ✅ Email notify (Edge function `notify-inlaw`) — fire-and-forget từ client sau `confirmByToken` và `revokeLink`. Dispatch theo status: confirmed → email admin clan A (proposer); revoked → email admin cả 2 bên. Token mode chưa có clan B lúc propose → bỏ pending notify (chờ public-discovery).

**Performance hardening (2026-06-07)**:
- ✅ Fixed silent truncation bug: PostgREST `max_rows = 1000` (config.toml + Supabase Cloud default) silently truncate ed `getTreeData`, `getClanBookData`, `getRelativesIndex` cho clan > 1000 person. Thêm `.range(0, 9999)` defensive — covers plan §5 ceiling 7000/clan với headroom.
- ✅ Benchmark `toFamilyChart` với 5000 person dataset — chạy < 100ms (locally ~10ms). Adapter là O(P + F), không có loop bậc 2.
- ✅ Seed opt-in `BIG_CLAN_SIZE=5000 npm run seed` để manual test render full tree.

**Phase 1 còn thiếu**: (none — Phase 1 đã đủ)

**Public-discovery mode (§28.11.A) — đã làm 2026-06-06**:
- `proposeLinkDirect(clanA, personA, clanB, personB, note)` — INSERT pending với cả 2 sides set, không có invite_token.
- `acceptLinkDirect(linkId)` — admin B UPDATE status='confirmed', trigger stamps confirmed_by/at (không cần token-based RPC).
- RPC `get_inlaw_proposal_preview(link_id)` (SECURITY DEFINER) — admin B peek qua RLS để xem clan A name + person A name + year (private clan A vẫn lộ minimal).
- `InlawsNew` thêm tab "Tìm dòng họ công khai": search `listCommunityClans` → pick → search `persons_public_safe` → pick → confirm.
- `Inlaws` "Đang chờ" split: section "Đề nghị đến với bạn" (incoming, admin B clan thấy với nút Xác nhận/Từ chối) + section "Đề nghị tôi đã gửi" (outgoing).
- `notify-inlaw` thêm branch `status='pending' AND clan_b_id IS NOT NULL` → email admin clan B kèm gợi ý + ghi chú + link `/clans/<b>/inlaws`.
- Seed fixtures: 2 direct-mode pending để smoke test.

**Phase 3 đã làm (2026-06-06)**:
- ✅ RPC `get_inlaw_peer_relatives(link_id)` — SECURITY DEFINER, trả peer person + parents + spouses + children dạng card. Áp dụng `hide_living_for_nonmembers` per relative; mỗi card có `masked` flag + `caller_can_visit` (cho biết link Xem có resolve được không).
- ✅ Shared component `InlawFamilyCard` — render peer family (focal nổi bật + 3 group cha mẹ/vợ chồng/con). Mỗi row: avatar + tên + meta line; masked rows hiển thị "Người còn sống".
- ✅ Tree's `↔` badge dialog: thay simple peek list bằng `InlawFamilyCard` (multi-link stack với separator). Click badge → thấy ngay gia đình bên đó (cha mẹ / vợ chồng / con).
- ✅ PersonDetail's link card thêm nút "Gia đình bên đó" → expand inline với `InlawFamilyCard`.
- ✅ Visual mini-tree (`InlawMiniTree`) — toggle list ↔ tree trong `InlawFamilyCard` header (icon List / Grid). Tree mode dùng family-chart instance riêng, render parents → peer (oxblood border) → spouses + children.
- ✅ Multi-spouse topology fix (migration `20260606221033`): RPC `get_inlaw_peer_relatives` giờ trả mỗi child kèm `other_parent_id` (peer's spouse cho child đó). `InlawMiniTree` anchor mỗi child vào đúng (peer, that-spouse) pair → polygamy/remarriage hiển thị đúng nhánh thay vì gộp tất cả về spouse đầu tiên.

**Phase 2 đã làm**:
- ✅ Tree ghost badge: card person có link confirmed hiện "↔" chip oxblood/bronze ở góc phải. Click → popup nhẹ trên cây với peek info (cùng pattern qua `get_link_peek` → masking nhất quán). Không cần rời cây. `linkedIdsRef` để chart không phải rebuild khi link thay đổi.
- ✅ Drawer badge "(N) chờ" trên mục **Liên kết thông gia** — query `countPendingPersonLinks(clanId)` đếm pending where (clan_a OR clan_b) = current, cache 30s. Hôm nay (token mode) chỉ match clan_a → proposer thấy nhắc về invite mình đã gửi. Khi public-discovery lands, clan_b_id được set → admin B tự thấy "(N)" mà không phải sửa wiring.
- ✅ GEDCOM `_INLAW` export: mỗi confirmed link emit 1 sub-block `_INLAW { _CLAN, _PERSON, _SEX, _BIRTH_YEAR, _DEATH_YEAR }` dưới INDI của local person. Masked peer (clan đối tác hide living) → `_PERSON "(người còn sống, chưa công khai)"`. Parse round-trip: `ParsedIndi.inlaws[]` được expose nhưng **import KHÔNG tự recreate** `person_links` (peer clan có thể không tồn tại ở DB đích; peer person chỉ là string) — preserve thông tin để human-read, admin tự re-propose qua UI nếu cần.

**Phase 2** (chưa làm): tree ghost spouse, GEDCOM `_INLAW`.

## 29. Web Push (VAPID, không Firebase) — nhắc giỗ/sinh nhật ngay trên thiết bị

Trạng thái: **chưa làm**, kế hoạch (2026-06-07). Xếp sau Phase 3 contributions vì tái dùng cron + lunar engine có sẵn.

### 29.1 Bối cảnh & nguyên tắc cốt lõi

App đã có 3 lớp nhắc:
1. **Trang Hôm nay** — luôn chạy, không cần quyền.
2. **Email reminder** qua `notify-events` Edge Function + pg_cron (giỗ/sinh nhật + mùng 1/rằm).
3. **Xuất `.ics`** từ trang Sự kiện sang Google/Apple Calendar.

Web Push là **lớp phụ thứ 4**, không thay thế 3 lớp trên. Người dùng app phần nhiều **lớn tuổi + ở quê + iOS hạn chế** — tỉ lệ bật push thành công sẽ thấp. App phải vẫn hữu ích khi không có push.

Nguyên tắc:
- **Dùng Web Push API + VAPID chuẩn mở — KHÔNG Firebase/FCM.** Không tạo project Firebase, không nhúng SDK, không khoá nhà cung cấp. Trình duyệt tự routing qua endpoint (Google push service / Mozilla / APNs). Code phía gửi y hệt nhau qua lib `web-push`.
- **Push là LỚP PHỤ.** App đã hữu ích không có push. Người dùng từ chối quyền → đẩy sang phương án `.ics` đã có.
- **Mọi việc gửi đặt ở backend.** Frontend chỉ đăng ký subscription + hiển thị banner pre-prompt. Edge Function ký + gửi.

### 29.2 Tái dùng infrastructure đã có (KHÔNG viết song song)

Web Push **mở rộng** stack thông báo hiện có, không tạo ra stack thứ hai. Cụ thể:

| Đã có | Web Push tái dùng | KHÔNG tạo mới |
|---|---|---|
| `notify-events` Edge Function | Mở rộng để gửi push + email cùng lúc | ❌ `send-reminders` riêng |
| `event_subscriptions` (per-user/clan/branch/person opt-in) | Dùng nguyên — opt-in dùng chung cho cả email lẫn push | ❌ `notification_prefs` riêng |
| `notification_log` UNIQUE `(user_id, event_key, channel)` | Thêm row `channel='webpush'` để idempotent | ❌ tracking trên `push_subscriptions` |
| `profiles.notify_monthly_lunar` toggle | Thêm `profiles.notify_via_push` toggle cùng pattern | ❌ |
| pg_cron `notify-events-daily` 00:05 UTC | Reuse — push gửi cùng lúc với email | ❌ cron riêng |
| Lunar engine `@dqcai/vn-lunar` | Reuse | ❌ |

### 29.3 Schema mới

```sql
-- 1 user có thể có nhiều thiết bị/trình duyệt → nhiều subscription
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failure_count   int not null default 0
);
create index push_subs_user_idx on push_subscriptions (user_id);

-- Toggle "nhận push" toàn cục, theo pattern notify_monthly_lunar đã có
alter table profiles
  add column notify_via_push boolean not null default false;
```

**KHÔNG** tạo `notification_prefs` riêng. Opt-in chi tiết "nhắc event nào" tái dùng `event_subscriptions` đã ship.

### 29.4 RLS

```sql
alter table push_subscriptions enable row level security;
create policy psub_owner on push_subscriptions
  for all using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

Edge Function `notify-events` đọc bảng này bằng service_role (vượt RLS, server-side).

### 29.5 Khoá VAPID & env

Sinh 1 lần bằng `npx web-push generate-vapid-keys`:
- `VITE_VAPID_PUBLIC_KEY` — public, nhúng frontend. An toàn để lộ.
- `VAPID_PRIVATE_KEY` — secret của Edge Function `notify-events`. KHÔNG commit, KHÔNG frontend.
- `VAPID_SUBJECT` — `mailto:thaohk@vnvc.vn` (yêu cầu giao thức).

Set qua `npx supabase secrets set` cho Edge Function (giống `RESEND_API_KEY`, `CRON_TOKEN`).

### 29.6 Service Worker (mở rộng SW có sẵn)

`vite-plugin-pwa` đã sinh SW. Thêm handler `push` + `notificationclick` trong custom SW file:

```ts
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Gia phả', {
      body: data.body,
      icon: '/icon-192.png',
      badge: '/badge.png',
      data: { url: data.url ?? '/' },
      tag: data.tag,           // event_key để gộp nhắc trùng cross-device
      requireInteraction: true // giỗ — giữ thông báo cho tới khi user tap
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
```

### 29.7 Luồng xin quyền (cẩn thận với người lớn tuổi)

- **KHÔNG** `Notification.requestPermission()` ngay khi mở app. Bị từ chối 1 lần thì rất khó xin lại.
- Chỉ xin quyền **sau khi user chủ động bật** toggle "Nhắc tôi qua thông báo" trong `/account`.
- Trước khi gọi prompt hệ thống, hiện **pre-prompt banner** giải thích vì sao cần. User đồng ý → mới gọi API thật.
- User từ chối → hiện hướng dẫn nhẹ + **đề xuất ngay `.ics`** làm thay thế (link trực tiếp tới nút Xuất lịch ở /events).

### 29.8 Hook + UI

- `usePushSubscription()` — hook khôi phục/tạo subscription, lưu vào `push_subscriptions`. Idempotent: cùng endpoint không tạo row thứ hai (dùng `upsert` on `endpoint`).
- Card mới trong `/account`: toggle `notify_via_push` + nút "Thử gửi push test" (gọi Edge Function `send-test-push`).
- **Permission revocation drift fix**: trên app boot, check `Notification.permission`. Nếu `denied` nhưng còn sub trong DB → xoá sub. Tránh case "user tắt notification trong browser settings, app không biết, push gửi đi nhưng không hiện".

### 29.9 Mở rộng `notify-events` Edge Function

Pseudocode bổ sung (sau bước email dispatch):

```ts
import webpush from 'npm:web-push@^3';  // ưu tiên npm: specifier trên Deno
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// Với mỗi (user_id, event_key) đã được chọn để nhắc:
//   1. Check profiles.notify_via_push = true → nếu false, bỏ qua push
//   2. Reserve notification_log row với channel='webpush' (ON CONFLICT DO NOTHING)
//      → nếu đã có row, skip (đã gửi rồi)
//   3. Fetch all push_subscriptions của user (nhiều thiết bị)
//   4. Promise.allSettled chunks of 50 → webpush.sendNotification
//      payload = { title, body (1 dòng), url (deep-link), tag (event_key) }
//   5. Xử lý lỗi (29.10)
```

Payload web push **bị giới hạn ~4KB** và **mã hoá đầu-cuối**. Chỉ gửi tối thiểu (title + 1 dòng + URL). KHÔNG nhét dữ liệu nhạy cảm. Áp đúng quy tắc ẩn người còn sống: nội dung không lộ thông tin người nhận không được phép thấy.

### 29.10 Dọn subscription chết

- HTTP **404** hoặc **410 Gone** → subscription hết hạn → **xoá** khỏi `push_subscriptions`.
- Lỗi khác (network, 5xx) → tăng `failure_count`. Quá 5 → xoá.
- Thành công → cập nhật `last_success_at`, reset `failure_count = 0`.

### 29.11 iOS — rào cản thật, cần UX hướng dẫn rõ

- iOS hỗ trợ web push **chỉ từ 16.4 trở lên** VÀ **bắt buộc Add to Home Screen** (mở từ icon, không phải Safari).
- Detect qua feature-detect (KHÔNG UA sniff):
  ```ts
  const supportsPush = 'PushManager' in window && 'Notification' in window;
  const isStandalone = 'standalone' in navigator
    && (navigator as any).standalone === true;
  ```
- Nếu iOS + chưa standalone → hiện banner "Để nhận thông báo, cần Thêm Gia phả vào màn hình chính" + link doc bước add-to-home.
- Nếu iOS quá cũ (< 16.4) → ẩn toggle push, hiện text "Thiết bị iOS này chưa hỗ trợ — dùng .ics".

### 29.12 Concurrency khi fan-out

Với 1000 subscription, `await sendNotification(...)` tuần tự = phút. Bắt buộc:
```ts
const CHUNK = 50;
for (let i = 0; i < subs.length; i += CHUNK) {
  await Promise.allSettled(
    subs.slice(i, i + CHUNK).map(s => webpush.sendNotification(s, payload))
  );
}
```

### 29.13 Test (bổ sung)

- Đăng ký subscription → INSERT đúng row, RLS chặn user khác đọc.
- `notify_via_push = false` → skip push hoàn toàn (chỉ email).
- `notification_log` reserve-then-commit: cron chạy 2 lần liên tiếp → push gửi 1 lần.
- 410 Gone → subscription bị xoá; lần gửi sau không nhắm tới endpoint đã chết.
- Payload **không** chứa tên người còn sống bị ẩn (test với `hide_living_for_nonmembers=true`).
- `Notification.permission = 'denied'` + sub còn tồn tại → app boot xoá sub.
- iOS detect (mock) feature-detect: PushManager missing → toggle bị ẩn.
- Concurrency: 100 subscription, 1 sub fail → 99 cái còn lại vẫn gửi (allSettled).

### 29.14 Lộ trình triển khai

Một migration + extend notify-events + 1 hook + 1 Account card + SW handler + RLS test.

1. **Migration `push_subscriptions` + `profiles.notify_via_push`.**
2. **Sinh VAPID keys + set secrets prod.**
3. **SW handler push + notificationclick.**
4. **Hook `usePushSubscription` + `/account` toggle + pre-prompt banner.**
5. **Mở rộng `notify-events`** dispatch push song song email.
6. **Permission revocation drift fix.**
7. **iOS A2HS banner + doc article hướng dẫn.**
8. **RLS test + integration test.**

### 29.15 Ngoài phạm vi v1 (đề xuất Phase sau)

#### A. Push 2-chiều — trả lời thẳng từ notification

**Bài toán**: hiện push chỉ là **1-chiều** — user mở app → vào trang
liên quan → tương tác. Push 2-chiều cho phép user **xử lý ngay
trên notification** mà không cần mở app, tận dụng Web Notifications
API `actions` (Android) và iOS 16.4+ action buttons.

**Use cases cụ thể**:
- Notification "Có đề xuất sửa cho ông Nguyễn Văn A" → 2 nút **Duyệt** /
  **Xem chi tiết**. Bấm "Duyệt" → service worker gọi `apply_contribution`
  RPC luôn, không cần mở app.
- Notification "Lời mời thông gia từ Họ Nguyễn" → nút **Xác nhận** /
  **Từ chối** → SW gọi `confirm_link_by_token` / `revoke`.
- Notification "Hôm nay là rằm — đã thắp hương chưa?" → nút **Đã thắp**
  / **Nhắc sau 2h** → SW log + reschedule.

**Schema bổ sung**:
- `notifications` table giữ payload đầy đủ (id, user_id, kind, target_id,
  actions, created_at) — push payload bị giới hạn ~4KB nên không thể
  nhét đủ context.
- SW khi nhận push → `notifications` row id → đọc bằng service-role RPC
  để hiển thị actions tuỳ context.
- Action click → SW fetch chính phải tới Edge Function `push-action`
  (verify_jwt=true) → function dispatch theo `action_id` (approve_contrib,
  reject_contrib, confirm_inlaw, etc.).

**Rào cản**:
- iOS chỉ hỗ trợ `actions[]` từ 16.4+; Safari trên macOS hoàn toàn
  không. Phải graceful fallback (click → mở app như cũ).
- SW không có session — cần token tách rời để xác thực action click.
  Tự sinh + lưu trong `notifications.action_token` thì OK.
- UX phức tạp khi action thất bại (mất mạng) — SW phải queue + retry.

**Effort**: L. Phase ưu tiên trung bình — value cao cho admin nhận
nhiều contribution/inlaw, thấp cho user thường.

---

#### B. Weekly digest + Per-user timezone

**Bài toán hiện tại**: cron chạy 07:05 sáng VN (00:05 UTC). User
ở Mỹ/Châu Âu nhận push lúc nửa đêm. User cộng đồng cuối tuần không
muốn bị quấy mỗi sáng — họ muốn 1 email tóm tắt vào sáng thứ Hai.

**Tính năng "Múi giờ user"**:
- `profiles.timezone text default 'Asia/Ho_Chi_Minh'` — IANA name.
- `/account` thêm dropdown chọn múi giờ (default detect qua
  `Intl.DateTimeFormat().resolvedOptions().timeZone`).
- `notify-events` cron đổi từ "fixed 07:05 UTC" → chạy **hourly**.
  Mỗi giờ, query users có `extract(hour from now() at time zone tz)
  = 7` → dispatch cho họ. Tốn 24× số lần chạy nhưng mỗi lần ít user.
- Quy đổi lunar anniversary phải theo `tz` của user (lunar day rơi
  vào solar day nào tuỳ múi giờ).

**Tính năng "Weekly digest"**:
- `event_subscriptions` thêm cột `digest_mode text default 'realtime'
  check (digest_mode in ('realtime', 'weekly'))`.
- User chọn `weekly` → notify-events skip user trong daily run, thay
  vào đó **monday-only** dispatch gom toàn bộ sự kiện 7 ngày tới:
  - 1 email duy nhất, layout dạng table "Thứ 2: ngày sinh X, Thứ 4:
    giỗ Y..."
  - 1 push duy nhất với link tới `/today` đã pre-filtered.
- `notification_log.event_key = 'digest:YYYY-MM-DD'` (lần chạy thứ 2
  của tuần) để dedupe.
- Cron mới `notify-digest-weekly` (mỗi thứ 2 sáng) — tách khỏi
  `notify-events-daily` để logic không lẫn nhau.

**Rào cản**:
- DST (giờ mùa hè) ở user nước ngoài — `extract(hour ... at time zone)`
  đã xử lý đúng nếu dùng IANA name (vd "America/New_York"), không
  được dùng offset tĩnh ("UTC-5").
- Test: phải mock `current_setting('TIMEZONE')` trong RPC OR đổi
  `now()` để giả lập "thứ 2 sáng" — phức tạp hơn current test.
- Lunar engine: `@dqcai/vn-lunar` không native timezone-aware, phải
  pass `Date` đã convert sẵn (giờ VN cho người VN, giờ local cho
  user khác — quyết định: giỗ luôn dùng giờ VN vì là phong tục VN,
  sinh nhật theo giờ user).

**Effort**: M (timezone) + M (digest) — có thể ship cùng vì share
schema/cron rewrite.

---

#### C. Skip vĩnh viễn (đã loại khỏi roadmap)

- ~~SMS nhắc~~ — channel còn trong schema nhưng không wire (chưa
  có vendor; có phí). Email + push đã cover use case.
- ~~Push cho contributions pending (admin)~~ — đã ship `f2d6567`.

---

## 30. Hỗ trợ lập gia phả từ mô tả text thuần (người giúp, KHÔNG dùng AI)

**Phase 2 / sau launch.** Đã qua review một lượt — phần Schema/RLS dưới
đây đã bake-in các fix critical so với bản nháp gốc (xem 30.12).

### 30.1. Bối cảnh & mục tiêu

Nhiều người muốn có gia phả nhưng **không biết bắt đầu từ đâu** — chỉ có
ký ức rời rạc, ngại form/cấu trúc cây. Mọi cửa vào hiện tại (form, import,
thêm tại node) đều giả định người dùng *đã hiểu* cấu trúc.

> Người dùng gõ **text thuần** mô tả dòng họ → vào **hàng chờ** → một
> **người giúp** (admin / tình nguyện viên tin cậy) dựng cây **thủ công**
> trong không gian nháp → người yêu cầu **xem lại & xác nhận** → **phát
> hành** thành dòng họ của họ.

**Không tích hợp AI** — người giúp dựng cây bằng tay, tái dùng UI thêm/sửa
người sẵn có. Bản thô chỉ là dữ liệu *chờ xử lý*, **chưa** tạo `person`
thật cho tới khi phát hành.

### 30.2. Nguyên tắc kiến trúc (để không phá RLS hiện có)

- **"Cây nháp" là một clan riêng do NGƯỜI YÊU CẦU sở hữu**, ở trạng thái
  `draft`. Không tạo "siêu admin xem được mọi clan".
- **Người giúp chỉ được quyền TẠM THỜI vào đúng clan nháp đó** (qua
  `clan_helpers`, thu hồi được, tự gỡ khi phát hành). Tái dùng mô hình
  `clan_members` + RLS sẵn có.
- **Người yêu cầu luôn là chủ** clan; người giúp chỉ là *thợ tạm*.
- **Dữ liệu thô chứa người thật (có thể đang sống)** → bản nháp + brief
  chỉ requester + helper đã `claim` được thấy.
- **Giai đoạn đầu = TẬP TRUNG**: nhóm helper là người tin cậy (do platform
  admin add). Mô hình "cộng đồng giúp" để **sau** vì cần kiểm duyệt.

### 30.3. Schema

```sql
-- clans thêm trạng thái draft
alter table clans add column status text not null default 'active'
  check (status in ('draft','active','archived'));
create index clans_status_idx on clans (status) where status <> 'active';

-- Nhóm người giúp tin cậy (giai đoạn đầu: platform_admin add từng người)
create table genealogy_helpers (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  added_by   uuid references auth.users(id),
  created_at timestamptz not null default now()
);
-- (Đặt tên có prefix domain để không clash; bản nháp gốc dùng `helpers`
--  — quá generic.)

-- Yêu cầu lập gia phả
create table genealogy_help_requests (
  id            uuid primary key default gen_random_uuid(),
  clan_id       uuid not null references clans(id) on delete cascade,
                -- clan nháp tạo cho yêu cầu này; 1-1
  requester_id  uuid not null references auth.users(id) on delete cascade,
  brief         text not null
                  check (char_length(brief) between 1 and 10000),
  brief_summary text                       -- ≤140 char; hiện ở hàng chờ
                  check (brief_summary is null
                         or char_length(brief_summary) <= 140),
  status        text not null default 'open'
    check (status in ('open','in_progress','review','published','cancelled')),
  claimed_by    uuid references auth.users(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  claimed_at    timestamptz,
  submitted_at  timestamptz,
  published_at  timestamptz,
  cancelled_at  timestamptz
);
create index ghr_status_idx on genealogy_help_requests (status);

-- Quyền helper TẠM THỜI vào một clan nháp (revoke được)
create table clan_helpers (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid not null references clans(id) on delete cascade,
  helper_id   uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'active'
                check (status in ('active','revoked')),
  assigned_at timestamptz not null default now(),
  revoked_at  timestamptz,
  unique (clan_id, helper_id)
);

-- Defense-in-depth: chỉ cho phép INSERT clan_helpers nếu clan đang draft
create or replace function public.assert_clan_helpers_target_is_draft()
  returns trigger language plpgsql as $$
begin
  if not exists (
    select 1 from clans where id = NEW.clan_id and status = 'draft'
  ) then
    raise exception 'clan_helpers chỉ cho phép trỏ tới clan đang draft'
      using errcode = '42501';
  end if;
  return NEW;
end $$;
create trigger clan_helpers_only_draft_ins
  before insert on clan_helpers
  for each row execute function assert_clan_helpers_target_is_draft();

-- Trao đổi qua lại
create table clan_draft_messages (
  id         uuid primary key default gen_random_uuid(),
  request_id uuid not null references genealogy_help_requests(id)
               on delete cascade,
  author_id  uuid not null references auth.users(id),
  body       text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);

-- updated_at auto-maintain (dùng pattern set_updated_at() có sẵn)
create trigger ghr_set_updated_at
  before update on genealogy_help_requests
  for each row execute function public.set_updated_at();
```

### 30.4. Mở rộng hàm RLS

`can_access_clan` mở rộng để helper `active` truy cập được clan nháp:

```sql
create or replace function public.can_access_clan(p_clan uuid)
  returns boolean
  language sql stable security definer
  set search_path = public, pg_temp as $$
  select
    is_clan_member(p_clan)
    or exists (
      select 1 from clan_helpers ch
      where ch.clan_id = p_clan
        and ch.helper_id = auth.uid()
        and ch.status = 'active'
    );
$$;
revoke all on function public.can_access_clan(uuid) from public, anon;
grant execute on function public.can_access_clan(uuid) to authenticated;
```

Các policy đọc/ghi `persons`/`families` của clan **nháp** dùng
`can_access_clan(clan_id)`. Clan `active` dùng RLS cũ — nhánh helper
**chỉ activate khi clan đang draft** (đảm bảo bởi trigger ở 30.3 + revoke
trong `publish_draft_clan`).

Helper **không** xuất hiện trong danh sách "thành viên dòng họ" của UI
(UI lọc theo `clan_members`, không theo `clan_helpers`).

### 30.5. RLS các bảng mới

```sql
-- genealogy_helpers: chỉ platform_admin add, ai cũng đọc được trạng thái
-- của mình
alter table genealogy_helpers enable row level security;
create policy helpers_select_own_or_admin on genealogy_helpers
  for select using (
    user_id = auth.uid() or public.is_platform_admin()
  );
create policy helpers_insert_admin on genealogy_helpers
  for insert with check ( public.is_platform_admin() );
create policy helpers_delete_admin on genealogy_helpers
  for delete using ( public.is_platform_admin() );

alter table genealogy_help_requests enable row level security;

-- Requester thấy yêu cầu của mình; helper đã claim thấy cái mình nhận
create policy ghr_owner on genealogy_help_requests for select
  using ( requester_id = auth.uid() or claimed_by = auth.uid() );

-- Helper trong nhóm thấy hàng chờ — NHƯNG chỉ trường brief_summary
-- (không phải brief đầy đủ). Tạo một view tách brief để enforce ở
-- column-level vì RLS Postgres không có column-level granularity.
create view genealogy_help_queue_v as
  select id, clan_id, requester_id, brief_summary, status, created_at
  from genealogy_help_requests
  where status = 'open';
-- Cấp execute cho view (RLS chạy theo bảng nền nên cần policy đọc
-- cho status='open' dành cho helper)
create policy ghr_queue_helpers on genealogy_help_requests for select
  using (
    status = 'open'
    and exists (select 1 from genealogy_helpers h where h.user_id = auth.uid())
  );
-- ↑ Khi đọc qua view, helper thấy được cả `brief` của hàng chờ. Để
-- chặt hơn, tạo SECURITY DEFINER RPC `list_open_help_requests()` trả
-- về summary thôi, và REVOKE select trực tiếp trên bảng cho helper khi
-- chưa claim. Khuyến nghị làm theo cách này.

-- INSERT: chính người dùng
create policy ghr_insert on genealogy_help_requests for insert
  with check ( requester_id = auth.uid() );

alter table clan_helpers enable row level security;
create policy chelp_visible on clan_helpers for select
  using ( helper_id = auth.uid() or public.is_clan_admin(clan_id) );

alter table clan_draft_messages enable row level security;
create policy cdm_participants on clan_draft_messages for all
  using ( exists (
    select 1 from genealogy_help_requests r
    where r.id = request_id
      and (r.requester_id = auth.uid() or r.claimed_by = auth.uid())
  ));
```

### 30.6. Luồng & RPC (`SECURITY DEFINER` cho mọi chuyển trạng thái)

1. **`create_help_request(brief, brief_summary)`**:
   - Tạo `clans` mới `status='draft'`; insert `clan_members` (owner = caller).
   - Insert `genealogy_help_requests` (`status='open'`).
   - Chưa có helper, chưa có `person`.

2. **`list_open_help_requests()`** (helper-only):
   - Trả về `id, requester_display_name, brief_summary, created_at`.
   - **KHÔNG** trả `brief` đầy đủ. Helper xem brief đầy đủ chỉ sau khi claim.

3. **`claim_help_request(request_id)`**:
   - Chỉ user trong `genealogy_helpers`; chỉ khi `status='open'`.
   - Update với `WHERE status='open'` để chống race (2 helpers cùng claim).
   - Set `claimed_by`, `status='in_progress'`, `claimed_at=now()`.
   - Insert `clan_helpers(active)` → helper có quyền tạm vào clan nháp.

4. **Helper dựng cây THỦ CÔNG**: reuse UI `/clans/:id/tree`, `EditPerson`,
   `AddChild`, etc. Chat qua `clan_draft_messages`.

5. **`submit_for_review(request_id)`**:
   - Chỉ `claimed_by`; chỉ khi `status='in_progress'`.
   - Set `status='review'`, `submitted_at=now()`.
   - Tạo notification cho requester (dùng `notifications` table sẵn có).

6. **`publish_draft_clan(request_id)`**:
   - Chỉ requester; chỉ khi `status='review'`.
   - **Idempotent**: nếu đã `published`, return success quietly.
   - Atomically:
     - `clans.status='active'`,
     - `request.status='published'`, `published_at=now()`,
     - **Revoke toàn bộ `clan_helpers`** của clan này.
   - Generation: trigger sẵn có trên `persons` đã maintain `generation` từ
     parent links — KHÔNG cần code thêm khi publish.

7. **`cancel_help_request(request_id)`**:
   - Requester gọi. Set `status='cancelled'`, revoke helpers.
   - Tuỳ chọn: archive clan (`status='archived'`) hoặc xoá vĩnh viễn.

### 30.7. UI

- **Onboarding mới**: ai mở app mà chưa có clan nào → ngoài "Tạo dòng họ /
  Import", thêm **"Tôi chưa biết bắt đầu — nhờ giúp"** → text area lớn +
  ví dụ mẫu ("Ông nội tôi tên…, có 3 con…"). Cửa vào cho người ngại
  cấu trúc.
- **Trang trạng thái** (requester): đang chờ / đang được dựng / **mời xem
  lại** + chat bổ sung.
- **Bảng việc cho helper**: hàng chờ `open` (chỉ summary) + việc đang làm.
- **Màn hình duyệt**: requester xem cây nháp, sửa được, bấm **"Xác nhận
  & phát hành"**.

### 30.8. Quy tắc bắt buộc (riêng tư)

- **Brief + cây nháp chứa người thật, có thể đang sống.** Chỉ requester +
  helper đã claim thấy đầy đủ.
- **Hàng chờ chỉ lộ `brief_summary` (≤140 ký tự)**, brief đầy đủ hiện
  sau khi `claim`. Schema + RPC bake-in ràng buộc này (xem 30.5/30.6).
- **Phát hành = gỡ quyền helper.** Sau publish, helper không còn thấy
  dữ liệu.

### 30.9. Tích hợp với phần còn lại của app

- **Lọc draft khỏi các nơi không nên thấy** — audit và thêm filter
  `status='active'`:
  - `src/lib/queries/clans.ts` `listClans`
  - Share-view Edge Function (refuse nếu clan đang draft)
  - Dashboard recent activity panel
  - Admin clan list (admin nên thấy cả draft, nhưng badge phân biệt)
- **Block cross-clan `person_links` cho draft clan** — trigger insert
  refuse nếu side A hoặc B thuộc clan `status='draft'`.
- **Audit log**: claim / submit_for_review / publish / cancel ghi vào
  `audit_log` (entity_type = `'help_request'` mới, hoặc reuse `'clan'`
  với action chuyên biệt).

### 30.10. Gom chung "pipeline nháp"

Tính năng này, **import**, và (nếu sau làm) **chụp gia phả giấy** đều
cùng dạng: *dữ liệu thô → dựng nháp → duyệt → phát hành*. Gom **một
pipeline nháp duy nhất**: cùng khái niệm `clan status='draft'`, cùng
RPC `publish_draft_clan`. Nguồn nháp khác nhau (text + helper / file /
ảnh) đổ về cùng bước phát hành.

### 30.11. Test (RLS + nghiệp vụ)

- Requester tạo yêu cầu → có clan `draft` do mình owner; chưa helper nào
  truy cập được.
- Chỉ user trong `genealogy_helpers` mới `claim` được; user thường claim
  → 42501.
- 2 helpers race claim cùng lúc → đúng 1 thắng (optimistic via WHERE
  status='open').
- Sau claim: helper đọc/sửa được **đúng** clan nháp đó; **không** đọc
  được clan nháp/active khác (`can_access_clan` với clan khác → false).
- Trigger `clan_helpers_only_draft_ins`: insert `clan_helpers` cho clan
  active → 42501 (defense-in-depth).
- `publish_draft_clan`: chỉ requester gọi được; sau publish clan thành
  `active`, **mọi `clan_helpers` bị revoke**, helper truy cập lại → bị
  chặn.
- Gọi `publish_draft_clan` lần 2 → success quietly (idempotent).
- Cancel → revoke helper, dữ liệu nháp không rò.
- Brief / cây nháp KHÔNG xuất hiện ở share-link / public list.
- Hàng chờ: helper khi chưa claim chỉ thấy `brief_summary`, không thấy
  `brief`.
- Cross-clan link: `person_link` insert giữa draft clan và active clan
  → bị refuse.
- Brief có HTML/markdown → render escape, no XSS (FE test).

### 30.12. Khác biệt so với bản nháp gốc

Bản này đã áp các fix critical từ review:

1. **`helpers` → `genealogy_helpers`** (tránh tên generic) + RLS policy
   (chỉ platform_admin INSERT, mình SELECT row của mình).
2. **`can_access_clan` defense-in-depth**: trigger
   `clan_helpers_only_draft_ins` đảm bảo helper không bao giờ được gán
   vào clan active, kể cả khi `publish_draft_clan` có bug.
3. **Tách `brief_summary` từ đầu**: schema, không phải convention. Helper
   chưa claim KHÔNG đọc được brief đầy đủ (qua RPC riêng).
4. **`brief` size limit**: ≤10000 char; `clan_draft_messages.body` ≤5000.
5. **`updated_at` trigger** + thêm `claimed_at` / `submitted_at` /
   `cancelled_at` cho audit.
6. **`publish_draft_clan` idempotent**.
7. **Generation note**: clarify dùng trigger sẵn có, không cần code thêm.
8. **Audit log integration**: ghi claim/publish/cancel vào `audit_log`.
9. **Touchpoints filter `status='active'`**: enumerate những nơi cần
   audit (clan list, share-view, dashboard, admin).
10. **Cross-clan person_link block**: trigger refuse draft clan.

### 30.13. Ngoài phạm vi v1 (phase 2.x)

- **Notification push** cho helper khi có request mới + cho requester khi
  helper submit_for_review. Dùng `notifications` table + Web Push sẵn có.
- **Auto-expire abandoned drafts**: cron 90d email reminder, 180d auto
  cancel.
- **AI** dựng nháp (đã loại theo yêu cầu — không tích hợp AI API).
- **Cộng đồng giúp** mở cho người lạ nhận việc (cần kiểm duyệt + rating).
- **Nhiều helper cùng dựng một cây** (collab editing).
- **Chấm điểm/khen thưởng người giúp** (rủi ro lệch văn hoá thờ tự,
  xem cảnh báo ở mục Progress 30 / leaderboard).

### 30.14. Phase

**Phase 2 / sau launch.** Bản tập trung tối giản: text → helper (admin
hoặc nhóm nhỏ tin cậy) dựng tay → duyệt → phát hành. Không mở cộng đồng.

---

## 31. Linh vật gợi ý sử dụng (mascot tip system)

> Người dùng (đặc biệt người lớn tuổi) **ít khi vào /docs đọc hướng dẫn**.
> Cần một kênh chủ động đẩy gợi ý ngay trong app, không xâm phạm, không
> spam. Thay vì onboarding tour cứng (1 lần lúc đăng ký xong là quên),
> dùng "linh vật" pop tip rải rác trong phiên dùng — đúng lúc, đúng
> ngữ cảnh, tắt được, không lặp.

### 31.1. Bối cảnh & mục tiêu

- Đã có `/docs` + `HelpButton` ở header (mục 10) — passive, user phải
  tự bấm. Đa số không bấm.
- Đã có `UpdateBanner` (mục 17 PWA) — chỉ thông báo khi có app version
  mới, không có gợi ý feature khác.
- Mục tiêu: kênh **proactive** nhưng **nhẹ nhàng** — pop tip dạng
  tooltip cạnh một biểu tượng linh vật ở góc, user bấm để xem chi
  tiết hoặc dismiss. Phiên dùng có 0-2 tip, không bao giờ chen ngang
  thao tác.

### 31.2. Nguyên tắc (anti-banner-blindness)

1. **Ít hơn 1 tip / phiên đầu**, và ≤1 tip / route load sau đó.
2. **Mỗi tip chỉ pop 1 lần** trong vòng đời user (lưu seen-ids trong
   `localStorage`). Đã dismiss = vĩnh viễn không pop lại.
3. **Cooldown giữa các tip**: ≥48h kể từ tip cuối — để tip không
   thành stream of nags.
4. **Context-aware**: tip về "Thêm Thuỷ tổ" chỉ pop khi `/tree` đang
   rỗng. Tip về "can-chi" chỉ pop khi user vừa mở `EditPerson`. Tip
   về update chỉ pop khi có version mới.
5. **Dismissible tức thì**: 1 nút "×" trên tooltip, hoặc bấm ra
   ngoài. Không có "snooze for 24h" — quá phức tạp.
6. **Không pop khi user đang thao tác**: nếu modal/sheet đang mở,
   form đang dirty, hoặc user đang scroll → skip.
7. **Linh vật bản thân không animation chen ngang**. Chỉ một icon
   nhỏ tĩnh (≤32px) ở góc, có chấm đỏ subtle khi đang có tip mới
   chưa xem.

### 31.3. State + storage

Không cần migration DB — toàn bộ state phía client:

```typescript
// localStorage key: "ftv3:tips"
interface TipsState {
  seenIds: string[];          // tip ids đã dismiss / shown
  lastShownAt: number | null; // ms timestamp; cooldown gate
  mascotMuted: boolean;       // user explicitly muted (settings option)
}
```

Tip pool (catalogue) là **static TypeScript file** — không cần admin
UI để soạn tip. Bump phiên bản tip → release mới.

### 31.4. Catalogue tip (sample)

`src/lib/tipCatalogue.ts`:

```typescript
export interface Tip {
  id: string;                              // stable, lưu trong seenIds
  title: string;
  body: string;
  /** Pop điều kiện. Tip chỉ pop khi predicate trả true. */
  when: (ctx: TipContext) => boolean;
  /** Optional: button "Mở" dẫn user đến route cụ thể. */
  action?: { label: string; to: string };
  /** Priority cao hơn = pop trước nếu nhiều tip cùng eligible. */
  priority?: number;
}

export interface TipContext {
  route: string;
  hasAnyClan: boolean;
  currentClan: { id: string; isEmpty: boolean; canEdit: boolean } | null;
  appVersion: string;       // __APP_VERSION__
  lastSeenVersion: string;  // user's last-seen version (localStorage)
}
```

Tip mẫu (~10-15 đủ cover các use case chính):

| id | Khi pop | Nội dung |
|---|---|---|
| `welcome-new-user` | route=`/clans` + `hasAnyClan=false` | "Bạn đã tạo dòng họ đầu tiên chưa?" + action /clans/new |
| `tree-add-root` | route=`/tree` + `isEmpty=true` + canEdit | "Bắt đầu bằng cách thêm Thuỷ tổ" + action /people/new |
| `try-can-chi` | route=`/people/*/edit` + first 5 edits | "Không nhớ năm dương? Gõ can-chi (vd Bính Thìn)" |
| `try-quick-add` | route=`/tree` + clan có ≥3 người | "Bấm dấu + trên card để thêm con/vợ-chồng nhanh" |
| `try-todo` | có gap ≥5 và chưa vào /todo | "Có 5+ chỗ thiếu thông tin — xem 'Việc cần làm'" |
| `try-share` | route=`/tree` + clan public + admin | "Có thể chia sẻ cây qua nút Chia sẻ ở trên" |
| `lunar-calendar` | bao giờ đó | "Ô năm sinh / mất cho cả dương + âm — bấm 'Nhập theo lịch Âm'" |
| `feedback-button` | sau 5 phút dùng | "Gặp lỗi? Bấm nút Góp ý ở góc dưới" |
| `app-updated` | `appVersion !== lastSeenVersion` | "App có cập nhật v{version} — tải lại để áp dụng" + action reload |
| `import-excel` | clan empty + canEdit + sau 2 phút | "Có file Excel danh sách? Nhập hàng loạt một lần" + action /import |
| `theme-toggle` | route=`/clans` + sau dark hour | "Đổi sang chế độ tối ở góc trên" |
| `mute-mascot` | sau tip thứ 5 | "Không muốn xem gợi ý? Tắt linh vật ở /account" |

### 31.5. Triggers & scheduling

```typescript
// src/hooks/useMascotTip.ts
export function useMascotTip(): { tip: Tip | null; dismiss: (id: string) => void };
```

Gọi từ một component invisible (giống `MilestoneWatcher` đã có ở
`ClanLayout`) — mount toàn cục, scan tip catalogue mỗi khi:
- Route thay đổi (`useLocation`),
- `clanCompletion` / `tree` data refresh,
- App focus (visibilitychange).

Thuật toán pick tip:
1. Lọc tip có `when(ctx) === true`.
2. Loại tip đã có trong `seenIds`.
3. Nếu `Date.now() - lastShownAt < 48h` → return null.
4. Pick tip có `priority` cao nhất; tie-break by id ổn định.
5. Show tooltip + chấm đỏ trên mascot. Sau khi shown → push id vào
   `seenIds` + update `lastShownAt`.

### 31.6. UI

```
┌─────────────────────────────────────────┐
│                                          │
│  [trang nội dung]                       │
│                                          │
│                                          │
│           ┌──────────────────────────┐   │
│           │ Bạn đã tạo dòng họ chưa? × │
│           │ Bấm để tạo cây gia phả     │   │
│           │ [Mở →]                     │   │
│           └────────────────────────┐  │   │
│                                    \ │   │
│                                    [🐉]  │  ← linh vật góc dưới-trái
│                                          │  (tránh FeedbackButton bên phải)
│  ●           [Góp ý]                    │
└─────────────────────────────────────────┘
```

- Linh vật: 1 emoji hoặc SVG nhỏ (≤32px). Vd `🐉` (rồng — biểu tượng
  dòng họ VN), hoặc 1 hình mascot riêng. Tĩnh, có chấm đỏ subtle
  khi đang có tip chưa xem.
- Tooltip: bubble với title + body + button action (nếu có) + nút ×.
- Click ngoài / scroll mạnh → dismiss tooltip nhưng không mark
  seen (lần sau vẫn pop lại nếu user chưa thấy hết).
- Linh vật bấm vào → hiện tip cuối cùng (nếu chưa dismiss hẳn)
  hoặc dropdown "Mẹo đã xem" / settings.

### 31.7. Settings + mute

`/account` (hoặc `/settings`) thêm 1 toggle "Linh vật gợi ý" — bật/
tắt. Mặc định ON. User tắt → mascot ẩn hoàn toàn, không pop tip nào.

Tip `mute-mascot` (id 12 ở bảng trên) chỉ pop sau khi đã hiển thị
≥5 tip khác — để user khám phá feature trước khi được mời tắt.

### 31.8. Tích hợp với code hiện có

- **Vị trí mount**: bên cạnh `<FeedbackButton />` trong `App.tsx`
  (toàn cục, không phụ thuộc route hay clan).
- **Tip context**: dùng `useLocation()`, `useAuth()`, optionally
  `useClanContext()` qua một wrapper (vì mascot mount ngoài
  ClanLayout — có thể parse `clanId` từ pathname).
- **Reuse `__APP_VERSION__`**: đã được vite inject (mục 17).
- **Reuse `MilestoneWatcher` pattern**: invisible component
  watcher.

### 31.9. Test

- Tip seen → không pop lại (refresh page → không pop).
- Cooldown 48h: pop tip A → set system time +24h → không pop tip B.
- `mascotMuted=true` → mascot ẩn, không pop bất cứ tip nào.
- `when(ctx)` thay đổi (vd: user thêm clan đầu tiên) → tip
  `welcome-new-user` không pop nữa.
- Multiple tips eligible → priority cao hơn pop trước.
- Action button dẫn đúng route.
- Storage corrupted (parse error) → gracefully reset (không crash app).

### 31.10. Phase & ngoài phạm vi

- **Phase 2 (sau launch).** Có thể ship cùng phase với mục 30 vì
  không phụ thuộc lẫn nhau.
- **Ngoài phạm vi v1**:
  - A/B test tip wording (cần analytics infra).
  - Personalize per user-segment (cần backend tracking).
  - Animated mascot / voice / mascot character full-body.
  - Tip soạn từ admin UI (lúc nào schema thay đổi mới quá nhiều
    để hard-code).
  - Push tip qua notification khi user offline lâu (lẫn lộn với
    Web Push mục 29 — dễ thành spam).

## 32. Lớp giao tiếp: Thông báo hệ thống · Bảng tin dòng họ · Liên hệ/Phản hồi

> Đề xuất chèn vào `plan.md` ngay sau §31 (Mascot). Văn bản tiếng Việt; tên bảng/cột/hàm tiếng Anh để khớp với phần còn lại của repo. Đánh số bên trong là `32.x` để không đụng các section cũ.
>
> **Quan trọng — đã tận dụng những gì có sẵn:**
> - `is_platform_admin()`, `is_clan_admin(uuid)`, `is_clan_member(uuid)`, `is_caller_suspended()` đã tồn tại (`20260530131033_rls_policies.sql`, `20260530141401_member_management.sql`, `20260605130000_lineage_platform_admin.sql`).
> - Bảng `feedback` đã có MVP (`20260610000000_feedback.sql`) — §32.4 là **nâng cấp**, không tạo mới.
> - Web Push fan-out + `push_subscriptions` đã có (`20260607220000_web_push.sql`); §32.3 chỉ thêm event type, không xây lại pipeline.
> - Trang **Hôm nay** đã tồn tại (`src/pages/clan/Today.tsx`); §32.3 đẩy thêm "tin mới + sự kiện sắp tới" lên đó.
> - Edge Functions có sẵn pattern: `notify-events`, `notify-contribution`, `notify-inlaw`, `admin-action` — §32.6 thêm `notify-feedback` và mở rộng `notify-events` cho `clan_posts`.

---

### 32.1. Bối cảnh

App đã public, mạnh ở **dữ liệu** (cây, người, quan hệ), thiếu **lớp giao tiếp giữa con người**. Ba kênh khác hẳn nhau, làm dần:

| Lớp | Ai → ai | Giải quyết | Trạng thái hiện tại |
|---|---|---|---|
| **1. Thông báo hệ thống** | Platform admin → toàn bộ user | Tính năng mới, bảo trì, sửa lỗi | **Chưa có** |
| **2. Bảng tin dòng họ** | Thành viên ↔ thành viên (trong 1 clan) | Họp họ, giỗ, tảo mộ, sinh, mất → giữ chân | **Chưa có** |
| **3. Liên hệ / Phản hồi** | User → platform admin | Báo lỗi, góp ý, hỏi đáp | **MVP đã có**, cần nâng cấp |

Không cần thêm khái niệm "platform admin" — đã có sẵn. Không cần thêm `is_clan_member` / `is_clan_admin` — đã có sẵn. Mỗi RLS dưới đây dùng đúng các helper này.

---

### 32.2. Module 1 — Thông báo hệ thống (làm trước)

Migration mới: `supabase/migrations/<ts>_announcements.sql`.

```sql
-- 32.2 Announcements — broadcast channel from platform admin to all users.
-- Cũng dùng làm nguồn duy nhất cho trang changelog public (xem 32.9 — Tối ưu).

create type public.announcement_level
  as enum ('info','update','warning','critical');

create table public.announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body         text not null,
  level        public.announcement_level not null default 'info',
  published_at timestamptz,                    -- null = nháp; có giá trị = đã đăng
  expires_at   timestamptz,                    -- null = không hết hạn
  is_public    boolean not null default false, -- true = hiện cả ở trang changelog public (chưa đăng nhập)
  created_by   uuid not null references auth.users(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint announcements_title_len check (char_length(btrim(title)) between 1 and 200),
  constraint announcements_body_len  check (char_length(btrim(body))  between 1 and 20000),
  constraint announcements_expires_after_published
    check (expires_at is null or published_at is null or expires_at > published_at)
);

create index announcements_published_idx
  on public.announcements (published_at desc) where published_at is not null;

create trigger announcements_set_updated_at
  before update on public.announcements
  for each row execute function public.set_updated_at();   -- helper đã có

-- Đánh dấu đã đọc, cho badge "chưa đọc" trên chuông.
create table public.announcement_reads (
  user_id         uuid not null references auth.users(id) on delete cascade,
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  read_at         timestamptz not null default now(),
  primary key (user_id, announcement_id)
);

create index announcement_reads_ann_idx
  on public.announcement_reads (announcement_id);
```

**RLS — khoá theo role tường minh (`to anon` / `to authenticated`):**

```sql
alter table public.announcements enable row level security;

-- Authenticated user đọc thông báo đã đăng & chưa hết hạn.
create policy announcements_read_auth
  on public.announcements for select
  to authenticated
  using (
    published_at is not null and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- Anon đọc CHỈ thông báo được mark is_public = true (dùng cho trang changelog public).
create policy announcements_read_anon
  on public.announcements for select
  to anon
  using (
    is_public = true
    and published_at is not null and published_at <= now()
    and (expires_at is null or expires_at > now())
  );

-- Platform admin xem được cả bản nháp (mọi row).
create policy announcements_admin_read
  on public.announcements for select
  to authenticated
  using (public.is_platform_admin());

-- Chỉ platform admin tạo/sửa/xoá.
create policy announcements_admin_write
  on public.announcements for all
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());

alter table public.announcement_reads enable row level security;
create policy announcement_reads_owner
  on public.announcement_reads for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

**RPC count chưa đọc** (tránh client tự ghép 2 query):

```sql
create or replace function public.announcements_unread_count()
  returns integer
  language sql stable security definer set search_path = public, pg_temp
  as $$
    select count(*)::int
    from public.announcements a
    where a.published_at is not null and a.published_at <= now()
      and (a.expires_at is null or a.expires_at > now())
      and not exists (
        select 1 from public.announcement_reads r
        where r.announcement_id = a.id and r.user_id = auth.uid()
      );
  $$;

create or replace function public.announcements_mark_all_read()
  returns integer
  language plpgsql security definer set search_path = public, pg_temp
  as $$
  declare n integer;
  begin
    if auth.uid() is null then raise exception 'Not authenticated'; end if;
    insert into public.announcement_reads(user_id, announcement_id)
    select auth.uid(), a.id
    from public.announcements a
    where a.published_at is not null and a.published_at <= now()
      and (a.expires_at is null or a.expires_at > now())
    on conflict do nothing;
    get diagnostics n = row_count;
    return n;
  end; $$;

revoke all on function public.announcements_unread_count() from public, anon;
revoke all on function public.announcements_mark_all_read() from public, anon;
grant execute on function public.announcements_unread_count() to authenticated;
grant execute on function public.announcements_mark_all_read() to authenticated;
```

**UI**
- Biểu tượng **chuông** ở header (`src/components/AppShell.tsx` hoặc tương đương) + badge số chưa đọc — gọi `announcements_unread_count()` lúc load + poll 60s (hoặc Realtime — xem 32.9).
- `level='critical'` chưa đọc → render **banner** đỏ trên cùng app.
- Trang `src/pages/Announcements.tsx`: danh sách + nút "đánh dấu đã đọc tất cả" (gọi `announcements_mark_all_read`).
- Trang admin: `src/pages/admin/Announcements.tsx` (CRUD + preview + nút publish/expire).

---

### 32.3. Module 2 — Bảng tin dòng họ

Migration: `supabase/migrations/<ts>_clan_posts.sql`.

```sql
create type public.clan_post_type
  as enum ('news','event','birth','death','notice');

create type public.clan_post_status
  as enum ('published','pending','hidden');

create type public.clan_comment_status
  as enum ('published','hidden');

create table public.clan_posts (
  id          uuid primary key default gen_random_uuid(),
  clan_id     uuid not null references public.clans(id) on delete cascade,
  author_id   uuid not null references auth.users(id),
  type        public.clan_post_type not null default 'news',
  title       text,
  body        text not null,
  -- Liên kết tuỳ chọn tới person/event đã có trong cùng clan.
  -- Cho phép "bài cáo phó" đính kèm person, "bài sự kiện" đính kèm event giỗ.
  person_id   uuid references public.persons(id) on delete set null,
  event_id    uuid references public.events(id)  on delete set null,
  event_date  date,                              -- override nếu chưa nối với events
  status      public.clan_post_status not null default 'published',
  pinned      boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint clan_posts_title_len check (title is null or char_length(btrim(title)) <= 200),
  constraint clan_posts_body_len  check (char_length(btrim(body)) between 1 and 20000)
);

create index clan_posts_clan_recent_idx
  on public.clan_posts (clan_id, pinned desc, created_at desc)
  where status = 'published';

create index clan_posts_clan_pending_idx
  on public.clan_posts (clan_id, created_at desc)
  where status = 'pending';

create trigger clan_posts_set_updated_at
  before update on public.clan_posts
  for each row execute function public.set_updated_at();

create table public.clan_post_comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.clan_posts(id) on delete cascade,
  -- Denormalized cho RLS gọn. KHÔNG cho client set: trigger 32.3.t1 ghi đè.
  clan_id    uuid not null references public.clans(id) on delete cascade,
  author_id  uuid not null references auth.users(id),
  body       text not null,
  status     public.clan_comment_status not null default 'published',
  created_at timestamptz not null default now(),
  constraint clan_post_comments_body_len check (char_length(btrim(body)) between 1 and 4000)
);

create index clan_post_comments_post_idx
  on public.clan_post_comments (post_id, created_at);

-- Trigger 32.3.t1: ép clan_id của comment = clan_id của post.
-- Lý do: tránh client gửi clan_id sai để bypass RLS chéo clan.
create or replace function public.clan_post_comments_sync_clan()
  returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    new.clan_id := (select clan_id from public.clan_posts where id = new.post_id);
    if new.clan_id is null then
      raise exception 'Bài không tồn tại';
    end if;
    return new;
  end; $$;

create trigger clan_post_comments_sync_clan_ins
  before insert on public.clan_post_comments
  for each row execute function public.clan_post_comments_sync_clan();
```

**RLS — bám đúng vai trò sẵn có + chặn anon + chặn user bị treo:**

```sql
alter table public.clan_posts enable row level security;

-- READ: thành viên clan. Người thường chỉ thấy 'published';
-- author thấy bài 'pending' của chính mình; admin clan thấy mọi status.
create policy clan_posts_read
  on public.clan_posts for select
  to authenticated
  using (
    (public.is_clan_member(clan_id) or public.is_platform_admin())
    and (
      status = 'published'
      or author_id = auth.uid()
      or public.is_clan_admin(clan_id)
      or public.is_platform_admin()
    )
  );

-- INSERT:
--   - admin clan đăng tin chính thức (published) hoặc draft (pending) tuỳ ý
--   - thành viên thường BUỘC 'pending' (chờ duyệt) — chống loạn & spam
--   - user bị treo: không cho post
create policy clan_posts_insert
  on public.clan_posts for insert
  to authenticated
  with check (
    public.is_clan_member(clan_id)
    and author_id = auth.uid()
    and not public.is_caller_suspended()
    and (
      public.is_clan_admin(clan_id)
      or public.is_platform_admin()
      or status = 'pending'
    )
  );

-- UPDATE:
--   - admin clan / platform admin: cập nhật bất kỳ cột nào (bao gồm duyệt, ghim, ẩn).
--   - author: CHỈ được sửa nội dung của mình; KHÔNG được tự đổi 'status'/'pinned'.
--     Để bảo vệ moderation gate, dùng trigger 32.3.t2 ép cột bất biến cho non-admin.
create policy clan_posts_update
  on public.clan_posts for update
  to authenticated
  using (
    public.is_clan_admin(clan_id) or public.is_platform_admin() or author_id = auth.uid()
  )
  with check (
    public.is_clan_admin(clan_id) or public.is_platform_admin() or author_id = auth.uid()
  );

-- Trigger 32.3.t2: chặn author non-admin đổi status/pinned/clan_id/author_id.
-- Đây là KEY SECURITY GUARD — RLS một mình không enforce được "cột nào sửa được".
create or replace function public.clan_posts_guard_update()
  returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
  declare is_priv boolean;
  begin
    is_priv := public.is_clan_admin(new.clan_id) or public.is_platform_admin();
    if not is_priv then
      -- Author non-admin: khoá các cột nhạy cảm.
      new.status     := old.status;
      new.pinned     := old.pinned;
      new.clan_id    := old.clan_id;
      new.author_id  := old.author_id;
      -- Cho phép sửa title/body/type/person_id/event_id/event_date.
    end if;
    return new;
  end; $$;

create trigger clan_posts_guard_update_trg
  before update on public.clan_posts
  for each row execute function public.clan_posts_guard_update();

-- DELETE: KHÔNG expose. Chính sách soft-delete = status='hidden'.
-- Để dữ liệu lịch sử + audit không mất.

alter table public.clan_post_comments enable row level security;

create policy clan_post_comments_read
  on public.clan_post_comments for select
  to authenticated
  using (
    (public.is_clan_member(clan_id) or public.is_platform_admin())
    and (status = 'published' or author_id = auth.uid() or public.is_clan_admin(clan_id))
  );

create policy clan_post_comments_insert
  on public.clan_post_comments for insert
  to authenticated
  with check (
    public.is_clan_member(clan_id)
    and author_id = auth.uid()
    and not public.is_caller_suspended()
  );

create policy clan_post_comments_update
  on public.clan_post_comments for update
  to authenticated
  using (public.is_clan_admin(clan_id) or author_id = auth.uid())
  with check (public.is_clan_admin(clan_id) or author_id = auth.uid());

-- Guard tương tự cho comment: non-admin không đổi status được.
create or replace function public.clan_post_comments_guard_update()
  returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
  begin
    if not (public.is_clan_admin(new.clan_id) or public.is_platform_admin()) then
      new.status   := old.status;
      new.clan_id  := old.clan_id;
      new.post_id  := old.post_id;
      new.author_id:= old.author_id;
    end if;
    return new;
  end; $$;

create trigger clan_post_comments_guard_update_trg
  before update on public.clan_post_comments
  for each row execute function public.clan_post_comments_guard_update();
```

**Audit log moderation** — bám pattern `20260606205259_inlaws_audit.sql`:

```sql
create table public.clan_post_audit (
  id         bigserial primary key,
  post_id    uuid not null references public.clan_posts(id) on delete cascade,
  actor_id   uuid not null references auth.users(id),
  action     text not null check (action in ('publish','reject','hide','unhide','pin','unpin','edit')),
  old_status public.clan_post_status,
  new_status public.clan_post_status,
  note       text,
  created_at timestamptz not null default now()
);
create index clan_post_audit_post_idx on public.clan_post_audit (post_id, created_at desc);

alter table public.clan_post_audit enable row level security;
create policy clan_post_audit_read
  on public.clan_post_audit for select to authenticated
  using (
    public.is_platform_admin()
    or public.is_clan_admin((select clan_id from public.clan_posts where id = post_id))
  );
-- Không cho INSERT trực tiếp; chỉ trigger sau ghi.
```

**RPC moderation** — chuyển trạng thái phải đi qua RPC để vừa enforce vừa log:

```sql
create or replace function public.clan_post_moderate(
  p_post_id uuid,
  p_action  text,        -- 'publish' | 'reject' | 'hide' | 'unhide' | 'pin' | 'unpin'
  p_note    text default null
) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_post public.clan_posts;
  v_old  public.clan_post_status;
  v_new  public.clan_post_status;
  v_pin  boolean;
begin
  select * into v_post from public.clan_posts where id = p_post_id;
  if not found then raise exception 'Không thấy bài'; end if;

  if not (public.is_clan_admin(v_post.clan_id) or public.is_platform_admin()) then
    raise exception 'Không có quyền' using errcode = '42501';
  end if;

  v_old := v_post.status;
  v_new := v_old;
  v_pin := v_post.pinned;

  case p_action
    when 'publish' then v_new := 'published';
    when 'reject' then  v_new := 'hidden';
    when 'hide' then    v_new := 'hidden';
    when 'unhide' then  v_new := 'published';
    when 'pin' then     v_pin := true;
    when 'unpin' then   v_pin := false;
    else raise exception 'Action không hợp lệ';
  end case;

  update public.clan_posts set status = v_new, pinned = v_pin where id = p_post_id;

  insert into public.clan_post_audit(post_id, actor_id, action, old_status, new_status, note)
  values (p_post_id, auth.uid(), p_action, v_old, v_new, p_note);
end; $$;

revoke all on function public.clan_post_moderate(uuid, text, text) from public, anon;
grant execute on function public.clan_post_moderate(uuid, text, text) to authenticated;
```

**Tích hợp với phần đã có:**
- Bài `type='death'`/`'birth'` + `person_id` đã set → trang person hiển thị card "Tin liên quan".
- Bài `type='event'` + `event_id` → đẩy lên trang `Today.tsx` cùng nguồn với events giỗ (đã có pattern âm lịch trong `notify_events_cron`).
- Bài mới `status='published'` → web push fan-out cho thành viên đã opt-in. Mở rộng `notify-events` Edge Function: thêm event source `clan_post_published` (xem §32.6).
- Mascot tip §31: trigger thêm "bạn có **3 bài chờ duyệt** trong họ X" cho admin clan.

---

### 32.4. Module 3 — Nâng cấp Feedback (không tạo mới)

Migration: `supabase/migrations/<ts>_feedback_upgrade.sql`. Giữ MVP đã có, chỉ bổ sung.

```sql
-- Thêm phân loại & trạng thái xử lý.
create type public.feedback_category as enum ('bug','idea','question','other');
create type public.feedback_status   as enum ('new','seen','resolved','spam');

alter table public.feedback
  add column category    public.feedback_category not null default 'other',
  add column status      public.feedback_status   not null default 'new',
  add column page_path   text,                         -- ĐÃ làm sạch (xem trigger)
  add column resolved_at timestamptz,
  add column resolved_by uuid references auth.users(id),
  add column admin_note  text;

create index feedback_status_idx on public.feedback (status, created_at desc);

-- Trigger 32.4.t1: sanitize page_url → page_path.
-- Bỏ origin, tham số query nhạy cảm, thay UUID/số ID thành :id.
create or replace function public.feedback_sanitize_path()
  returns trigger language plpgsql as $$
  declare p text;
  begin
    p := coalesce(new.page_url, '');
    -- bỏ origin + query
    p := regexp_replace(p, '^https?://[^/]+', '');
    p := regexp_replace(p, '\?.*$', '');
    -- UUID → :id
    p := regexp_replace(p, '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', ':id', 'g');
    -- Số dài (ID) → :id
    p := regexp_replace(p, '/\d{2,}', '/:id', 'g');
    if char_length(p) > 200 then p := substring(p from 1 for 200); end if;
    new.page_path := nullif(p, '');
    -- Không tin page_url của client cho mục đích long-term: drop raw để không rò tên/id.
    new.page_url := null;
    return new;
  end; $$;

create trigger feedback_sanitize_path_trg
  before insert on public.feedback
  for each row execute function public.feedback_sanitize_path();

-- Chính sách cho phép user đọc lại feedback của chính mình (lịch sử "đã gửi").
-- Policy hiện tại chỉ cho platform admin select → thêm policy owner riêng,
-- KHÔNG drop policy cũ.
create policy feedback_select_owner
  on public.feedback for select
  to authenticated
  using (user_id is not null and user_id = auth.uid());

-- UPDATE: chỉ platform admin (đổi status/admin_note/resolved_*).
create policy feedback_update_admin
  on public.feedback for update
  to authenticated
  using (public.is_platform_admin())
  with check (public.is_platform_admin());
```

**Edge Function `notify-feedback`** (chi tiết §32.6): trigger từ `after insert on feedback`, đẩy email/Telegram cho platform admin.

**Anon spam** — `feedback_insert_anyone` đang mở cho `anon`. Đừng siết ở DB, chặn ở edge:
- Đếm theo IP trong 1 giờ qua Edge Function trung gian (`submit-feedback`); reject nếu > N. Tránh cho frontend gọi RLS trực tiếp khi anon.
- Hoặc trước mắt: thêm `created_at` index + cron cứng "xoá feedback anon > 30 ngày chưa được flag" để không phình DB.

---

### 32.5. Bẫy riêng tư & vận hành (vì app đã public)

1. **RLS chéo clan**: mọi policy ở §32.3 đã có `to authenticated` + `is_clan_member`. Test thủ công + Playwright (xem §32.8).
2. **`page_path` sanitize ở DB, không tin client** (§32.4.t1).
3. **`clan_id` của comment ép server-side** (§32.3.t1) — không cho client gửi.
4. **Cột nhạy cảm khoá trong trigger guard** (§32.3.t2) — không dùng RLS để chặn từng cột; nó không đủ.
5. **Không expose DELETE** cho bài/comment — soft delete bằng `status='hidden'`.
6. **Audit moderation đầy đủ** — ai duyệt/ẩn/ghim, lúc nào, ghi chú gì.
7. **User suspended không đăng/comment được** (`is_caller_suspended()` trong policy insert).
8. **Anon vào announcements** chỉ qua flag `is_public=true`; tin nội bộ default `false`.
9. **Tin "bé Z chào đời" / "cụ Y vừa mất"** là dữ liệu người sống — không ra ngoài clan, không index public, không qua `share-view`.
10. **Rate limit edge** cho `submit-feedback` + (về sau) cho insert `clan_posts` để chặn spam.

---

### 32.6. Edge Functions

Bám pattern `notify-events` / `notify-contribution` đã có.

**`supabase/functions/notify-feedback/index.ts`** — chạy khi có feedback mới:
- Trigger SQL: `after insert on feedback` → gọi `pg_net.http_post` tới function (đúng pattern `notify-contribution`).
- Body: email/Telegram cho platform admin (env `FEEDBACK_ALERT_EMAIL`, `FEEDBACK_ALERT_TG_CHAT`).
- Payload **không** chứa `body` raw nếu length > 500 — chỉ link tới `/admin/feedback/<id>`.

**Mở rộng `notify-events/index.ts`** — thêm source `clan_post_published`:
- Khi `clan_posts.status` chuyển sang `published` (via RPC `clan_post_moderate`), enqueue 1 record vào bảng outbox để function fan-out push tới thành viên clan đã opt-in (`profiles.notify_via_push = true`).
- Reuse `push_subscriptions` + concurrency cap đã có ở §29.12.
- **Không** push cho author (đỡ phiền).
- Nếu là `type='death'`/`'birth'`/`'event'` → priority cao hơn (icon riêng, title "Tin họ <name>").

**`supabase/functions/submit-feedback/index.ts`** — entry public cho anon:
- Rate limit theo IP (KV / Postgres counter); 5 req/h/IP cho anon.
- Validate length + sanitize trước khi insert qua service role.
- Lý do dùng edge thay vì RLS trực tiếp: edge thấy IP, DB không.

---

### 32.7. UI

**Frontend mới (chèn vào router hiện có):**

| Route | File | Ai dùng |
|---|---|---|
| `/announcements` | `src/pages/Announcements.tsx` | Mọi user — danh sách tin hệ thống |
| `/changelog` | `src/pages/Changelog.tsx` | Public — render `is_public=true` |
| `/lien-he` | `src/pages/Contact.tsx` | Public + user — form feedback (đã có nút floating, thêm trang riêng) |
| `/clan/:id/bang-tin` | `src/pages/clan/Board.tsx` | Thành viên clan — feed + post + comment |
| `/clan/:id/bang-tin/duyet` | `src/pages/clan/BoardModeration.tsx` | Admin clan — queue `pending` |
| `/admin/announcements` | `src/pages/admin/Announcements.tsx` | Platform admin |
| `/admin/feedback` | `src/pages/admin/Feedback.tsx` | Platform admin — inbox + filter category/status |

**Component dùng chung:**
- `src/components/NotificationBell.tsx` — gọi `announcements_unread_count()`, badge, click mở `/announcements`.
- `src/components/CriticalBanner.tsx` — đọc 1 announcement `level='critical'` chưa đọc, hiện trên cùng app shell.
- `src/components/ClanPostCard.tsx` / `ClanPostComposer.tsx` / `ModerationActions.tsx` (dùng `clan_post_moderate` RPC).

**Mascot integration (§31):**
- Tip mới: "bạn có **N tin chưa đọc**" (khi N ≥ 3).
- Tip cho admin clan: "có **N bài chờ duyệt**".
- Tip cho platform admin: "có **N feedback mới**".

---

### 32.8. Test (RLS + nghiệp vụ)

Bám pattern test SQL ở `tests/` đã có (xem `tests/rls/` nếu có; nếu chưa thì tạo thư mục theo cùng phong cách).

**Module 1 — announcements:**
- T1.1: user thường đọc được tin đã `published_at <= now()`, **không** thấy nháp.
- T1.2: tin `expires_at < now()` không hiện.
- T1.3: anon **không** thấy tin `is_public=false`, **thấy** tin `is_public=true`.
- T1.4: chỉ platform admin INSERT/UPDATE/DELETE được.
- T1.5: `announcements_unread_count()` đúng sau khi mark.
- T1.6: `announcements_mark_all_read()` idempotent (conflict do nothing).

**Module 2 — clan_posts:**
- T2.1: thành viên clan A **không** đọc được bài clan B (test cross-clan).
- T2.2: thành viên thường INSERT → status bị ép `pending`; thử insert thẳng `published` → policy reject.
- T2.3: author non-admin UPDATE thử đổi `status='published'` → trigger guard giữ nguyên `pending`. **(blocker của bản plan cũ)**
- T2.4: admin clan gọi `clan_post_moderate('publish')` → status đổi + audit row được tạo.
- T2.5: comment client gửi `clan_id` sai → trigger ép lại.
- T2.6: user `is_caller_suspended()` → INSERT bị reject.
- T2.7: bài/comment `hidden` không hiện cho non-admin (kể cả author? — quyết định nghiệp vụ: hiện cho author kèm note "đã ẩn", **không** hiện cho người khác).
- T2.8: DELETE bị từ chối ở mọi role.

**Module 3 — feedback:**
- T3.1: anon gửi được; user_id null OK.
- T3.2: user đăng nhập đọc được feedback của chính mình; **không** đọc của người khác.
- T3.3: platform admin đọc tất cả.
- T3.4: `page_url='https://x.com/clan/1691/person/abc-uuid'` → trigger sanitize ra `page_path='/clan/:id/person/:id'`, `page_url` null.
- T3.5: chỉ admin update status được.

**E2E (Playwright):**
- Đăng tin hệ thống → user thấy banner critical + badge chuông.
- Thành viên đăng bài → admin clan vào queue duyệt → bài hiện trên bảng tin + push gửi (mock fetch).
- Gửi feedback anon → admin /admin/feedback thấy ngay.

---

### 32.9. Tối ưu (gợi ý nâng cao, làm dần)

**O1. Realtime thay vì poll.**
- `supabase.channel('clan-board-<clanId>')` subscribe `postgres_changes` cho `clan_posts` + `clan_post_comments`. Tránh poll 30s như chuông announcements.
- Áp dụng cho 3 chỗ: bảng tin clan, danh sách `pending` (admin queue), badge announcement (nếu user mở app lâu).
- Lưu ý: realtime đi qua RLS — bài clan B không lọt sang client clan A.

**O2. Counter cache cho chuông.**
- Nếu `announcements_unread_count()` chạy thường, thêm cột `profiles.last_announcement_seen_at timestamptz` rồi đếm `where published_at > last_seen`. Chỉ 1 query, không phải anti-join.
- Đổi `announcements_mark_all_read()` thành update `last_announcement_seen_at = now()`. Bảng `announcement_reads` vẫn giữ để biết per-announcement read (cho analytics) hoặc bỏ hẳn nếu không cần.

**O3. Full-text search bài bảng tin.**
- Tận dụng `f_unaccent()` đã có (xem `member_management.sql`).
- Thêm `search_tsv tsvector generated always as (to_tsvector('simple', f_unaccent(coalesce(title,'')||' '||body))) stored` + GIN index. Trang `/clan/:id/bang-tin?q=...`.

**O4. Single Source of Truth cho changelog.**
- Trang `/changelog` public **chỉ** đọc `announcements where is_public=true`. Bỏ ý định maintain MD/docs song song.
- Tip mascot khi user vào sau 7 ngày: "có N cập nhật mới kể từ lần trước" (so với `profiles.last_changelog_seen_at`).

**O5. Per-clan notification opt-out.**
- `clan_members.notify_clan_posts boolean not null default true`. Một số người trong họ to thì không muốn nhận push mỗi bài.
- Edge function fan-out check cờ này trước khi push.

**O6. Reaction / "đã đọc" nhẹ cho bài.**
- Không làm reactions emoji vội — bẫy moderation. Nhưng `clan_post_views(post_id, user_id)` để hiện "12 người đã xem" → tạo cảm giác cộng đồng, không tạo nội dung mới phải duyệt.

**O7. Mention `@thành viên`.**
- Parse `@username` server-side trong `clan_post_comments.body` (lookup `clan_members → profiles.display_name`), thêm push priority cao cho người được mention. Đây là "nhẹ" nhất để tăng tương tác.
- Index: dùng `profiles.display_name` đã có.

**O8. Outbox pattern cho push.**
- Đừng để trigger SQL gọi pg_net trực tiếp khi `clan_post_moderate('publish')`. Đẩy 1 row vào bảng `notification_outbox` (đã có / cần tạo), cron `notify-events` mỗi 30s rút ra fan-out. Tránh blocking transaction, tránh retry storm.
- Pattern này đã dùng ở `notify-events`, chỉ cần extend `event_kind`.

**O9. Soft "draft" cho bài thành viên thường.**
- Thành viên thường đăng bài lần đầu — nếu chưa hoàn chỉnh, lưu local (`localStorage`) trước, chỉ INSERT khi bấm "gửi duyệt". Đỡ tạo `pending` rác.

**O10. Public /changelog → SEO.**
- Server-side render (hoặc prerender) `/changelog` để search engine index "cập nhật gia phả tháng X". Nguồn tự nhiên kéo người mới về app — đỡ phải maintain blog ngoài.

**O11. Email digest cho thành viên im lặng.**
- Cron tuần 1 lần: với mỗi user `notify_via_email = true` không login > 14 ngày, gửi tổng hợp "5 tin mới nhất trong họ X". Reuse table `clan_posts`.
- Pattern giống §29.15.B (weekly digest).

**O12. `event_date` ↔ `events` linkage.**
- Nếu bài có `event_date` mà không có `event_id`, tạo RPC `clan_post_attach_event` để admin clan "tạo event từ bài này" (1 click). Tránh hai cách quản lý event song song.

**O13. Limit số bài `pending` mỗi user.**
- `check (...)` không làm được; dùng trigger: nếu user đang có > 5 bài `pending` chưa duyệt trong clan này → reject INSERT mới. Chặn spam tự nhiên.

**O14. Banner critical có "đã đọc 1 lần là tắt".**
- Lưu read vào `announcement_reads` ngay khi user click "Đã hiểu", không phải khi mở trang `/announcements`. Đỡ banner đeo bám.

---

### 32.10. Lộ trình triển khai

**Phase A — gấp (1 tuần):**
- §32.4 nâng cấp `feedback` (alter table, trigger sanitize, RLS owner, edge `notify-feedback`).
- `src/pages/Contact.tsx` + nâng cấp floating "Góp ý" hiện có.
- `src/pages/admin/Feedback.tsx` (đơn giản: list + đổi status + ghi note).

**Phase B — tuần kế (1–2 tuần):**
- §32.2 announcements (table + RLS + RPC + 2 trang).
- `NotificationBell`, `CriticalBanner` vào AppShell.
- Trang `/changelog` public.

**Phase C — sau khi A+B ổn (2–3 tuần):**
- §32.3 clan_posts đầy đủ (enum + bảng + RLS + trigger guard + audit + RPC).
- Trang `/clan/:id/bang-tin` + queue duyệt.
- Edge mở rộng `notify-events` cho `clan_post_published`.
- Mascot tip §31 thêm 3 case mới.

**Phase D — tối ưu (làm dần khi có tín hiệu):**
- §32.9 O1 (realtime), O2 (counter cache), O3 (search), O5 (per-clan opt-out), O7 (mention).
- Các O còn lại theo nhu cầu thực tế.

---

### 32.11. Ngoài phạm vi (đợt đầu)

- Chat 1-1 giữa các thành viên.
- Reactions emoji (like/heart/…) — bẫy moderation, chưa làm.
- Bảng tin liên-dòng-họ (thông gia) — đợi §28 stable trước.
- Feedback dạng ticket có thread trả lời qua lại (chỉ status + admin_note phase đầu).
- Edit lịch sử bài / version control cho post.
- Attachment ảnh trong bài bảng tin — đợi bucket storage strategy (xem §27 deploy).
- Polling/voting trong bảng tin (ví dụ "ngày họp họ ai chọn ngày nào").

---

### 32.12. Khác biệt so với bản nháp gốc (cho người review)

1. **Bỏ phần tạo lại `platform_admins`/`is_platform_admin()`** — đã có.
2. **Bỏ phần tạo lại `feedback`** — đã có MVP, chuyển thành "nâng cấp".
3. **Vá lỗ moderation bypass**: trigger `clan_posts_guard_update` khoá `status`/`pinned` cho non-admin (RLS một mình không đủ).
4. **Chuyển status change qua RPC `clan_post_moderate`** + audit log.
5. **`clan_id` của comment do trigger ép**, không tin client.
6. **`page_url` sanitize bằng trigger DB**, không tin client.
7. **Thêm `to authenticated`/`to anon`** tường minh ở mọi policy.
8. **Thêm `is_caller_suspended()`** vào policy insert post/comment.
9. **`announcements_unread_count` / `mark_all_read` thành RPC**, không để client tự ghép.
10. **Liên kết person/event** trong `clan_posts` qua FK + RPC, không sync ngầm.
11. **Dùng enum thay text + check** (đồng bộ pattern dự án).
12. **Index có điều kiện** (`where status = 'published'` v.v.) cho query nóng.
13. **Mục §32.9 — 14 đề xuất tối ưu** (realtime, counter cache, FTS, mention, outbox, digest, anti-spam …).
14. **Lộ trình A→D rõ tuần**, gán Phase A vào nâng cấp feedback (rẻ nhất, có sẵn 80%).
