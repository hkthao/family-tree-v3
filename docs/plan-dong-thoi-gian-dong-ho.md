# Plan: Dòng thời gian dòng họ ("Câu chuyện qua các thế hệ")

Mẫu tham chiếu: poster ngang "The Johnson Family — Our Story Through the Generations": tiêu đề + khẩu hiệu,
trục thời gian ngang với các mốc theo thập niên (ảnh, tiêu đề phụ, mô tả ngắn), hàng dưới là thẻ
"Life Then" (bối cảnh thời đại) kèm hình minh hoạ, câu chốt ở chân poster.

## Đã chốt
1. **Nguồn mốc: tự động + chỉnh tay.** App dựng sẵn mốc theo thế hệ từ cây; admin/editor sửa tiêu đề, mô tả,
   ảnh từng mốc, ẩn mốc, thêm mốc tay.
2. **Hiển thị: trang trong app + xuất poster** (PNG/PDF khổ ngang) để in, treo tường, chia sẻ.
3. **Bối cảnh thời đại: thư viện thẻ Việt Nam theo thập niên**, gắn theo năm; admin bật/tắt/sửa.

## Chưa chốt (mặc định đề xuất)
- ~~Gom theo thập niên hay theo đời?~~ **Đã chốt: thập niên**, nhưng cỡ gom tự co giãn vì có dòng họ lịch sử từ
  năm 1200: ≥1800 thập niên · 1500–1799 nửa thế kỷ · <1500 thế kỷ. Giai đoạn không có dữ liệu bị bỏ qua.
- Có hiện người còn sống không? → theo cài đặt riêng tư hiện có (ẩn thông tin nhạy cảm như các màn khác).
- Trang xem công khai qua link Share? → làm sau, bản đầu chỉ trong app.

## Mô hình dữ liệu
- `clan_timeline_milestones` (clan_id, year_from, year_to nullable, title, subtitle, body, photo_path,
  source `auto|manual`, auto_key nullable, hidden bool, sort_order, created/updated).
  - Mốc tự động **không lưu sẵn**: tính lúc xem, ghép với bản ghi chỉnh tay theo `auto_key`
    (vd `decade:1950`) để áp ghi đè (sửa chữ, ảnh, ẩn). Nhờ vậy cây đổi thì mốc tự cập nhật.
- `timeline_era_cards` (thư viện bối cảnh VN, dữ liệu seed, không theo dòng họ): year_from, year_to, title,
  bullets[], icon/hình. Cho phép ghi đè theo dòng họ qua bảng phụ `clan_timeline_era_overrides`.
- RLS: đọc theo quyền xem cây; ghi chỉ admin/editor. Migration áp tay lên self-host (xem memory
  migrations thủ công).

## Dựng mốc tự động (hàm thuần, có test)
`computeClanTimeline(persons, families, events, opts)` trả về danh sách mốc, mỗi thập niên có dữ liệu:
- Người đáng nhớ: Thuỷ tổ / người đầu dòng, người sinh trong thập niên, hôn nhân, người mất (chỉ người đã mất).
- Ảnh đại diện mốc: ảnh người nổi bật nhất thập niên (ưu tiên có ảnh, người đã mất).
- Câu mô tả sinh từ mẫu ("Ông A lập gia đình với bà B, có N người con."), admin sửa được.
- Chỉ dùng năm, không suy ra ngày; bỏ mốc rỗng.

## UI
- Trang mới `/clans/:id/dong-thoi-gian` (thêm vào ngăn "Tính năng"): trục ngang cuộn được trên desktop,
  dọc trên điện thoại; hàng thẻ bối cảnh bên dưới trục.
- Chế độ sửa (admin/editor): bấm mốc mở ngăn kéo bên phải (đúng quy ước side panel) để sửa chữ/ảnh/ẩn/thêm mốc.
- Dùng lại component đã có: avatar/ảnh người, Callout, ngăn kéo, lọc.

## Xuất poster
- Tái dùng cơ chế xuất PNG của cây (`exportPng`) + PDF; khổ ngang 2:1 như mẫu; chọn nền (giấy cũ / thuỷ mặc
  theo nền đã có), tiêu đề + câu chốt sửa được.
- Vẽ poster bằng một component riêng (SVG/HTML) dùng chung dữ liệu với trang, để thêm loại mốc mới chỉ sửa ở một chỗ.

## Nguyên tắc UX: người dùng gần như không phải gõ
- App sinh sẵn **mốc ứng viên** (tiêu đề, mô tả, hình, ảnh người đại diện); người dùng chỉ tick chọn, mốc
  quan trọng đã bật sẵn (`recommended`). Gõ chữ chỉ để tinh chỉnh, không bắt buộc.
- Mỗi mốc có `iconKey` → hình minh hoạ cùng một bộ phong cách (bước 3), thẻ bối cảnh cũng vậy.

## Các bước làm
1. ✅ Hàm `computeClanTimeline` + seed thẻ bối cảnh VN + test (`src/lib/timeline/`, `src/test/lib/computeClanTimeline.test.ts`).
2. Migration (2 bảng + RLS) + query layer.
3. Trang xem (chỉ đọc) từ dữ liệu tự động.
4. Chế độ sửa trong ngăn kéo + mốc tay + ẩn mốc.
5. Xuất poster PNG/PDF.
6. i18n EN, mục trong ngăn "Tính năng", tài liệu hướng dẫn.
7. (Sau) link Share công khai, MCP tool đọc/sửa mốc.

## Rủi ro
- Dữ liệu năm thưa/không đều → nhiều thập niên rỗng: gom mốc rỗng liền kề, hoặc đổi sang theo đời.
- Văn bản bối cảnh lịch sử phải đúng sự thật: seed cần rà soát, ghi nguồn; cho admin sửa.
- Ảnh poster độ phân giải cao nặng: giới hạn số ảnh, tải lười khi xuất.

## Cập nhật 23/11/2026: MỘT kho dữ liệu cho cả dòng họ và từng người
Quyết định: dòng thời gian của từng người (Danh bạ) và poster dòng họ dùng **chung một bảng** `clan_timeline_milestones`,
cùng cấu trúc, cùng poster (`TimelinePoster`) và cùng form sửa (`TimelineMilestoneForm`) — sửa một chỗ.
- `person_id`: mốc nói về người nào (null = mốc chung). Trang người lọc theo `person_id`.
- `on_clan`: có hiện trên poster dòng họ không. Mốc tạo từ poster dòng họ mặc định `true`; mốc chi tiết tạo ở trang người
  mặc định `false` (dòng họ chỉ cần tổng quan), bật bằng ô "Hiện trên dòng thời gian dòng họ".
- Bảng cũ `person_timeline` được chuyển sang (migration `20261123110000`, chạy lại không trùng nhờ `source_key = legacy:<id>`),
  **không xoá** — xoá ở migration sau khi đã kiểm chứng trên server thật.
- Trang người (`PersonTimelineCard`) dùng poster chế độ `bare` (không tiêu đề, khung ảnh chỉ khi có hình thật, một bên nếu không có
  thẻ bối cảnh). Dòng họ lịch sử chưa có mốc lưu vẫn dựng tạm (chỉ đọc) từ tiểu sử, kèm mốc Sinh / Mất.
- MCP: `list/create/update/delete_timeline_milestone(s)`, `get/set_person_timeline` (cùng kho) và bộ công cụ liên kết dòng họ.
- Việc còn lại: áp 2 migration + deploy mcp-server lên server tự host; xoá bảng `person_timeline` sau khi kiểm chứng.
