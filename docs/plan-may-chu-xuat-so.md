# Plan: máy chủ dựng Sổ gia phả PDF cho app

Trạng thái: **đã chốt cấu hình máy: giữ 1 vCPU / 2 GB RAM** (2026-11-17). Còn 4 câu hỏi mở ở mục 7.

## 1. Vấn đề

Xuất Sổ gia phả hiện dựng PDF ngay trong trình duyệt người dùng. Với dòng họ lớn:

- Trước 2026-11-17: dàn trang chạy trên luồng chính → trình duyệt **treo**.
- Đã xử lý: dựng trong Web Worker (luồng chính đứng ~2 ms) + giới hạn 3 lượt lấy dữ liệu cùng lúc (`export_slots`).
- Còn lại: **chậm** và **phụ thuộc máy người dùng**. Đo thực tế (bản build, Chromium headless):

| Dòng họ | Cấu hình | Thời gian | Kích thước |
|---|---|---|---|
| ~350 người | chỉ danh sách chi tiết | ~13 giây | 0,7 MB |
| ~2000 người | chỉ danh sách chi tiết (tắt Cây + Cây thư mục) | ~377 giây | 3,7 MB |

Số 2000 người chưa gồm sơ đồ cây và cây thư mục nên cuốn sổ đủ mục còn lâu hơn. Điện thoại yếu còn chậm hơn nữa, và tab bị hệ điều hành dọn khi hết RAM.

## 2. Cái đã có sẵn (không làm lại)

`mcp-server/src/book.tsx` đã dựng sổ **phía server** bằng chính `ClanBookPdf` của app:

- **Dàn trang một lượt** + dàn lại riêng trang mục lục (comment trong file đo dàn trang ≈ 87% thời gian; cách này bỏ gần nửa việc so với hai lượt). **Bản trình duyệt/worker vẫn dựng hai lượt đầy đủ.**
- Cache theo băm nội dung (dữ liệu sổ + tuỳ chọn + mã dựng sổ): dữ liệu không đổi thì trả file cũ ngay.
- Lưu vào bucket private `book-exports` (`<uid>/…`), trả signed URL 30 phút, dọn định kỳ.
- Một sổ một lúc (`busy`), trần 1000 người, heap V8 600 MB (800 người ≈ 0,8 GB RSS).
- Đóng gói `Dockerfile.mcp`, deploy bằng `deploy-mcp.yml`.

Ngoài ra `export_slots` (migration 20261117500000) đã giới hạn số lượt chạm DB cùng lúc.

## 3. Phương án

### Giai đoạn 0 — không cần máy mới (làm trước, rẻ)

Đưa cách "dàn trang một lượt" của `book.tsx` vào Web Worker (`clanBook.worker.tsx`).

- Kỳ vọng: gần **một nửa** thời gian dựng trong trình duyệt; bỏ lượt thừa cũng giảm RAM đỉnh.
- Rủi ro thấp: logic đã chạy ở server, có đường lùi (lượt hai đầy đủ) khi bố cục không như dự kiến.
- Cần đo lại trước/sau trên cùng dữ liệu giả để xác nhận.

### Giai đoạn 1 — dịch vụ xuất sổ riêng (máy chủ mới)

Tách `exportClanBook` thành container **book-worker** chạy trên máy riêng, không chạy chung với DB hay web.

```
App (trình duyệt)          Supabase (DB + Storage)           book-worker (máy mới)
      │  1. tạo job ───────────► export_jobs (queued)
      │                                   ▲  2. nhận job (FOR UPDATE SKIP LOCKED)
      │                                   │  3. đọc dữ liệu, tải ảnh, dựng PDF
      │                                   │  4. upload book-exports/<uid>/…
      │  5. theo dõi trạng thái ◄─────────┘     (done + đường dẫn file)
      │  6. tải bằng signed URL
```

- **Hàng đợi trong DB** (`export_jobs`: clan_id, user_id, options, status, progress, error, file_path, created/started/finished). RLS: người tạo chỉ thấy job của mình. Worker dùng service role, lấy job bằng `FOR UPDATE SKIP LOCKED`.
- **Song song = 1 job/worker** (hoặc 2 nếu đủ RAM). Hàng chờ thật có thứ tự, thay cho cơ chế `export_slots` (giữ làm đường lùi chạy ở trình duyệt).
- **Cache** theo băm nội dung giữ nguyên: dữ liệu không đổi → job xong ngay.
- **Tiến độ** qua cột `progress`/`stage`; app poll vài giây (hoặc Realtime), hiện "Đang xếp hàng (vị trí N)", "Đang dàn trang…", "Sẵn sàng".
- **Đường lùi**: nếu dịch vụ không sẵn sàng (job không được nhận trong X phút), app báo và cho chọn xuất tại máy (worker trình duyệt).
- **Quyền**: chỉ thành viên dòng họ tạo job (kiểm trong RPC `create_export_job`); worker không tin dữ liệu từ máy khách, tự đọc theo `clan_id` bằng service role và kiểm lại người tạo là thành viên.
- **Giới hạn**: trần số người theo RAM thực của máy; vượt trần thì từ chối rõ ràng thay vì sập.

### Giai đoạn 2 — dòng họ rất lớn (> trần của giai đoạn 1)

Chỉ làm nếu thực tế có dòng họ vượt trần. Hướng: dựng **theo phần** (mỗi chi / khoảng đời một PDF rồi ghép bằng thư viện ghép PDF), mục lục tính từ số trang từng phần. Phức tạp và chưa chắc cần — bỏ qua cho đến khi có số liệu.

## 4. Sức chứa máy chủ

Máy dự kiến hiện có: **1 CPU, 2 GB RAM**, chưa có Node/nginx, đã dọn sạch Docker.

- Đo ở mcp-server: 800 người ≈ 0,8 GB RSS, trần heap 600 MB. Với 2 GB RAM (đang bị chiếm ~1,7 GB mà chưa rõ nguyên nhân) **không đủ an toàn**, và 1 CPU thì dòng họ 1000 người có thể mất nhiều phút.
- **Quyết định (2026-11-17): giữ máy 1 vCPU / 2 GB.** Hệ quả phải chấp nhận:
  - Trần số người **thấp hơn** 1000 của mcp-server. Giá trị ban đầu đặt ~400, rồi **đo trên chính máy này** (RSS đỉnh, thời gian, có chạm swap không) để chỉnh. Vượt trần thì từ chối rõ ràng và để người dùng xuất tại máy mình (đường lùi).
  - Chậm hơn máy mạnh (1 CPU): dòng họ vài trăm người có thể mất vài phút. Hàng đợi 1 job/lần là bắt buộc.
  - Máy hiện báo ~1,7 GB "đã dùng" ngay sau khởi động dù không chạy gì (chưa rõ nguyên nhân, nghi nhà cung cấp cấp RAM thấp hơn hiển thị) → RAM dùng được thực tế có thể chỉ còn ~0,2–0,3 GB. **Việc đầu tiên khi làm G1: đo RAM khả dụng thật** (chạy thử một job nặng đo RSS) trước khi chốt trần; nếu không đủ cho 400 người thì xem lại quyết định.
- Bắt buộc: swap (đã có ~3,9 GB, chậm hơn RAM nhiều), giới hạn bộ nhớ cho container (`--memory`, `--max-old-space-size` thấp hơn trần) để job hỏng bị kill riêng thay vì kéo sập sshd như đã gặp.
- Đã chuẩn bị máy: Docker trống, SSH chỉ bằng khoá, tường lửa chỉ mở cổng SSH, hệ điều hành đã cập nhật bản vá.

## 5. Bảo mật & vận hành

- Máy chủ **chỉ cần đi ra** (kết nối tới Supabase), **không mở cổng nào ra ngoài ngoài SSH** → không cần nginx/TLS cho dịch vụ này. Worker tự kéo việc từ DB.
- SSH chỉ bằng khoá, tường lửa mặc định chặn vào (đã cấu hình).
- Service role key đặt trong file env trên máy (không commit); mẫu `deploy/book-worker.env.example` chỉ có placeholder. **Không đưa IP/hostname/đường dẫn thật vào repo** (test `noInfraSecrets` chặn).
- Dọn file tạm định kỳ như `sweepExports`; nhật ký job giữ 30 ngày.
- Giám sát: endpoint `/healthz`, cảnh báo khi hàng đợi tồn > N phút.

## 6. Các bước làm

1. **(G0)** Đưa dàn trang một lượt vào worker trình duyệt; đo trước/sau.
2. Migration `export_jobs` + RPC `create_export_job` / `get_export_job`; RLS; test.
3. Tách `book-worker` từ `mcp-server/src/book.tsx` (dùng chung mã dựng), vòng lặp nhận job, upload, cập nhật trạng thái.
4. `Dockerfile.book-worker` + `deploy-book-worker.yml` (chạy tay, giống `deploy-mcp.yml`).
5. App: nút xuất tạo job, hiện hàng chờ/tiến độ, tải khi xong; giữ đường lùi dựng tại máy.
6. Dựng máy chủ (nâng cấu hình, swap, giới hạn RAM container, env), deploy, chạy thử với dòng họ lớn.
7. Theo dõi 1–2 tuần rồi mới quyết định giai đoạn 2.

Mỗi bước migration/deploy chỉ chạy khi chủ dự án nói rõ.

## 7. Câu hỏi cần chốt

1. ~~**Cấu hình máy**~~ — **đã chốt: giữ 1 CPU / 2 GB**, trần thấp (~400 người, đo lại trên máy).
2. **Có làm G0 trước** để xem còn cần máy riêng không? (khuyến nghị: có, vài giờ công)
3. **Đường lùi**: khi dịch vụ lỗi, cho người dùng xuất tại máy mình, hay chỉ báo "thử lại sau"?
4. **Phạm vi**: chỉ xuất Sổ, hay cả các PDF nặng khác (báo cáo quỹ, mã QR hàng loạt) về cùng dịch vụ?
5. **Ai được xuất** qua dịch vụ: mọi thành viên hay chỉ biên tập/quản trị (để tiết kiệm tài nguyên)?
