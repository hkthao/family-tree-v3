# Ảnh xem trước khi chia sẻ bài Bảng tin, hồ sơ người và thiệp khoe (Open Graph)

Trang dòng họ là SPA nên không có thẻ `og:*` theo từng bài. Để Zalo / Facebook / Twitter hiện tiêu đề + ảnh + đoạn
trích khi dán link bài, **máy chủ web chuyển riêng trình quét** sang edge function `og-post`; người thật vẫn nhận ứng dụng.
Không sinh HTML tĩnh (link token là bí mật, bài sửa / ẩn / thu hồi thì file cũ vẫn còn) — xem
`docs/plan-trang-dong-ho.md`, mục 6b.

## Function

`supabase/functions/og-post` — `GET ?token=<token>|clan=<clanId> &id=<postId>` → HTML nhỏ có thẻ `og:*`, `twitter:*`,
`canonical` và `meta refresh` về địa chỉ bài của ứng dụng.

- Cổng kiểm tra y hệt `share-view?part=post`: link còn hiệu lực, loại link xem được cây (`tree_view` / `contribute`),
  mục **Bảng tin** đang bật trong `share_sections`, bài đã đăng. Mọi lỗi đều trả **404 trơn**.
- Ảnh bìa = ảnh https đầu tiên trong bài; không có (hoặc dòng họ bật "ẩn ảnh") thì dùng ảnh chung.
- Link token → `noindex`. Dòng họ công khai → cho lập chỉ mục.
- Biến môi trường của function: `SITE_ORIGIN` (bắt buộc), `OG_IMAGE` (tuỳ chọn), `OG_SITE_NAME` (tuỳ chọn).
- `verify_jwt = false` (đã khai trong `supabase/config.toml`); qua Kong vẫn cần header `apikey` — nginx thêm sẵn.

## nginx (cấu hình nằm trên máy chủ web, KHÔNG đưa vào repo)

Thay các chỗ `<…>` theo môi trường thật. Đặt `map` ở cấp `http`, hai `location` trong `server` của ứng dụng.

```nginx
# Trình quét chia sẻ của các mạng xã hội.
map $http_user_agent $is_share_bot {
    default 0;
    ~*(facebookexternalhit|facebot|zalobot|zalo|twitterbot|telegrambot|slackbot|linkedinbot|whatsapp) 1;
}

# Link chia sẻ: /share/<token>/bang-tin/<postId>
location ~ "^/share/(?<tok>[A-Za-z0-9_-]+)/bang-tin/(?<pid>[0-9a-fA-F-]{36})/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }   # người thật: ứng dụng như cũ (dùng đúng cách phục vụ SPA hiện có)
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-post?token=$tok&id=$pid;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}

# Trang dòng họ công khai: /xem/clans/<clanId>/bang-tin/<postId>
location ~ "^/xem/clans/(?<cid>[0-9a-fA-F-]{36})/bang-tin/(?<pid>[0-9a-fA-F-]{36})/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-post?clan=$cid&id=$pid;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}
```

Ghi chú:
- Nếu ứng dụng đã có `try_files $uri /index.html` ở `location /`, thay dòng `rewrite ^ /index.html last;` bằng cách đang dùng
  để phục vụ SPA (hoặc dùng `error_page`/`try_files` tương ứng) — mục đích chỉ là người thật không bị chuyển sang function.
- `<SUPABASE_ANON_KEY>` là khoá anon công khai của dự án; không dùng service key ở nginx.
- Trình quét cache kết quả; sau khi sửa bài / đổi ảnh bìa, dùng công cụ gỡ lỗi chia sẻ của Facebook để làm mới.

## Mở rộng: hồ sơ người và thiệp khoe

**Hồ sơ người** dùng chung function `og-post` với tham số `kind=person` (`id` là id người). Cổng như `share-view?part=person`:
link hợp lệ + đúng phạm vi cây con; **người còn sống → 404** (không lộ tên); tiểu sử chỉ vào mô tả khi dòng họ công khai hoặc link
có khoá `profiles`. Ảnh luôn là ảnh chung (ảnh người nằm trong bucket riêng, URL ký hết hạn).

```nginx
location ~ "^/share/(?<tok>[A-Za-z0-9_-]+)/nguoi/(?<pid>[0-9a-fA-F-]{36})/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-post?kind=person&token=$tok&id=$pid;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}
location ~ "^/xem/clans/(?<cid>[0-9a-fA-F-]{36})/nguoi/(?<pid>[0-9a-fA-F-]{36})/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-post?kind=person&clan=$cid&id=$pid;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}
```

**Thiệp khoe** `/khoe/:token` dùng function `og-khoe` (`GET ?token=…`): chỉ trả HTML khi thiệp **còn hạn**
(`expires_at > now`), `og:image` là **ảnh thiệp thật** trong bucket công khai `card-shares`, luôn `noindex`; hết hạn / không có → 404.
Biến môi trường: `SITE_ORIGIN` (bắt buộc), `OG_IMAGE`, `OG_SITE_NAME`, `CARD_IMAGE_BASE` (mặc định
`<SUPABASE_URL>/storage/v1/object/public/card-shares`). Thay trang tĩnh chung `public/khoe-og.html` (giữ làm dự phòng).

```nginx
location ~ "^/khoe/(?<tok>[A-Za-z0-9_-]+)/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-khoe?token=$tok;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}
```

Khi triển khai: copy thêm thư mục `og-khoe`, kiểm bằng `curl -H "apikey: <ANON>" "<base>/functions/v1/og-khoe?token=<token>"`,
và **bỏ/sửa khối nginx cũ** đang chuyển `/khoe/:token` sang `khoe-og.html` (nếu không, trình quét vẫn nhận ảnh chung).
**Ảnh OG 1200×630 riêng (mẫu T6):** lúc xuất bản (chia sẻ / tải / sao chép link khoe) trình duyệt dựng thêm một JPEG ~50–150 KB (thiệp thu nhỏ bên trái + tên họ, tiêu đề chữ lớn bên phải), lưu `<clan>/<token>-og.jpg` và ghi `card_shares.og_image_path` (migration `20261126120000`). `og-khoe` ưu tiên ảnh này (kèm `og:image:width/height`), không có thì rơi về ảnh thiệp gốc; function `cleanup-card-shares` dọn cả ảnh OG khi hết hạn — nhớ copy lại cả hai function khi deploy. Lỗi dựng ảnh OG không làm hỏng chia sẻ.

## Triển khai (chỉ khi đã bảo deploy)

1. Copy thư mục `supabase/functions/` (gồm `og-post`, `share-view`, `_shared`) vào thư mục functions của self-host, đặt
   `SITE_ORIGIN` cho function, restart container edge-functions.
2. Kiểm bằng khoá anon: `curl -H "apikey: <ANON>" "<base>/functions/v1/og-post?clan=<id>&id=<postId>"` ra HTML có `og:title`.
3. Thêm hai `location` ở trên vào nginx của máy chủ web, `nginx -t`, reload.
4. Thử: `curl -A facebookexternalhit/1.1 <địa chỉ bài>` ra thẻ OG; `curl <địa chỉ bài>` ra ứng dụng như cũ.
5. Dán link bài vào công cụ gỡ lỗi chia sẻ của Facebook và gửi thử trong Zalo.

## robots.txt phải cho bot xem trước link vào /share/ và /khoe/

Facebook (và vài mạng khác) tôn trọng `robots.txt`: nếu `User-agent: *` chặn `/share/` thì bài đăng link chỉ hiện **mỗi tên miền**, không ảnh, không tiêu đề — kể cả khi nginx/og-post trả OG đúng. `public/robots.txt` có nhóm riêng cho các bot xem trước link (facebookexternalhit, Facebot, Twitterbot, Slackbot, TelegramBot, LinkedInBot, WhatsApp, Discordbot, ZaloBot) cho phép `/share/` và `/khoe/`; công cụ tìm kiếm vẫn bị chặn. Sau khi deploy, dán lại link vào https://developers.facebook.com/tools/debug/ → "Scrape Again" để Facebook bỏ bản đã nhớ.

## Ảnh xem trước của TRANG CHỦ dòng họ (kind=clan)

Link gốc `/share/<mã>` và `/xem/clans/<id>` dùng `og-post?kind=clan`. Admin thiết kế ảnh 1200×630 ở **Trung tâm chia sẻ → "Ảnh xem trước khi chia sẻ"**
(chọn kiểu trong `src/lib/cards/clanOgStyles.ts`; app dựng JPEG, lưu `card-shares/<clan>/clan-og-<ts>.jpg`, ghi `clans.share_og_path/_style/_updated_at`,
migration `20261126160000`). Chưa thiết kế → function trả thẻ chung của ứng dụng (không lộ tên dòng họ). Đã thiết kế → `og:title` "Gia phả <tên>",
mô tả cắt từ giới thiệu dòng họ, `og:image` là ảnh đã lưu (`?v=` đổi mỗi lần lưu). Cổng: link còn hiệu lực + loại link xem được cây; link riêng luôn `noindex`.
Cần biến `CARD_IMAGE_BASE` (hoặc mặc định `<SUPABASE_URL>/storage/v1/object/public/card-shares`) giống `og-khoe`.

```nginx
location ~ "^/share/(?<tok>[A-Za-z0-9_-]+)/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-post?kind=clan&token=$tok;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}
location ~ "^/xem/clans/(?<cid>[0-9a-fA-F-]{36})/?$" {
    if ($is_share_bot = 0) { rewrite ^ /index.html last; }
    proxy_pass http://<EDGE_FUNCTIONS_UPSTREAM>/functions/v1/og-post?kind=clan&clan=$cid;
    proxy_set_header apikey <SUPABASE_ANON_KEY>;
    proxy_set_header Authorization "Bearer <SUPABASE_ANON_KEY>";
}
```

### Link ngắn `/s/<mã>` cho Facebook

Facebook giữ `robots.txt` cũ rất lâu: nếu từng chặn `/share/` thì dù đã sửa, Debugger vẫn báo 403 mà KHÔNG gửi yêu cầu nào tới máy chủ. Đường dẫn
ngắn `/s/<mã>` không nằm trong `robots.txt` cũ nên quét được ngay. Bot → `og-post?kind=clan&alias=1` (og:url trỏ `/s/<mã>`); người thật → 302 sang `/share/<mã>`.
Trung tâm chia sẻ → chi tiết link cây → "Link ngắn cho Facebook" sao chép địa chỉ này.

```nginx
location ~ "^/s/(?<ref>[A-Za-z0-9_-]+)/?$" {
    if ($is_share_bot) { rewrite ^ /__og/clan/a/$ref/- last; }
    return 302 /share/$ref;
}
# trong location ~ "^/__og/..." : mode (t|c|a); với a: set $og_q "$og_q&token=$ref&alias=1";
```
