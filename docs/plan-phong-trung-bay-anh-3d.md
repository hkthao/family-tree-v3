# Plan — Phòng Trưng Bày Ảnh 3D "Phòng Ký Ức Dòng Họ"

> Nguồn ý tưởng: `spec-phong-trung-bay-anh-3d.md` (do người dùng cung cấp) + tham
> khảo repo `ClementCariou/virtual-art-gallery` (MIT, REGL). Bản plan này là phần
> **rà soát khả năng thực hiện + quyết định kỹ thuật + phân kỳ**, viết riêng cho
> codebase family-tree-v3.

## Mục tiêu
Biến ảnh dòng họ (ảnh cũ, ảnh kỷ niệm) từ album phẳng thành một **không gian trưng
bày 3D đi dạo được** — ảnh treo trên tường như bảo tàng, có nhãn tên/năm, chạm để
xem chi tiết. Về sau: nối với cây gia phả 3D, xuất clip chia sẻ, và trưng cả **hiện
vật 3D** (kỷ vật) trên bục.

## Đối tượng người dùng
Cả **người trẻ** (yếu tố "wow", chia sẻ mạng xã hội) lẫn **người lớn tuổi** (xem lại
kỷ niệm). Người lớn tuổi + mobile là ràng buộc UX quan trọng → **mặc định điều hướng
kiểu "tour dẫn đường", không bắt tự đi lại (free-walk)**. Xem mục Quyết định.

---

## 🔎 Đánh giá lại khả năng thực hiện (feasibility)

Kết luận nhanh: **KHẢ THI**, độ khó **trung bình–cao**, nên làm **MVP tinh gọn trước**.
Ba rủi ro cần khống chế: (1) bundle/PWA, (2) lượng ảnh thật, (3) hiệu năng GPU mobile.

| Khía cạnh | Đánh giá | Ghi chú / cách khống chế |
|---|---|---|
| **Engine 3D** | ✅ Sẵn sàng | Đã có `three@0.185` trong repo (dùng qua `3d-force-graph`). Thêm R3F tái dùng chính three core này. |
| **Bundle / PWA** | ⚠️ Rủi ro cao | Hiện `index` ~1.96MB, chunk `three` 796KB, `Tree3DView` 591KB; **precache PWA giới hạn 2MB** (đã phải lazy-load cây 3D). Phòng trưng bày **BẮT BUỘC** lazy-load thành chunk riêng + loại khỏi precache. |
| **Nguồn ảnh** | ⚠️ Cần kiểm chứng | Ảnh nằm ở 3 nơi: `persons.photo_path` (1 ảnh/người), `heritage` media, `resting_place_photos`. Nhiều người **không có ảnh** (nên mới có avatar). Một họ 4k người có thể chỉ vài chục ảnh → phòng phải **tự co theo số ảnh**. Cần gộp cả 3 nguồn. |
| **Signed URL** | ⚠️ Vừa | Ảnh ở **bucket private, URL ký có HẠN** (`getSignedPhotoUrlMap`). Cơ chế "nạp ảnh khi tới gần" phải **ký lại URL** khi texture hết hạn — phức tạp hơn `api/local.js` (đọc thư mục tĩnh) của repo gốc. |
| **Hiệu năng mobile** | ⚠️ Vừa | Nhiều texture độ phân giải cao tốn VRAM. Bắt buộc: nạp/huỷ theo khoảng cách, dynamic resolution, culling, giới hạn số ảnh render đồng thời. Phần này học thẳng từ repo gốc. |
| **Điều khiển** | ⚠️ Vừa | `PointerLockControls` KHÔNG chạy cảm ứng; free-walk FPS dễ gây "say" + khó với người lớn tuổi → mặc định **tour dẫn đường**. |
| **2D fallback** | ✅ Dễ | Đã có sẵn album/thư viện ảnh 2D để rơi về khi thiếu WebGL/máy yếu. |
| **Hiển thị GLTF (hiện vật)** | ✅ Dễ | `GLTFLoader`/`useGLTF` có sẵn; đầu ra image-to-3D là GLB/GLTF → "nhét vật vào phòng" gần như free. |
| **Dựng hiện vật 3D** | ❌ Khó / ngoài client | Image-to-3D cần GPU mạnh → server riêng hoặc API bên thứ ba (Meshy/Luma/Tripo). Tốn chi phí mỗi lần dựng → **để giai đoạn sau**. |
| **Hạ tầng self-host** | ⚠️ Lưu ý | Prod là self-host Supabase, VPS **ít storage/CPU** (đã là ràng buộc cứng ở heritage). Không transcode/dựng 3D trên VPS app; nếu làm hiện vật → API bên thứ ba. |

**Nhận định:** phần "phòng ảnh 2D-trên-tường" hoàn toàn trong tầm tay với hạ tầng
hiện có. Phần "hiện vật 3D" mới là chỗ tốn kém → tách hẳn thành giai đoạn cuối,
tuỳ chọn, khởi đầu bằng API bên thứ ba.

---

## Quyết định kỹ thuật (đề xuất — có thể đổi)

- **React Three Fiber + `@react-three/drei`**, KHÔNG viết three thuần.
  - *Lý do:* phòng là scene khai báo được (tường/khung/đèn/nội thất/điều khiển).
    R3F + drei cho sẵn `PointerLockControls`, `useTexture`, `useGLTF`, `Html` (nhãn
    2D neo trong 3D), `Bounds`/`CameraControls` — giảm rất nhiều boilerplate so với
    three thuần.
  - *Đánh đổi:* thêm ~R3F + vài helper drei. Khống chế bằng **lazy-load** + **import
    chọn lọc** từ drei (không import cả gói).
  - Cây 3D vẫn dùng `3d-force-graph` (three thuần) — hai chỗ **chung three core**,
    không xung đột. "Dùng chung engine" nghĩa là chung three, KHÔNG phải chung một
    canvas/instance với cây.
- **Lazy-load bắt buộc** (`React.lazy` + `Suspense`) như `Tree3DView`; cấu hình
  Workbox loại chunk phòng-trưng-bày khỏi precache để không vượt 2MB.
- **Điều khiển mặc định: TOUR DẪN ĐƯỜNG** — bấm/chạm một khung → camera lướt mượt
  tới trước bức đó (tái dùng ý tưởng click-to-focus của cây 3D). Free-walk là
  **tuỳ chọn nâng cao** (desktop có bàn phím). Bonus: tour dẫn đường = cơ sở cho
  tính năng **xuất clip** ở giai đoạn sau.
- **Kiểm tra WebGL + 2D fallback** tách thành helper dùng chung (cả cây 3D cũng nên
  dùng).
- **Data source gộp 3 nguồn ảnh** qua một module riêng (theo tinh thần `api/local.js`
  nhưng động): trả về danh sách `{ path, title, subtitle, source }` + hàm ký URL
  theo lô cho tập ảnh đang hiển thị.

---

## Kiến trúc & module

```
src/components/gallery/
  MemoryRoom.tsx        // <Canvas> R3F, lazy-load; lắp Room + Frames + Controls
  Room.tsx             // hộp phòng (sàn/tường/trần), material màu cấu hình
  PhotoFrame.tsx       // 1 khung ảnh: mặt phẳng + texture + viền + nhãn Html
  useGalleryPhotos.ts  // data source: gộp person/heritage/grave, ký URL theo lô
  placement.ts         // thuật toán bố trí ảnh dọc tường theo tỉ lệ ảnh
  useTextureLOD.ts     // nạp/huỷ texture theo khoảng cách + dynamic resolution
  webglSupport.ts      // (dùng chung) kiểm tra WebGL → quyết định fallback 2D
```

- **Placement:** viết lại logic `placement.js` của repo gốc bằng toán đơn giản —
  rải khung dọc chu vi tường, chừa khoảng cách đều, cỡ khung theo aspect ratio ảnh,
  căn giữa theo chiều cao mắt. Phòng **tự co**: số ảnh ít → phòng nhỏ.
- **LOD/streaming:** chỉ nạp texture các khung trong bán kính R quanh camera; khung
  xa dùng bản thu nhỏ hoặc placeholder; đang di chuyển → bản phân giải thấp, đứng
  yên → nạp bản nét. Huỷ texture khung ra khỏi vùng để giải phóng VRAM.
- **Nhãn ảnh:** `Html` (drei) hoặc sprite text dưới khung — tên người · năm · dịp.
- **Xem chi tiết:** chạm khung → overlay 2D (ngoài canvas) phóng to ảnh + mô tả,
  dễ đọc, có nút đóng.

---

## Phân kỳ

### Giai đoạn 1 — MVP (phòng ảnh 2D-trên-tường)
- [ ] `<Canvas>` R3F lazy-load + kiểm tra WebGL, thiếu thì rơi về **album 2D**.
- [ ] Một phòng hộp (sàn/tường/trần) material màu, đèn môi trường + đèn hắt tranh.
- [ ] Data source gộp 3 nguồn ảnh + ký URL theo lô; phòng tự co theo số ảnh.
- [ ] Bố trí ảnh dọc tường theo tỉ lệ (placement) + khung + nhãn tên/năm.
- [ ] **Tour dẫn đường** (chạm khung → lướt tới) + chạm để xem chi tiết (overlay 2D).
- [ ] Tối ưu: LOD/streaming texture, dynamic resolution, culling, giới hạn số ảnh.
- [ ] Lazy chunk loại khỏi precache PWA; kiểm tra bundle không vượt ngưỡng.

### Giai đoạn 2 — Tuỳ biến & trang trí
- [ ] Preset "tông phòng" (màu sơn tường/trần/sàn) cho admin/user.
- [ ] Thả nội thất GLTF low-poly (ghế băng, chậu cây, đèn, bục) — nguồn CC0
  (Poly Haven/Kenney), instancing nếu lặp.
- [ ] Free-walk (desktop) như tuỳ chọn ngoài tour dẫn đường.
- [ ] Bố cục nhiều phòng: theo thế hệ / theo nhánh.

### Giai đoạn 3 — Kết nối & chia sẻ
- [ ] Từ node thành viên trên **cây gia phả 3D** → mở phòng ảnh của người/nhánh đó.
- [ ] **Xuất ảnh/clip**: camera tự chạy tour → capture canvas ra ảnh (lý tưởng là
  video ngắn) để chia sẻ; tôn trọng quyền riêng tư từng ảnh.

### Giai đoạn 4 (tuỳ chọn) — Hiện vật 3D (kỷ vật)
- [ ] Chụp kỷ vật → dựng vật thể 3D đặt trên bục (xem spec mục 10).
- [ ] **Bắt đầu bằng API bên thứ ba** (Meshy/Luma/Tripo — không tự nuôi GPU) để thử
  phản ứng người dùng; single-image-to-3D cho phổ thông, nhiều-ảnh cho vật quan
  trọng. Đầu ra GLB/GLTF → dùng lại pipeline GLTF của GĐ2.
- [ ] Cân nhắc mô hình chi phí (giới hạn lượt/kỷ vật quan trọng/hàng đợi). Khảo sát
  lại công nghệ tại thời điểm làm (mảng này đổi từng quý).

---

## Tận dụng lại từ codebase
- `getSignedPhotoUrlMap` + avatar fallback (đã có) cho data source.
- `palette()` sáng/tối trong `Tree3DView` → đồng bộ tông phòng theo theme.
- Mẫu lazy + Suspense + code-split three (đã làm cho cây 3D).
- Bucket `person-photos` + RLS theo `foldername[1]=clan_id` (như heritage/mộ phần).

## Ràng buộc & rủi ro
- **PWA precache 2MB** — lazy chunk + loại khỏi precache (rủi ro #1).
- **Storage/CPU VPS ít** — không dựng 3D/transcode trên VPS; hiện vật dùng API ngoài.
- **Ảnh thưa** — phòng tự co; nếu quá ít ảnh, gợi ý người dùng thêm ảnh trước.
- **VRAM mobile** — LOD/streaming bắt buộc; luôn có 2D fallback.
- **Quyền riêng tư** — phòng mặc định trong dòng họ; ảnh/clip xuất ra chỉ gồm nội
  dung user chủ động chọn; tôn trọng cài đặt từng ảnh/thành viên.

## Tiêu chí hoàn thành (theo giai đoạn)
- **GĐ1:** đi/tour được trong phòng, ngắm ảnh treo tường mượt trên desktop + mobile;
  ảnh lấy từ dữ liệu thật qua data source; có 2D fallback tự kích hoạt.
- **GĐ2:** đổi được màu phòng + thả được vài nội thất GLTF.
- **GĐ3:** vào phòng từ node cây 3D; xuất được ít nhất ảnh (lý tưởng clip) chia sẻ.
- **GĐ4:** dựng + trưng được ít nhất một hiện vật 3D từ kỷ vật (qua API), tôn trọng
  quyền riêng tư.

## Câu hỏi cần chốt trước khi code
1. **R3F** (đề xuất) hay **three thuần**?
2. MVP mặc định **tour dẫn đường** (đề xuất) hay **free-walk**?
3. Lối vào phòng đặt ở đâu MVP: trong module **Di sản** hay nút riêng trên trang họ?
4. GĐ4 hiện vật 3D: ưu tiên **API bên thứ ba nào** khi tới lúc khảo sát?
