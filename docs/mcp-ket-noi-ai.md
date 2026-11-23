# Kết nối AI bên ngoài (MCP)

Cho Claude / ChatGPT / script tra cứu gia phả và **đề xuất** chỉnh sửa, qua máy chủ MCP
`mcp-server/` (server Node riêng).

## Mô hình phân quyền

AI chạy **bằng danh tính chủ token**, không phải một tài khoản riêng: hàm `mcp` ký JWT HS256
sống 2 phút cho chủ token rồi truy vấn bằng JWT đó. Nhờ vậy RLS, trigger audit và quyền xoá
của app áp dụng nguyên vẹn, không có bản luật thứ hai để lệch.

- **Ai tạo token:** chỉ admin dòng họ (*menu Công cụ & Quản trị → Kết nối AI*, trang `/clans/:id/ket-noi-ai`) hoặc admin hệ thống
  (*Quản trị → Kết nối AI*, xem/thu hồi mọi token). Admin dòng họ xem và thu hồi được MỌI token của dòng họ mình
  (kể cả của admin khác), không thấy token dòng họ khác hay token admin hệ thống (RLS `api_tokens_clan_admin_*`). Token gắn 1 người + 1 dòng họ, hạn 30/90/365 ngày.
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

**Tra cứu (mọi gói):** `clan_stats`, `search_person`, `list_persons` (lọc + phân trang), `get_person`, `get_relatives`,
`get_tree` (cây hậu duệ/tổ tiên dạng chữ), `get_kinship` (xưng hô), `upcoming_anniversaries`, `search_book`,
`list_branches`, `list_events`, `get_clan_info`, `get_book_texts`, `list_my_proposals`, **`export_clan_book`** (PDF).

**Đề xuất (gói propose):** `propose_add_person`, `propose_edit_person`, `propose_add_note` — vào hàng chờ Đóng góp.

**Ghi thẳng (gói write):**
- Người: `create_person` (mọi trường + nối quan hệ ngay lúc tạo), `update_person` (mọi trường, `null` = xoá trống, ngày
  `YYYY`/`YYYY-MM`/`YYYY-MM-DD`), `append_person_note`, `delete_person` (xoá mềm, cần `confirm`), `restore_person`.
- Quan hệ: `link_relation`, `unlink_relation` (cha/mẹ, con, vợ/chồng — dùng RPC của app nên chặn vòng lặp, cùng giới…),
  `set_spouse_order`.
- Ảnh đại diện: `set_person_photo` (https URL hoặc base64; nén 512px JPEG như app; chống SSRF), `remove_person_photo`.
- Chi: `create_branch`, `update_branch`, `delete_branch`. Sự kiện: `create_event`, `update_event`, `delete_event`.
- Dòng họ & sổ: `update_clan_info` (chỉ tên, mô tả, offset đời — CỐ Ý không đổi được chế độ công khai/giới hạn/tính năng),
  `update_book_texts`.

### Bảng tin, Phòng ký ức, Ảnh ghép, Di sản, Mộ phần, Quỹ họ, Bảng vàng, Bản đồ

Mỗi mục có `list_*` (đọc, mọi gói; truyền `id` để đọc một mục đầy đủ, danh sách tự cắt chữ dài), `create_*`, `update_*`
(chỉ trường được truyền thay đổi, `null` xoá trống) và `delete_*` (gói write; cần `confirm`). Khai báo trường nằm ở
`mcp-server/src/resourceDefs.ts`, thực thi ở `resources.ts`.

| Mục | Tool |
|---|---|
| Bảng tin | `list_posts`, `create_post`, `update_post`, `moderate_post` (đăng/ẩn/ghim…), `delete_post` (ẩn bài) |
| Phòng ký ức | `list/create/update/delete_memory_room(s)`, `list_memory_room_items`, `add_memory_room_item`, `update_memory_room_item`, `remove_memory_room_item` |
| Ảnh ghép | `list/create/update/delete_mosaic(s)`, `set_mosaic_dashboard`, `list_mosaic_tiles`, `set_mosaic_tile_status`, `delete_mosaic_tile` |
| Di sản | `list/create/update/delete_heritage_item(s)`, `add_heritage_person`, `remove_heritage_person` |
| Mộ phần | `list/create/update/delete_resting_place(s)`, `add/remove_resting_place_occupant`, `list_resting_place_occupants`, `add_resting_place_relocation` |
| Quỹ họ | `list/create/update/delete_fund_transaction(s)`, `fund_summary` (tổng thu/chi/số dư) |
| Bảng vàng | `list/create/update/delete_honor_entr(y|ies)` |
| Dòng thời gian (một kho dùng chung) | `list/create/update/delete_timeline_milestone(s)` — mốc của poster dòng họ **và** của từng người (cùng cấu trúc: `year`, `title`, `body`, `era`, `icon_key`, `sort_order`, `image_url`; `person_id` gắn mốc vào người, `on_clan` = có hiện trên poster dòng họ; lọc list theo `person_id` / `on_clan`). Lối tắt theo người: `get_person_timeline`, `set_person_timeline` (`mode=append` thêm sau các mốc cũ; `mode=replace` chỉ thay các mốc **riêng** của người — mốc không hiện trên poster dòng họ — và cần `confirm` khi đã có; mỗi mốc cần `title` và/hoặc `body`, chỉ có `body` thì tiêu đề được suy ra; tối đa 100 mốc/lần). **Bối cảnh & hình:** `fill_context=true` chép bối cảnh của thời đại chứa năm của mốc; `hide_context=true` ẩn thẻ bối cảnh; hoặc tự viết `context_title` + `context_body` (mỗi dòng một ý, tối đa 6); bỏ trống = app tự lấy bối cảnh mặc định theo năm. `image_url` nhận link `https` **hoặc** `lib:<id cảnh>` (cảnh minh hoạ dựng sẵn của app); `icon_key` chọn biểu tượng. `list_timeline_library` liệt kê thời đại (bối cảnh), cảnh minh hoạ và mẫu mốc để AI chọn. Dữ liệu thư viện và bộ `icon_key` trùng app (có test đối chiếu; file `mcp-server/src/timelineData.ts` SINH TỰ ĐỘNG, không sửa tay) |
| Liên kết dòng họ | `list_clan_links` (lọc `status`), `get_clan_link` (liên kết đã xác nhận kèm người ở bên kia; đề nghị do họ này gửi kèm mã mời), `create_clan_link` (quản trị đề nghị liên kết một người của họ này với dòng họ khác — trả **mã mời** để đưa cho quản trị bên kia; chưa xác nhận thì chưa có hiệu lực), `create_clan_link_from_token` (bên nhận xác nhận bằng mã, gắn một người của họ mình), `set_clan_link_status` (đồng ý đề nghị gửi thẳng tới họ này), `delete_clan_link` (huỷ đề nghị còn chờ / gỡ liên kết đã xác nhận — giữ lịch sử, cần `confirm`). Loại liên kết: `same_person` (thông gia), `ancestor_of`, `descendant_of`, `related`. Chỉ quản trị dòng họ mới ghi được (RLS); tool KHÔNG gửi email thông báo như app |
| Bản đồ | `map_stats` (chỉ đọc: số người/mộ/di sản theo tỉnh, không có tên hay địa chỉ) |

**Phân quyền (hai lớp, kiểm bằng `src/test/queries/mcp-resources-perm.test.ts` với phiên đăng nhập thật):**
- Gói token: tool ghi chỉ gói `write`/`admin` thấy và gọi được; `read`/`propose` chỉ thấy tool đọc.
- RLS của app theo VAI TRÒ THẬT của chủ token: Bảng vàng, Quỹ họ, Di sản, Mộ phần, Phòng ký ức, Ảnh ghép, Dòng thời gian cần quyền biên tập
  (người xem chỉ đọc). Bảng tin: quản trị đăng thẳng, thành viên khác chỉ gửi được bài **chờ duyệt**, chỉ quản trị kiểm duyệt.
- Code tự kiểm thêm những điều RLS không làm: mọi truy vấn khoá theo dòng họ đang chọn; id cha (di sản, mộ phần, phòng,
  bức ảnh ghép, bài đăng), `person_id`, `event_id` phải thuộc CÙNG dòng họ — nếu không, token nhiều họ hoặc admin hệ thống
  có thể bị lái sang họ khác. Chỉ nhận trường đã khai báo (không ghi được `clan_id`, `deleted_at`, `created_by`, `status`/
  `pinned` của bài, `is_public`…); link ảnh/mô hình chỉ `https`; mọi lệnh xoá/gỡ cần `confirm`.
- Cố ý KHÔNG làm: tải ảnh lên (Ảnh ghép, Di sản, Mộ phần dùng ảnh tải lên trong app), đổi chế độ công khai của phòng/di sản,
  bình luận Bảng tin.
- Dữ liệu tài chính (Quỹ họ) mọi thành viên đã đọc được trong app nên token đọc cũng đọc được; mọi thay đổi vẫn ghi vào
  `fund_audit` dưới tên chủ token.

### Xuất sổ gia phả PDF (`export_clan_book`)

Dựng bằng chính `ClanBookPdf` của app. Lưu file tạm trong bucket private `book-exports` (`<uid>/mcp-<clan>-<băm>.pdf`) và
trả **link tải có hạn 30 phút** (signed URL). Không tạo link chia sẻ công khai nên bìa không có mã QR.

- **Cache:** khoá = băm của dữ liệu sổ + thông tin dòng họ + tuỳ chọn + mã dựng sổ + mốc cập nhật từng người. Không có gì
  đổi thì trả lại file đã dựng (~30 ms thay vì vài chục giây). Đổi ảnh/dữ liệu/tuỳ chọn/bố cục sổ → tự dựng mới.
- **Dọn:** giữ tối đa 3 bản gần nhất mỗi (người, dòng họ); `sweepExports` chạy mỗi giờ xoá bản `mcp-*` quá
  `MCP_EXPORT_KEEP_HOURS` (mặc định 72) giờ; không đụng file của Mini App Zalo.
- **Tài nguyên:** chạy từng cái một; trần 1000 người (cao hơn thì báo lỗi, hãy xuất trong app); container giới hạn 1 GB RAM, V8 heap 600 MB. Đo thực tế (máy dev):
  50 người ≈ 1 s, 500 người ≈ 23 s, 800 người ≈ 56 s (RAM đỉnh ~0,8 GB). Dòng họ rất lớn nên xuất trong app.
- **Số trang mục lục:** dàn trang cả cuốn MỘT lần rồi dàn lại riêng trang mục lục với số trang thật (trước đây dựng cả
  cuốn hai lần chỉ để lấy số trang). Có chốt an toàn: không đúng bố cục dự kiến thì quay về dựng hai lượt.

### Tổng hợp đóng góp cộng đồng vào gia phả (2026-11-20)

- `list_memories` (đọc): đóng góp đã duyệt mà người kể cho phép dùng lại (câu chuyện, ảnh, trả lời câu hỏi) — kèm người kể, quan hệ, năm, nơi chốn, nguồn, đã/chưa đưa vào gia phả.
- `propose_add_note` / `propose_edit_person` / `propose_add_person` nhận thêm `source_memory_ids`. **AI luôn chỉ đề xuất** (kể cả token admin — gói admin nay gọi được `propose_*`); admin duyệt trong app thì trigger `contributions_mark_source_memories` tự đánh dấu các đóng góp nguồn "đã đưa vào gia phả".
- `get_biography_sources` (đọc, P4): gom trong một lần gọi dữ kiện đã ghi, cha mẹ / vợ chồng / con, tiểu sử hiện có và các đóng góp đánh số [n] kèm id + hướng dẫn soạn (trình tự thời gian, ghi nguồn từng câu, không bịa, mâu thuẫn thì nêu cả hai, giữ riêng tư người còn sống). AI soạn xong gửi `propose_edit_person` (changes.bio) / `propose_add_note` kèm `source_memory_ids`.
- Trong app, admin cũng tự "Đưa vào gia phả" (tiểu sử / ảnh đại diện / đánh dấu) ở trang Đóng góp nội dung.

## Token ADMIN HỆ THỐNG (gói `admin`)

Tạo ở *Quản trị → Kết nối AI* (chọn quyền "Admin hệ thống"), chỉ admin hệ thống tạo được và chỉ cho chính mình. Không gắn
dòng họ (`api_tokens.clan_id` null): mỗi lệnh theo dòng họ truyền thêm `clan_id` (lấy từ `admin_list_clans`).

- **Sống chừng nào chủ token còn là admin hệ thống** — kiểm lại ở MỖI lượt gọi; bị gỡ quyền hoặc bị khoá → 401 ngay.
- **Không có quyền nào lớn hơn admin UI:** vẫn chạy bằng JWT ngắn hạn của chủ token nên RLS giữ nguyên; lệnh tài khoản đi
  qua chính edge function `admin-action` (nó tự kiểm lại quyền).
- **Tool theo dòng họ** (mọi tool đọc + ghi, kể cả `export_clan_book`) dùng được trên bất kỳ dòng họ, kèm `clan_id`.
  Không dùng được `propose_*` (admin ghi thẳng).
- **Tool quản trị (`admin_*`):** `platform_stats`, `list_users` / `set_user_limits` / `user_action` (suspend, unsuspend,
  signout), `list_clans` / `set_clan_limits`, `list_contributions` /
  `review_contribution` (duyệt/từ chối/cần thêm thông tin trên MỌI dòng họ), `list_feedback` / `update_feedback`,
  `list/create/update/delete_announcement`, `get_settings` (chỉ đọc), `list_failed_notifications` /
  `clear_failed_notification`, `list_api_tokens` / `revoke_api_token`, `audit_log`.
- **Chốt an toàn:** khoá tài khoản, xoá thông báo, thu hồi token bắt buộc
  `confirm: true` + `reason` (5–500 ký tự). Không tự khoá chính mình, không thu hồi token đang dùng. Cố ý
  KHÔNG có tool xoá dòng họ, xoá sạch danh mục, xoá tài khoản, cấp/thu quyền admin hệ thống hay đổi cấu hình nền tảng:
  nội dung do người ngoài nhập (góp ý, đóng góp) có thể cài lệnh điều khiển AI mà `confirm` do chính AI tự điền thì không
  chặn được — các việc này chỉ làm trong giao diện admin.
- **Nhật ký:** mọi lệnh của token admin (tool, dòng họ, tham số đã rút gọn, kết quả) ghi vào `mcp_admin_log`; xem bằng
  `admin_audit_log`. Ngoài ra thay đổi dữ liệu gia phả vẫn vào audit theo dòng họ dưới tên chủ token.
- **Chưa có:** nhập gia phả lịch sử (Gia phả vua chúa), danh mục địa giới, Podcast — các màn này còn là việc chuyên biệt.

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
Claude.ai / ChatGPT kết nối bằng OAuth — xem mục dưới (không cần dán token).

## OAuth 2.1 (ChatGPT, Claude…)

Theo đặc tả MCP Authorization: người dùng chỉ dán địa chỉ máy chủ, ứng dụng AI tự khám phá + tự đăng ký, rồi chuyển sang
màn **"Cho phép"** trong app (`/ket-noi-ai/cap-quyen`, cần đăng nhập) để chọn dòng họ + gói quyền. Token không phải đi qua
tay người dùng và không bao giờ nằm trong URL.

- **Khám phá:** `GET /.well-known/oauth-protected-resource[/mcp]` (RFC 9728), `GET /.well-known/oauth-authorization-server`
  (RFC 8414); `/mcp` trả `401` + `WWW-Authenticate: Bearer resource_metadata=…` khi chưa có token.
- **Đăng ký client:** `POST /oauth/register` (RFC 7591, client công khai + PKCE S256 bắt buộc). Chưa hỗ trợ Client ID Metadata
  Document nên client tự rơi về đăng ký động (Claude: "Register automatically").
- **Cấp quyền:** `POST /oauth/authorize-info` (app hỏi tên ứng dụng, kiểm redirect_uri) và `POST /oauth/approve` (kèm JWT đăng nhập
  của người dùng; chỉ admin của dòng họ đó hoặc admin hệ thống; gói `read|propose|write`). Admin hệ thống có thêm gói `admin` (không gắn dòng họ, mọi
  dòng họ + chức năng quản trị, hạn trượt 30 ngày thay vì 90); người khác xin gói này bị 403.
- **Nhiều dòng họ một lần:** màn "Cho phép" chọn được tối đa 20 họ (chỉ các họ mình là admin) với MỘT gói chung. Họ chính ở
  `api_tokens.clan_id`, toàn bộ họ ở `api_token_clans`. Quyền thật tính RIÊNG TỪNG HỌ mỗi lượt gọi (hạ vai trò ở họ B → B chỉ còn đọc,
  A vẫn ghi; rời hết các họ → 401). Admin của BẤT KỲ họ nào trong kết nối thấy và thu hồi được kết nối (thu hồi dừng quyền ở mọi họ).
- **Gọi theo TÊN họ, không bao giờ theo mã:** kết nối nhiều họ và token admin thêm tham số `clan` (tên như người dùng nói, hoặc mã) vào
  mọi tool theo họ, và có tool `list_my_clans` (tên, mô tả, số người, quyền; lọc bằng `q`). Khớp không phân biệt dấu/hoa thường, ưu tiên
  khớp nguyên từ; trùng tên → trả danh sách kèm mô tả + số người để AI hỏi lại người dùng. Kết nối một họ không cần `clan`. Vẫn nhận `clan_id` kiểu cũ.
- **Token:** `POST /oauth/token` — `authorization_code` (code 5 phút, dùng một lần, ràng buộc client + redirect_uri + PKCE) và
  `refresh_token`. Access token `gat_…` sống 1 giờ; refresh token xoay vòng mỗi lần dùng, dùng lại token cũ → thu hồi cả kết nối.
- **Mô hình dữ liệu:** một lần cấp quyền = một hàng `api_tokens` (tên "<ứng dụng> (OAuth)", hạn trượt 90 ngày) — hiện chung ở danh
  sách token, thu hồi ở đó là chết mọi access/refresh token. Băm token ở `oauth_tokens`; `oauth_clients`, `oauth_codes` chỉ service role đụng được.
  Mỗi lượt gọi `/mcp` vẫn kiểm lại thành viên/vai trò/khoá y như token thường.
- **Chống spam:** đăng ký 10 lần/giờ/IP, token 60/phút/IP, cấp quyền 20/phút/người, tối đa 5000 client; client đăng ký mà không ai cấp
  quyền sau 7 ngày bị dọn mỗi giờ. Cấu hình `PUBLIC_ORIGIN` (issuer) trong `mcp.env`.
- **nginx:** thêm các `location` OAuth trong `deploy/nginx-mcp-location.conf`.

## Chạy local

```bash
node mcp-server/build.mjs
SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… \
JWT_SECRET=super-secret-jwt-token-with-at-least-32-characters-long node mcp-server/dist/server.mjs
```

## Triển khai (làm tay lần đầu)

1. **Migration** `20261115100000_api_tokens.sql`, `20261116100000_api_tokens_admin.sql`, `20261116200000_api_tokens_clan_admin.sql`, `20261117100000_oauth_mcp.sql`, `20261117200000_oauth_admin_scope.sql`, `20261117300000_api_token_multi_clan.sql` lên DB self-host (xem [[project_migrations_manual_selfhost]]; ghi `schema_migrations`).
2. **Máy web** (máy chạy FE; địa chỉ thật xem doc vận hành ngoài repo): tạo `/opt/gia-pha-mcp/mcp.env` từ `deploy/mcp.env.example`, `chmod 600`.
   `JWT_SECRET` + `SERVICE_ROLE_KEY` là khoá quyền cao — lấy ở file `.env` của Supabase self-host trên máy DB (`<supabase-dir>/.env`).
3. **nginx** của genealogy-app: chèn `deploy/nginx-mcp-location.conf` vào server block giapha.thaohk.com,
   `docker exec genealogy-app-nginx-1 nginx -t && nginx -s reload`.
4. Chạy workflow **deploy-mcp** (Actions, thủ công): build image `Dockerfile.mcp` → GHCR → `docker compose -f docker-compose.mcp.yml up -d`
   (stack riêng `/opt/gia-pha-mcp`, cố ý không gộp compose của app vì `--remove-orphans`).
5. Kiểm: `curl -X POST https://giapha.thaohk.com/mcp -H "Authorization: Bearer <token>" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`.
