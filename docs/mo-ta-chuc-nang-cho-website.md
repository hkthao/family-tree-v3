# Mô tả chức năng Dòng Họ Việt — tài liệu để làm website (chuẩn SEO, đúng style)

> Soạn 23/11/2026 từ code, nav, tài liệu hướng dẫn, changelog và landing hiện tại. Mỗi chức năng ghi rõ
> **trạng thái thật** (✅ đã chạy trên prod · 🟡 có nhưng hạn chế · ⏸ tạm dừng · 🗒 mới là kế hoạch) để website
> **không quảng cáo thứ chưa có**.

---

## 1. Định vị

| | |
|---|---|
| Tên | **Dòng Họ Việt** (app: `giapha.thaohk.com` · landing: `donghoviet.thaohk.com`) |
| Một câu | Gia phả số cho dòng họ Việt: cả họ cùng dựng cây gia phả, nhớ giỗ theo âm lịch, lưu giọng kể và di sản của ông bà. |
| Dành cho | Trưởng tộc / người giữ gia phả (quản trị); con cháu khắp nơi (đóng góp, xem); người lớn tuổi (xem, kể chuyện bằng giọng nói). |
| Khác biệt | Làm riêng cho **tập tục Việt**: âm lịch & ngày giỗ, xưng hô họ hàng, Thuỷ tổ & đời, chi/nhánh, từ đường, mộ phần, nếp nhà. |
| Nguyên tắc UX | Chữ to, nút lớn, ít thao tác, tiếng Việt thuần — ưu tiên người lớn tuổi. Có video hướng dẫn. |
| Giá | Bắt đầu miễn phí; nhu cầu nâng cao (in sách phả, phả đồ khổ lớn) có thể có phí riêng (landing đang nói vậy — xác nhận trước khi đăng). |
| Ngôn ngữ | Việt (gốc) + Anh (danh mục dịch EN đã đủ). |

---

## 2. Danh mục chức năng

### A. Lõi gia phả
| Chức năng | Mô tả để viết | Trạng thái |
|---|---|---|
| **Tạo dòng họ & phân quyền** | Lập dòng họ trong vài phút; vai trò quản trị / biên tập / thành viên / người xem; riêng tư hay công khai. | ✅ |
| **Cây gia phả** | Nhiều đời, đặt bất kỳ người nào làm trung tâm, số đời hiển thị tuỳ chỉnh, xem toàn màn hình. Chế độ 2D, 3D, thư mục, trực hệ. Thẻ phong cách hoàng gia (viền vàng, **triện Đời**, nền thuỷ mặc), chọn font tên, khung avatar. Xuất PNG / SVG / PDF. | ✅ |
| **Danh bạ** | Tìm / thêm / sửa người; tên Việt (tên tự, tên thuỵ, biệt danh); ngày sinh & mất dương lịch và âm lịch; tiểu sử; ảnh; nơi ở; quan hệ cha mẹ – vợ chồng (nhiều đời vợ) – con; xem nhanh trong ngăn kéo; dòng thời gian cuộc đời tự dựng (sinh → con chào đời → mất). | ✅ |
| **Nhập / xuất** | Nhập hàng loạt từ Excel, GEDCOM, CSV; xuất GEDCOM / CSV; gộp người trùng; nhật ký thay đổi. | ✅ |
| **Tra cứu quan hệ & xưng hô** | Chọn một người: tổ tiên, anh chị em, bác / chú / cô, con cháu theo đời; hai người gọi nhau là gì (chú, bác, cô, dì, cậu, cháu…). Tải CSV / PDF. | ✅ |
| **Chi (nhánh)** | Chia dòng họ thành các chi, trưởng chi, nhà thờ chi. | ✅ |
| **Liên kết dòng họ** | Nối hai dòng họ qua một thành viên: thông gia, họ tổ ↔ họ hậu duệ, họ hàng; đề nghị bằng mã mời, bên kia xác nhận. | ✅ |

### B. Lịch, giỗ và tâm linh
| Chức năng | Mô tả | Trạng thái |
|---|---|---|
| **Ngày giỗ theo âm lịch** | Ghi ngày mất âm/dương; tự tính giỗ hằng năm; nhắc qua thông báo đẩy và email (gộp theo giờ). | ✅ |
| **Lịch âm dương & xem ngày** | Lịch tháng, ngày tốt xấu, giờ hoàng đạo, lễ tết. Thông tin tham khảo theo phong tục. | ✅ |
| **Sự kiện & Hôm nay** | Giỗ, sinh nhật, họp họ, lễ tết; thẻ "Hôm nay" (lịch dương/âm, giỗ sắp tới); tải lịch `.ics` về điện thoại. | ✅ |
| **Sổ tay Văn hoá** | Bài về phong tục, nghi lễ, tín ngưỡng Việt (công khai, đọc không cần đăng nhập). | ✅ |
| **Podcast** | Những câu chuyện ngắn về gia phả (lấy từ Facebook). | ✅ |

### C. Cả họ cùng làm
| Chức năng | Mô tả | Trạng thái |
|---|---|---|
| **Link mời góp** | Gửi một đường link; người nhận **không cần tài khoản** vẫn góp được câu chuyện, ảnh cũ, hay sửa thông tin sai. Có tin nhắn soạn sẵn cho Zalo / Messenger và **ảnh mời có mã QR** để đăng Facebook, Zalo (9 mẫu × 3 tông). | ✅ |
| **Hỏi ông bà** | Mỗi tuần một câu gợi ý hoặc tự đặt; gửi link cho cả nhà trả lời; người lớn tuổi bấm 🎤 trên bàn phím để **nói thay vì gõ**. | ✅ |
| **Đóng góp nội dung** | Quản trị duyệt, ẩn hay xoá; bấm "Đưa vào gia phả" để chép đoạn đã duyệt vào tiểu sử; chống spam khi link bị lộ. | ✅ |
| **Mời góp từng người** | Người đã mất còn thiếu thông tin có nút tạo link và ảnh "Hồ sơ còn thiếu". | ✅ |
| **Ảnh ghép đại gia đình** | Mỗi người góp một mảnh ảnh, ghép thành bức tranh chung. | ✅ |
| **Bảng tin** | Tin tức, tin vui, thông báo chung; kiểm duyệt bài. | ✅ |
| **Việc cần làm / Bước tiếp theo** | App dò chỗ còn thiếu trong gia phả và gợi ý việc nên làm. | ✅ |

### D. Di sản, tưởng niệm và câu chuyện
| Chức năng | Mô tả | Trạng thái |
|---|---|---|
| **Dòng thời gian dòng họ** | Poster câu chuyện qua các thế hệ: **dấu triện năm**, hình minh hoạ, thẻ bối cảnh thời đại (Lý → nay). Một poster cho cả họ và một cho từng thành viên. Poster ngang / dọc, **6 mẫu nền**, mã QR, **xuất PDF / PNG**. Chọn mốc từ mẫu, từ gia phả / sự kiện / mộ phần / di sản. | ✅ |
| **Di sản dòng họ** | Từ đường, tục lệ, giai thoại, kỷ vật; ảnh, ghi âm, video; gắn người liên quan. | ✅ |
| **Mộ phần & tro cốt** | Danh mục nơi an nghỉ, nghĩa trang, chỉ đường, ảnh, lịch sử dời mộ, tảo mộ; **QR dán tại mộ / từ đường** mở ra tiểu sử người khuất. | ✅ |
| **Bản đồ** | Con cháu, mộ phần, di sản theo tỉnh / thành (chỉ hiện số đếm, không lộ địa chỉ). | ✅ |
| **Phòng ký ức** | Phòng trưng bày ảnh 3D. | ✅ |
| **Bảng vàng công đức & Quỹ họ** | Ghi nhận đóng góp, thành tích; sổ thu chi minh bạch. | ✅ |
| **Gia phả lịch sử** | Các triều **Lý, Trần, Hậu Lê, Nguyễn** (khoảng 500 nhân vật) có tiểu sử, dòng thời gian từng người và **nguồn trích dẫn**. Có trang xem công khai. | ✅ |
| **Cây bản mệnh / vườn dòng họ** | Mỗi người một cái cây, cả họ thành khu vườn. | 🗒 chưa làm |

### E. Xuất bản và in ấn
| Chức năng | Mô tả | Trạng thái |
|---|---|---|
| **Sổ gia phả PDF** | Bìa, lời nói đầu, phả ký, phả hệ, phả đồ, ngoại phả, phụ khảo, mục lục có số trang; chọn mẫu và hoa văn. | ✅ |
| **Phả đồ khổ lớn** | Xuất cây khổ lớn để treo từ đường (SVG / PDF). | ✅ |
| **QR cá nhân** | Mã QR từng người để in / khắc; quét ra trang cá nhân. | ✅ |
| **Thiệp & ảnh chia sẻ** | Thiệp giỗ, thiệp mời họp họ, ảnh "khoe cây" đăng mạng xã hội. | ✅ |

### F. Chia sẻ và công khai
| Chức năng | Mô tả | Trạng thái |
|---|---|---|
| **Link chia sẻ** | Tab Tổng quan · Cây · Cùng góp · Hỏi & trả lời; quản trị tick phần muốn chia sẻ thêm (thông tin, bảng tin, bản đồ, di sản, mộ phần, bảng vàng, ảnh ghép). Có đếm lượt ghé. | ✅ |
| **Ẩn người còn sống** | Khi chia sẻ ra ngoài, thông tin người đang sống tự ẩn. | ✅ |
| **Xem thử không cần đăng nhập** | Dòng họ mẫu (demo) và dòng họ công khai. | ✅ |

### G. Nền tảng
| Chức năng | Mô tả | Trạng thái |
|---|---|---|
| **Dùng trên điện thoại** | Giao diện web tối ưu điện thoại, cài như ứng dụng (PWA), thông báo đẩy. | ✅ |
| **Sáng / tối, Việt / Anh** | Giao diện sáng – tối, đổi ngôn ngữ. | ✅ |
| **An toàn dữ liệu** | Phân quyền từng dòng họ ở tầng cơ sở dữ liệu, sao lưu định kỳ, nhật ký thay đổi, ẩn người sống, bạn tự quyết ai xem / sửa. | ✅ |
| **Kết nối AI (MCP)** | Cho Claude, ChatGPT… đọc và (nếu được cấp quyền) ghi vào gia phả: tra cứu, soạn tiểu sử có nguồn, thêm mốc dòng thời gian, liên kết dòng họ. Ba gói quyền: chỉ đọc / đề xuất / ghi. Người dùng cấp và thu hồi được. | ✅ |
| **Trợ giúp** | Hướng dẫn từng tính năng (~30 bài), video, Sổ tay, Góp ý / báo lỗi, "Có gì mới". | ✅ |
| **Zalo Mini App** | Xem gia phả ngay trong Zalo. | ⏸ tạm dừng |
| **Trợ lý AI trong app** | Đã gỡ; thay bằng Kết nối AI (MCP) ở trên. | ✅ đã thay |

---

## 3. Style (đúng với app)

**Cảm hứng:** giấy cũ, mực, triện đỏ, thuỷ mặc — ấm, trang trọng, không "công nghệ lạnh".

| Token | Sáng | Tối |
|---|---|---|
| Nền | `#E4E1DA` ngà xám | `#1A1612` mực ấm |
| Thẻ | `#F1EFEA` | `#221E19` |
| Chữ | `#292019` mực | `#EFE9DB` kem |
| **Chính (oxblood)** | `#792A2A` | `#D24545` |
| Nhấn (đồng) | `#8A5B20` | `#D4A045` |
| Vàng viền | `#CAA455` | `#CAA455` |
| Viền | `#C7C2B8` | `#2B2520` |

- **Phông:** *Be Vietnam Pro* (giao diện, đoạn văn) · *Noto Serif* (tiêu đề, trang trọng) · *Playfair Display* (tên trên thẻ cây). Cả ba hỗ trợ tiếng Việt đủ dấu.
- **Họa tiết nhận diện:** **con triện** đỏ son viền chỉ vàng (logo, huy hiệu "Đời N", dấu năm trên dòng thời gian); nền **thuỷ mặc**; hoa văn bảng gia phả; **giấy kem** cho poster; **linh vật** (mascot). Tài nguyên có sẵn trong `public/`: `icons/`, `backgrounds/`, `textures/`, `watermarks/`, `mascot/`, `fonts/`.
- **Nguyên tắc:** icon đi cùng chữ ở mọi nút; vùng chạm tối thiểu 40–44px; một hành động chính mỗi màn; dark mode dùng chung khoá `localStorage["family-tree:theme"]` với app (landing hiện đã dùng).
- Chi tiết quy ước: `docs/design-language.md`.

---

## 4. SEO — gợi ý cấu trúc website

**Đã có (đã kiểm tra trong `landing/`):** landing một trang `landing/index.html` (FAQ, OG đủ, JSON-LD, **đã gắn Umami**, CTA chính dẫn tới `/xem/demo` kèm UTM), `robots.txt`, `sitemap.xml` (9 URL), `llms.txt`, và **7 bài kiến thức dài** (~4.500–5.100 chữ mỗi bài) trong `landing/huong-dan/`: cách lập gia phả dòng họ, cách tính ngày giờ âm lịch, cách xưng hô họ hàng, chạp họ – tạo mộ – giỗ tổ, mẫu sổ gia phả, phần mềm gia phả tiếng Việt, thuật ngữ gia phả. Các trang công khai của app cũng có giá trị SEO: `/xem/demo`, `/xem/clans/:id`, `/so-tay`, `/changelog`, `/docs`. (Kế hoạch gốc: `docs/plan-landing-update.md`.)

**Sơ đồ trang đề xuất** (mỗi cụm một trang riêng, mỗi trang một chủ đề tìm kiếm):

| Trang | Mục đích tìm kiếm | Nội dung lấy từ |
|---|---|---|
| Trang chủ | "gia phả số", "phần mềm gia phả" | §1, hero + 3 bước |
| Cây gia phả online | "lập cây gia phả online", "vẽ phả hệ" | A. Cây gia phả |
| Ngày giỗ & lịch âm | "cách tính ngày giỗ", "nhắc ngày giỗ" | B |
| Xưng hô họ hàng | "xưng hô họ hàng", "gọi bác chú cô dì" | A. Tra cứu quan hệ (công cụ miễn phí là mồi SEO tốt) |
| Cùng góp gia phả | "làm gia phả cả họ cùng góp" | C |
| Di sản & từ đường | "ghi chép gia phả dòng họ", "nhà thờ họ" | D |
| Mộ phần & QR | "QR mộ phần", "quản lý mộ phần dòng họ" | D |
| Sổ gia phả in | "in sách gia phả", "phả đồ khổ lớn" | E |
| Gia phả lịch sử | "gia phả nhà Trần", "gia phả nhà Nguyễn" | D (nội dung công khai, có nguồn → rất hợp E-E-A-T) |
| Dòng thời gian dòng họ | "poster lịch sử dòng họ" | D |
| Bảo mật & quyền riêng tư | "gia phả có an toàn không" | G |
| Hướng dẫn / Kiến thức / Hỏi đáp | long-tail | `/docs`, `landing/huong-dan`, FAQ |
| Changelog | tín hiệu hoạt động | `docs/changelog-*.md` |

**Kỹ thuật:**
- Dữ liệu có cấu trúc: `SoftwareApplication` (trang chủ), `FAQPage` (đã có 4 câu hỏi nhưng chưa đánh dấu), `HowTo` (3 bước), `Article` (kiến thức), `BreadcrumbList`.
- Mỗi trang: `<title>` ≤ 60 ký tự, mô tả 140–160 ký tự, một `<h1>`, canonical, OG 1200×630, `hreflang` vi/en nếu có bản Anh.
- Tĩnh, không build nặng (giữ hướng hiện tại), ảnh WebP có `alt`, tải chữ tối thiểu; mục tiêu LCP < 2.5s trên 4G.
- Giữ CTA chính dẫn vào **trang xem thử** (`/xem/demo`) kèm UTM như landing hiện tại; các trang mới của website làm tương tự.

**Cẩn trọng nội dung:**
- **Lời chứng thực trên landing hiện tại** (ông Nguyễn Văn Phúc, bà Trần Thị Lan…) cần xác minh là người thật và đã đồng ý; nếu là mẫu thì phải bỏ hoặc ghi rõ — có rủi ro pháp lý và Google không ưa đánh giá giả.
- Chỉ nói những gì ở cột trạng thái ✅. Đừng nhắc Cây bản mệnh, Zalo Mini App hay "AI trợ lý trong app".
- "Sao lưu định kỳ", "miễn phí để bắt đầu", "chữ to nút lớn" là cam kết — kiểm lại trước khi đăng.
- Gia phả lịch sử: ghi nguồn trích dẫn, tránh khẳng định tuyệt đối ở chỗ sử liệu còn tranh luận.

---

## 5. Tài liệu nguồn trong repo
`docs/design-language.md` · `docs/plan-landing-update.md` · `docs/changelog-*.md` · `docs/mcp-ket-noi-ai.md` · `docs/plan-dong-thoi-gian-dong-ho.md` · `docs/plan-di-san-van-hoa.md` · `docs/plan-mo-phan-tro-cot.md` · `docs/plan-anh-dai-gia-dinh-ghep-manh.md` · `docs/plan-gia-pha-vua-chua.md` · `landing/` · `src/pages/docs/` (các bài hướng dẫn).
