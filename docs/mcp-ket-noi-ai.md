# Kết nối AI bên ngoài (MCP)

Cho Claude / ChatGPT / script tra cứu gia phả và **đề xuất** chỉnh sửa, qua máy chủ MCP
`mcp-server/` (server Node riêng).

## Mô hình phân quyền

AI chạy **bằng danh tính chủ token**, không phải một tài khoản riêng: hàm `mcp` ký JWT HS256
sống 2 phút cho chủ token rồi truy vấn bằng JWT đó. Nhờ vậy RLS, trigger audit và quyền xoá
của app áp dụng nguyên vẹn, không có bản luật thứ hai để lệch.

- **Ai tạo token:** chỉ admin dòng họ (*Cài đặt dòng họ → Kết nối AI*) hoặc admin hệ thống
  (*Quản trị → Kết nối AI*, xem/thu hồi mọi token). Token gắn 1 người + 1 dòng họ, hạn 30/90/365 ngày.
  DB chỉ lưu SHA-256; bản rõ hiện đúng một lần.
- **Ba gói:** `read` · `propose` (đề xuất vào `contributions`, admin duyệt mới ghi) ·
  `write` (ghi thẳng: thêm/sửa/ghi chú/xoá mềm).
- **Quyền thật = min(gói, vai trò hiện tại của chủ token).** Chủ token bị hạ xuống viewer → token
  chỉ còn đọc; rời họ/bị khoá → 401. Xoá theo đúng RLS của app (editor/admin) và cần
  `confirm=true`.
- Mọi thay đổi `write` ghi nhật ký (audit) dưới tên chủ token, xoá là xoá mềm, khôi phục được.
- Vẫn lọc `clan_id` ở mọi truy vấn (token bị khoá vào một dòng họ; admin hệ thống thì RLS không tự giới hạn).
- Rate limit 60 lệnh/phút/token (bộ nhớ isolate); tối đa 30 đề xuất chờ/người.

## Tool

| Tool | Gói | Việc |
|---|---|---|
| `clan_stats`, `search_person`, `get_person`, `get_relatives` | mọi gói | tra cứu người, cha mẹ/vợ chồng/con |
| `get_kinship`, `upcoming_anniversaries`, `search_book` | mọi gói | xưng hô, giỗ (âm→dương), phả ký/di sản/tiểu sử |
| `list_my_proposals` | mọi gói | trạng thái đề xuất đã gửi |
| `propose_add_person` / `propose_edit_person` / `propose_add_note` | propose | chờ duyệt |
| `create_person` / `update_person` / `append_person_note` / `delete_person` | write | ghi thẳng |

## Kiến trúc

Server Node độc lập (`mcp-server/`, build bằng `Dockerfile.mcp`), chạy trên **máy web cùng FE**, gọi sang
Supabase self-host qua HTTPS (PostgREST bằng JWT ngắn hạn của chủ token). Không phải edge function:
không phải vá router `main/index.ts`, giới hạn tốc độ đếm chính xác (một tiến trình), dễ thêm OAuth/nhật ký sau.
Bộ tool tra cứu (`mcp-server/src/tools.ts`) dùng bản vendor xưng hô/âm lịch trong `supabase/functions/_shared/vendor` nên kết quả khớp với app. (Trợ lý AI trong app đã gỡ; MCP là đường duy nhất để AI làm việc với dữ liệu.)

## Dùng

```bash
claude mcp add --transport http dong-ho-viet https://giapha.thaohk.com/mcp \
  --header "Authorization: Bearer gpt_xxxxxxxx"
```

Client khác: URL như trên + header `Authorization: Bearer <token>`. Giao thức: JSON-RPC 2.0 qua
HTTP POST không trạng thái (không SSE/session); GET trả 405. `GET /healthz` cho healthcheck.
Claude.ai / ChatGPT connector thường đòi OAuth — chưa hỗ trợ (việc sau).

## Chạy local

```bash
node mcp-server/build.mjs
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long node mcp-server/dist/server.mjs
```

## Triển khai (làm tay lần đầu)

1. **Migration** `20261115100000_api_tokens.sql` lên DB self-host (xem [[project_migrations_manual_selfhost]]; ghi `schema_migrations`).
2. **Máy web** (APP_HOST_IP): tạo `/opt/gia-pha-mcp/mcp.env` từ `deploy/mcp.env.example`, `chmod 600`.
   `JWT_SECRET` + `SERVICE_ROLE_KEY` là khoá quyền cao — lấy ở `/root/supabase/.env` trên máy DB.
3. **nginx** của genealogy-app: chèn `deploy/nginx-mcp-location.conf` vào server block giapha.thaohk.com,
   `docker exec genealogy-app-nginx-1 nginx -t && nginx -s reload`.
4. Chạy workflow **deploy-mcp** (Actions, thủ công): build image `Dockerfile.mcp` → GHCR → `docker compose -f docker-compose.mcp.yml up -d`
   (stack riêng `/opt/gia-pha-mcp`, cố ý không gộp compose của app vì `--remove-orphans`).
5. Kiểm: `curl -X POST https://giapha.thaohk.com/mcp -H "Authorization: Bearer <token>" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`.
