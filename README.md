# family-tree-v3

Web app SaaS đa-dòng-họ (multi-tenant) để quản lý và hiển thị gia phả quy mô lớn. Mobile-first, đóng gói PWA, tối ưu cho người lớn tuổi. Chạy production tại <https://giapha.thaohk.com>.

Thiết kế chi tiết ở [`plan.md`](./plan.md) (kiến trúc, schema, RLS, design system, lịch âm, sự kiện). Mỗi tính năng lớn có plan riêng trong [`docs/`](./docs) (`plan-*.md`).

## Tech stack

| Lớp | Lựa chọn |
|---|---|
| Frontend | React 18 + TypeScript + Vite, Tailwind + shadcn/ui, PWA |
| Fonts | Be Vietnam Pro (body) + Noto Serif (tên dòng họ) |
| Backend | Supabase self-host (Postgres 17 + Auth + Storage + RLS + Edge Functions) |
| Dữ liệu client | React Query + IndexedDB (cache theo `data_version`) |
| Cây / đồ thị | `family-chart`, d3, `3d-force-graph`, Three.js (`@react-three/fiber`) |
| Xuất bản | `@react-pdf/renderer` (sổ gia phả PDF), GEDCOM, Excel (`xlsx`) |
| Đa ngôn ngữ | Lingui — tiếng Việt là ngôn ngữ gốc, có bản tiếng Anh |
| Kết nối AI | Máy chủ MCP riêng ở [`mcp-server/`](./mcp-server) |
| Testing | Vitest (unit + RLS integration) |
| CI/CD | GitHub Actions |

## Tính năng chính

- **Gia phả**: dòng họ, chi họ, thành viên, quan hệ cha mẹ / vợ chồng / con, cây gia phả, đường trực hệ, máy tính xưng hô họ hàng, gộp người trùng.
- **Lịch âm & sự kiện**: quy đổi âm–dương, ngày giỗ, nhắc sự kiện qua email và web push, xuất iCal.
- **Nhập / xuất**: import Excel, import/export GEDCOM, xuất sổ gia phả PDF, thẻ QR cá nhân.
- **Cộng đồng dòng họ**: bảng tin, đóng góp có duyệt, thông gia, Sổ tay Văn hoá (`/so-tay`), di sản, phòng ký ức, share-link.
- **Quản trị**: phân quyền theo dòng họ, audit log + khôi phục, trang quản trị nền tảng.
- **Kết nối AI (MCP)**: Claude / ChatGPT / client MCP tra cứu và chỉnh sửa gia phả qua OAuth 2.1 hoặc token cá nhân; quyền thật không vượt quá vai trò của người cấp. Xem [`docs/mcp-ket-noi-ai.md`](./docs/mcp-ket-noi-ai.md).

Trợ lý AI chat trong app đã được gỡ; AI ngoài dùng đường MCP ở trên.

## Yêu cầu hệ thống

- **Node 22** (xem `.nvmrc`).
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
| `npm run typecheck` | Kiểm kiểu cho app và test (`tsc -b` + `tsconfig.test.json`) |
| `npm run lint` | ESLint |
| `npm test` | Vitest watch mode |
| `npm run test:rls` | RLS integration tests (cần Supabase local chạy) |
| `npm run db:start` / `db:stop` | Bật / tắt Supabase local (Docker) |
| `npm run db:reset` | Reset DB sạch, chạy lại tất cả migrations |
| `npm run db:status` | In ra URL, keys, Studio URL |
| `npm run db:types` | Sinh `src/lib/database.types.ts` từ schema |
| `npm run i18n:extract` | Trích chuỗi cần dịch vào `src/locales/*/messages.po` |
| `npm run i18n:status` | Xem số chuỗi còn thiếu bản dịch |
| `npm run seed` | Nạp fixtures: 2 clan giả (50 và 500 thành viên) + users mọi role |
| `npm run seed:board` / `seed:customs` | Nạp bảng tin mẫu / bài Sổ tay Văn hoá mẫu |

> Dùng `npm run typecheck`, không dùng `tsc --noEmit -p .` (không kiểm gì vì `tsconfig.json` chỉ chứa references).

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
  components/     UI dùng chung; ui/ là shadcn primitives
  hooks/          useAuth, ...
  lib/            logic miền (lịch âm, xưng hô, GEDCOM, PDF, cây, queries/…)
  locales/        vi (gốc) + en — Lingui .po
  pages/          các màn hình; admin/, clan/, docs/ là nhóm con
  test/           unit tests; rls/ là RLS integration tests
supabase/
  config.toml     cấu hình local
  migrations/     SQL forward-only, prefix timestamp
  functions/      Edge Functions (thông báo, share, đóng góp, …) + _shared/
mcp-server/       máy chủ MCP + OAuth 2.1 (Node, build bằng build.mjs)
landing/          trang giới thiệu tĩnh + hướng dẫn
deploy/           compose + nginx mẫu cho máy chủ MCP / Umami
scripts/          seed, migrate, build landing, kiểm tra giao diện
docs/             plan-*.md, changelog, tài liệu MCP, hardening
plan.md           thiết kế tổng thể
```

## Bảo mật

- **RLS là chốt chặn thật**, không phải frontend. Mọi sửa schema/policy phải kèm test RLS (xem `src/test/rls/`).
- **Service role key** chỉ dùng trong Edge Function, máy chủ MCP (để tra token/vai trò) và script seed. KHÔNG bao giờ để ở frontend.
- Migrations là **forward-only**. Rollback = migration mới đảo ngược. Deploy không tự áp migration lên production — áp tay và ghi `schema_migrations`.
- Soft delete cho `persons`/`families`/`branches` (cột `deleted_at`); hard delete chỉ khi xoá clan.
- **MCP**: token chỉ lưu băm; mọi lượt gọi kiểm lại vai trò hiện tại; dữ liệu truy vấn bằng JWT ngắn hạn của chủ token nên RLS vẫn áp dụng. Gói `admin` hệ thống không có xoá tài khoản, cấp/thu quyền admin hay đổi cấu hình nền tảng (chống prompt injection).
- Không đưa IP / hostname / đường dẫn máy chủ thật vào repo; dùng placeholder.

## Triển khai

Workflow trong `.github/workflows/`:

| Workflow | Việc |
|---|---|
| `test.yml` | Chạy test khi push lên `main` và trên pull request |
| `deploy-vps.yml` | Build và đưa frontend lên máy chủ web (chạy tay) |
| `deploy-functions.yml` | Đưa Edge Functions (chạy tay) |
| `deploy-mcp.yml` | Build image và thay container máy chủ MCP (chạy tay) |

## Dữ liệu tách khỏi code

Dữ liệu gia phả lịch sử và bài Sổ tay Văn hoá nằm ở repo riêng `family-tree-data`, không commit chung repo code.

## Đóng góp

Mỗi tính năng phải kèm test (Vitest unit + RLS integration): chưa có test = chưa xong.

Commit messages dùng [Conventional Commits](https://www.conventionalcommits.org/): `feat:`, `fix:`, `chore:`, `docs:`, `test:`.
