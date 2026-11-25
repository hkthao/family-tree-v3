# Plan: Trang dòng họ (thiết kế lại trang Share thành website nhiều trang)

Trạng thái: **đã chốt hướng, chưa có code.** Soạn ngày 24/11/2026.
Bản thiết kế tham chiếu: canvas Design "Trang dòng họ — thiết kế lại trang Share"
(https://claude.ai/artifact/5uK5A5tiSUkgZcNuZEy2nq, riêng tư). Gồm 10 màn: Trang chủ (+ bản điện thoại),
Đọc bài, Bảng tin, Cây gia phả, Sự kiện & giỗ (lịch), Di sản, Mộ phần & tro cốt, Bảng vàng công đức, Cùng góp.

## 1. Mục tiêu

Biến tab "Tổng quan" của link chia sẻ (hiện là một màn dài các thẻ) thành **website dòng họ**: có header + menu,
đọc được bài Bảng tin như blog, lịch giỗ/sự kiện, trang riêng cho Di sản / Mộ phần / Bảng vàng, tìm kiếm toàn trang,
giữ tông màu và sáng/tối của app.

Phạm vi: chỉ kênh **tree_view** (link token xem cây + trang công khai `/xem/clans/:id`). Các scope `single_person`,
`resting_place` (QR mộ), `heritage_item` (QR di sản) **giữ nguyên giao diện cũ**, không đụng.

## 2. Hai quyết định đã chốt

### 2.1 Bài viết dùng Markdown
- Cột `clan_posts.body` vẫn là `text` (giới hạn 20000 ký tự đã có) — **không đổi schema**, chỉ đổi cách soạn và hiển thị.
- Hiển thị bằng `src/components/markdown/MarkdownView.tsx` (đã có: `rehype-raw` + `rehype-sanitize` + `markdownSanitizeSchema`).
- Soạn bằng `src/components/markdown/MarkdownEditor.tsx` (đã có, đang dùng cho nội dung khác).
- Bài cũ là chữ thường: xuống dòng đơn sẽ bị gộp khi render markdown. Xử lý: bật `remark-breaks` trong lúc hiển thị
  bài Bảng tin (hoặc chuẩn hoá khi hiển thị: `\n` → hai dấu cách + `\n`). Cần thử với vài bài cũ trước khi chốt.
- Không thêm cột ảnh bìa / tag / slug:
  - **Ảnh bìa** = ảnh markdown đầu tiên trong `body` (không có thì dùng khối màu như thiết kế).
  - **Tag** = nhãn của `clan_posts.type`: `news` Tin chung · `event` Sự kiện · `birth` Tin vui · `death` Tin buồn · `notice` Thông báo.
    (Chip lọc trong thiết kế đổi theo năm nhãn này, bỏ "Lịch sử / Tư liệu / Giai thoại".)
  - **Tiêu đề**: cột `title` vẫn cho phép rỗng; khi rỗng hiển thị dòng đầu của `body`. Trình soạn mới bắt buộc nhập tiêu đề (chỉ ở UI).
  - **Thời gian đọc** = tính ở client (số từ / 200).
  - **Bài trước / sau, Đọc tiếp** = lấy từ danh sách đã phân trang, không cần cột mới.

### 2.2 Gộp hệ cờ: dùng `clans.share_sections`, không tạo hệ mới
Hiện có hai hệ chạy song song:
- `clans.public_show_tree / heritage / graves / events` (4 boolean, form Cài đặt họ) — chỉ cho trang công khai.
- `clans.share_sections text[]` (7 khoá, `ShareSectionsCard`, ràng buộc CHECK) — chỉ cho link token.

Chốt: **`share_sections` là nguồn duy nhất quyết định trang nào hiện, cho cả hai kênh.** `visibility` +
`public_show_tree` giữ vai trò **cửa vào** (dòng họ có công khai và cho xem cây hay không), không phải cờ từng mục.

Ánh xạ trang ↔ khoá:

| Trang | Khoá `share_sections` | Ghi chú |
|---|---|---|
| Trang chủ (giới thiệu) | `info` | có sẵn |
| Bảng tin | `board` | có sẵn |
| Cây gia phả | — | luôn có |
| Sự kiện & giỗ | `events` | **khoá mới** (thay `public_show_events`) |
| Di sản | `heritage` | có sẵn (thay `public_show_heritage`) |
| Mộ phần & tro cốt | `graves` | có sẵn (thay `public_show_graves`) |
| Bảng vàng công đức | `honor` | có sẵn |
| Ảnh ghép / Bản đồ | `mosaic` / `map` | có sẵn, hiện ở Trang chủ |
| Cùng góp, Hỏi & trả lời | — | chỉ link token và `community.can_contribute` |

Menu được dựng từ danh sách khoá đang bật: khoá nào tắt thì mục menu biến mất; nhóm "Di sản ▾" chỉ còn 1 mục thì
hiện thẳng mục đó, không còn thả xuống.

## 3. Dữ liệu và API

### 3.1 Migration (áp tay lên self-host, nhớ ghi `schema_migrations`)
1. Sửa CHECK của `share_sections` để thêm `'events'`.
2. Chuyển cờ cũ sang cờ mới, **ưu tiên riêng tư**: với dòng họ `visibility = 'public'`, ba khoá `heritage / graves / events` trong `share_sections` được đặt **đúng bằng** `public_show_*` cũ (cũ bật thì bật, cũ tắt thì tắt). Lý do: ba cờ cũ nằm trong 11 chính sách RLS (di sản, mộ phần, sự kiện và ảnh trong storage) nên khi chuyển, RLS đọc `share_sections`; nếu lấy hợp của hai bên thì dòng họ công khai từng tick riêng "Mộ phần/Di sản" cho link sẽ bị lộ cho mọi tài khoản đăng nhập. Hệ quả chấp nhận: dòng họ công khai đã tick riêng cho link mà chưa mở cờ công khai sẽ mất mục đó khỏi link cho tới khi admin tick lại. Dòng họ riêng tư giữ nguyên `share_sections`.
3. **Giữ** 3 cột `public_show_heritage/graves/events` thêm một đợt phát hành (không còn được đọc), xoá ở đợt sau.
4. Không đụng `clan_posts`.

### 3.2 Edge function `share-view`
- **Không `part`** = payload hiện tại (giữ tương thích; bỏ phần nặng khỏi các bản sau khi front đã chuyển hẳn).
- Thêm `part` (GET, có `token` hoặc `clan`):
  - `posts` (`page`, `per`, `type`): danh sách bài đã `published`, ghim lên đầu; trả `excerpt` (đã gỡ markdown, ~200 ký tự), `cover` (ảnh đầu), `type`, `pinned`, `created_at`.
  - `post` (`id`): một bài đầy đủ + id bài trước/sau.
  - `events`: sự kiện (cả hai kênh, thay vì chỉ trang công khai) — giỗ vẫn tính ở client từ người đã mất.
  - `heritage` (phân trang, kèm ảnh bìa) và `heritage_item` (`id`, theo dòng họ) — tái dùng logic scope QR.
  - `graves` (phân trang): **không toạ độ, không địa chỉ chi tiết**, chỉ người đã mất.
  - `honor` (phân trang).
  - `search_index`: danh sách gọn `{kind, id, title}` cho bài viết / di sản / mộ phần (tối đa ~500), tải lười khi ô tìm kiếm được focus.
- Mọi `part` đều lọc theo `share_sections` của dòng họ (khoá tắt → 404 hoặc mảng rỗng).
- Giới hạn tốc độ: hiện 60 yêu cầu/phút/IP dùng chung. Duyệt nhiều trang sẽ chạm trần → tách bộ đếm cho `part` (nới hơn) hoặc thêm `Cache-Control` ngắn (khoảng 60 giây) cho các `part` không đổi theo người dùng.
- `bump_clan_visit` chỉ gọi ở lần tải đầu, không gọi ở từng `part`.

### 3.3 Front
- Giữ `/share/:token` và `/xem/clans/:id` làm điểm vào; thêm route con để có địa chỉ riêng:
  `…/bang-tin`, `…/bang-tin/:postId`, `…/cay`, `…/su-kien`, `…/di-san`, `…/di-san/:itemId`, `…/mo-phan`, `…/bang-vang`, `…/cung-gop`.
- Tách khỏi `src/pages/Share.tsx` (1529 dòng) thành `src/pages/site/`: `ClanSiteLayout` (header, menu, tìm kiếm, footer, nút lên đầu) + mỗi trang một file. Màn Cây giữ nguyên bộ dựng family-chart hiện có, chỉ đổi khung và thanh công cụ theo thiết kế.
- Menu điện thoại: nút ba gạch mở danh sách dọc (theo thiết kế bản 390px).
- Tìm kiếm toàn trang: tìm không dấu trên người (đã có trong payload cây) + `search_index` + trang. Chưa làm tìm phía server.
- Mọi chuỗi UI dùng `t` của Lingui (theo plan đa ngôn ngữ).

### 3.4 Soạn bài
- Form đăng bài ở Bảng tin trong app đổi sang `MarkdownEditor` (tiêu đề bắt buộc, chọn loại bài, xem trước).
- Công cụ MCP `create_post` / `update_post`: ghi rõ `body` là markdown trong mô tả tham số.

## 4. Thay đổi cần áp lại cho bản thiết kế
- Mộ phần: **bỏ nút "Chỉ đường"** (trang này không có toạ độ). Chỉ đường vẫn dùng qua link QR từng mộ.
- Bảng tin: chip lọc theo năm loại bài ở mục 2.1.
- Menu: dựng theo khoá đang bật, không cố định 6 mục.
- Nút chia sẻ Zalo/Facebook trên trang bài: từ bước 1 đến 7 **chưa có ảnh xem trước** (SPA không có thẻ OG theo bài; phương án trang HTML tĩnh đã huỷ 24/11/2026). Vẫn giữ nút. Ảnh xem trước được thêm ở bước 8 (mục 6, bước 8) bằng edge function trả thẻ OG riêng cho trình quét, không sinh HTML tĩnh.

## 5. Kết quả kiểm tra trước khi code (bước 1, đã xong 24/11/2026)
- **Toạ độ mộ phần: không lộ trong payload cây.** `resting_places` (có `latitude/longitude/address`) chỉ được nạp khi `includeExtras`, tức scope `single_person` (thẻ cá nhân, có "Chỉ đường" từ trước); payload `tree_view` không có. Phần `heritage` của trang công khai cũng không chọn toạ độ. Kết luận: **không có lỗ hổng cần vá riêng**; trang Mộ phần của website lấy từ `part=graves` (không toạ độ) nên vẫn bỏ nút "Chỉ đường".
- **Bài cũ chữ thường:** `@uiw/react-markdown-preview` chỉ dùng `remark-gfm`, không có `remark-breaks`, nên xuống dòng đơn sẽ bị gộp. Thay vì thêm thư viện, dùng hàm `normalizePostMarkdown` (`src/lib/postMarkdown.ts`) đổi xuống dòng đơn thành xuống dòng cứng, trừ danh sách, trích dẫn và khối code. Cùng file có sẵn `firstImageUrl` (ảnh bìa), `postExcerpt`, `postDisplayTitle`, `readMinutes`. Có test.
- **Ánh xạ trang ↔ khoá:** `src/lib/siteSections.ts` (`isPageVisible`, `buildSiteMenu`) + test, khớp bảng ở mục 2.2.
- **Chưa kiểm tra:** Zalo Mini App (tạm dừng) có phụ thuộc phần payload sẽ bỏ ở bước dọn hay không.

## 6. Các bước làm
1. ~~**Kiểm tra** mục 5 + viết test cho ánh xạ cờ.~~ **Xong** (kết quả ở mục 5).
2. ✅ **Xong ở local (24/11/2026), chưa áp lên prod.** **Migration** `20261126100000_share_sections_merge_public_flags.sql` (+`events`, gộp cờ, viết lại 9 chính sách RLS + 2 chính sách storage) và sửa form/`navModel`/`clan-detail`/edge function/bản dịch/test. Migration đã chạy thử trên DB local (giao dịch hoàn tác) và kiểm công thức chuyển cờ bằng dữ liệu mẫu. Nội dung gốc của bước: gỡ 3 công tắc công khai khỏi form Cài đặt họ / `ClanFormFields` / tạo họ; thêm thẻ "Trang nào hiện" dùng `ShareSectionsCard` (thêm khoá `events`); sinh lại `database.types`.
3. ✅ **Xong ở local (24/11/2026), chưa deploy.** **Edge function**: các `part` nằm ở `supabase/functions/share-view/parts.ts` (posts, post, events, heritage, heritage_item, graves, honor, search_index), lọc theo `share_sections`, chỉ scope `tree_view` (scope QR mộ/di sản/một người trả 403 cho `part`), phân trang có trần (per tối đa 30), bộ đếm tốc độ riêng 240/phút cho `part` (khoá `ip|part`), `Cache-Control: public, max-age=60` cho phản hồi 200. Quyết định thêm khi làm: danh sách và chi tiết di sản chỉ lấy mục `status = 'active'` (trước đây cả mục nháp cũng lọt ra ở các đường khác — chưa sửa các đường đó); ảnh bìa bài viết chỉ nhận ảnh https; `heritage_item` của trang dòng họ bỏ toạ độ + địa chỉ (link QR vẫn giữ như cũ); `loadHeritageItem` dùng chung cho link QR di sản. `postMarkdown.ts` được sao sang `_shared/vendor/` (có test chống trôi). 28 test mới, đã gọi thử bằng curl với DB local (dữ liệu thật + 3 bài tạm đã xoá).
4. **Front** (đang làm). **Xong ở local (24/11/2026, đợt 1):** cửa vào `ClanSiteRoot` (`/share/:token/*`, `/xem/clans/:clanId/*`), khung chung `ClanSiteLayout` (header, menu tab gạch chân, nhóm Di sản thả xuống, menu điện thoại, footer, nút lên đầu trang, tên họ dài bị cắt `…`), Trang chủ (phần đầu + giới thiệu qua `part=info` + "Sắp tới trong họ" tính từ người đã mất trong cây + khối Bảng tin / Di sản / Mộ phần / Bảng vàng mới nhất, mỗi khối chỉ hiện khi mục bật và có dữ liệu; nút cỡ `sm` như app; menu ngang từ 1024px, dưới đó là nút ba gạch), Bảng tin (lọc theo loại, phân trang trên URL, bài đầu hiện lớn), trang đọc bài (markdown, chia sẻ, bài trước/sau, Đọc tiếp). Edge function trả thêm `site_sections` để dựng menu cho cả link token lẫn trang công khai. **Cờ bật:** mặc định TẮT (vẫn là màn Share cũ); bật bằng `?site=1` (nhớ trong phiên) hoặc `VITE_CLAN_SITE=1`; `?site=0` tắt. Scope khác `tree_view` luôn dùng màn cũ. Đã chụp màn bằng trình duyệt thật (máy tính + 390px) trên DB local. **Đợt 2 xong ở local (24/11/2026):** Sự kiện & giỗ (dùng lại `EventsCalendar` + `UpcomingEventList` của app, thêm chế độ `readOnly`), Di sản (danh sách + chi tiết, không toạ độ), Mộ phần, Bảng vàng; dùng chung `useSiteList` (lọc + phân trang trên URL, giá trị lọc lạ bị bỏ). Sửa lỗi nền: payload cây trước đây KHÔNG kèm `death_anniv_lunar_*` nên giỗ không bao giờ hiện ở trang chia sẻ — giờ có (chỉ người đã mất). Link mời góp (`scope=contribute`) cũng dùng được trang dòng họ. **Bản đồ xong ở local:** `part=map` (chỉ số đếm theo tỉnh, không địa chỉ / tên người) + khối "Bản đồ dòng họ" ở Trang chủ dùng lại `ProvinceMap`. **Cây xong ở local:** tách nguyên văn phần cây của `Share.tsx` (~740 dòng: chọn người trung tâm, Tuỳ chọn cây, 2D/3D, hướng dẫn, xuất ảnh, toàn màn hình) thành `src/components/share/ShareTree.tsx`; màn Share cũ và trang Cây của website cùng dùng nó (đã so sánh bằng trình duyệt thật: 43 thẻ ở cả hai, đổi tab / toàn màn hình / ngăn Tuỳ chọn của màn cũ vẫn chạy). **Đợt 3 xong ở local (24/11/2026) — hết bước 4:** Trang chủ có khối Ảnh ghép (`part=mosaic`, ẩn khi dòng họ bật ẩn ảnh); trang Cùng góp + Hỏi & trả lời dùng nguyên `CommunitySharePanel` (chỉ link token cho phép đóng góp), link mời cũ `?tab=gop|hoi&p=&q=` tự chuyển tới đó; tìm kiếm toàn trang (ô ở header, mục đầu menu điện thoại): gõ không dấu, tìm trang + người trong cây + bài viết / di sản / mộ phần / bảng vàng (chỉ mục tải lười), chọn người mở cây tại `?p=<id>`. Tất cả vẫn nằm sau cờ `?site=1`.
5. ✅ **Xong ở local (25/11/2026).** Form đăng/sửa bài dùng `MarkdownEditor` (tiêu đề bắt buộc với bài mới; bài cũ chưa có tiêu đề không ép; ngăn kéo dùng chế độ chỉ-soạn, trang dùng soạn + xem trước; chế độ chỉ xem hiện `MarkdownView`); đọc bài trong app (`BoardPostDetail`) hiển thị markdown; thẻ bài (`ClanPostCard`) và tiểu sử (`PersonDetail`) dùng đoạn trích thuần chữ; mô tả MCP `create_post` / trường `body` nói rõ markdown.
6. ✅ **Xong (25/11/2026).** Typecheck pass; 1070 test không-RLS + 191 test RLS pass; chạy thử bằng trình duyệt thật (link token, trang công khai, điện thoại 390px). ⚠️ **Đừng chạy `src/test/rls` trên DB local đang có dữ liệu seed:** `rls/clan_posts.test.ts` xoá TOÀN BỘ `clan_posts` (`delete().gte("created_at", "1970-01-01")`) — đã làm mất bài seed của Nhà Trần một lần (seed lại bằng script seed).
7. **Dừng ở local chờ bạn test xong mới deploy** (website: bước 1–7). Deploy: migration áp tay qua ssh + `docker exec psql` rồi ghi `schema_migrations`; edge function copy vào thư mục functions của self-host rồi restart container edge; không đưa IP/hostname vào repo (test `noInfraSecrets` chặn).

8. ✅ **Xong ở local (25/11/2026), chưa deploy.** Xem mục 6b + `docs/og-post-nginx.md`: function `og-post` (`og.ts` + `index.ts`), `share-view/access.ts` dùng chung cho cổng xác thực (share-view cũng đã chuyển sang dùng), 15 test; đã chạy thật với DB local (link token, trang công khai, link sai, bài khác → 404).

## 6b. Bước 8: thẻ OG cho trình quét (không sinh HTML tĩnh)

Vì sao không sinh HTML tĩnh: link token là bí mật nên không đưa vào file tĩnh; bài sửa, ẩn hay thu hồi link thì file cũ vẫn còn. Đó cũng là lý do phương án tĩnh đã huỷ (code cũ ở nhánh `archive/trang-cong-khai-tinh`, chỉ để tham khảo).

Cách làm:
- Edge function mới `og-post`: gọi cùng logic với `share-view?part=post`, trả một trang HTML gọn có `og:title`, `og:description` (đoạn trích), `og:image`, `og:url`, kèm chuyển hướng sang địa chỉ bài của ứng dụng cho trường hợp người thật mở nhầm.
- Vẫn chia sẻ **đúng địa chỉ bài của ứng dụng**, không có link thứ hai. Máy chủ web nhận ra trình quét theo tên trình duyệt (`facebookexternalhit`, Zalo, `Twitterbot`) và chuyển riêng chúng sang `og-post`; người thường vẫn nhận ứng dụng. Cấu hình nginx nằm trên máy chủ, **không đưa vào repo**: tài liệu chỉ ghi hướng dẫn với tên máy là placeholder (test `noInfraSecrets` chặn).
- Cổng kiểm tra giống `part=post`: link còn hiệu lực, bài `published`, khoá `board` đang bật trong `share_sections`; không thì trả 404 cho trình quét.
- Ảnh bìa: ảnh trong kho nội bộ dùng link ký tên có hạn nên trình quét sẽ cache link hết hạn. Chỉ dùng ảnh ngoài (https) hoặc một đường dẫn ảnh ổn định; không có thì dùng ảnh chung của dòng họ.
- Triển khai theo quy trình function self-host (copy vào thư mục functions, restart container edge, kiểm bằng ANON JWT) và sửa nginx; chỉ làm khi bạn bảo deploy.
- Kiểm thử: dán link vào công cụ gỡ lỗi chia sẻ của Facebook và thử gửi trong Zalo.

## 6c. Rà soát cuối (25/11/2026)

Đã bổ sung sau rà soát: trang **hồ sơ người** (`nguoi/:id`, thay tab "Chi tiết & nguồn" của màn cũ: thông tin, quan hệ, tiểu sử + nguồn cho dòng họ lịch sử công khai; nút "Xem hồ sơ" cạnh ô chọn người trên cây); **đo lượt xem** như màn cũ (`public_clan_viewed`, `share_viewed`, `share_cta_click`). Đã kiểm: `npm run build` chạy được, giao diện sáng, 5 trang ở 390px không tràn ngang.

Còn thiếu / chưa làm:
- Triển khai prod (bước 7) và bật mặc định: migration gộp cờ, edge function `share-view` + `og-post` (+ `SITE_ORIGIN`), nginx; hiện website tắt mặc định (`?site=1`), màn Share cũ chạy song song.
- **Đã bổ sung (25/11/2026):** `SiteNotices` — lưu ý "Thông tin nhạy cảm đã được ẩn" (đóng được, dùng chung khoá nhớ với màn Share cũ) và, với dòng họ công khai, nút "Đăng nhập để xem đầy đủ & cùng vun đắp"; không hiện ở link tập trung (QR / thiệp).
- **Đã quyết BỎ (25/11/2026):** bình luận dưới bài viết và loại đóng góp "Sửa thông tin" riêng cho khách. Khách muốn sửa / bổ sung thông tin thì viết thẳng vào **Câu chuyện** (form Cùng góp có dòng gợi ý này), người quản lý xem và cập nhật; không nhập form có cấu trúc.
- **Đã kiểm (25/11/2026):** máy tính bảng 768 / 820 / 1024px (8 trang, không tràn ngang, không lỗi console); link token giới hạn cây con (tree_view + root_person_id: payload chỉ còn người gốc + con cháu + vợ/chồng, `part=person` ngoài phạm vi → 404; lưu ý các mục cấp dòng họ như mộ phần / bảng vàng / di sản vẫn là của cả họ theo khoá `share_sections`, đúng như màn Share cũ); dòng họ 5000 người (home / cây / hồ sơ tải ~1 giây, payload 1,7 MB, không lỗi).
- **Lỗi tìm thấy và đã sửa khi kiểm:** share-view đọc `persons` / `families` một lần nên PostgREST cắt âm thầm ở `max_rows` = 1000 → dòng họ trên 1000 người mất người ở cây chia sẻ (cả màn cũ lẫn mới) và tính sai phạm vi cây con. Nay phân trang (`share-view/paging.ts`, test `shareViewPaging.test.ts`; chốt 50.000 hàng).
- **Còn lại:** sitemap cho các trang con công khai (cần quyết đưa những họ nào vào), ESLint (cấu hình repo đang lỗi).

## 6d. Trang hồ sơ người — thiết kế lại thành tiểu sử cá nhân (25/11/2026)

Bản thiết kế: artboard "10 · Hồ sơ người — tiểu sử cá nhân" trong canvas Design. Trang hồ sơ hiện tại (`SitePerson`) chỉ bọc lại
`SharedPersonCard` (thông tin cơ bản + quan hệ + tiểu sử); mục tiêu là một **trang tiểu sử đầy đủ thông tin công khai** của người đã mất.

### Bố cục
- **Đầu hồ sơ:** ảnh chân dung tròn viền đồng, huy hiệu (Đời N · Đã mất · Giới tính), tên (serif lớn), tên hiệu + năm sinh–mất, tóm tắt 2 dòng,
  nút: Xem trên cây · Đóng góp về người này · Chia sẻ hồ sơ.
- **Cột chính:** Tiểu sử (chữ serif căn đều, chip "Theo: …" dẫn nguồn) → Dấu mốc cuộc đời (đường thời gian dọc) → Hình ảnh & tư liệu →
  Ký ức gia đình (trích dẫn + người kể, link "Góp một câu chuyện") → Bài viết & di sản liên quan → Nguồn sử liệu.
- **Cột bên:** Thông tin cơ bản (tên hiệu/tự/húy/thụy, ngày sinh–mất kèm âm lịch, ngày giỗ, nơi sinh, nơi an táng, đời) · Ngày giỗ sắp tới
  (đếm ngày + thêm vào lịch) · Quan hệ (cha mẹ, vợ/chồng, con, anh chị em — mỗi người là một thẻ dẫn sang hồ sơ họ) · Nơi an nghỉ (dẫn trang Mộ phần) ·
  ghi chú riêng tư. Điện thoại: một cột, thứ tự như trên; cột bên chèn sau "Dấu mốc".
- Khối nào không có dữ liệu thì **ẩn hẳn** (không để khung rỗng).

### Nguồn dữ liệu và điều kiện hiện từng khối
| Khối | Nguồn | Điều kiện |
|---|---|---|
| Đầu hồ sơ, Quan hệ | `persons`, `families` (đã có trong payload cây) | luôn có; **người còn sống chỉ hiện tên + đời** |
| Tên hiệu/tự/húy/thụy, ngày âm, nơi sinh, nơi an táng, tiểu sử | `persons` + `get_historical_person_extras` | người đã mất; xem câu hỏi mở 1 |
| Trị vì, chức tước | `person_reigns`, `person_titles` | dòng họ lịch sử |
| Dấu mốc cuộc đời | `clan_timeline_milestones` (có `person_id`) | người đã mất |
| Nguồn sử liệu / chip "Theo:" | `person_citations` | có trích dẫn |
| Hình ảnh & tư liệu | ảnh đại diện + ảnh của ký ức đã duyệt | tôn trọng "ẩn ảnh khi chia sẻ" |
| Ký ức gia đình | `person_memories` (hiện + cho phép chia sẻ) | người đã mất, link có `community` |
| Bài viết liên quan | `clan_posts.person_id` đã đăng | khoá `board` bật |
| Di sản liên quan | `heritage_people` → `heritage_items` đang hoạt động | khoá `heritage` bật |
| Nơi an nghỉ | `resting_place_occupants` → tên + khu vực | khoá `graves` bật; **không toạ độ / địa chỉ** |
| Ngày giỗ sắp tới | `death_anniv_lunar_*` (payload cây đã có) + sự kiện | người đã mất |

### API
- Thêm `share-view?part=person&id=<personId>`: một lần gọi trả toàn bộ khối trên (đã lọc theo cờ và người đã mất), thay cho các truy vấn rời rạc
  hiện có (`get_historical_person_extras`, `clanHasSources`…). Người không thuộc phạm vi link hoặc không tồn tại → 404; người còn sống →
  `{ living: true, name, generation }`.
- Phản hồi ngắn hạn cache như các `part` khác; dùng bộ đếm `part` (240/phút) — mỗi lần chỉ một người nên khó cào hàng loạt.
- Giữ `person` trong menu ẩn (đi tới từ cây / tìm kiếm / thẻ quan hệ), `title` = `<Tên> — <Tên họ>`.

### Trạng thái (25/11/2026)
**Đã làm ở local, chưa deploy.** Quyết định tạm theo đề xuất ở câu hỏi mở 1: thêm khoá `profiles` ("Hồ sơ người đã mất") vào `share_sections` (migration `20261126110000_share_sections_profiles.sql`, mặc định tắt; **kênh công khai không cần khoá**); link token chưa bật khoá thì hồ sơ chỉ có thông tin cơ bản + quan hệ + khối liên quan, kèm ghi chú. Đã có: `share-view?part=person` (cổng theo khoá, người sống chỉ tên + đời, **chặn người ngoài phạm vi link cây con** qua `share-view/scope.ts` dùng chung với payload cây, không toạ độ), `src/lib/siteRelations.ts`, `SitePerson` viết lại theo thiết kế (đầu hồ sơ, tiểu sử, trị vì / tước hiệu, dấu mốc, hình ảnh & ký ức lấy từ payload cộng đồng, bài viết + di sản liên quan, cột bên: thông tin cơ bản, ngày giỗ sắp tới, quan hệ, nơi an nghỉ). Chưa làm: bước 4 (thẻ OG riêng cho hồ sơ), SEO / sitemap, câu hỏi mở 2 và 3.

### Việc cần làm (ban đầu)
1. Quyết câu hỏi mở bên dưới.
2. `parts.ts`: `person` + test (cổng theo từng khoá, người sống, không toạ độ, thiếu dữ liệu).
3. Viết lại `SitePerson` theo thiết kế, tách thành các khối nhỏ (`PersonHero`, `PersonBio`, `PersonTimeline`, `PersonMemories`, `PersonRelated`, `PersonFacts`, `PersonRelations`), test DOM + chụp trình duyệt (máy tính / 390px / sáng-tối).
4. Chia sẻ hồ sơ (hộp chia sẻ hệ điều hành + sao chép link); thẻ OG riêng cho hồ sơ làm theo mẫu `og-post` (tuỳ chọn, sau).
5. SEO: hồ sơ người đã mất của dòng họ **công khai** cho lập chỉ mục (JSON-LD `Person` tuỳ chọn), thêm vào sitemap; hồ sơ người sống và mọi trang qua link token vẫn `noindex`.

### Câu hỏi mở
1. **Link token có được xem tiểu sử đầy đủ không?** Payload cây cố ý không kèm tiểu sử / nơi chốn (chỉ link QR một người mới có). Với dòng họ công khai thì
   đã công khai sẵn (RLS). Với link token xem cây, đề xuất thêm khoá `profiles` ("Hồ sơ người đã mất") vào `share_sections` (cùng hệ cờ, mặc định tắt) thay vì
   mở mặc định.
2. Có cho Google lập chỉ mục hồ sơ của người đã mất (dòng họ công khai) không?
3. "Hình ảnh & tư liệu" chỉ lấy ảnh đại diện + ảnh trong ký ức, hay thêm bộ ảnh riêng của từng người (hiện chưa có bảng)?

## 7. Không làm trong plan này
- Bình luận dưới bài trên trang công khai (bảng `clan_post_comments` có sẵn nhưng chưa mở).
- Tìm kiếm phía server, nội dung đa ngôn ngữ cho bài viết.


## 6e. Mọi chức năng chia sẻ dẫn vào trang dòng họ (25/11/2026)
Nguyên tắc: **không có link chia sẻ riêng lẻ**. Mọi địa chỉ `/share/:token…` do app tạo đều dựng ở MỘT nơi, `src/lib/shareUrls.ts`
(`shareLinkPath` theo loại link, `contributeUrl`, `questionUrl`, `shareTokenPath`) và dẫn vào đúng mục menu: QR người → `/nguoi/<id>`,
QR mộ → `/mo-phan/<id>`, QR di sản → `/di-san/<id>`, mời góp / câu hỏi → `/cung-gop`, link cây / bìa Sổ / PDF quan hệ → trang chủ.
Test `shareUrlsGuard` chặn việc tự ghép `/share/${…}` ở chỗ khác. Link QR **tập trung** (người / mộ / di sản) mở trong khung trang dòng họ
nhưng chỉ có MỘT mục menu, không tìm kiếm, không lộ phần còn lại (`FocusPage.tsx`, `focus` trong ngữ cảnh); QR đã in cũ (`/share/<token>` trơn) tự chuyển về địa chỉ chuẩn.
Đổi cấu trúc địa chỉ sau này chỉ sửa `shareUrls.ts` + `siteSections.ts`. **Ngoại lệ còn lại:** thiệp khoe `/khoe/:token` (bảng `card_shares`, không phải `share_links`) và
`/join/:token` (lời mời vào họ, cần đăng nhập) — chưa gộp. Cờ `?site=1` vẫn quyết định bật giao diện mới; địa chỉ mới chạy được cả khi cờ tắt (màn Share cũ bỏ qua đường dẫn con).
