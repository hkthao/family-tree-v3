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

## Biến môi trường của edge function `sync-podcast`

| Biến | Ý nghĩa |
|---|---|
| `FB_PAGE_ID` | ID Trang, ví dụ `984275491441459` (ByteCast Tech) |
| `FB_PAGE_TOKEN` | Page token dài hạn |
| `FB_API_VERSION` | mặc định `v21.0` |
| `FB_SYNC_LIMIT` | số tập kéo mỗi lần, mặc định 25 |
| `CRON_TOKEN` | dùng chung với các cron khác |

## Lịch chạy

`cron.schedule('sync-podcast', '17 */6 * * *', …)` — 6 tiếng một lần. Cần đặt
hai GUC một lần trên database:

```sql
alter database postgres
  set app.sync_podcast_url = 'https://<host>/functions/v1/sync-podcast';
alter database postgres set app.sync_podcast_token = '<CRON_TOKEN>';
```

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
