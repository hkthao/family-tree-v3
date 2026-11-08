# Kế hoạch: Bộ tranh thuỷ mặc làm hình nền

> Phần **asset** của [plan-hinh-nen-thuy-mac.md](plan-hinh-nen-thuy-mac.md) (bước 1 + câu hỏi 1, 4).
> Trạng thái: **đề xuất, chưa làm.**

## Hướng đề xuất: tự tạo bằng script (procedural), không dùng tranh có sẵn
Lý do: không vướng bản quyền, cả bộ cùng một phong cách, **sinh được bản sáng + tối từ cùng một
bố cục**, dung lượng nhỏ, sửa/tạo thêm tranh chỉ cần đổi tham số. Tranh thuỷ mặc hợp với kỹ thuật này
vì đặc trưng là mảng loang, sương và nét cọ đơn sắc — không cần chi tiết ảnh thật.

Phương án dự phòng: tranh phạm vi công cộng (Wikimedia Commons / bảo tàng mở) hoặc ảnh user cung cấp —
đẹp và "thật" hơn nhưng khó có bản tối và khó đồng bộ phong cách; chỉ dùng nếu bản procedural không đạt.

## Bộ tranh (8 chủ đề, mỗi chủ đề 1 cặp sáng/tối)
| id | Chủ đề | Ý nghĩa với gia phả |
|---|---|---|
| `nui-suong` | Núi non nhiều lớp trong sương | cội nguồn, bền vững |
| `truc` | Khóm trúc nghiêng, trăng mờ | quân tử, thanh cao |
| `sen` | Sen đầm, lá lớn, vài nụ | thanh sạch, Việt |
| `tung-hac` | Cây tùng, bóng hạc | trường thọ |
| `thuyen-song` | Thuyền nhỏ trên sông, núi xa | quê hương |
| `mai` | Cành mai điểm hoa | tết, khởi đầu |
| `rung-thong` | Rừng thông trong mưa phùn | tĩnh lặng |
| `trang-nui` | Trăng tròn trên dãy núi | đoàn viên |

## Kỹ thuật sinh tranh
1. **Giấy dó**: nền kem + nhiễu `feTurbulence` (baseFrequency thấp) + sợi giấy mịn (`feDisplacementMap`).
2. **Mảng mực loang**: đa giác núi/lá sinh từ nhiễu 1D nhiều tầng, tô gradient mực
   (đậm gần → nhạt xa), viền mềm bằng `feGaussianBlur` + `feTurbulence` làm mép lem.
3. **Sương**: dải gradient trắng đục chồng giữa các lớp núi.
4. **Nét cọ** (trúc, tùng, mai): đường cong Bézier có độ dày thay đổi, ngẫu nhiên hoá theo seed.
5. **Dấu son**: một ấn đỏ nhỏ (màu theo `--primary`) ở góc, như tranh thật; nằm ngoài vùng hay bị che.
6. **Bố cục thưa ở giữa**: vùng giữa/trên ít mực để khi lớp phủ + thẻ đè lên vẫn sạch; tranh "dồn" về
   hai bên lề (nơi laptop thực sự lộ ra) và đáy.
7. **Bản tối**: không đảo màu. Sinh lại với bảng màu khác: nền mực đen ấm (`#1A1612`), "mực" thành xám
   ngà nhạt, sương thành khói xám, trăng/ấn giữ sắc ấm — cùng seed ⇒ cùng bố cục.

Deterministic theo `seed` (lưu trong file cấu hình) để tái tạo y hệt; đổi seed ra biến thể mới.

## Pipeline
```
scripts/backgrounds/
  themes.json        # id, seed, tham số từng chủ đề, bảng màu sáng/tối
  gen.mjs            # sinh SVG (Node, không phụ thuộc mới) → build/<id>-{light,dark}.svg
  rasterize.mjs      # Playwright (đã cài) chụp SVG → PNG 1920×1080 và 1080×1920 (dọc cho điện thoại)
  encode.sh          # cwebp -q 78 → public/backgrounds/<id>-{light,dark}-{lg,sm}.webp + thumb 320px
```
- Tranh điện thoại là **bố cục dọc riêng** (không cắt từ ngang) — cùng seed, canvas khác.
- Ngân sách: lg ≤ 180 KB, sm ≤ 90 KB, thumb ≤ 15 KB; script fail nếu vượt.
- Kết quả commit vào `public/backgrounds/` (asset sinh sẵn, không sinh khi build CI); script + `themes.json`
  commit để tái tạo. Sinh tranh bằng AI ảnh (nếu sau này muốn) lưu cùng chỗ, ghi vào `docs/credits.md`.

## Các bước
1. **Prototype 1 chủ đề (`nui-suong`)** sáng + tối, xem bằng mắt → chốt phong cách (nửa ngày). *Điểm dừng
   để user duyệt trước khi làm 7 tranh còn lại.*
2. Hoàn thiện bộ máy sinh (giấy dó, sương, nét cọ, ấn) + `themes.json`.
3. Sinh 7 chủ đề còn lại; chỉnh seed/tham số tới khi đạt.
4. Rasterize + encode; kiểm ngân sách dung lượng.
5. **Kiểm đọc được**: dán thử lên layout thật (script chụp Playwright dùng lớp phủ mặc định) cho cả
   16 tranh × điện thoại/laptop; đo tương phản vùng nền trực tiếp (nhãn nhóm menu, tiêu đề trang).
6. Bàn giao cho plan chính (bước 2–6: store, layout, UI chọn).

Ước lượng: 1–1,5 ngày cho bộ tranh (prototype 0,5 + 7 tranh còn lại + kiểm).

## Rủi ro
- **Procedural trông "máy"** nếu thiếu biến thiên → nhiều tầng nhiễu, mép lem, seed khác nhau; nếu vẫn
  không đạt, dùng phương án dự phòng hoặc AI ảnh.
- **Dung lượng WebP** với nhiễu giấy: nhiễu làm file phình → giảm biên độ nhiễu / làm mịn trước khi nén.
- **Bản tối trông bẩn** → duyệt riêng ở bước 1 trước khi nhân ra 8 tranh.

## Cần user quyết
- Duyệt **hướng procedural** (khuyến nghị) hay dùng nguồn khác?
- Chốt danh sách 8 chủ đề (thêm/bớt, ví dụ thêm cảnh đình làng, cổng tam quan, hoa sen–cá chép?).
- Có muốn tranh mang yếu tố Việt rõ (nón lá, tre làng, cầu ngói) hay thiên phong cách thuỷ mặc Á Đông chung?
