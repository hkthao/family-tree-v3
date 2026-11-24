# Plan: loạt bài "Lễ hội truyền thống Việt Nam" (HTML tĩnh, tối ưu SEO)

Nguồn tham khảo: *60 lễ hội truyền thống Việt Nam* — Thạch Phương, Lê Trung Vũ (NXB Khoa học xã hội, PDF 435 trang, bản scan ABBYY có lớp chữ nhưng nhiều lỗi OCR dấu).
Trạng thái: **bản nháp kế hoạch, chờ chốt các câu hỏi ở cuối.**

## 1. Mục tiêu
- Kéo lượt tìm kiếm tự nhiên theo truy vấn kiểu "hội chùa Hương ngày nào", "lễ hội đền Hùng có gì", "lễ Vu Lan cúng gì".
- Nối sang đúng sản phẩm: lễ hội gắn với tổ tiên, thờ tự, ngày giỗ → CTA sang Sổ tay Văn hoá và tạo gia phả (xem [[project_growth_funnel]]: nút thắt là share→signup, không phải thiếu tính năng).
- Bài hữu ích độc lập, trích dẫn được cho AI search (mở bài bằng câu trả lời trực tiếp, như các bài `huong-dan` hiện có).

## 2. Hiện trạng (đã kiểm tra)
- Landing đã có pipeline bài tĩnh: `scripts/landing-guides/data.mjs` → `scripts/build-landing-guides.mjs` → `landing/huong-dan/<slug>.html`, `landing/huong-dan.html` (hub), `landing/sitemap.xml`, `landing/llms.txt`. Đã có JSON-LD Article + BreadcrumbList, FAQ, `related`, dateModified. Deploy tự động qua `deploy-vps.yml` (thư mục `landing/`).
- Sổ tay trong app (`custom_entries`, trang `/so-tay`) là SPA nên khó index; `scripts/gen-sitemap.mjs` có đưa mục `published` vào sitemap app. Đã seed ~15 bài (Giao thừa, Vu Lan, Trung Thu, Đoan Ngọ, Thanh Minh, Táo quân…), nháp `drafts/` có thêm Rằm tháng Giêng.
- Công cụ MCP `dong-ho-viet` (giapha.thaohk.com) **không có tool đọc Sổ tay** (chỉ gia phả/di sản/sự kiện…); `mcp__supabase` chưa có token. Muốn biết chính xác bài Sổ tay đã có để dedup/liên kết, cần một trong: cấp token MCP Supabase, hoặc đọc qua REST anon (RLS chỉ trả `published`) — việc làm ở bước 0.
- Sách trích được text: đã xuất toàn bộ ra file làm việc cục bộ (không đưa vào repo).

## 3. Quyết định then chốt
1. **Bản quyền:** sách còn bản quyền. Chỉ dùng làm *bản đồ chủ đề + đối chiếu*; viết lại hoàn toàn bằng lời mình, không chép đoạn, không dịch sát; mỗi bài đối chiếu thêm ≥2 nguồn công khai (Cổng thông tin DSVH, báo lớn, Wikipedia, Ban quản lý di tích). Ghi sách vào mục "Tài liệu tham khảo" theo chuẩn trích dẫn.
2. **Nơi đăng:** landing tĩnh, mục mới `/le-hoi/<slug>.html` + hub `/le-hoi.html` (tách khỏi `huong-dan` để từ khoá và breadcrumb rõ ràng). Dữ liệu ở `scripts/landing-guides/le-hoi-data.mjs`, tái dùng hàm `shell()`. Không đẩy HTML vào DB.
3. **Sổ tay trong app** chỉ nhận bản rút gọn (skill `so-tay-viet-bai`, `needs_review`) cho lễ hội gắn gia đình/dòng họ; bài dài SEO nằm ở landing. Hai bên liên kết chéo.
4. **Không bịa ngày:** ngày hội theo âm lịch ghi dạng "mùng 6 tháng Giêng âm lịch" + ghi chú "lịch có thể thay đổi theo địa phương, kiểm tra thông báo của ban tổ chức"; năm hiện hành chỉ ghi khi tra được.

## 4. Danh sách chủ đề (từ mục lục sách)
**Phần A — Lễ hội người Việt (43):** Tết Nguyên Đán · Hội chợ Xuân Gia Lạc · Hội xuân chợ Gò · Hội trình nghề La Vân · Hội vật Liễu Đôi · Hội Đổng Kỵ · Hội đền Lê Phụng Hiểu · Lễ hội Quang Trung · Hội đền An Dương Vương · Hội chùa Hương · Hội Triều Khúc · Hội đền Phù Ủng · Hội Lim · Hội Tản Viên Sơn Thánh · Lễ hội Chùa Bà (Bà Đanh/Bà Tấm) · Lễ hội đền Hòn Chén · Lễ hội Nghinh Cô · Hội Phủ Giầy · Hội Bình Đà · Hội chùa Thầy · Lễ hội đền Hai Bà Trưng · Lễ hội Trường Yên · Hội đền Hùng · Lễ hội Chử Đồng Tử · Hội đền Lý Bát Đế · Lễ hội Tháp Bà · Hội Lệ Mật · Lễ hội Thánh Gióng · Hội cầu mùa Bảo Ninh · Lễ vía bà Chúa Xứ · Lễ hội đền Linh Sơn · Hội đền Chèm · Lễ Vu Lan · Lễ hội Long Chử · Hội Đổ Giàn · Lễ hội Lăng Ông · Hội chọi trâu Đồ Sơn · Lễ hội Đức Thánh Trần · Hội đền Vua Lê · Hội đền Đồng Bằng · Hội chùa Keo · Lễ hội Nghinh Ông · Lễ Giáng Sinh.
**Phần B — Dân tộc anh em (17):** Hội chơi núi mùa Xuân · Hội Hoa Ban · Hội mời Mẹ Trăng · Lễ hội Chùa Bà (Chợ Lớn) · Lễ hội Chùa Ông · Hội mừng măng mọc Tây Bắc · Hội đua voi Tây Nguyên · Chôl Chnăm Thmây · Mbăng Katê · Ok Om Bok & đua ghe ngo · Roya Idil Adha · Mpuh (Lễ Lớn Khôn) · Lễ đền ơn đáp nghĩa Cha Mẹ · Lễ ăn trâu · Lễ ăn cơm mới · Hội mừng nhà mới · Lễ bỏ mả (Pơ thi).
**Phần C (tuỳ chọn, đợt sau):** trò diễn/trò chơi (múa rối nước, chơi đu, kéo co, đấu vật, chọi gà, đua thuyền…) và cuộc thi tài; **Phần hai** câu ca hội hè — dùng làm trích dẫn ngắn trong bài, không làm bài riêng.
> Lưu ý: nhiều hội sách viết từ thập niên 2000, địa danh/hành chính đã đổi (vd Thái Bình, Hà Tây cũ); cách viết phải lấy địa danh hiện hành.

## 5. Chọn thứ tự (đợt sóng)
- **Sóng 1 (10 bài, từ khoá lớn + liên quan thờ cúng/tổ tiên):** Hội đền Hùng, Chùa Hương, Lễ Vu Lan, Đền Chèm (Lý Ông Trọng), Đức Thánh Trần, Thánh Gióng, Tết Nguyên Đán, Hội Lim, Hội chùa Keo, Bà Chúa Xứ. Bắt đầu 2–3 bài để chốt khuôn rồi mới mở rộng.
- **Sóng 2 (~15 bài):** các hội lớn khác của người Việt (Phủ Giầy, Chùa Thầy, Hai Bà Trưng, Đồ Sơn, Nghinh Ông, Tháp Bà, Tản Viên, Quang Trung, Lê Phụng Hiểu…).
- **Sóng 3 (~35 bài):** phần còn lại + dân tộc thiểu số (cần cẩn trọng văn hoá, ưu tiên nguồn nhà nước/viện nghiên cứu).
- Mỗi sóng xong: build, test, deploy, gửi sitemap lên Search Console, đo Umami/GSC 2–4 tuần rồi mới quyết sóng sau.

## 6. Khuôn một bài (~900–1500 chữ)
- `<title>` ≤ 60 ký tự: "Tên lễ hội: thời gian, địa điểm, nghi lễ chính"; meta description 140–160 ký tự; H1 duy nhất; URL `/le-hoi/hoi-chua-huong.html`.
- Mở bài: **câu trả lời trực tiếp** (hội gì, ở đâu, khi nào, thờ ai) trong 1–2 câu đậm; mục lục nhảy neo.
- Hộp thông tin nhanh (bảng): thời gian âm lịch, địa điểm (tên hiện hành), nhân vật được thờ, hoạt động chính, di sản (nếu được công nhận — chỉ ghi khi tra được).
- H2 theo thứ tự: Lễ hội là gì · Thời gian & địa điểm · Nguồn gốc & truyền thuyết (đánh dấu rõ "tương truyền") · Phần lễ · Phần hội/trò chơi · Món ăn/đặc sản (nếu có) · Kinh nghiệm đi (đi lại, trang phục, lưu ý) · Liên hệ với tổ tiên/dòng họ (đoạn dẫn sang Sổ tay) · FAQ (3–5 câu thật) · Nguồn tham khảo.
- Cuối bài: CTA ngắn (UTM `campaign=le-hoi-<slug>`), `related` 3 bài, liên kết Sổ tay tương ứng.
- Schema: Article + BreadcrumbList + FAQPage; `Event` chỉ khi có ngày cụ thể đã xác minh (tránh thông tin sai bị phạt rich result). Ảnh: free-license (Wikimedia/Pexels, quy tắc [[feedback_historical_sources_license_relaxed]]), WebP ≤150 KB, có `alt`, `width/height`, ghi công trong nguồn; không dùng ảnh scan từ sách.
- Liên kết nội bộ: hub ↔ bài ↔ bài liên quan (cùng vùng, cùng nhân vật thờ, cùng mùa); Sổ tay ↔ landing hai chiều.
- Từ khoá mỗi bài: 1 chính + 3–5 phụ, gom vào bảng `keywords.csv` (làm ở bước 1, kiểm bằng gợi ý tìm kiếm/GSC, không đoán).

## 6b. Ảnh minh hoạ lấy từ internet
- **Mỗi bài 3–5 ảnh:** 1 ảnh đầu bài (cũng là `og:image` riêng cho bài, thay `og-banner.png` chung), còn lại đặt dưới các H2 phần lễ / phần hội / kinh nghiệm đi.
- **Nguồn ưu tiên (đã thử, chạy được):** API Wikimedia Commons (`commons.wikimedia.org/w/api.php`, `generator=search`, `prop=imageinfo&iiprop=url|extmetadata`) trả đủ URL ảnh, kích thước, giấy phép (`LicenseShortName`) và tác giả (`Artist`). Thử với "Chùa Hương" ra được ảnh Public domain và CC BY-SA 4.0. Tiếp theo là Pexels/Unsplash/Pixabay.
- **Nới nguồn** theo [[feedback_historical_sources_license_relaxed]]: được dùng ảnh báo chí/Cổng thông tin khi không rõ giấy phép, nhưng vẫn ghi nguồn và link dưới ảnh. Ảnh Commons CC BY-SA bắt buộc ghi tác giả + giấy phép + link.
- **Tải về, không hotlink:** script `scripts/fetch-le-hoi-images.mjs` tải ảnh đã chọn, đổi sang WebP (`cwebp -q 82`, rộng ≤1600px, <150 KB) vào `landing/assets/le-hoi/<slug>-<n>.webp`; ghi `credits` (tác giả, giấy phép, URL gốc) vào dữ liệu bài, build tự sinh `<figure>`/`<figcaption>` + dòng ghi công, và gom vào `docs/credits.md`.
- **Kiểm ảnh bắt buộc:** ảnh có đúng lễ hội/địa điểm không (nhiều ảnh trên mạng gán nhầm tên); title tệp và mô tả Commons phải khớp; nghi ngờ thì bỏ. `alt` mô tả thật (không nhồi từ khoá), có `width/height`, `loading="lazy"` trừ ảnh đầu bài.
- **Việc của agent:** haiku đề xuất 6–8 ứng viên/bài kèm giấy phép; sonnet kiểm khớp chủ đề; người duyệt chọn cuối (xem nhanh bằng một trang lưới ảnh ứng viên cục bộ).
- Không dùng ảnh trong sách (scan) và không lấy ảnh từ trang có chặn bot/watermark người khác.

## 7. Việc kỹ thuật
1. Mở rộng `build-landing-guides.mjs`: nhận thêm tập `leHoi` (hoặc tham số `section`), sinh `/le-hoi/*.html` và hub `/le-hoi.html`, thêm vào sitemap + `llms.txt` + nav ("Lễ hội"); hub có lọc theo vùng/tháng âm lịch bằng HTML tĩnh (không phụ thuộc JS).
2. Mở rộng schema đã có: trường `region`, `lunarWhen`, `deity`, `infobox`, `sources[]`.
3. Test: kiểm tra mọi bài có title/description/canonical/H1 duy nhất, không link gãy, `related` tồn tại, độ dài title/description; có thể thêm test Vitest cho dữ liệu như `noInfraSecrets` (không IP/hostname hạ tầng, xem [[feedback_no_infra_in_repo]]).
4. Chạy local, user duyệt, rồi mới deploy ([[feedback_test_local_before_deploy]]).

## 8. Quy trình sản xuất nội dung
- Theo skill `so-tay-viet-bai`: nhóm ~5 chủ đề/subagent **haiku** (research + soạn, ghi JSON ra file nháp, trả text ngắn), **sonnet** rà soát độc lập (bịa/suy diễn, ngày, địa danh hiện hành, nguồn khớp), người duyệt cuối.
- Mỗi bài có `sources` URL thật; thiếu nguồn thứ 2 → không đăng. Nội dung truyền thuyết luôn gắn "tương truyền".
- Chủ đề tôn giáo/dân tộc: trung lập, không phán đúng sai; Giáng Sinh, Roya, Chôl Chnăm… mô tả như thực hành của cộng đồng, nhờ người am hiểu đọc lại nếu có thể.
- Không đưa lớp OCR sách vào repo; chỉ lưu ghi chú trích dẫn (số trang) ở file làm việc cục bộ.

## 9. Đo hiệu quả
- Thêm landing vào Google Search Console (nếu chưa), nộp `landing/sitemap.xml`; theo dõi lượt hiển thị/CTR theo bài. Umami đã có trên landing: sự kiện `data-cta` mỗi bài → signup.
- Chỉ nhân rộng khi sóng 1 có hiển thị và CTR > ngưỡng đã định (chốt sau khi có dữ liệu 4 tuần).

## 10. Rủi ro
- Nội dung mỏng/na ná nhau giữa 60 bài → bị coi spam: mỗi bài phải có chi tiết riêng (truyền thuyết, nghi lễ, ngày, tips), tối thiểu ~900 chữ, sóng nhỏ trước.
- Sai ngày âm lịch/địa danh → mất uy tín: bắt buộc đối chiếu nguồn hiện hành.
- Vi phạm bản quyền sách: xem mục 3.1.
- OCR nhiễu dẫn tới sai tên riêng: tên người/địa danh phải đối chiếu nguồn khác, không lấy trực tiếp từ OCR.

## 11. Câu hỏi cần chốt
1. Đăng ở landing `donghoviet.thaohk.com/le-hoi/` (khuyến nghị) hay trong app giapha.thaohk.com (cần SSR/prerender, tốn hơn)?
2. Số lượng: chạy thử sóng 1 (10 bài) rồi đo, hay làm trọn 60?
3. Có làm Phần C (trò diễn/thi tài) không?
4. Sổ tay trong app: có tạo thêm bản rút gọn cho các lễ hội gắn gia đình (Vu Lan, Tết, Thánh Trần…) không?
5. Cho phép tôi đọc Sổ tay hiện có bằng cách nào (token MCP Supabase hay REST anon) để dedup?
