# Plan: Sổ tay Văn hoá dùng chung nguồn bài viết (tệp) với landing, bỏ lưu bài trong DB

Trạng thái: **bản nháp, chờ chốt các câu hỏi cuối file.** Liên quan: `docs/plan-bai-viet-le-hoi-seo.md` (loạt bài lễ hội đã có nguồn JSON ở `scripts/landing-guides/le-hoi/`).

## 1. Hiện trạng (đã đọc code)
- Bài nằm ở bảng `custom_entries` (title, aliases, sections jsonb văn bản thuần, faq, cover…, `search_text` không dấu do trigger sinh). Đọc: user đăng nhập + `anon` qua link `/xem/so-tay/:id` (policy `custom_entries_public_read`). Ghi: platform admin qua `CustomsForm.tsx` (900 dòng), `CustomsImport.tsx`, skill `so-tay-viet-bai` (`upload-custom.ts`).
- **Tìm kiếm trong trang Sổ tay đã chạy phía client**: `listCustomEntries` tải toàn bộ bài đã đăng rồi lọc bằng `unaccent` + `CUSTOM_SYNONYMS` (`expandNeedles`). Không dùng chỉ mục DB → chuyển sang tệp tĩnh không làm mất khả năng này.
- Tìm kiếm toàn cục (`global_search` RPC) có một nhánh `custom` ở DB (khớp `title` / `search_text` bằng `like`).
- Phụ thuộc khác: `custom_bookmarks` (FK `entry_id` → uuid bài), `related_ids` (uuid), `sitemap` app (`gen-sitemap.mjs` đọc DB), `TodayHubCard`, `Heritage.tsx`, `globalSearchStatic.ts`, MCP/skill.
- Hai bên đang có hai định dạng bài khác nhau: Sổ tay = văn bản thuần theo `sections`; landing lễ hội = JSON có HTML, infobox, ảnh, nguồn.

## 2. Hướng đề xuất: một nguồn tệp, build ra hai đầu
```
content/so-tay/<slug>.json            ← nguồn duy nhất (git), field status: draft|needs_review|published
        │  scripts/build-so-tay.mjs (chạy lúc build, bỏ bài không published)
        ├─► landing/le-hoi/<slug>.html …      trang SEO tĩnh (đã có pipeline)
        └─► public/so-tay-data/
              index.json        mục lục + chỉ mục tìm kiếm nhẹ (slug, title, aliases, mô tả, category, regions, lunar_month, timing, từ khoá không dấu)
              <slug>.json       thân bài (HTML đã làm sạch, faq, ảnh, nguồn) — tải khi mở bài
              fulltext.json     văn bản không dấu của thân bài, chỉ tải khi người dùng gõ tìm toàn văn
```
- **Một schema chung**: mở rộng schema bài lễ hội hiện tại (thêm `category`, `aliases`, `regions`, `lunar_month`, `timing`, `scope`, `mandatory_level`, `origins`, `reliability`, `status`). Bài Sổ tay cũ chuyển từ `sections.body` thuần sang HTML đơn giản (`<p>`, `<ul>`) nên cả hai đầu dùng được.
- **Landing và app cùng repo**: bước build của app (Vite) chạy cùng script, sinh vào `public/so-tay-data/`; không cần CORS, không thêm máy chủ. Landing vẫn deploy từ `landing/` như cũ.
- **App hiển thị**: `CustomsDetail` lấy `<slug>.json`, render HTML qua DOMPurify (danh sách thẻ cho phép tối thiểu). Ảnh dùng chung `landing/assets/` → cần một đường dẫn ảnh dùng được từ cả hai (copy ảnh vào `public/` lúc build, hoặc trỏ tuyệt đối tới origin landing).
- **Tìm kiếm** (đảm bảo giữ đủ):
  - Tải `index.json` một lần (cache bằng service worker/HTTP, gzip ước vài chục KB cho ~100 bài), lọc bằng đúng `unaccent` + `expandNeedles` hiện có → danh sách, lọc theo loại/vùng/tháng âm lịch như cũ.
  - Tìm theo tình huống ("nhà mới", "có em bé") vẫn nhờ `aliases` + synonym.
  - Tìm toàn văn: tải `fulltext.json` khi cần (ước vài trăm KB gzip ở 100–200 bài). Nếu sau này vượt ~1 MB, thêm MiniSearch/Fuse tạo chỉ mục sẵn lúc build (xếp hạng tốt hơn `like`).
  - Tìm kiếm toàn cục (Ctrl+K): bỏ nhánh `custom` khỏi RPC, ghép kết quả từ `index.json` ở client (đã có `globalSearchStatic.ts` làm khuôn).
- **Slug thay uuid**: `custom_bookmarks.entry_id` → `entry_slug text`; `related_ids` → `related` (slug). URL `/so-tay/:slug`; giữ redirect từ uuid cũ (bảng ánh xạ id→slug sinh một lần lúc chuyển).

## 3. Cái được và cái mất
**Được:** hết phụ thuộc dung lượng DB cho bài; một nguồn cho SEO landing + app + MCP/skill; bài có lịch sử git, review bằng PR; bỏ `anon` đọc bảng; tìm kiếm nhanh hơn (không round-trip DB); chạy offline/PWA được.
**Mất / đổi:**
- Hết sửa bài trực tiếp trong app: đổi nội dung = sửa tệp → commit → CI build/deploy (vài phút thay vì tức thì). `CustomsForm`, `CustomsImport`, nút Thêm/Sửa/Xoá ở `Customs.tsx` sẽ bỏ hoặc giảm thành ghi chú cho admin. Skill `so-tay-viet-bai` đổi từ upload DB sang ghi tệp JSON.
- Mỗi lần thêm bài phải build lại app (tác động tới quy trình "không áp tay lên prod"; xem [[project_migrations_manual_selfhost]] — migration DB vẫn phải áp tay).
- Bài tải theo yêu cầu qua mạng (lần đầu), thay vì từ DB; cần cache hợp lý.

## 4. Các bước thực hiện
0. Chốt schema chung + kiểm kê bài hiện có trên prod (đọc qua REST anon của `custom_entries` published; không dùng MCP Supabase vì chưa có token).
1. Script **xuất DB → `content/so-tay/*.json`** (chuyển `sections.body` sang HTML an toàn; sinh slug không dấu, ghi ánh xạ uuid→slug).
2. `scripts/build-so-tay.mjs`: sinh `public/so-tay-data/*` + chạy lại trang landing từ cùng nguồn; hợp nhất với `build-landing-guides.mjs`; thêm test dữ liệu (đủ trường, slug duy nhất, `related` tồn tại, ảnh tồn tại, HTML chỉ chứa thẻ cho phép, không lộ hạ tầng — xem [[feedback_no_infra_in_repo]]).
3. App: viết lại `lib/queries/customs.ts` thành đọc tệp tĩnh (giữ chữ ký hàm để ít sửa trang), `Customs.tsx`/`CustomsDetail.tsx` đổi sang slug + render HTML sạch; bookmark theo slug (migration `custom_bookmarks` + backfill); bỏ nhánh `custom` khỏi `global_search` và gộp từ index ở client; `gen-sitemap.mjs` đọc tệp thay vì DB.
4. Dọn: bỏ form/import/edit (hoặc để chế độ chỉ-xem), cập nhật skill + `mcp-server` nếu đụng tới Sổ tay, cập nhật `docs/mo-ta-chuc-nang-cho-website.md`.
5. Cuối cùng mới **giảm tải DB**: migration DROP `custom_entries` (sau khi chạy ổn ≥ vài tuần; giữ bản sao lưu JSON). Áp tay lên prod theo quy trình hiện có.
- Test local đầy đủ trước khi deploy ([[feedback_test_local_before_deploy]]): tìm kiếm có/không dấu, tìm theo tình huống, lọc loại/vùng, link chia sẻ khách, bookmark, offline.

## 5. Rủi ro
- Link chia sẻ cũ `/xem/so-tay/<uuid>` đã gửi trên Zalo/Facebook: cần redirect uuid→slug (giữ bảng ánh xạ trong repo).
- Thân bài lớn làm tải `fulltext.json` nặng khi có hàng trăm bài: tách theo nhóm hoặc dùng chỉ mục dựng sẵn.
- HTML trong tệp: bắt buộc làm sạch ở cả build và khi render (hiện Sổ tay là văn bản thuần nên chưa có bề mặt XSS; thêm HTML là thêm rủi ro, cần danh sách thẻ cho phép).
- Zalo Mini App (nếu làm lại) đang đọc Sổ tay qua API: sẽ đọc `index.json` + `<slug>.json` thay cho DB.

## 6. Câu hỏi cần chốt
1. Chấp nhận mất chỉnh sửa bài trực tiếp trong app (đổi sang sửa tệp + deploy)? Nếu muốn giữ chỉnh sửa nhanh, phương án lai: tệp là gốc nhưng có DB nhỏ chỉ lưu bản "ghi đè" cho vài bài.
2. Bài hiện có trong DB: chuyển hết thành tệp rồi xoá bảng, hay giữ bảng chỉ đọc thêm một thời gian để rollback?
3. Chỉ bài đã `published` mới vào build? (khuyến nghị: có; `draft/needs_review` ở lại trong repo, không xuất ra).
4. Bookmark theo slug và đổi URL sang `/so-tay/:slug` có ổn không (đổi sang redirect các link cũ)?

## 7. Bổ sung: danh mục + thẻ (tag) kiểu WordPress, ưu tiên dùng mã nguồn mở có sẵn

### Phân loại nội dung
- **Danh mục (category)**: 1 danh mục chính cho mỗi bài, danh sách cố định có phân cấp 2 tầng, ví dụ *Lễ hội* → *Lễ hội đền – chùa*, *Lễ hội dân tộc*; *Thờ cúng*; *Vòng đời*; *Lễ Tết*; *Sinh hoạt*; *Văn khấn*. Mở rộng từ `category` hiện có.
- **Thẻ (tag)**: nhiều thẻ tự do để gom nhóm — vùng (Bắc/Trung/Nam), tỉnh/thành, nhân vật được thờ (Vua Hùng, Đức Thánh Trần…), tháng âm lịch, dịp/tình huống ("nhà mới", "có em bé"), loại di sản (UNESCO, quốc gia). `aliases` vẫn giữ riêng cho tìm kiếm.
- Trang tự sinh cho SEO: `/le-hoi/danh-muc/<slug>/`, `/le-hoi/the/<slug>/`, mục lục theo tháng âm lịch, phân trang; breadcrumb, JSON-LD `CollectionPage`, sitemap, RSS.

### Có dùng CMS mã nguồn mở được không (đã cân nhắc)
| Phương án | Danh mục/thẻ | Cần DB/máy chủ | Phù hợp |
|---|---|---|---|
| WordPress (kể cả headless) | có sẵn | MySQL + PHP + vá bảo mật | **Không**: vẫn tốn DB/hạ tầng, ngược mục tiêu |
| Ghost / Strapi / Directus / Payload | có | DB riêng + tiến trình Node | Không: thêm một hệ thống phải vận hành |
| **Astro + Content Collections** | frontmatter + trang động tự sinh `[category]`, `[tag]` | Không (build tĩnh ra HTML) | **Khuyến nghị** |
| Tiếp tục script tự viết | phải tự viết trang danh mục/thẻ/phân trang/RSS | Không | Được nhưng đúng là tốn công |

### Bộ công cụ khuyến nghị (không DB, không máy chủ thêm)
1. **Astro** làm trình sinh trang tĩnh cho mục bài viết: schema Zod bắt buộc (title, category, tags, status…), `getCollection()`, trang danh mục/thẻ, `@astrojs/sitemap`, RSS. Thay dần `scripts/build-landing-guides.mjs`; nginx vẫn phục vụ thư mục tĩnh như hiện nay, `landing/index.html` có thể giữ nguyên hoặc chuyển sau.
2. **Pagefind** cho tìm kiếm toàn văn trên web: **đã thử cục bộ**, tìm "ha noi" ra "Hà Nội", "banh chung" ra "bánh chưng" (không dấu và có dấu đều khớp). Đây là chỉ mục tĩnh dựng lúc build, không cần máy chủ.
3. **CMS soạn bài trên nền git** (Sveltia CMS hoặc Pages CMS; Decap là bản cũ hơn): giao diện soạn bài kiểu WordPress, chọn danh mục/thẻ bằng menu, lưu thẳng thành commit trong repo — không lưu DB. Đăng nhập bằng GitHub.
4. **App** đọc `index.json` do cùng bước build xuất ra (kèm danh mục/thẻ) → lọc theo danh mục/thẻ trong app, vẫn dùng `unaccent` + từ đồng nghĩa hiện có; không cần nhúng Pagefind vào app.

### Điều chưa chắc (phải thử trước khi cam kết)
- Sveltia/Pages CMS cần cấu hình schema riêng, phải giữ khớp với schema Zod của Astro (hai nơi).
- Chưa thử Astro với 60+ bài và font/CSS "Oxblood" của landing (cần chuyển phần giao diện sang layout Astro).
- Soạn bài bằng CMS sinh Markdown/frontmatter; bài hiện là JSON có HTML → cần chuyển sang Markdown (+ shortcode cho infobox/ảnh có ghi công) hoặc giữ JSON làm nguồn.
- Thời gian từ khi sửa tới khi lên web vẫn là build + deploy (vài phút).

### Bước thử nghiệm đề xuất (nhỏ, không đụng prod)
Dựng bản mẫu Astro trong `content-site/` với 3 bài lễ hội hiện có chuyển sang Markdown, có danh mục, thẻ, trang lưu trữ, Pagefind và một CMS git; đo công sức, rồi mới quyết có thay script cũ không.

## 8. Kết quả bản mẫu (content-site/) và ranh giới "nội dung nền tảng" vs "nội dung của dòng họ"

### Bản mẫu đã dựng
`content-site/` (Astro 6 — bản 7 yêu cầu Node ≥ 22.23, máy dev đang 22.19; **nếu muốn dùng Astro 7 phải nâng Node của CI/máy build**).
- `content/le-hoi/*.md`: 3 bài (đền Hùng, chùa Hương, Vu Lan) chuyển từ JSON sang Markdown + frontmatter (category, tags, infobox, ảnh, FAQ, nguồn, `status`). Chỉ `status: published` mới ra web.
- Trang sinh tự động: bài, hub `/le-hoi.html`, danh mục `/le-hoi/danh-muc/<slug>.html` (2 tầng khai báo ở `src/taxonomy.ts`), thẻ `/le-hoi/the/<slug>.html` (thẻ chỉ có 1 bài tự `noindex`), sitemap, JSON-LD (Article, BreadcrumbList, FAQPage, CollectionPage), breadcrumb có danh mục.
- Tìm kiếm Pagefind dựng lúc build: thử trên bản build, "chua huong", "vua hung", "gio to", "bao hieu", "ha noi", "quan am", "thang gieng" đều ra đúng bài (không dấu).
- `/so-tay-data/index.json`: mục lục (slug, tiêu đề, danh mục, thẻ, thời gian, ảnh) để app đọc ở bước sau.
- `public/admin/` (Sveltia CMS, cấu hình `config.yml` khớp schema Zod): soạn bài trên giao diện, chọn danh mục/thẻ bằng menu, lưu thành commit GitHub. **Chưa chạy thử giao diện CMS** (cần mở bằng Chrome/Edge với repo cục bộ hoặc đăng nhập GitHub).
- CSS/giao diện lấy từ `landing/index.html` lúc build (`scripts/sync-shell.mjs`), nên trang Astro trông giống landing; ảnh dùng chung `landing/assets/le-hoi/`.

### Chưa làm / việc tiếp theo
1. Chuyển 7 bài còn lại + 7 bài `huong-dan` sang Markdown; quyết định có chuyển cả `huong-dan` vào Astro hay chỉ phần lễ hội.
2. Nối CI: build `content-site` rồi gộp vào `landing/` (hoặc nginx trỏ thêm), cập nhật `sitemap`/`llms.txt` tập trung một nơi; hiện landing vẫn do `scripts/build-landing-guides.mjs` sinh (chưa bỏ).
3. Sitemap chỉ loại trang tìm kiếm; trang thẻ mỏng (`noindex`) vẫn nằm trong sitemap — cần lọc.
4. Phần app: đọc `index.json`, tìm kiếm không dấu + từ đồng nghĩa ở client, bookmark theo slug (các bước 3–5 của mục 4).
5. Bài nghi lễ từng ngày ở vài bài vẫn có nguy cơ sát văn sách → soát lại trước khi đăng.

### Mở rộng cho người dùng (sổ gia phả, tiểu sử, phả ký, lời nói đầu)
**Không dùng chung cơ chế git + build tĩnh cho nội dung của dòng họ**, vì:
- đó là dữ liệu riêng của từng họ, cần phân quyền (RLS), nhiều người cùng sửa, sửa là thấy ngay, có lịch sử/duyệt đóng góp; commit vào git và build lại cho mỗi lần sửa của từng người dùng là không khả thi và lộ dữ liệu riêng tư.
- Sổ gia phả (`book_texts`), tiểu sử và đóng góp hiện đã nằm trong DB theo dòng họ; chúng nhỏ so với tệp ảnh/âm thanh nên không phải nguồn gây đầy DB.

Cái **dùng chung được** là lớp "bài viết":
1. Một schema bài viết (tiêu đề, danh mục, thẻ, thân bài rich-text, ảnh, nguồn, trạng thái) dùng cho cả hai: bài nền tảng (tệp/git) và bài dòng họ (DB, JSON theo cùng cấu trúc).
2. Một bộ render + soạn thảo (editor rich-text, làm sạch HTML) tái dùng trong app cho phả ký, lời nói đầu, tiểu sử.
3. Danh mục/thẻ: bài dòng họ có thẻ riêng của họ; phần thẻ công khai (vd "Hà Nội", "tháng Giêng âm lịch") dùng chung danh sách của nền tảng.
Nếu sau này có dòng họ muốn **xuất bản công khai** một số bài (vd phả ký) ra web để Google index, làm cơ chế riêng: trang xuất bản render phía máy chủ hoặc build theo yêu cầu từ DB, không đi qua git. Đó là tính năng khác, chưa nằm trong phạm vi hiện tại.

## 9. Cập nhật 2026-11-24: gỡ giao diện soạn bài
Trang soạn bài trong app (`/so-tay/soan`, nút "Soạn bài"), mã dựng tệp `.md` đi kèm và CMS Sveltia (`content-site/public/admin`) đã bị gỡ vì chưa đạt yêu cầu bảo mật.
Giữ lại: nguồn bài dạng tệp, Astro/Pagefind, trang Blog, hàm `publish-so-tay` (chưa triển khai, dự định dùng cho kế hoạch MCP) và các thành phần
`src/components/markdown/` (trình soạn/xem Markdown, chưa dùng ở đâu). Mục 7 và 8 ở trên phần CMS/soạn bài chỉ còn là lịch sử thiết kế.
