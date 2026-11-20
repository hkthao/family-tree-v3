# Kế hoạch: Đóng góp cộng đồng — cả nhà cùng kể, không chờ admin

Trạng thái: **Plan, chưa làm (2026-11-20)**. Câu hỏi mục 11 đã chốt hết. **P0 đã code (2026-11-20), chưa áp prod** — xem "Đã làm ở P0" ngay dưới. **Design ảnh mời góp (mục 4.3) đã duyệt.**


### Đã làm ở P0 (2026-11-20, chưa commit / chưa áp prod)
- Migration `20261120100000_community_memories.sql`: `person_memories` (có sẵn mốc cho tiểu sử / video AI: `year_approx`, `place`, `topic`, `source`, `transcript`, `allow_ai_reuse`), `clans.memory_moderation` (post/pre), `share_links` + `recipient_label`/`allow`/`use_count` + scope `contribute` cho mọi thành viên (20 link/ngày, thu hồi link → ẩn ký ức chờ duyệt của link), `clan_visit_daily` + `bump_clan_visit` / `record_member_visit`, `community_submit_rate`, `clan_public_community_stats`, `clan_community_summary`; storage `{clan}/memories/{uid}/…`.
- Edge function mới `community-submit` (khách góp chuyện / ảnh / ghi âm; bẫy bot, ≥3 giây, chặn link, giới hạn IP băm + link, khách mới luôn chờ duyệt, tin cậy sau 3 lần duyệt). `share-view` trả khối `community` + đếm lượt `?visit=1`; sửa luôn lỗi `stripOrigin` ngoài phạm vi (nhánh QR mộ / di sản / mộ phần).
- UI: `MemoryForm` (dùng chung thành viên / khách, ghi âm bằng `useAudioRecorder`), `MemoryCard`, `PersonMemoriesSection` ở Chi tiết người ("Kể thêm", "Mời người khác kể", duyệt / ẩn / xoá), `CommunityCard` "Cả nhà đang kể" trên Tổng quan (số liệu, hàng chờ, link đã gửi + thu hồi, chọn cách duyệt cho admin), `ContributeLinkPanel` (link + tin nhắn soạn sẵn), trang chia sẻ: thanh mời góp + tab "Cùng góp" (`?tab=gop&p=`), trang QR cá nhân có khối kể.
- Sau góp ý (2026-11-20): Tổng quan chỉ còn thẻ thông tin "Đóng góp mới" + 3 số (lượt ghé, người góp, đóng góp mới) nằm trong thẻ "Số liệu dòng họ"; duyệt / ẩn / xoá / mời góp / link đã gửi / cách duyệt chuyển sang trang **"Đóng góp nội dung"** (`/clans/:id/dong-gop`, chuẩn Danh bạ, có mục menu). Lượt ghé KHÔNG tính admin dòng họ / admin hệ thống (và người đang đăng nhập mở link chia sẻ).
- **P1 + P2 đã code (2026-11-20)** — migration `20261120300000_questions_and_faces.sql`:
  - P1 "Hỏi ông bà": bảng `family_questions` (hỏi ai · về ai · câu hỏi), câu trả lời = đóng góp có `question_id` (mặc định ghi âm), có câu trả lời → `answered`. Ngăn kéo "Hỏi ông bà" (câu gợi ý của tuần + 12 câu gợi ý, tạo link + tin nhắn), danh sách câu hỏi ở đầu trang Đóng góp nội dung (gửi lại link, đóng câu hỏi), trang chia sẻ hiện câu hỏi đang chờ + `?q=` mở thẳng câu hỏi.
  - ⏸ **P2 TẠM TẮT (2026-11-20)** vì ổ cứng server không đủ lưu ảnh tải lên — cờ `PHOTO_IDENTIFY_ENABLED = false` (`src/lib/queries/community.ts`); DB / function / UI còn nguyên, bật lại = đổi cờ.
  - P2 "Ảnh: đây là ai?": `person_memories.identify` + bảng `photo_faces` (khung tỉ lệ 0..1, gắn người trong cây hoặc tên + nghề). `FaceTagger` kéo chuột / ngón tay để khoanh; editor+ gắn người trong cây thì xác nhận luôn, còn lại là gợi ý chờ xác nhận / bác. Khách khoanh qua `community-submit` (kind=face); trang chia sẻ chỉ hiện tên khung đã xác nhận. Ảnh nhờ nhận diện tự hiện ở trang chia sẻ. Tổng quan nhắc số gợi ý chờ xác nhận.
- Giới hạn dung lượng + dán link (migration `20261120200000_memory_external_media.sql`): ảnh nén ≤200 KB / 1280px, ghi âm ≤2 phút; server chặn 1 MB / 1,5 MB, 15 tệp mỗi link; link https (Google Photos, Drive, YouTube…) thay cho tệp.
- Chưa làm ở P0: thông báo cho admin khi có ký ức mới, trích xuất chuỗi i18n (EN đang fallback VI).

## 1. Vấn đề & mục tiêu

Hiện mọi nội dung đều là "dữ liệu của họ", chỉ editor/admin được ghi:

- Vai trò chỉ có `admin / editor / viewer`. Phòng ký ức, Di sản, Mộ phần, Sự kiện, Bảng vàng, Quỹ: INSERT chỉ editor+.
- Viewer chỉ đăng được Bảng tin và góp mảnh ảnh ghép.
- `contributions` (đóng góp có duyệt) chỉ có `edit_person`, `add_note`, `add_person`. Muốn góp ảnh cũ, chuyện kể, ngày giỗ → phải nhắn admin.
- `share_links` chỉ để **xem**, chỉ admin tạo.

→ Gia phả lớn lên đúng bằng tốc độ gõ của một người. Mục tiêu:

1. Người thân (kể cả **không có tài khoản**) góp được ký ức, ảnh, câu trả lời, thông tin — qua một link.
2. Admin không phải gõ hộ, chỉ **xác nhận dữ kiện** và **ẩn nội dung xấu**.
3. Hoạt động cộng đồng **nổi bật**: admin thấy ngay ở Tổng quan; khách xem trang chia sẻ thấy họ đang sống động và được mời góp.
4. Đánh vào nút thắt share → signup (xem phân tích Umami): góp trước, đăng ký sau.

## 2. Nguyên tắc cốt lõi: tách "ký ức" và "dữ kiện"

| | Dữ kiện | Ký ức |
|---|---|---|
| Ví dụ | ngày sinh/mất, quan hệ, đời, chi, gắn mặt trong ảnh vào một người | chuyện kể, ảnh, ghi âm, câu trả lời, "ông làm nghề gì" |
| Bản chất | một sự thật, phải đúng | nhiều góc nhìn, ai cũng có quyền kể |
| Ghi thế nào | **đề xuất chờ duyệt** (`contributions`, mở rộng loại) | **đăng thẳng**, ghi rõ người kể |
| Kiểm soát | luôn duyệt trước | **admin mỗi họ tự chọn** ở Cài đặt họ: *duyệt sau* (đăng thẳng, admin ẩn/xoá) hoặc *duyệt trước*; họ mới mặc định duyệt sau |

Nguyên tắc phụ:
- **Góp không cần đăng nhập.** Khách nhập tên + quan hệ ("cháu nội bác Ba"), nhớ trong localStorage cho lần sau. Mời đăng ký *sau khi* góp xong.
- **Người được xác minh `self_person_id`** sửa trực tiếp hồ sơ của chính mình (dữ kiện của chính mình không cần duyệt).
- **Riêng tư mặc định cho người còn sống, nhất là trẻ em**: ký ức về người còn sống mặc định chỉ thành viên/người có link thấy; không lên trang xem công khai.
- Không Like / Follow / News Feed. Tương tác có ý nghĩa: hỏi, kể, nhận diện, cảm ơn.

## 3. Các tính năng & thứ tự

| # | Tính năng | Ghi chú |
|---|---|---|
| P0 | **Link đóng góp riêng** + kho ký ức gắn người + khối "Cộng đồng" nổi bật + **lượt viếng thăm** | nền cho mọi thứ |
| P0b | **Hồ sơ góp từng mảnh** + màn "Gom hồ sơ" cho admin (mục 5) | thay P3 cũ cho phần dữ kiện người |
| P0c | **Mẫu chia sẻ mạng xã hội** — ảnh infographic + tin nhắn soạn sẵn (mục 4.3) | đi cùng P0, vì không có thì link không ai bấm |
| P1 | **Hỏi người lớn tuổi** (ghi âm là chính) | chạy trên link P0 |
| P2 | **Ảnh "Đây là ai?"** — cùng nhận diện người, nghề | dễ lan nhất |
| P3 | Mở rộng đóng góp dữ kiện: ảnh chân dung, ngày giỗ/sự kiện, quan hệ | |
| P4 | **Tiểu sử tổng hợp** từ các mảnh — qua MCP | không đưa AI lại vào app |
| P5 | **Quê hương 360°** — ghim toạ độ, ảnh 360 người ở quê chụp, Street View nếu có | để cuối |

## 4. Làm nổi bật — admin thấy, khách xem cũng thấy

### 4.1 Phía admin / thành viên (trong app)

- **Tổng quan (`Dashboard`)**: khối mới **"Cả nhà đang kể"** đặt *trên* "Tiến độ hoàn thiện" (cho ẩn/hiện qua "Tuỳ chỉnh trang chủ" sẵn có):
  - Dải số: *tuần này 23 lượt ghé · 5 người góp · 3 ký ức mới · 2 ảnh chờ nhận diện · 1 câu hỏi chưa ai trả lời*.
  - Dòng hoạt động gần đây (ảnh nhỏ + "cháu Minh kể về cụ Tư · 2 giờ trước"), bấm vào mở đúng chỗ.
  - Hàng việc admin: *4 dữ kiện chờ xác nhận* → `Contributions`.
  - Nút to: **"Gửi link mời góp"** và **"Đặt câu hỏi cho ông bà"**.
- **Menu**: mục **"Cộng đồng"** (gộp Đóng góp + Câu hỏi + Ảnh nhận diện + Link đã gửi), badge số chờ xử lý.
- **Chi tiết người**: khu **"Người thân kể về …"** ngay dưới tiểu sử, nút "Kể thêm" / "Hỏi người biết rõ".
- **Thông báo**: `notify-contribution` mở rộng sang ký ức/câu trả lời/gắn mặt; `weekly-digest` thêm mục "Tuần này cả nhà đã góp".
- **Cảm ơn**: người góp được ghi tên ("Ký ức do … kể"), có bảng ghi công người góp trong năm.

### 4.2 Phía trang chia sẻ (`/share/:token`, `/xem/clans/:id`)

Hiện tab chỉ có ở họ công khai; link token chỉ có cây; góp ý chỉ qua `SharedPersonCard → ContributeDialog`, khó thấy.

- **Thanh mời góp trên đầu** (khi họ bật cộng đồng): *"Họ Huỳnh đang cần bạn: 3 ảnh chưa ai nhận ra · 2 câu hỏi cho người lớn tuổi"* + nút **"Cùng góp"**.
- **Tab mới "Cùng góp"** — có cả ở link token:
  - Ảnh chờ nhận diện (lưới, bấm → khoanh mặt, ghi tên/nghề).
  - Câu hỏi đang mở (bấm → trả lời bằng chữ hoặc ghi âm).
  - Ký ức mới nhất (chỉ những gì được phép hiện ở trang chia sẻ).
- **Thẻ người**: nút **"Kể về người này"** nổi rõ, thay vì chìm trong Góp ý.
- **Dấu hiệu sống động**: *"128 lượt ghé thăm · 14 người đã góp"* ở đầu trang.
- **CTA cuối trang** đổi thứ tự theo ngữ cảnh: khách đã góp → "Lưu lại đóng góp của bạn — tạo tài khoản"; chưa góp → "Góp một ký ức" trước, "Tạo gia phả miễn phí" sau.

### 4.3 Mẫu chia sẻ mạng xã hội (ảnh infographic + tin nhắn soạn sẵn)

Mục tiêu: một người bấm **"Kêu gọi cả nhà góp"** → ra ngay một **ảnh đẹp** và một **đoạn tin nhắn** đúng giọng, dán lên Facebook / Zalo / nhóm họ, người xem tự nguyện bấm link vào góp.

**Dựng trên Kho thiệp có sẵn** (`src/lib/cards/registry.tsx`, `exportCard.ts` xuất bằng html-to-image, `publishCard.ts` → link `/khoe/:token`):
- Thêm `genre: "moi-gop"` với vài layout mới; ghép với các theme sẵn có (giữ màu rượu vang, hoa văn) ra ~10–15 mẫu.
- Ảnh **lấy dữ liệu thật** của họ, không phải ảnh tĩnh: tên họ, ảnh cần nhận diện, câu hỏi, số liệu, **mã QR** trỏ link đóng góp.
- Hai khổ: vuông 1080×1080 (Facebook/Zalo) và dọc 1080×1920 (Story/TikTok).
- Nút: **Tải ảnh** · **Sao chép tin nhắn** · **Chia sẻ** (`navigator.share` kèm file ảnh trên điện thoại → mở thẳng Zalo/Facebook).

Bộ mẫu theo tình huống — lời viết như **nhắn vào nhóm Zalo/Facebook gia đình**: mở bằng "Cả nhà ơi", nhờ giúp một việc nhỏ, nói rõ là dễ, xưng hô thân (con / cháu / em / mình — người chia sẻ chọn một lần, app nhớ).

| Mẫu | Ảnh hiển thị | Tin nhắn soạn sẵn (giọng thân mật, sửa được) |
|---|---|---|
| **Đây là ai?** | ảnh cũ, các mặt đánh số, "Cả nhà ơi, ai nhận ra người trong ảnh không?" + QR | "Cả nhà ơi 🙏 con mới tìm được tấm ảnh này trong album của ông, chụp khoảng năm {năm}. Con chỉ nhận ra được {2} người thôi. Ai biết những người còn lại là ai, làm nghề gì thì bấm vào link ghi giúp con với nha, không cần đăng ký đâu ạ 👇 {link}" |
| **Hỏi ông bà** | chân dung bà + câu hỏi chữ to + nút ghi âm | "Cả nhà ơi, tuần này mình cùng hỏi {bà nội} một câu nha: “{câu hỏi}”. Ai đang ở gần bà thì hỏi giúp rồi bấm link ghi âm lại chừng một phút thôi, để con cháu ở xa cũng được nghe bà kể ❤️ {link}" |
| **Hồ sơ còn thiếu** | chân dung + "Nhà mình mới biết được 8/14 điều về cụ" + danh sách ✓ / ○ | "Cả nhà ơi, con đang làm hồ sơ cho {cụ Tư} trong gia phả mà còn thiếu {nghề của cụ, ngày giỗ, một kỷ niệm về cụ}. Ai nhớ chút nào kể giúp con với, một câu thôi cũng quý lắm ạ. Con sẽ ghi tên người kể vào hồ sơ luôn 🙏 {link}" |
| **Kể về người này** | ảnh + tên + năm sinh–mất | "Sắp tới ngày giỗ {bà Năm} rồi. Ai còn nhớ kỷ niệm gì với bà, món bà hay nấu, câu bà hay dặn… thì kể lại giúp con nha, để mấy đứa nhỏ sau này còn biết về bà 👇 {link}" |
| **Họ đang lớn lên** | 4 ô số: ký ức mới, người được nhận ra, người đã góp, số thế hệ | "Cảm ơn cả nhà nha! Tháng này nhà mình đã kể thêm được {12} chuyện và nhận ra {5} người trong ảnh cũ 🥰 Vẫn còn {6} cụ chưa có chuyện kể với {2} tấm ảnh chưa ai biết, ai rảnh thì vào giúp thêm nha {link}" |
| **Ngày giỗ / tảo mộ** | ngày âm/dương + tên người | "Cả nhà ơi, {ngày} này là giỗ {cụ}. Ai có ảnh cũ hay chuyện về cụ thì gửi vào đây giúp con, hôm giỗ cả nhà cùng xem lại nha {link}" |
| **Cảm ơn người góp** | "Cảm ơn {tên} đã kể chuyện về {cụ}" | "Cảm ơn {cô Hai} đã kể chuyện hồi cụ đi kéo xe ở Hải Phòng, con đọc mà xúc động quá 😭 Cả nhà vào đọc nha, ai biết thêm thì kể tiếp giúp con {link}" |

Ba giọng cho mỗi mẫu: **thân mật** (như trên — nhóm gia đình nhỏ), **lễ phép** (nhóm họ lớn, có các cụ: "Kính thưa các cụ, các ông bà, cô chú…", bỏ emoji), **ngắn** (Story / bình luận: một câu + link).

Nguyên tắc viết & thiết kế ảnh (đối chiếu kinh nghiệm thiết kế bài mạng xã hội + cách các nhóm gia phả nhờ nhận diện ảnh cũ):
- **Tiêu đề là một câu hỏi / lời nhờ** đọc được trong 1 giây ở cỡ chữ to (≥ 70px trên khổ 1080) — câu hỏi kéo người ta bình luận, kể cả khi chưa bấm link.
- **Một ảnh, một việc nhờ, một nút**; không nhồi nhiều lời kêu gọi. Chừa khoảng trống quanh link/QR.
- **Nói rõ là dễ**: "một câu thôi", "chừng một phút", "không cần đăng ký".
- **Cho thấy đã có người góp** ("đã có 14 cô dì chú bác vào góp rồi đó") và **còn thiếu bao nhiêu** (2/4 người, 8/14 điều) — thanh tiến độ tạo cảm giác "góp nốt".
- **Ảnh thật của gia đình** là trung tâm (ảnh cũ, chân dung) — không dùng ảnh minh hoạ chung chung.
- **Màu của app**: nền oxblood `#7A2E2E → #511C1C`, vàng đồng `#D9B468 / #B8893B`, giấy `#FBF7F0`, mực `#2B2320`; mẫu "Hỏi ông bà" dùng theme `night`; chữ: Noto Serif cho tiêu đề, Be Vietnam Pro cho nội dung (đủ dấu tiếng Việt).
- **Khổ vuông có QR** (xem trên máy tính / in ra được); **khổ Story không có QR** (không ai quét màn hình của chính mình) mà dùng nút "Bấm vào đây giúp con" + mũi tên lên chỗ dán link; chừa ~250px trên/dưới cho thanh giao diện Story.
- Thông tin người kể có thể nhầm → form góp luôn hỏi "biết từ đâu" (đã có ở mục 5).
- Link dán lên Facebook/Zalo phải **hiện đúng ảnh này làm ảnh xem trước** (Open Graph): trang `/g/:token` cần trả thẻ `og:image` từ phía máy chủ (SPA không tự làm được) — dùng cùng ảnh đã xuất, lưu vào bucket như `card_shares`.

Nội dung trên ảnh là **động**, người chia sẻ chọn trước khi xuất:
- **Người đọc**: *Người trẻ* (thân mật: "Cả nhà ơi…", "giúp con nha") / *Người lớn tuổi* (lễ phép: "Kính nhờ các cụ, các bác…", "xin kể giúp con ạ", chữ to hơn, bước làm có **"bấm nút nói để kể"** thay cho gõ chữ).
- **Xưng hô**: con / cháu / em / mình — chèn vào mọi câu nhờ.
- **Link nằm ở đâu**: *mã QR trên ảnh* / *link trong bài viết* / *link ở bình luận đầu tiên* / *nhãn dán link (Story)*. Ảnh đăng lên mạng xã hội **không bấm được**, nên bước 1 luôn nói rõ chỗ mở link; "chạm vào mặt / chọn ô còn trống" là bước 2, làm *trong app sau khi mở link*. Kinh nghiệm phổ biến (chưa kiểm chứng) là Facebook giảm tiếp cận bài có link ngoài, nên mặc định gợi ý để link ở bình luận đầu tiên; tin nhắn soạn sẵn đổi theo ("link cả nhà bấm ở bình luận nha").
- **Hướng dẫn 3 bước** (bật/tắt): ① mở link (theo chỗ đã chọn) ② làm một việc (chạm mặt / chọn điều mình nhớ / bấm ghi âm) ③ Gửi. Tắt thì còn một câu tóm tắt.
- Trong app thật: các lựa chọn này nằm ở màn "Kêu gọi góp" (chọn → xem trước → tải ảnh + sao chép tin nhắn khớp với lựa chọn); app nhớ lựa chọn lần trước.

Bản mẫu trực quan 5 ảnh: artifact "Mẫu infographic mời góp" (dữ liệu mẫu, ảnh và QR là chỗ giữ chỗ).

Quy tắc:
- Người dùng chọn giọng + xưng hô trước khi sao chép; sửa tự do trước khi gửi.
- Mỗi lần tạo ảnh là tạo luôn một **link đóng góp riêng** (gắn đúng người / câu hỏi / ảnh) để đo được mẫu nào hiệu quả (`share_template_id` trong event Umami).
- Không đưa thông tin nhạy cảm của người còn sống (ngày sinh đầy đủ, địa chỉ, trẻ em) lên ảnh; mẫu "Hồ sơ còn thiếu" và "Kể về người này" mặc định chỉ cho người đã mất.
- Ảnh có watermark nhỏ "Dòng Họ Việt" + QR → cũng là quảng bá.
- Chỗ bấm: nút "Kêu gọi góp" ở khối "Cả nhà đang kể" (Tổng quan), trên Chi tiết người, trên ảnh chờ nhận diện, trên câu hỏi vừa tạo, và ở tab "Cùng góp" của trang chia sẻ (khách cũng chia sẻ tiếp được → lan nhiều tầng).

## 5. Hồ sơ nhiều người góp — mỗi người một mảnh, admin gom & duyệt

Một hồ sơ người được **chia thành các mảnh**. Mỗi người thân chỉ cần biết một mảnh là góp được; admin thấy tất cả mảnh của nhiều người đặt cạnh nhau rồi chọn / gộp / duyệt.

**Các mảnh của hồ sơ** (mỗi mảnh một trạng thái ✓ đã có / ○ còn thiếu / ● có đề xuất mới):

| Nhóm | Mảnh | Loại |
|---|---|---|
| Danh tính | họ tên, tên thường gọi, tên huý / tự, giới tính | dữ kiện |
| Năm tháng | ngày sinh, ngày mất (âm/dương), ngày giỗ | dữ kiện |
| Gốc gác | quê quán, nơi sinh, nơi ở, nơi an táng | dữ kiện |
| Quan hệ | cha mẹ, vợ chồng, con | dữ kiện |
| Cuộc đời | nghề nghiệp, học vấn, quân ngũ / công tác, tính cách, sở thích | ký ức (nhiều người kể khác nhau vẫn giữ hết) |
| Câu chuyện | kỷ niệm, giai thoại, lời dặn | ký ức |
| Hình ảnh | chân dung, ảnh đời thường, ảnh mộ | ký ức; chọn ảnh đại diện = dữ kiện |

**Phía người góp** (link đóng góp, không cần đăng nhập):
- Mở hồ sơ thấy ngay **"Còn thiếu: nghề nghiệp · quê quán · ảnh chân dung"**, mỗi mảnh một nút "Tôi biết".
- Mỗi lần chỉ điền **một mảnh**, kèm "Bạn biết từ đâu?" (nghe bố kể / giấy tờ / ảnh / chính tôi) và mức chắc chắn (chắc / nghe nói).
- Mỗi mảnh hiện như một **luồng bình luận**: người góp thêm ý kiến của mình ("Tôi nghe bố kể là 1932", "Giấy khai sinh ghi 1934"), trả lời / bổ sung cho ý kiến trước, đính ảnh giấy tờ làm bằng chứng. Không có nút "đồng ý" kiểu Like — muốn đồng ý thì viết nguồn của mình.

**Phía admin — màn "Gom hồ sơ"** (mở từ Chi tiết người hoặc từ hàng chờ ở Tổng quan):
- Hiện theo **từng mảnh**, mỗi mảnh liệt kê mọi đề xuất: giá trị · người góp · quan hệ · nguồn · mức chắc chắn · thời gian.
- Mảnh **dữ kiện**: **luôn chờ admin duyệt, kể cả khi nhiều người trùng ý** (cần độ chính xác). Luồng bình luận được tóm tắt trên đầu ("3 ý kiến nói 1932 · 1 ý kiến nói 1934 kèm ảnh giấy tờ") để admin quyết nhanh; admin chọn một → ghi vào hồ sơ, đóng luồng kèm lý do, các ý kiến vẫn lưu làm lịch sử nguồn.
- Mảnh **ký ức**: duyệt nhiều cái cùng lúc, giữ cả, ghi rõ ai kể; hoặc "gộp thành một đoạn" (P4: nhờ Claude qua MCP soạn bản nháp từ các mảnh, admin sửa rồi duyệt).
- Nút **"Hỏi lại người góp"** (trạng thái `needs_info` đã có) và **"Kêu gọi góp mảnh còn thiếu"** → ra mẫu chia sẻ "Hồ sơ còn thiếu" (4.3).
- **Thanh tiến độ hồ sơ** "8/14 mảnh" hiện ở Chi tiết người, danh bạ, và "Tiến độ hoàn thiện" ở Tổng quan → admin biết hồ sơ nào cần kêu gọi.
- Duyệt xong: ghi `audit_log`, người góp nhận thông báo "đóng góp của bạn đã được đưa vào hồ sơ cụ Tư", tên họ vào mục ghi công của hồ sơ.

**Dữ liệu**: không cần bảng mới cho dữ kiện — dùng `contributions` với `contribution_type = 'edit_person'` nhưng **mỗi bản ghi một mảnh** (`proposed_data = {field, value, source, confidence}`) thay vì cả hồ sơ, thêm cột `field text` + index `(person_id, field, status)` để gom nhanh. `apply_contribution` nhận một mảnh. Mảnh ký ức dùng `person_memories` với `kind` thêm `'fact_note'` + cột `topic` (nghề nghiệp, học vấn, …). Màn "Gom hồ sơ" đọc qua RPC `person_contribution_pieces(person_id)` trả về theo mảnh.

## 6. Dữ liệu (migration)

Áp tay trên self-host (deploy không áp migration), nhớ ghi `schema_migrations`.

```sql
-- Ký ức gắn người: chuyện kể / ảnh / ghi âm / câu trả lời
create table public.person_memories (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  person_id uuid references public.persons(id) on delete set null,  -- null = ký ức chung của họ
  kind text not null check (kind in ('story','photo','audio','answer')),
  body text check (body is null or char_length(body) <= 20000),
  media_path text,                       -- storage path, không lưu URL công khai
  transcript text,                       -- chữ từ ghi âm (Web Speech / người góp tự sửa)
  question_id uuid,                      -- nếu là câu trả lời
  author_user_id uuid references public.profiles(id) on delete set null,
  author_name text,                      -- khách
  author_relation text,
  via_link_id uuid,                      -- link đóng góp đã dùng
  visibility text not null default 'clan' check (visibility in ('clan','share')),
  status text not null default 'visible' check (status in ('pending','visible','hidden')),
  created_at timestamptz not null default now(),
  constraint person_memories_author check (author_user_id is not null or author_name is not null)
);

-- Link đóng góp: mở rộng share_links thay vì bảng mới
alter table public.share_links
  add column recipient_label text,       -- "Bác Ba", "Cô Hoa (Mỹ)"
  add column allow jsonb not null default '{}'::jsonb,  -- {memory:true, answer:true, tag:true, propose:true}
  add column branch_id uuid references public.branches(id) on delete set null,
  add column use_count int not null default 0;
-- scope thêm 'contribute'; **mọi thành viên** tạo được link scope này (đã chốt), giới hạn 20 link/người/ngày; admin xem & thu hồi được mọi link.

-- Câu hỏi cho người thân
create table public.family_questions (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  about_person_id uuid references public.persons(id) on delete set null, -- hỏi về ai
  ask_person_id uuid references public.persons(id) on delete set null,   -- hỏi ai (ông/bà)
  question text not null check (char_length(question) between 3 and 500),
  asked_by uuid references public.profiles(id) on delete set null,
  link_id uuid references public.share_links(id) on delete set null,
  status text not null default 'open' check (status in ('open','answered','closed')),
  created_at timestamptz not null default now()
);

-- Ảnh "Đây là ai?"
create table public.clan_photos (
  id uuid primary key default gen_random_uuid(),
  clan_id uuid not null references public.clans(id) on delete cascade,
  media_path text not null,
  caption text, year_approx int, place text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploader_name text,
  visibility text not null default 'clan' check (visibility in ('clan','share')),
  created_at timestamptz not null default now()
);
create table public.photo_faces (
  id uuid primary key default gen_random_uuid(),
  photo_id uuid not null references public.clan_photos(id) on delete cascade,
  clan_id uuid not null,
  box real[4] not null,                  -- x,y,w,h theo tỉ lệ 0..1
  person_id uuid references public.persons(id) on delete set null,
  suggested_name text, suggested_note text,  -- "ông Tư, thợ mộc"
  status text not null default 'suggested' check (status in ('suggested','confirmed','rejected')),
  tagged_by uuid, tagger_name text,
  created_at timestamptz not null default now()
);

-- Lượt viếng thăm: chỉ số đếm theo ngày, KHÔNG lưu IP
create table public.clan_visit_daily (
  clan_id uuid not null references public.clans(id) on delete cascade,
  day date not null,
  source text not null check (source in ('share','member')),
  visits int not null default 0,
  primary key (clan_id, day, source)
);
```

RLS:
- `person_memories` / `clan_photos` / `photo_faces` / `family_questions`: SELECT thành viên; INSERT **thành viên** (không cần editor); UPDATE/DELETE tác giả hoặc editor+; đổi `status` chỉ editor+.
- Khách luôn đi qua edge function (service role), không mở RLS cho anon.
- Trang chia sẻ đọc qua `share-view` mở rộng, chỉ trả `visibility='share' and status='visible'` và bỏ ký ức về người còn sống trừ khi bật rõ.

Ràng buộc dữ kiện:
- Gắn `person_id` vào một mặt = dữ kiện: chỉ `confirmed` khi **editor+ xác nhận** (không tự xác nhận theo số đông). Các lượt gắn khác nhau hiện dạng bình luận trên mặt đó.
- Tên/nghề đề xuất cho mặt chưa có trong cây → nút "Tạo đề xuất thêm người" → `contributions.add_person`.
- `contributions.contribution_type` thêm `add_photo`, `add_event`, `link_relation`.

## 7. Edge function & luồng

- **`community-submit`** (mới, hoặc mở rộng `submit-contribution`): nhận token link + loại (memory/answer/tag/propose/photo). Kiểm tra link còn hạn, chưa thu hồi, `allow` cho phép, trong phạm vi người/nhánh; giới hạn tần suất theo token + IP (không lưu IP vào bảng nội dung); tăng `use_count`.
- **Tải ảnh/ghi âm của khách**: function cấp signed upload URL (giới hạn dung lượng; ảnh nén ở client; ghi âm `MediaRecorder` webm/m4a ≤ 5 phút).
- **Chuyển giọng nói thành chữ**: Web Speech API (`vi-VN`) nếu trình duyệt hỗ trợ, người góp sửa lại trước khi gửi; không có thì chỉ lưu ghi âm. Không dùng AI phía server.
- **`share-view`**: trả thêm khối `community` (số liệu, ảnh chờ nhận diện, câu hỏi mở, ký ức được phép) và **cộng lượt `clan_visit_daily`** (một lượt / phiên trình duyệt, dùng sessionStorage để không đếm trùng khi F5).
- Thành viên mở trang họ: cộng `source='member'` qua RPC nhẹ, tối đa một lần / người / ngày.

Luồng "Hỏi ông bà" (P1):
1. Cháu chọn "Đặt câu hỏi" → chọn hỏi ai (ông nội) + gợi ý câu hỏi có sẵn ("Ngày nhỏ ông thích chơi gì?") hoặc tự viết.
2. App tạo link `contribute` gắn câu hỏi, nút **Gửi qua Zalo / sao chép**.
3. Ông bà mở link: màn hình to chữ, một câu hỏi, nút **ghi âm** thật to, ô chữ phụ.
4. Gửi xong → ký ức `answer` trên hồ sơ người được hỏi; người hỏi nhận thông báo.
5. "Câu hỏi của tuần": mỗi thứ Hai `weekly-digest` gợi ý một câu cho mỗi họ.

Luồng "Đây là ai?" (P2):
1. Thành viên tải ảnh cũ (năm, nơi chụp nếu nhớ) → "Nhờ cả nhà nhận diện" → link để gửi nhóm Zalo.
2. Người xem khoanh một mặt (kéo hình chữ nhật, điện thoại thì chạm + kéo) → chọn người trong cây hoặc gõ tên + nghề.
3. Hiện tất cả đề xuất trên mặt đó, ai cũng thấy ("2 người nói là ông Tư").
4. Xác nhận → ảnh vào hồ sơ người đó, gắn vào dòng thời gian.

### Chống spam / phá hoại (vì đóng góp mở cho khách và mọi thành viên tạo link)
- **Giới hạn tần suất** ở `community-submit`: theo token link (vd 30 lượt/giờ), theo IP băm (vd 60 lượt/giờ, chỉ giữ trong bộ đếm ngắn hạn, không lưu vào bảng nội dung), theo người góp đăng nhập.
- **Link có hạn & phạm vi**: hết hạn mặc định 30 ngày, giới hạn số lượt dùng, chỉ trong người/nhánh đã chọn; admin thu hồi một chạm, thu hồi link thì ẩn luôn các đóng góp chưa duyệt từ link đó.
- **Chặn bot**: honeypot field + thời gian tối thiểu điền form; Cloudflare Turnstile chỉ bật khi một link vượt ngưỡng.
- **Lọc nội dung**: chặn link ngoài trong chữ của khách, độ dài tối đa, danh sách từ cấm cơ bản; ảnh/ghi âm giới hạn dung lượng & số lượng mỗi link.
- **Khách mới** (chưa từng được duyệt) → ký ức của họ luôn vào hàng chờ, kể cả khi họ đặt *duyệt sau*; sau 3 lần được duyệt thì coi là tin cậy.
- **Một chạm dọn dẹp**: admin chọn "Ẩn tất cả từ người góp/link này".
- **Gom thông báo**: admin nhận tối đa 1 thông báo / giờ / họ, không bị dội khi có spam.

## 8. P4 — Tiểu sử tổng hợp (qua MCP)

- Thêm tool `get_person_memories` (đọc ký ức/câu trả lời/ảnh đã xác nhận của một người) và `propose_biography` (ghi **bản nháp** tiểu sử, chờ admin duyệt, ghi nguồn từng câu).
- Admin dùng Claude bên ngoài qua `mcp-server/` sẵn có. Không đưa trợ lý AI trở lại app.
- Bản nháp hiện ở Chi tiết người: "Bản nháp tiểu sử từ 7 ký ức — Duyệt / Sửa / Bỏ".

## 9. P5 — Quê hương 360°

- Thêm `lat/lng` (tuỳ chọn) cho quê gốc, mộ phần, di sản; chọn bằng ghim trên bản đồ.
- Người ở quê chụp **ảnh 360°** bằng điện thoại → góp qua link (loại `photo` có cờ `panorama`), xem bằng trình xem panorama (vd Pannellum), không cần kính VR.
- Có Street View tại toạ độ thì nhúng thêm (Maps Embed API). Lưu ý vùng quê VN phủ ít — không coi là nguồn chính.
- Trang chia sẻ: tab/khối "Về quê" cho Việt kiều.

## 10. Đo lường (Umami event + SQL)

- `% nội dung do người không phải admin tạo` (chỉ số chính).
- Số link đóng góp gửi đi / được mở / có ít nhất một đóng góp.
- Khách góp → đăng ký trong 7 ngày (`community_submit` → `signup`).
- Số họ có ≥ 2 thế hệ cùng góp trong 30 ngày.
- Tỉ lệ câu hỏi được trả lời; tỉ lệ mặt trong ảnh được xác nhận.
- Lượt viếng thăm theo nguồn (share / member).

## 11. Câu hỏi cần chốt

Đã chốt (2026-11-20):
1. ✅ Ký ức: **admin mỗi họ tự chọn** duyệt trước / duyệt sau (họ mới mặc định duyệt sau; khách mới luôn vào hàng chờ).
2. ✅ **Mọi thành viên** tạo được link đóng góp (giới hạn/ngày, admin thu hồi được).
3. ✅ + 7. ✅ Gắn mặt và mảnh dữ kiện: hiện dạng **bình luận**, **luôn chờ admin duyệt**, không tự duyệt theo số đông; có lớp chống spam (mục 7).
5. ✅ **Zalo Mini App: ngoài phạm vi** — Mini App đang tạm dừng vô thời hạn, plan này không đụng tới.

4. ✅ Lượt viếng thăm **hiện công khai** trên trang chia sẻ.
6. ✅ Khách **được góp ảnh / ghi âm** (giới hạn dung lượng + số lượt theo link).
8. ✅ Thành viên thấy đầy đủ bình luận của người khác trên cùng mảnh; khách chỉ thấy **số lượng ý kiến**.

## 12. Ước lượng

| Giai đoạn | Việc | Ước lượng |
|---|---|---|
| P0 | migration + `community-submit` + tạo/quản lý link + kho ký ức ở Chi tiết người + khối "Cả nhà đang kể" + tab "Cùng góp" + lượt viếng thăm | 5–7 ngày |
| P1 | câu hỏi + màn trả lời to chữ + ghi âm + câu hỏi tuần | 3–4 ngày |
| P2 | ảnh + khoanh mặt (desktop + mobile) + xác nhận | 4–5 ngày |
| P0b | đóng góp theo mảnh dạng bình luận + RPC gom + màn Gom hồ sơ + thanh tiến độ + chống spam | 5–6 ngày |
| P0c | genre `moi-gop` trong Kho thiệp + 7 mẫu tin nhắn × 3 giọng + QR + share | 3–4 ngày |
| P3 | 3 loại đóng góp mới (ảnh, sự kiện, quan hệ) + apply | 2–3 ngày |
| P4 | 2 tool MCP + màn bản nháp | 1–2 ngày |
| P5 | toạ độ + panorama + Street View | 3–4 ngày |
