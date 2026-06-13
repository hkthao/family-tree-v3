# family-tree-v3

Web app SaaS đa-dòng-họ (multi-tenant) để quản lý và hiển thị gia phả quy mô lớn. Mobile-first, đóng gói PWA, tối ưu cho người lớn tuổi.

Toàn bộ thiết kế chi tiết ở [`plan.md`](./plan.md) (kiến trúc, schema, RLS, design system, lunar dates, events, Supabase local).

## Tech stack

| Lớp | Lựa chọn |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind + shadcn/ui |
| Fonts | Be Vietnam Pro (body) + Noto Serif (tên dòng họ) |
| Backend | Supabase (Postgres 17 + Auth + Storage + RLS) |
| Cây gia phả | `family-chart` (sẽ thêm ở Phase 1) |
| Testing | Vitest (unit + RLS integration) |
| CI | GitHub Actions |

## Yêu cầu hệ thống

- **Node 22** (xem `.nvmrc` nếu có).
- **Docker Desktop** đang chạy (Supabase CLI dựng container Postgres + Auth + Storage + Studio).
- **npm 10+**.

## Cài đặt lần đầu

```bash
git clone https://github.com/hkthao/family-tree-v3.git
cd family-tree-v3
npm install

# Khởi động Supabase local (pull Docker images lần đầu, ~5 phút)
npm run db:start

# Lấy URL + anon key + service role key vào .env.local
npx supabase status --output env | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=' > .env.local.tmp
# Đổi tên biến cho khớp Vite (xem .env.example):
#   API_URL → VITE_SUPABASE_URL
#   ANON_KEY → VITE_SUPABASE_ANON_KEY
#   SERVICE_ROLE_KEY → SUPABASE_SERVICE_ROLE_KEY

# Áp dụng migrations + sinh types
npm run db:reset
npm run db:types

# (Tuỳ chọn) Nạp dữ liệu giả lập
npm run seed
# Đăng nhập: admin@example.test / demo-password-1234

# Khởi động dev server
npm run dev
```

App mở ở `http://localhost:5173`.

## NPM scripts

| Lệnh | Mô tả |
|---|---|
| `npm run dev` | Vite dev server, hot reload |
| `npm run build` | Type check + production build |
| `npm run preview` | Phục vụ bản build cục bộ |
| `npm run db:start` / `db:stop` | Bật / tắt Supabase local (Docker) |
| `npm run db:reset` | Reset DB sạch, chạy lại tất cả migrations |
| `npm run db:status` | In ra URL, keys, Studio URL |
| `npm run db:types` | Sinh `src/lib/database.types.ts` từ schema |
| `npm run seed` | Nạp fixtures: 2 clan giả (50 và 500 thành viên) + users mọi role |
| `npm test` | Vitest watch mode |
| `npm run test:rls` | Chạy RLS integration tests (yêu cầu Supabase local chạy) |

## Truy cập Supabase local

| Tên | URL |
|---|---|
| API | http://127.0.0.1:54321 |
| Studio (UI quản DB) | http://127.0.0.1:54323 |
| Mailpit (catch email) | http://127.0.0.1:54324 |
| Postgres trực tiếp | postgresql://postgres:postgres@127.0.0.1:54322/postgres |

## Cấu trúc thư mục

```
src/
  components/
    ui/           shadcn primitives (Button, Input, Card, Alert, ...)
    AuthLayout.tsx, RequireAuth.tsx
  hooks/          useAuth
  lib/            supabase.ts, database.types.ts, utils.ts
  pages/          Login, Signup, Home
  test/
    rls/          33 RLS integration tests
    supabase-helpers.ts
supabase/
  config.toml             cấu hình local (ports, auth, storage)
  migrations/             SQL forward-only, prefix timestamp
scripts/
  seed-fixtures.ts        Vietnamese fixtures cho dev
plan.md                   thiết kế chi tiết (1003 dòng)
```

## Bảo mật

- **RLS là chốt chặn thật**, không phải frontend. Mọi sửa schema/policy phải kèm test RLS (xem `src/test/rls/`).
- **Service role key** chỉ dùng trong Edge Function + script seed local. KHÔNG bao giờ để ở frontend.
- Migrations là **forward-only**. Rollback = migration mới đảo ngược.
- Soft delete cho `persons`/`families`/`branches` (cột `deleted_at`); hard delete chỉ khi xoá clan.

## Trạng thái phát triển

- ✅ **Phase 0** — Setup, schema, RLS, triggers, RLS tests, auth pages, seed, CI
- ✅ **Phase 1** — CRUD clan/persons/families, danh bạ list+grid, family-chart tree, import Excel, dashboard, cache (React Query + IndexedDB + data_version), tài khoản cá nhân
- ✅ **Phase 2** — Share-link + Edge Function, audit/restore, platform admin UI, xuất PDF sổ gia phả
- ✅ **Phase 3** — Quy đổi lịch âm, sự kiện + thông báo (email + web push), kinship UI, GEDCOM import/export, đường trực hệ
- 🚧 **Đang mở rộng** — Bảng tin/posts, đóng góp (contributions workflow), thông gia (in-laws), QR cá nhân, gộp người trùng, AI gợi ý mô tả, video hướng dẫn

App đã chạy production tại <https://giapha.thaohk.com> — vẫn tiếp tục thêm tính năng theo phản hồi cộng đồng.

Lộ trình chi tiết: xem `plan.md` mục 21.

## Đóng góp

Mỗi tính năng phải kèm test (Vitest unit + RLS integration). Mục test "chưa có test = chưa xong" áp dụng từ Phase 0.

Commit messages dùng [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
