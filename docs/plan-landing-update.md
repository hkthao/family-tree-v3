# Plan — Cập nhật landing page (donghoviet.thaohk.com)

## Tóm tắt
Landing hiện tại nội dung **tốt** (3.605 từ, 10 mục, FAQ, ảnh thật, OG đầy đủ, dark
mode dùng chung key với app). Vấn đề không nằm ở nội dung mà ở **ba chỗ rò**: không đo
được gì, mọi nút bấm đổ thẳng vào tường đăng nhập, và không có gì cho Google ăn ngoài
một trang duy nhất.

Kiểu file giữ nguyên: **một `index.html` tĩnh, không build**. Mọi đề xuất dưới đây đều
làm được trong file đó.

---

## Hiện trạng
| | |
|---|---|
| Vị trí | `landing/index.html` (46 KB) + `landing/assets/` |
| Deploy | `rsync -az --delete landing/ <host>:<landing-dir>/` (chi tiết ở doc vận hành riêng) |
| Design | Dùng chung hệ "Oxblood" của app; dark mode chia sẻ `localStorage["family-tree:theme"]` |
| Nội dung | 3.605 từ · 10 mục · 4 câu FAQ · ảnh thật (hero, kể chuyện, cây) |
| SEO cơ bản | `<html lang="vi">`, canonical, description, OG + Twitter card đủ 1200×630 |

---

## 🔴 Ba lỗ hổng đo được

### 1. Landing KHÔNG gắn Umami — đang bay mù
`grep -c umami landing/index.html` → **0**.

Nghĩa là con số "donghoviet.thaohk.com: 5 visitor tháng 8" trong Umami **chỉ đếm người
đã bấm sang app**. Bao nhiêu người vào landing rồi bỏ đi, ta **không biết**. Không biết
tỉ lệ chuyển đổi của landing thì mọi việc sửa nội dung bên dưới đều là đoán mò.

→ **Việc số 1, làm trước mọi thứ khác.**

### 2. Cả 9 nút CTA đều đổ vào tường đăng nhập
Cả 9 link `href="https://giapha.thaohk.com"` — mà root của app là
`<Route path="/" element={<Navigate to="/clans" />}>` → `RequireAuth` → **`/login`**.

Đối chiếu phân tích tháng 8: **16 phiên vào `/login`, 8 thoát ngay tại đó**. Landing
làm tốt việc thuyết phục rồi đẩy người ta vào đúng chỗ chết. `signed_in` = **0** trong
cả tháng 8.

Trớ trêu: app **đã có** trang xem công khai không cần đăng nhập
(`/xem/clans/:clanId`, `platform_settings.demo_clan_id`) — landing không link tới cái nào.

### 3. Không có `robots.txt`, không có `sitemap.xml`, không có structured data
Trong khi **organicSearch đã là kênh vào lớn nhất** (8 visitor, vượt organicSocial 6).
Landing là tài sản SEO tự nhiên nhất — tên miền riêng, tĩnh, nhanh — mà đang bỏ không.

Đặc biệt: đã có sẵn **4 câu FAQ** nhưng không đánh dấu `FAQPage` — đây là loại rich
result dễ ăn nhất của Google, gần như không tốn công.

---

## Ưu tiên 1 — Gắn đo lường (nửa ngày)

```html
<script defer src="https://analytics.thaohk.com/script.js"
        data-website-id="f09ad523-5d64-4cf7-a15c-cecc7da13b67"
        data-domains="donghoviet.thaohk.com,giapha.thaohk.com"></script>
```

Dùng **chung website ID với app** để hai bên nằm trong một báo cáo. Lưu ý thật thà:
Umami **không ghép session xuyên tên miền một cách hoàn hảo** — nên đừng tin cột
"visitor" khi đo phễu chéo, mà **dựa vào UTM** (mục dưới).

Event cần bắn: `landing_cta_click` (kèm `{section}`), `landing_demo_click`,
`landing_faq_open`, `landing_scroll_75`.

**Gắn UTM vào mọi link sang app** — hiện tại không có cái nào, nên app chỉ thấy
referrer chung chung, không biết nút nào hiệu quả:

```
https://giapha.thaohk.com/xem/clans/<demo>?utm_source=landing&utm_medium=cta&utm_campaign=hero
```

## Ưu tiên 2 — Sửa đích của CTA (nửa ngày, tác động lớn nhất)

Đảo thứ bậc: **cho xem trước, đừng bắt đăng ký trước.**

| Vị trí | Hiện tại | Đề xuất |
|--------|----------|---------|
| CTA chính (hero, cuối trang) | `giapha.thaohk.com` → login | **"Xem thử gia phả mẫu"** → `/xem/clans/<demo_clan_id>` — không cần đăng nhập |
| CTA phụ | — | **"Tạo gia phả miễn phí"** → `/signup?next=/clans/new` |
| CTA giữa bài | `giapha.thaohk.com` | Giữ nhưng trỏ thẳng `/signup`, không trỏ root |

Lý do: dữ liệu cho thấy người ta **rời đi ở cửa đăng nhập**, không phải ở landing.
Landing đã làm xong việc thuyết phục — đừng bắt họ trả giá ngay lập tức.

Ghi chú kỹ thuật: `demo_clan_id` nằm trong `platform_settings` (**đọc công khai**), nên
landing tĩnh vẫn fetch được bằng một lời gọi `fetch` nhỏ, hoặc đơn giản là hard-code
UUID rồi cập nhật khi đổi.

## Ưu tiên 3 — SEO (1 ngày)

1. **`robots.txt`** + **`sitemap.xml`** — hiện chưa có file nào.
2. **JSON-LD `FAQPage`** cho 4 câu hỏi sẵn có → cơ hội rich result cao nhất.
3. **JSON-LD `SoftwareApplication`** — tên, mô tả, `applicationCategory`, giá (miễn phí
   có gói trả tiền), ngôn ngữ `vi`.
4. **Tách trang con cho từ khoá dài.** Landing một trang không xếp hạng được cho nhiều
   truy vấn. Ứng viên có sẵn nội dung: *cách lập gia phả dòng họ*, *cách tính ngày giỗ
   âm lịch*, *phần mềm gia phả tiếng Việt*. Mỗi trang một file tĩnh, không cần build.
5. Bổ sung `<meta name="robots" content="index,follow">` và
   `<link rel="alternate" hreflang="vi">`.

> Việc này ăn khớp với commit SEO vừa làm cho app (`f662e99`): app lo tiêu đề theo
> route, landing lo cấu trúc và từ khoá. Hai bên không giẫm chân nhau.

## Ưu tiên 4 — Chia sẻ Zalo & Facebook (nửa ngày)
Dữ liệu Umami có traffic thật mang `utm_source=zalo` — kênh này sống, mà landing không
có nút chia sẻ nào.

- Nút **chia sẻ Zalo** (`https://zalo.me/share/link?url=...`) và **Facebook**, đặt cạnh
  CTA cuối trang. App đã làm đúng pattern này ở `ShareTreeButton.tsx:216`.
- Kiểm lại OG preview bằng Zalo debugger — Zalo scraper khó tính hơn Facebook, đặc biệt
  với ảnh > 1 MB. Kiểm `assets/og-banner.png` dung lượng.
- Facebook page đã link 3 chỗ — thêm nút "Theo dõi" thay vì chỉ link chữ.

## Ưu tiên 5 — Hiệu năng & vệ sinh (nửa ngày)

1. **Tự host font.** Đang tải Be Vietnam Pro + Noto Serif từ `fonts.googleapis.com` —
   request chặn render, đi vòng ra nước ngoài, chậm đáng kể với mạng VN. Tự host trong
   `assets/fonts/` + `font-display: swap`.
2. **`.DS_Store` đang bị deploy lên production.** Lệnh `rsync -az --delete landing/`
   không loại trừ nó. Thêm `--exclude='.DS_Store'` và một dòng vào `.gitignore`.
3. Ảnh: kiểm `hero-family.jpg`, `family-*.jpg` đã nén chưa; thêm `loading="lazy"` cho
   ảnh dưới màn hình đầu, `width`/`height` để tránh nhảy layout.
4. Thêm `assets/app-icon.svg` làm favicon nếu chưa có.

## Nội dung — bổ sung khi tính năng sẵn sàng
- **Mục "Trợ lý AI"** — thêm sau khi giai đoạn 1 của [plan-ai-tro-ly.md](plan-ai-tro-ly.md)
  lên production. Góc kể chuyện đúng nhất: *"Ông bà chỉ cần nói, không cần gõ"* — nói
  vào nỗi sợ thật (gõ tiếng Việt có dấu), không nói "chúng tôi có AI".
- **Mục bảng giá** — thêm khi hạn mức và thanh toán chạy. Nhấn mạnh: **miễn phí dùng
  được thật**, gói lẻ không hết hạn.
- **Bằng chứng xã hội** — mục "Được các dòng họ tin dùng" hiện đang chung chung. Thay
  bằng số thật khi có (số dòng họ, số người trong gia phả) — số cụ thể đáng tin hơn lời khen.

## Không làm
- **Không chuyển sang framework.** File tĩnh không build là đúng cho trang này; thêm
  Astro/Next chỉ đổi lấy công bảo trì.
- **Không làm OG động per-clan** ở landing — việc đó thuộc app và đã hoãn có lý do.
- **Không thêm chatbot vào landing.** Trợ lý AI thuộc trong app, sau khi đăng nhập —
  đặt ở landing chỉ tốn tiền cho khách vãng lai.

## Đo lường thành công
Sau 4 tuần kể từ khi gắn Umami, các chỉ số cần có:

| Chỉ số | Hôm nay | Mục tiêu |
|--------|---------|----------|
| Visitor landing | **chưa đo được** | có số |
| Tỉ lệ bấm CTA | chưa đo được | > 15% |
| Landing → mở demo | 0 (chưa có link) | > 8% |
| Landing → `signed_in` | ~0 | > 2% |

Chỉ số thật sự quan trọng là **cột cuối**. Ba cột trên chỉ để biết chỗ nào rò.

## Thứ tự đề nghị
1. ~~Umami + UTM~~ ✅
2. ~~Sửa đích CTA sang demo công khai~~ ✅
3. ~~`robots.txt` + `sitemap.xml` + JSON-LD FAQ~~ ✅
4. ~~Nút chia sẻ Zalo~~ ✅ · ~~sửa `.DS_Store`~~ ✅
5. **Tự host font** — còn lại, cần tải woff2 subset tiếng Việt về `assets/fonts/`
6. **Nén ảnh** + `loading="lazy"` + `width`/`height`
7. **Trang con SEO theo từ khoá dài** — việc lớn nhất còn lại

## Đã làm (23/8/2026)
- Umami gắn chung website id với app, kèm 5 event: `landing_cta_click`
  (có `section`), `landing_demo_click`, `landing_faq_open`, `landing_scroll_75`,
  `landing_share`. Mọi lời gọi bọc try/catch — adblock chặn Umami là chuyện
  thường, không được để nó làm vỡ trang.
- 9 CTA không còn cái nào trỏ root. Hero đảo thứ bậc: **"Xem thử gia phả mẫu"**
  thành nút chính, "Tạo gia phả miễn phí" xuống phụ. Mọi link mang UTM riêng
  theo vị trí nên biết được chỗ nào hiệu quả, không chỉ biết "có người bấm".
- Route mới **`/xem/demo`** trong app tự phân giải `demo_clan_id` → landing tĩnh
  không phải hard-code UUID, đổi dòng họ demo ở /admin là landing tự trỏ đúng.
- `robots.txt`, `sitemap.xml`, JSON-LD `FAQPage` (5 câu) + `SoftwareApplication`.
- Nút chia sẻ Zalo + Facebook ở cuối trang.
