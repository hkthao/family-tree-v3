# family-tree-v3 — Onboarding (cập nhật 2026-11-16)

Bối cảnh nhanh cho người / Claude session mới để làm tiếp dự án. Giới thiệu chung và cách cài đặt nằm ở
[`README.md`](./README.md); thiết kế chi tiết ở [`plan.md`](./plan.md).

## Tổng quan

Web app SaaS đa-dòng-họ (multi-tenant) quản lý và hiển thị gia phả, mobile-first, PWA, ưu tiên người lớn tuổi (chữ to,
nút lớn). Production: <https://giapha.thaohk.com>.

- **Frontend**: React 18 + TypeScript + Vite + Tailwind + shadcn/ui. Cây gia phả dùng `family-chart`.
- **Backend**: Supabase **self-host** (Postgres + Auth + Storage + RLS + Edge Functions). Không còn dùng Supabase cloud.
- **Mail**: các function thông báo gửi thẳng qua SMTP (không dùng Resend HTTP API).
- **i18n**: Lingui; tiếng Việt là gốc (có fallback), tiếng Anh dịch trước. Chuỗi mới bọc bằng `t` rồi chạy
  `npm run i18n:extract`, điền bản `en` cho hết trước khi commit.
- **Kết nối AI**: máy chủ MCP riêng ở `mcp-server/` (OAuth 2.1 + token `gpt_`). Trợ lý AI chat trong app **đã gỡ**.
- **Zalo Mini App**: app riêng trong `zalo/`, chung repo. Chỉ xem; không có admin / phân quyền.

## Việc phải làm TAY khi deploy (CI không làm)

- **Migration DB**: `deploy-vps.yml` KHÔNG áp migration. Áp tay lên DB production và ghi vào `schema_migrations`.
  Một migration chưa áp thì code dùng cột/bảng đó sẽ lỗi trên prod.
- **Edge Function**: đưa file vào thư mục functions của Supabase self-host rồi khởi động lại container edge-functions
  (workflow `deploy-functions.yml` hỗ trợ). Kiểm tra bằng anon JWT.
- **MCP**: `gh workflow run deploy-mcp.yml` (build image từ `main` rồi thay container). Phải push trước.
- **Frontend**: `gh workflow run deploy-vps.yml --ref main`.
- Địa chỉ máy chủ, đường dẫn và key thật KHÔNG nằm trong repo (có test `noInfraSecrets` chặn); dùng placeholder.

## Edge Functions (`supabase/functions/`)

Cấu hình `verify_jwt` ở `supabase/config.toml`. Nhóm chính:

| Nhóm | Function |
|---|---|
| Chia sẻ / QR | `share-view`, `auth-qr`, `cleanup-card-shares` |
| Đóng góp / thông gia | `submit-contribution`, `notify-contribution`, `notify-inlaw` |
| Thông báo | `notify-events`, `weekly-digest`, `push-action`, `send-test-push`, `calendar-feed` |
| Quản trị / nhập | `admin-action`, `giapha-import` |
| Podcast | `sync-podcast` |
| Zalo | `zalo-auth`, `zalo-link`, `zalo-webhook` |

Function không đăng nhập (`verify_jwt = false`) phải tự kiểm quyền bên trong. Thêm function mới thì thêm cả mục vào
`config.toml`, nếu không gateway sẽ chặn khách.

## Tính năng lớn và nơi đọc thêm

| Tính năng | Tài liệu |
|---|---|
| Kết nối AI (MCP, OAuth) | `docs/mcp-ket-noi-ai.md`, code `mcp-server/src/` |
| Mộ phần & tro cốt | `docs/plan-mo-phan-tro-cot.md` |
| Di sản & Văn hoá dòng họ | `docs/plan-di-san-van-hoa.md` |
| Phòng trưng bày ảnh 3D | `docs/plan-phong-trung-bay-anh-3d.md` |
| Cây bản mệnh & Khu vườn | `docs/plan-cay-ban-menh.md` |
| Ảnh đại gia đình ghép mảnh | `docs/plan-anh-dai-gia-dinh-ghep-manh.md` |
| Gia phả dòng họ lịch sử (vua chúa) | `docs/plan-gia-pha-vua-chua.md` |
| Đa ngôn ngữ | `docs/plan-da-ngon-ngu.md`, `docs/glossary-i18n.md` |
| Zalo Mini App | `docs/plan-zalo-mini-app.md` |
| In ấn phả đồ / phả ký | `docs/plan-in-an-pha-do-pha-ky.md` |
| Ngăn kéo (side panel) cho form | `docs/plan-side-panel-ux.md` |
| Design system | `docs/design-language.md` |
| Bảo mật, RLS | `docs/security-hardening-2026-06-27.md`, `src/test/rls/` |
| Lịch sử thay đổi | `docs/changelog-*.md` (hiện ở `/changelog` trong app) |

Một số plan mới ghi "chờ chốt" câu hỏi — đọc phần đầu của file trước khi bắt tay làm.

## Lệnh hay dùng

```bash
npm run dev                  # localhost:5173
npm run typecheck            # kiểm kiểu app + test (KHÔNG dùng tsc --noEmit -p .)
npm test                     # Vitest watch
npm run test:rls             # RLS integration (cần Supabase local)
npm run db:reset             # reset DB local, chạy lại migrations
npm run seed                 # dữ liệu giả
npm run i18n:extract         # cập nhật catalog dịch
npm run i18n:status          # còn thiếu bản dịch nào
node mcp-server/build.mjs    # build thử máy chủ MCP
```

## Quy ước

- **Commit**: Conventional Commits, scope viết thường (`feat(mcp): …`, `fix(db): …`, `style(settings): …`, `docs: …`).
  Thân ngắn nói "vì sao". Không amend commit đã push. Commit do Claude tạo kết thúc bằng dòng `Co-Authored-By` theo
  hướng dẫn của phiên làm việc.
- **Schema**: migration forward-only, prefix timestamp; sửa schema/policy phải kèm test RLS.
- **Dữ liệu tách khỏi code**: dữ liệu gia phả lịch sử và bài Sổ tay nằm ở repo riêng `family-tree-data`, không commit
  vào repo này.
- **UI**: chức năng đồng nhất giữa web và Zalo, nhưng bố cục Zalo làm lại cho điện thoại; giữ icon, phông, màu rượu vang
  của web. Trang cấp cao dùng `max-w-4xl py-6 px-4 space-y-6`; nút mặc định size default, icon `h-4 w-4 mr-1.5`.
- **Email**: HTML dựng inline trong edge function (như `notify-events`), không dùng React Email.
- **Nhập số lượng lớn** (dòng họ lịch sử): làm theo lô nhẹ để không nghẽn server; audit/version/RLS đã tối ưu, log chỉ
  giữ 30 ngày.

## Quyết định đã chốt (đừng đổi nếu không có lý do mới)

- **Đường trực hệ**: thuỷ tổ ở trên, "tôi" ở dưới (theo gia phả truyền thống); mặc định bên nội.
- **QR cá nhân**: scope `single_person`, dùng lại share_link chưa thu hồi, mặc định 365 ngày (in lên bia cần lâu).
- **Đóng góp**: `apply_contribution` là SECURITY DEFINER RPC, thay đổi nguyên tử; admin khôi phục qua `audit_log`.
- **MCP**: quyền thật = min(gói, vai trò hiện tại của chủ token); dữ liệu chạy bằng JWT ngắn hạn của chủ token nên RLS
  vẫn áp dụng. Gói `admin` hệ thống cố ý KHÔNG có xoá tài khoản, cấp/thu quyền admin, đổi cấu hình nền tảng, vì nội dung
  người ngoài nhập có thể cài lệnh điều khiển AI. Màn "Cho phép" hiện host nhận mã và cảnh báo nếu không phải ứng dụng
  AI quen thuộc (`KNOWN_AI_HOSTS` trong `ConnectAiAuthorize.tsx`).
- **Cây bản mệnh**: không cần chăm sóc, vẽ procedural bằng Three.js.
- **Zalo**: Zalo chặn IP ngoài Việt Nam nên `zalo-auth` gọi Graph API vòng qua máy web trong nước.

## Việc còn mở (gợi ý)

- Các bước tiếp theo của MCP: hạn tuyệt đối cho kết nối OAuth, mặc định gói `propose` thay vì `write`, giới hạn tần
  suất theo IP trước bước xác thực, bắt buộc `client_id` khi làm mới token.
- Migration `20261115200000_drop_ai_assistant.sql` (gỡ trợ lý AI) cần kiểm đã áp trên prod chưa trước khi dựa vào.
- Các plan đang chờ chốt câu hỏi: ảnh ghép mảnh, đa ngôn ngữ, ngăn kéo side panel.
