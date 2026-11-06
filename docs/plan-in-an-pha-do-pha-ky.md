# Kế hoạch: In ấn — Phả đồ khổ lớn & Sách Phả ký

> Plan tự-chứa để Claude Code triển khai trong session sau. Tiếng Việt mô tả;
> tên bảng/cột/route/biến giữ tiếng Anh. Trạng thái: **mới khảo sát, CHƯA chốt
> phạm vi — còn các câu hỏi mở ở mục 6.**

## 1. Vì sao làm
Khảo sát thị trường cho thấy đây là thứ dòng họ chịu trả tiền thật: Phả Tuệ
bán "xuất phả đồ in khổ lớn", Gia phả Đại Việt / AKB bán "in ấn tốt" là điểm
mạnh chính. Phần mềm vẽ cây thì miễn phí đầy rồi; **sản phẩm cầm được trên tay
(tranh phả đồ treo nhà thờ họ, cuốn sách phả) mới là thứ đáng tiền.**

Dữ kiện thị trường (nguồn ngoài, chưa kiểm độc lập, nhiều trang là quảng cáo):
- Phả Tuệ: xuất phả đồ PDF = **1 xu/thành viên** (~400–500đ/xu) cho tài khoản
  thường; gói Phả Sư **1.990.000đ/năm** miễn phí xuất PDF. Trang của họ **không
  niêm yết giá in thật** — chỉ bán file.
- Nhà in VN: bìa gia phả ~**100.000đ/bìa** (giảm 30% từ 50 cuốn); in tờ lẻ
  **800–3.000đ/tờ** tuỳ số lượng; phả đồ khổ lớn **báo giá theo yêu cầu**, chất
  liệu decal / PP / giấy.
- Nguồn: intamphuc.vn, inbiamavang.com, indongloi.com, phatue.vn/bang-gia.
- **Không tìm được** bảng giá in phả đồ khổ lớn hay sách bìa da có số thật →
  cần gọi 2–3 nhà in lấy báo giá trước khi chốt mô hình kinh doanh (mục 6).

## 2. App đã có gì (đã đọc code — KHÔNG làm lại)

| Thành phần | File | Hiện trạng |
|---|---|---|
| **Sổ gia phả PDF** | `src/lib/pdf/ClanBookPdf.tsx` (1.964 dòng), `exportClanBook.tsx` | Sách **A4** bằng `@react-pdf/renderer`: bìa có QR link xem công khai, viền hoạ tiết dây leo, hình nền mờ (Phượng/Rồng), thẻ danh bạ, thẻ thông gia, sơ đồ cây, cây thư mục, di sản, mộ phần, quỹ họ. Bảng màu hoàng gia, font chọn được. Đã có từ nhiều commit — **đây chính là nền của "sách phả"** |
| Sơ đồ cây trong sổ | `ClanBookPdf.tsx` (`TreeDiagramPage`) | **SVG vector**, tuỳ chọn vẽ cả cây trên **một trang khổ tự tính** (`treeSinglePage`) hoặc tách nhiều trang A4 theo đời |
| Cây thư mục PDF | `FolderTreePdf.tsx` | Trang khổ tự tính theo cây |
| Canvas phả đồ → PDF | `exportCanvasPdf.tsx`, `canvasModel.ts` (A0–A3) | Chụp ảnh Konva rồi nhúng 1 trang. **Là ảnh raster**, trần 16 triệu điểm ảnh. Canvas đang **tạm ẩn** (prod chưa có bảng `tree_canvases`) |
| Ảnh PNG cây | `exportTreePng.ts` | scale cố định ×2 |

**Phát hiện cần xử lý — chất lượng in khổ lớn:** khổ A0 (841×1189 mm) ≈ 14,3
triệu px ở 96 dpi; với trần 16M px thì hệ số chỉ ~1,06 → **~100 dpi hiệu dụng**.
In A0 cần tối thiểu ~100–150 dpi nhìn gần, nên **chưa đạt chuẩn in** và chữ sẽ
vỡ khi phóng. Đường đi đúng là **xuất vector** (như `TreeDiagramPage`), không
dựa vào ảnh chụp canvas.

Chính tôi đã nhận định sai ở lượt trước ("không thấy Phả ký"): chỉ grep chuỗi
"phả ký" nên bỏ sót. Thực tế đã có sổ PDF đầy đủ; thứ **thiếu** là phần **văn
bản kể chuyện** (xem 3.2) và các tính năng chuẩn in (3.1).

## 3. Khoảng trống & đề xuất

### 3.1 Phả đồ khổ lớn (tranh treo)
Thiếu so với dịch vụ in thật:
1. **Xuất vector khổ lớn** (A2/A1/A0/tuỳ chọn mm) từ chính bố cục cây, không
   qua ảnh chụp. Dùng lại engine vẽ SVG của `TreeDiagramPage` / canvas.
2. **Chuẩn in**: lề an toàn, **bleed 3 mm + dấu cắt** (tuỳ chọn), nhúng font,
   ảnh chân dung độ phân giải đủ (cảnh báo nếu ảnh < ~150 dpi ở khổ đã chọn).
   Trình duyệt không ra CMYK — ghi rõ "PDF RGB, nhà in tự chuyển".
3. **Khung & trang trí truyền thống**: câu đối hai bên, tiêu đề lớn ("Phả đồ
   họ …"), rồng/phụng, khung viền, nền giấy. Dùng bộ tài nguyên của sổ
   (watermark/vine) làm điểm khởi đầu. Bản quyền ảnh trang trí: dùng tài
   nguyên tự vẽ hoặc có giấy phép.
4. **Bố cục thông minh cho cây lớn**: chọn gốc/chi, chỉ trực hệ (tuỳ chọn), số
   đời tối đa, chừa nhánh trống cho đời sau; xem trước tỉ lệ thật.
5. **Ước lượng chất liệu**: gợi ý khổ theo số người (bao nhiêu người thì chữ
   còn đọc được ở A1/A0).

### 3.2 Sách Phả ký (kể chuyện)
Sổ hiện chủ yếu là **dữ liệu có cấu trúc**. "Phả ký" truyền thống là **bài viết
lịch sử dòng họ**: nguồn gốc, thuỷ tổ, các chi, di huấn, sự kiện, gương mặt
tiêu biểu. Đề xuất:
1. Mô hình `clan_chronicle` (chương/mục, thứ tự, nội dung, ảnh) — chỉnh sửa
   trong app, **thành viên có quyền biên tập mới sửa**.
2. **AI soạn nháp** từ dữ liệu có sẵn (đời, tiểu sử `bio`, sự kiện, di sản,
   mộ phần) qua hạ tầng Trợ lý hiện có; **bắt buộc người duyệt**, đánh dấu rõ
   phần AI soạn, tuyệt đối không bịa sự kiện — chỉ diễn đạt lại dữ liệu đã nhập.
3. Chèn vào `ClanBookPdf`: mục lục, đánh số trang, các chương phả ký trước phần
   danh bạ, trang bìa/gáy.
4. **Bìa sách**: file bìa riêng đúng khổ nhà in (bìa trước + gáy + bìa sau, gáy
   tính theo số trang). Đây là thứ nhà in thật sự hỏi.
5. Khổ sách: A4 hiện tại hợp bản in lẻ; thêm **A5 / 16×24 cm** cho sách đóng
   quyển; chọn khổ ở hộp "Xuất sổ".

## 4. Mô hình kinh doanh (chưa chốt — xem câu hỏi mở)
| Hướng | Mô tả | Công sức | Rủi ro |
|---|---|---|---|
| A. Chỉ bán file | Xuất PDF chuẩn in, người dùng tự mang ra nhà in. Tính theo xu/gói như Phả Tuệ | Thấp | Doanh thu thấp, nhưng không vận hành |
| B. Giới thiệu nhà in | Nút "Gửi nhà in đối tác" kèm file + thông số khổ/số trang; hưởng hoa hồng | Vừa | Cần thoả thuận đối tác |
| C. In theo đơn (POD) | Nhận đơn, thanh toán, gửi file cho nhà in, giao hàng | Cao | Vận hành, thanh toán, CSKH, hoàn đơn |

Đề xuất bắt đầu **A (chuẩn in, chất lượng cao) → thử B** với 1–2 nhà in; chỉ
làm C nếu có nhu cầu thật. Tính năng AI/xuất tốn tài nguyên nên cân nhắc cơ chế
**lượt/xu** đã có (`/account/luot-dung`, CreditHistory) cho phần AI soạn phả ký.

## 5. Các pha
1. **P1 — Phả đồ vector khổ lớn**: xuất A3→A0 từ SVG, tiêu đề + khung cơ bản,
   cảnh báo dpi ảnh, thử in thật 1 tờ A1 để kiểm chữ/ảnh. Làm trên trang Cây
   (không phụ thuộc canvas đang ẩn).
2. **P2 — Chuẩn in**: bleed/dấu cắt, mẫu khung truyền thống, câu đối, chọn
   gốc/chi/số đời.
3. **P3 — Phả ký**: bảng + trình soạn + chèn vào sổ + mục lục/số trang.
4. **P4 — AI soạn nháp phả ký** (có người duyệt, có ghi nguồn dữ liệu).
5. **P5 — Bìa + khổ sách** (gáy tự tính), chọn A5/16×24.
6. **P6 — Kênh đặt in** (B hoặc C) sau khi có báo giá đối tác.

## 6. Câu hỏi mở cần chốt trước khi code
1. Mục tiêu chính: **tạo doanh thu** (bán in/xuất) hay **tăng giá trị cho người
   dùng miễn phí**? Quyết định xuất file miễn phí hay tính xu.
2. Gọi 2–3 nhà in (HN/HCM) lấy **báo giá thật** phả đồ A1/A0 (decal, PP, vải
   canvas, giấy mỹ thuật) và sách 100–200 trang bìa cứng/bìa da → định giá.
3. Khổ phả đồ phổ biến thực tế dòng họ dùng? (hỏi 5–10 trưởng họ/người làm
   gia phả; bài FB thu thập ý kiến đã soạn sẵn ở `fb-post-thu-thap-y-kien.md`
   — thêm câu hỏi về in ấn).
4. Phả ký: dòng họ muốn **AI viết nháp** hay tự viết hoàn toàn (nhạy cảm về
   độ chính xác lịch sử)? Mức người duyệt tối thiểu?
5. Có thử in A1 thật bằng ảnh test để kiểm chất lượng trước P2 không?

## 7. Rủi ro
- **Bộ nhớ/hiệu năng** trình duyệt khi dựng PDF vector hàng nghìn người ở A0
  (Zalo Mini App càng hạn chế): cân nhắc dựng phía server (edge function / job)
  nếu client không chịu nổi; cần đo trước.
- **Font tiếng Việt** trong `@react-pdf` từng lỗi dấu với font serif (commit
  `60990f6`) → chốt font đã kiểm trước khi làm tiêu đề trang trí.
- **Dữ liệu cá nhân trong bản in**: sổ in ra là bản vật lý, không thu hồi được;
  mặc định **ẩn người còn sống** hoặc cho chọn, và **không in địa chỉ** (xem
  `plan-thong-ke-ban-do.md`).
- **Bản quyền** ảnh trang trí/khung/câu đối; tách tài nguyên có giấy phép rõ.
- **Giá/nguồn thị trường** ở mục 1 chưa kiểm chứng; đừng dùng để định giá khi
  chưa có báo giá nhà in.
