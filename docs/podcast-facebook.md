# Podcast — đồng bộ từ Trang Facebook

## Tóm tắt

Các tập podcast đăng trên Trang Facebook của nền tảng được kéo về bảng
`podcast_episodes`, rồi app hiện lại ở `/podcast` và trên trang "Hôm nay".

**Không cần Meta duyệt (App Review).** Tài liệu Meta: *"If your app will only be
used by app users who have a role on the app itself, App Review is not
required."* App do chính chủ Trang tạo, chính chủ Trang có vai trò admin trên
app — đúng trường hợp miễn duyệt.

## Những gì đã ĐO được (không phải đoán)

Gọi thật vào Trang ByteCast Tech ngày 14/09/2026:

| Câu hỏi | Kết quả |
|---|---|
| `/{page-id}/video_reels` đọc được không? | **Không** — Meta ghi rõ "You cannot perform this action on this endpoint". Nó chỉ để ĐĂNG. |
| Reel có trong `/{page-id}/videos` không? | **Có**, đủ `id`, `description`, `created_time`, `permalink_url`, `picture`, `length` |
| Reel có `title` không? | **Không.** Tiêu đề phải rút từ dòng đầu `description` |
| `permalink_url` là gì? | Đường dẫn **tương đối**: `/reel/1356331553352275/` |
| Nhúng được vào web không? | **Được** — plugin `plugins/video.php` trả trang có thẻ `<video>`, không báo "nội dung không khả dụng" |

## Quyền và token

Quyền cần, bật trong **Use case "Manage everything on your Page" → Customize**:

- `pages_show_list` (mặc định)
- `pages_read_engagement`
- `pages_read_user_content`

⚠️ **Token là bản chụp quyền tại thời điểm tạo.** Thêm quyền cho app KHÔNG làm
token cũ mạnh lên — phải sinh token mới.

Chuỗi token (bắt buộc theo thứ tự này):

```
User token ngắn (1–2 giờ)
  → đổi lấy User token dài (60 ngày):
    GET /oauth/access_token?grant_type=fb_exchange_token
        &client_id=<app_id>&client_secret=<app_secret>&fb_exchange_token=<token ngắn>
  → GET /me/accounts  → Page token (gần như không hết hạn)
```

Page token **thừa hưởng quyền của User token lúc sinh ra nó** — sinh Page token
từ một User token thiếu quyền thì Page token cũng thiếu y như vậy.

## Cắm token từ màn hình quản trị (cách nên dùng)

**Quản trị › Podcast › Kết nối Facebook.** Dán App ID + App Secret + token
người dùng (ngắn hạn cũng được) → máy chủ tự đổi sang token dài hạn, đọc danh
sách Trang cho admin chọn, rồi lưu Page token đã **mã hoá AES-GCM** vào bảng
`fb_page_credentials`.

Ba điều cố ý:

- **Bảng token không có RLS policy nào.** RLS bật + không policy = chặn sạch
  mọi vai trò qua PostgREST, kể cả platform admin. Chỉ service role (edge
  function) đọc nổi. Admin xem trạng thái qua RPC `fb_page_credentials_status()`
  — hàm này trả tên Trang, 4 ký tự cuối token, hạn dùng, kết quả kiểm tra gần
  nhất; **không bao giờ trả token**.
- **App Secret không được lưu.** Nó chỉ cần cho đúng lần đổi token; thứ gì
  không cần giữ thì đừng giữ.
- **Không dùng `platform_settings`** cho token — bảng đó `using (true)`, tức
  đọc công khai. Cắm token vào đó là tặng cả cái Trang cho mọi khách vãng lai.

Mã hoá dùng chung KEK với khoá AI (`AI_KEY_ENCRYPTION_KEY`) — đổi KEK thì phải
cắm lại token.

## Biến môi trường của edge function `sync-podcast`

Chỉ còn là **đường lui** khi chưa cắm token trong app (hoặc KEK đổi làm bản mã
thành rác). Có bản ghi trong `fb_page_credentials` thì nó được ưu tiên.

| Biến | Ý nghĩa |
|---|---|
| `FB_PAGE_ID` | ID Trang, ví dụ `984275491441459` (ByteCast Tech) |
| `FB_PAGE_TOKEN` | Page token dài hạn |
| `AI_KEY_ENCRYPTION_KEY` | KEK để mã hoá/giải mã token đã lưu (đã có sẵn cho khoá AI) |
| `FB_API_VERSION` | mặc định `v21.0` |
| `FB_SYNC_LIMIT` | số tập xin trong MỖI TRANG kết quả, mặc định 50 |
| `FB_SYNC_MAX` | trần tổng số tập một lần chạy, mặc định 500 |
| `CRON_TOKEN` | dùng chung với các cron khác |

## Lịch chạy

`cron.schedule('sync-podcast', '17 */6 * * *', …)` — 6 tiếng một lần. Cần đặt
hai GUC một lần trên database:

```sql
alter database postgres
  set app.sync_podcast_url = 'https://<host>/functions/v1/sync-podcast';
alter database postgres set app.sync_podcast_token = '<CRON_TOKEN>';
```

## Facebook trả kết quả theo TRANG

`/{page-id}/videos` chỉ trả về một trang, kèm con trỏ `paging.next`. Lấy một
trang rồi dừng thì Trang có 188 video mà app chỉ thấy **25 tập mới nhất** — đã
dính đúng lỗi này. Hàm đồng bộ đi hết con trỏ, dừng khi trang trả về rỗng (đừng
chỉ tin con trỏ) hoặc khi chạm trần `FB_SYNC_MAX`.

Cũng vì thế, mỗi lần chạy phải đọc danh sách tập đã có **một lần duy nhất** rồi
ghi theo lô. Hỏi cơ sở dữ liệu từng tập một là gần 400 lượt gọi cho 188 tập —
đủ để hàm hết giờ giữa chừng và bỏ dở.

Riêng nhóm tập admin đã sửa tiêu đề thì phải UPDATE thật, không upsert được:
upsert vẫn dựng một dòng để chèn thử, mà dòng đó thiếu `title` nên vướng ràng
buộc NOT NULL — dù bản ghi đã tồn tại và ta chỉ định sửa vài cột khác.

## Kiểu hỏng phải đề phòng

**Token Facebook chết âm thầm.** Đổi mật khẩu Facebook, gỡ app, hoặc Meta đổi
luật là token ngừng hoạt động — app vẫn chạy bình thường, chỉ là không bao giờ
có tập mới nữa. Không ai nhận ra cho tới vài tháng sau.

Vì thế mỗi lần đồng bộ ghi lại `podcast.last_sync_at` và `podcast.last_sync_error`
vào `platform_settings`, và trang **Quản trị → Podcast** bật cảnh báo đỏ khi quá
3 ngày không đồng bộ được. Đây là phần quan trọng nhất của tính năng, dù nó chỉ
là một dòng chữ nhỏ.

## Quyền riêng tư

Iframe của Facebook kéo theo mã theo dõi của Meta. Nên:

- **Chỉ nạp iframe khi người dùng bấm Xem** — mở trang không nạp sẵn.
- Ảnh bìa lấy từ CDN Facebook (URL có hạn dùng, mỗi lần đồng bộ ghi đè lại).
- Cần bổ sung một dòng vào chính sách riêng tư về việc nhúng nội dung Facebook.
