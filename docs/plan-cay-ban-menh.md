# Plan — Cây bản mệnh & Khu vườn dòng họ

> Nguồn ý tưởng: mô phỏng **tục xưa trồng một cây khi có người chào đời**. Cây không
> đòi chăm sóc, không bắt vào app mỗi ngày; nó **tự lớn theo thời gian thật** và tự đổi
> theo mùa, sinh nhật, ngày giỗ. Bản plan này chốt **kỹ thuật dựng hình cho cây chân
> thực nhất**, mô hình dữ liệu, màn hình, thông báo và phân kỳ.
>
> Trạng thái: **TẠM DỪNG (11/11/2026): chức năng chưa phù hợp, bỏ qua spike.** Spike đã làm nằm ở nhánh `spike/cay-ban-menh` (chưa merge, chưa push): ez-tree MIT, có gió, chunk 34KB nếu alias sang mã nguồn; điều khiển 3D khó dùng với người lớn tuổi. Nội dung bên dưới là bản gốc: mới lập kế hoạch, CHƯA code. Có một bước thử nghiệm kỹ thuật (spike)
> ở mục 7 để chọn công nghệ trước khi cam kết.

## 1. Vì sao làm

Dòng họ nhập đủ thông tin xong thì mở app **không còn việc để làm** — đó là lúc người
dùng ngừng quay lại. Cây bản mệnh cho họ một thứ để nhìn và để tặng nhau, mà không
tạo áp lực:

- **Cây tự thay đổi theo thời gian thật** (tuổi người, mùa, giờ trong ngày) → mỗi lần
  mở app thấy hơi khác.
- **Gắn với sự kiện thật đã có trong dữ liệu**: sinh nhật, ngày giỗ, Tết.
- **Một tương tác xã hội nhẹ**: tặng hoa/nước cho cây người thân, thắp hương ngày giỗ.

Đối tượng: người lớn tuổi là ưu tiên số một (xem [plan-ai-tro-ly.md](plan-ai-tro-ly.md),
[plan-di-san-van-hoa.md](plan-di-san-van-hoa.md)) → **không có việc vặt, không có hình
phạt, không có cây héo/gãy**. Người trẻ có thêm yếu tố "wow" để chia sẻ.

### Nguyên tắc cứng
1. **Cây thuộc về NGƯỜI trong cây (`person_id`), không thuộc tài khoản.** Cụ đã mất và
   em bé chưa có tài khoản vẫn có cây. Khu vườn tự có sẵn mọi người trong cây.
2. **Không bắt làm gì.** Bỏ app một năm cây vẫn khoẻ và đúng tuổi.
3. **Không phạt, không điểm sinh trưởng.** Người dùng không bao giờ thấy "cây của bạn
   đang héo".
4. **Người đã mất = cây cổ thụ yên tĩnh + nén hương ngày giỗ**, không "lá vàng rơi".
5. **Tính toán theo dữ liệu có sẵn** (tuổi, ngày, giỗ), không cron, không worker.

## 2. Kỹ thuật dựng hình — chọn gì để cây chân thực nhất

### 2.1 Hiện trạng liên quan trong repo
- Đã có `three@0.185`, `@react-three/fiber`, `@react-three/drei` (dùng cho Phòng trưng bày
  3D — xem [plan-phong-trung-bay-anh-3d.md](plan-phong-trung-bay-anh-3d.md)) → **không phải
  thêm engine mới**.
- **Ràng buộc PWA:** precache giới hạn 2MB; chunk `three` đã ~800KB. Mọi thứ 3D phải
  **lazy-load thành chunk riêng, loại khỏi precache** (cùng cách `Tree3DView` / Phòng
  trưng bày đang làm).
- VPS ít storage/CPU: **không dựng ảnh/video trên server**; asset phải nhỏ và tĩnh.
- Máy người dùng đa dạng, nhiều **Android cũ 2–3GB RAM** → bắt buộc có chế độ thấp.

### 2.2 So sánh các hướng

| Hướng | Độ chân thực | Động (gió/mùa/lớn) | Mỗi người một cây riêng | Nặng (bundle / GPU) | Công làm | Nhận xét |
|---|---|---|---|---|---|---|
| **A. Rive / Lottie (2D vector)** | ⭐⭐ (hoạt hoạ) | Tốt, qua state machine | ❌ phải vẽ tay từng biến thể | Rất nhẹ | Cần hoạ sĩ vẽ | Dễ mượt, nhưng **không "real"**, và mỗi loài × mỗi giai đoạn là một file vẽ tay |
| **B. Ảnh/video dựng sẵn (Blender)** | ⭐⭐⭐⭐⭐ (ảnh thật) | ❌ chỉ vòng lặp cố định | ❌ | Nhẹ lúc chạy, **tốn dung lượng** | Dựng offline nhiều biến thể | Đẹp nhất nhưng tĩnh; nhiều giai đoạn × mùa × loài = hàng trăm file |
| **C. Three.js procedural + shader** | ⭐⭐⭐⭐ | Rất tốt: gió, mùa, lớn liên tục, ánh sáng theo giờ | ✅ `seed = hash(person_id)` → mỗi người một cây khác nhau | Vừa (lazy chunk); GPU mobile là rủi ro | Trung bình–cao | **Chân thực + sống động + tái dùng engine sẵn có** |
| **D. Lai (khuyến nghị)** | ⭐⭐⭐⭐ | ✅ | ✅ | Điều chỉnh được theo máy | Cao nhất | C là chính; **ảnh dựng sẵn / 2D làm chế độ máy yếu và làm "impostor" cho cây ở xa** |

**Quyết định đề xuất: hướng D — Three.js procedural (C) làm lõi, kèm ba mức chất lượng
và ảnh dựng sẵn cho máy yếu / cây ở xa.** Lý do: chỉ hướng này vừa chân thực, vừa cho
mỗi người một cây riêng và cây thực sự "sống", mà không cần hoạ sĩ vẽ hàng trăm biến thể.

### 2.3 Bộ kỹ thuật tạo độ chân thực (xếp theo hiệu quả / chi phí)

1. **Hình dạng cây procedural, seed theo người.** Dùng thư viện sinh cây (ứng viên:
   `@dgreenheck/ez-tree` — sinh hình học cây cho Three.js, có nhiều tham số, xuất được
   geometry thô; hoặc tự viết L-system/space-colonization). `seed = hash(person_id)` →
   cây của mỗi người luôn giống nhau mọi lần mở, và khác người khác. *Ghi chú:* tài liệu
   của ez-tree **không nêu** gió, mùa, LOD hay giấy phép trong README tôi đọc → các phần
   đó **tự dựng bằng shader** (mục 4–5), và **phải kiểm tra giấy phép + hiệu năng ở spike**.
2. **Chất liệu PBR thật**: vỏ cây có *albedo + normal + roughness* (texture CC0 từ
   ambientCG / Poly Haven), nén **KTX2/Basis** để nhẹ và tiết kiệm VRAM.
3. **Lá bằng InstancedMesh / billboard có alpha-test**, dùng texture lá thật (CC0), màu
   thay đổi nhẹ từng lá (tint ngẫu nhiên theo instance) → hết cảm giác "nhựa". Gộp lá
   thành **một draw call**.
4. **Gió bằng vertex shader**: dịch chuyển đỉnh theo sóng sin + noise, **trọng số theo
   độ cao và theo cấp cành** (gốc đứng yên, ngọn đung đưa nhiều; lá rung nhanh hơn cành).
   Đây là thứ tạo cảm giác "cây thật" nhiều nhất, và rất rẻ trên GPU.
5. **Mùa bằng uniform, không đổi geometry**: màu lá (xanh → vàng/đỏ), **tỉ lệ lá hiển thị**
   (rụng dần bằng ngưỡng noise trong shader), hoa/quả xuất hiện theo mùa. Một cây, nhiều
   mùa, không nạp thêm asset.
6. **Ánh sáng theo giờ thật của người dùng**: góc mặt trời theo giờ → sáng sớm, trưa,
   hoàng hôn, đêm (ánh trăng xanh nhạt). Rẻ mà tạo cảm giác "đúng lúc" rất mạnh. Một
   directional light + hemisphere light + **một shadow map mềm**.
7. **Hậu kỳ nhẹ**: tone mapping (ACES), sương mù xa, nếu máy khoẻ thêm bloom rất nhẹ ở
   hoa/ánh nắng. Mặc định tắt trên máy yếu.
8. **Hạt**: vài chục lá/cánh hoa rơi bằng `Points`; mưa hoa ngày sinh nhật. Giới hạn số hạt.
9. **Lớn lên**: mỗi **giai đoạn** (hạt → mầm → cây non → trưởng thành → cổ thụ) sinh lại
   geometry một lần khi giai đoạn đổi (không phải mỗi khung hình); trong cùng giai đoạn
   thì chỉ scale mượt theo tuổi.
10. **Bối cảnh "trước ngõ"**: mặt đất cỏ, một đoạn tường/cổng cách điệu, bóng cây đổ
    xuống. Gợi đúng tục xưa và che bớt giới hạn của cây (cây "đang ở đâu đó" thay vì
    lơ lửng).

### 2.4 Ba mức chất lượng (tự phát hiện, người dùng đổi được)

| Mức | Dùng khi | Gồm |
|---|---|---|
| **Cao** | Máy khoẻ | Cây đầy đủ, bóng đổ, gió, mùa, hạt, hậu kỳ nhẹ |
| **Vừa** | Mặc định cho máy trung bình | Giảm số lá, **tắt bóng đổ & hậu kỳ**, DPR tối đa 1,5, 30fps |
| **Thấp** | Không WebGL, máy yếu, bật "tiết kiệm pin" | **Ảnh cây dựng sẵn (WebP) theo loài × giai đoạn × mùa**, hoặc 2D tĩnh; không gió |

Cách phát hiện: có WebGL không; `navigator.hardwareConcurrency` và `deviceMemory`; đo
FPS trong ~1 giây đầu rồi tự hạ mức nếu dưới ngưỡng. **Luôn có đường lui về 2D** (đã làm
đúng vậy cho Phòng trưng bày).

### 2.5 Tối ưu bắt buộc
- Lazy-load chunk riêng, **loại khỏi precache PWA**; nạp trước khi vào trang.
- Gộp geometry; lá `InstancedMesh`; **texture atlas**; KTX2.
- Giới hạn DPR (≤ 1,5), giới hạn khung hình (30fps khi gió, **tạm dừng** khi tab ẩn hoặc
  cây ngoài màn hình).
- **Khu vườn nhiều cây: impostor.** Cây ở xa không dựng 3D mà dùng **ảnh dựng sẵn**
  (render mỗi loài × giai đoạn ra atlas một lần, cache) dán lên billboard, instancing
  hàng trăm cây trong một draw call; chỉ cây gần camera hoặc cây được chọn mới dựng
  đầy đủ. Đây là kỹ thuật cho phép vườn hàng trăm cây trên điện thoại.
- Không dựng hình trên server; mọi thứ chạy ở trình duyệt.

### 2.6 Vì sao không chọn từng hướng khác
- **Rive/Lottie:** đẹp và nhẹ nhưng hoạt hoạ, không "real"; mỗi người một cây riêng
  là bất khả thi nếu vẽ tay. Có thể dùng cho **icon/huy hiệu nhỏ**, không cho cây chính.
- **Chỉ ảnh/video dựng sẵn:** chân thực nhất ở từng khung nhưng **chết** (không gió,
  không đổi theo giờ), và số file bùng nổ (loài × giai đoạn × mùa × giờ).
- **Unity/Unreal WebGL:** quá nặng cho một app gia phả.

## 3. Mô hình dữ liệu

**Phần thụ động không cần bảng mới.** Giai đoạn, mùa, hoa nở, nén hương đều **suy ra từ
dữ liệu có sẵn** (`persons.birth_date`, `death_date`, `death_anniv_lunar_*`, ngày hôm
nay). Nhờ đó không có cron, không có đồng bộ, không có trạng thái cây bị lệch.

Quy tắc giai đoạn (theo tuổi, tính tại thời điểm mở):

| Tuổi | Giai đoạn |
|---|---|
| < 1 | Mầm |
| 1–5 | Cây non |
| 6–17 | Cây vừa |
| 18–59 | Trưởng thành (có hoa/quả theo mùa) |
| ≥ 60 hoặc đã mất | Cổ thụ |
| Thiếu ngày sinh | Ước lượng theo năm; thiếu hết thì theo **đời** (`generation`) |

Chỉ thêm hai bảng nhỏ:

```
person_trees            -- tuỳ chọn, ghi đè mặc định
  person_id  uuid pk -> persons
  clan_id    uuid   (denormalized, cho RLS)
  species    text   -- loài cây người nhà chọn; null = theo seed
  planted_on date   -- ngày trồng hiển thị; null = ngày sinh
  created_at timestamptz

tree_gifts              -- tương tác nhẹ
  id            uuid pk
  clan_id       uuid
  person_id     uuid -> persons   -- cây được tặng
  from_user_id  uuid -> auth.users
  kind          text check in ('water','flower','incense')
  note          text (<= 120 ký tự, tuỳ chọn)
  gift_day      date default current_date
  created_at    timestamptz
  unique (from_user_id, person_id, gift_day)   -- 1 lần/ngày/cây/người
```

RLS: thành viên đọc cả hai; editor/admin ghi `person_trees`; thành viên ghi
`tree_gifts` của chính mình (`from_user_id = auth.uid()` và là thành viên). Hai migration
nhỏ, **áp tay lên self-host** (nhớ ghi `schema_migrations`).

### Loài cây
Bắt đầu **3–4 loài dựng bằng tham số**, ưu tiên cây quen thuộc (đa, đào/mai, bưởi/nhãn).
*Lưu ý trung thực:* thư viện sinh cây có sẵn thường chỉ có vài kiểu cây ôn đới
(sồi, thông…); **cây Việt Nam (mai, đào, bưởi, nhãn, tre) cần tự chỉnh tham số và dùng
texture lá riêng** nên độ giống thật ở loài Việt sẽ thấp hơn so với cây "chuẩn". Đây là
việc cần thử ở spike, và có thể phải chấp nhận ít loài hơn lúc đầu.

## 4. Sự kiện gắn với dữ liệu thật

| Sự kiện | Điều kiện | Hiển thị |
|---|---|---|
| **Sinh nhật** | Hôm nay ± 3 ngày so với ngày sinh (người còn sống) | Cây nở hoa rực rỡ, mưa cánh hoa nhẹ |
| **Ngày giỗ** | Ngày giỗ (đã đổi âm → dương) ± 1 ngày | Cây có **nén hương**; người nhà bấm "Thắp hương" (ghi `tree_gifts kind=incense`) |
| **Tết Nguyên đán** | Khoảng Tết | Hoa mai/đào nở trên cây phù hợp |
| **Mùa** | Theo lịch | Màu lá, độ rụng, hoa/quả theo loài |
| **Giờ trong ngày** | Giờ máy người dùng | Ánh sáng sáng/trưa/chiều/đêm |

Tái dùng hàm quy đổi âm lịch và `upcoming_anniversaries` đã có.

## 5. Màn hình

1. **Thẻ "Cây của tôi"** trên Tổng quan (khung nhỏ, một cây, hiệu ứng nhẹ) — chỉ hiện khi
   đã "nhận vị trí" (`self_person_id`, đã có). Bấm vào mở vườn.
2. **Khu vườn dòng họ** `/clans/:id/vuon`: các cây xếp theo **đời** (đời trên ở xa/cao,
   đời dưới ở gần), camera xoay nhẹ, kéo để xoay trong giới hạn. Bấm một cây → ngăn kéo:
   tên, tuổi, giai đoạn, sự kiện hôm nay, nút **Tặng hoa / Tặng nước** (người sống) hoặc
   **Thắp hương** (ngày giỗ). Bộ lọc theo **chi / đời** để không dựng hàng nghìn cây.
3. **Trang cá nhân**: một cây nhỏ cạnh ảnh đại diện.
4. **Chế độ thấp**: cùng bố cục nhưng ảnh tĩnh/2D, không xoay.

UX người lớn tuổi: nút lớn, **không bắt phải kéo/xoay**, mọi thứ bấm được; hiệu ứng có
nút tắt ("Tiết kiệm pin"); chữ theo cỡ chữ app.

## 6. Thông báo

- **Tặng hoa/nước:** thông báo đẩy cho người nhận (người liên kết với cây qua
  `self_person_id`), **gộp tối đa một lần mỗi ngày**: "Hôm nay có 3 người tặng hoa cho
  cây của bạn." (Không phải mỗi lượt một thông báo — tránh người dùng tắt hết thông báo.)
- **Ngày giỗ / sinh nhật:** đã có thông báo hiện hữu; chỉ thêm đường dẫn mở thẳng cây.
- Cây của người **chưa có tài khoản** (em bé, cụ đã mất): quà vẫn ghi lại và hiện khi
  người nhà mở cây; không có ai để đẩy thông báo thì thôi.

Dùng đường ống thông báo hiện có (`notify-events`, `push-action`); không dựng hệ thống mới.

## 7. Phân kỳ

| Pha | Việc | Kết quả | Ước lượng thô |
|---|---|---|---|
| **0. Spike kỹ thuật** | Thử sinh cây (ez-tree vs tự viết), shader gió + mùa, ánh sáng theo giờ; **đo FPS/RAM trên 1–2 Android cũ** và iPhone cũ; kiểm giấy phép thư viện & texture CC0 | Chốt thư viện, loài khả thi, ngưỡng chất lượng | 3–4 ngày |
| **1. Cây của tôi** | Một cây gắn `person_id`: lớn theo tuổi, mùa, gió, ánh sáng theo giờ; 3 mức chất lượng + đường lui 2D; thẻ trên Tổng quan | Người dùng thấy cây thật của mình | 5–7 ngày |
| **2. Sự kiện + Vườn** | Sinh nhật nở hoa, giỗ có nén hương, Tết; trang Vườn xếp theo đời, lọc chi/đời; ngăn kéo chi tiết | Có lý do mở app theo ngày | 5–7 ngày |
| **3. Tặng quà** | `tree_gifts`, nút Tặng hoa/Thắp hương, thông báo gộp | Tương tác nhẹ giữa người thân | 3–4 ngày |
| **4. Mở rộng** | Impostor + LOD cho vườn lớn, thêm loài, loài chọn được (`person_trees`), mùa Tết | Vườn hàng trăm cây trơn tru | 5+ ngày |

Mỗi pha tự dùng được, có thể dừng ở bất kỳ pha nào. **Không làm pha 1 trước khi spike
(pha 0) cho kết quả đạt**; nếu cây 3D không đủ nhẹ trên máy yếu thì lùi về hướng B/A cho
chế độ thấp và giữ 3D cho máy khoẻ.

### Tiêu chí đạt (đo được)
- ≥ **30 fps** ở mức Vừa trên một Android 3GB RAM cũ; không crash do hết VRAM.
- Chunk 3D mới **< ~400KB gzip** ngoài phần `three` đã dùng chung; không vượt giới hạn precache.
- Mở trang Vườn của dòng họ ~300 người dưới **3 giây** trên Wi-Fi bình thường.
- Cây của cùng một người **giống nhau mọi lần mở** (seed ổn định).

## 8. Rủi ro và câu hỏi mở

| Rủi ro | Cách khống chế |
|---|---|
| Cây 3D quá nặng trên máy yếu | Ba mức chất lượng + tự hạ mức + đường lui 2D + impostor; **spike chứng minh trước** |
| Cây Việt Nam kém giống thật | Chấp nhận ít loài lúc đầu; đầu tư texture lá/vỏ đúng loài; kiểm ở spike |
| Giấy phép thư viện/texture | Chỉ dùng MIT/CC0; ghi nguồn vào `docs/credits.md` |
| Cây người đã mất gây nhạy cảm | Cổ thụ yên tĩnh + nén hương; **không** có héo/rụng; cho người nhà tắt hiệu ứng riêng cho cây của người thân |
| Tặng quà thành spam | Mỗi người/cây/ngày một lần; thông báo gộp một lần/ngày; có nút tắt thông báo cây |
| Ít người dùng thật sự quan tâm | Pha 1 nhỏ để đo trước khi làm tiếp; đo % mở cây, số quà/ngày |

**Câu hỏi cần bạn chốt**
1. Chấp nhận **ít loài** lúc đầu (3–4) để cây đạt độ thật cao, hay muốn nhiều loài ngay?
2. Có muốn người nhà **chọn loài cây** cho một người (bản mệnh) ở pha đầu, hay để tự động
   theo seed?
3. Khu vườn dạng **3D xoay được** hay **nhìn cố định kiểu tranh** (nhẹ hơn, hợp người lớn
   tuổi hơn)?
4. Spike có thể dùng **máy Android thật** của bạn/người thân để đo không?

## 9. Không làm (cố ý)
- Thời tiết thật qua API (không cần khi cây không phải chăm); mùa theo lịch là đủ.
- Điểm sinh trưởng, hình phạt, cây héo/gãy, nhiệm vụ hằng ngày.
- Thu hoạch quả, huy hiệu, xếp hạng.
- Worker/cron/Redis để "tính sự phát triển": mọi thứ suy ra từ dữ liệu khi mở.
