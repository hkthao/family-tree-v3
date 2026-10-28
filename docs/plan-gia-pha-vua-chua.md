# Plan — Gia phả các triều vua chúa Việt Nam (dữ liệu lịch sử)

## Mục tiêu
Tạo các **dòng họ lịch sử công khai** (Nhà Trần, Nhà Nguyễn, Chúa Trịnh…) trên app để:
1. Làm phong phú dữ liệu live — người mới vào có cái để xem ngay, không phải cây trống.
2. Làm nội dung **SEO + chia sẻ** (người ta search "gia phả nhà Trần", "các vua nhà Nguyễn")
   → kéo về trang share → CTA đăng ký (nút thắt growth hiện tại là share→signup).
3. Làm **dòng họ demo** thay 3 dòng họ giả (`seed-demo-clans.ts`) — thật, có giá trị hơn.

**Ràng buộc cứng: CHÍNH XÁC + XÁC THỰC ĐƯỢC.** Mỗi dữ kiện (người, quan hệ, ngày tháng,
danh hiệu) phải truy được về nguồn cụ thể (sách, quyển, kỷ/trang). Không có trích dẫn =
không nhập. Chỗ sử sách mâu thuẫn thì **ghi cả các dị bản**, không tự chọn một.

## Nguyên tắc dữ liệu (bắt buộc)
- **Không bịa, không suy đoán.** AI chỉ được *trích xuất* từ văn bản nguồn, không được
  "điền chỗ trống" bằng kiến thức chung. Mọi fact do AI đề xuất đều kèm đoạn trích nguyên văn.
- **Wikipedia/Wikidata KHÔNG phải nguồn xác thực** — chỉ dùng làm chỉ dẫn và để đối chiếu
  tự động (phát hiện chỗ lệch). Fact chỉ có nguồn Wikipedia → không publish.
- **Truyền thuyết tách riêng.** Hồng Bàng/Hùng Vương, An Dương Vương, các tích "mộng thấy
  rồng"… không đưa vào cây như sự thật; nếu làm thì là dòng họ riêng gắn nhãn `legendary`.
- **Chỉ nhập người đã mất.** Hậu duệ còn sống (đặc biệt Nguyễn Phúc tộc) không nhập —
  dừng ở các đời mà sử/thế phả đã công bố và người đã qua đời.
- **Trung lập chính trị.** Chính sử mỗi triều gọi triều đối địch là "nguỵ" (Toàn thư gọi
  Mạc, Thực lục gọi Tây Sơn…). App dùng tên trung tính (Nhà Mạc, Nhà Tây Sơn), ghi rõ
  quan điểm của nguồn khi cần.
- **Lịch ghi theo nguồn.** Ngày tháng lưu **âm lịch như sử chép** (năm can chi + niên hiệu
  → năm). Ngày dương lịch là giá trị *suy ra*, gắn cờ "quy đổi", vì lịch Việt trước thế kỷ
  19 có lúc lệch với lịch Trung Quốc/thuật toán hiện đại.

## Phân tầng nguồn

| Tầng | Loại | Ví dụ | Vai trò |
|------|------|-------|---------|
| **A — Chính sử / thế phả hoàng tộc** | Sử quan triều đình biên soạn | *Đại Việt sử ký toàn thư* (bản Nội các quan bản 1697), *Khâm định Việt sử thông giám cương mục*, *Đại Nam thực lục* (Tiền biên, Chính biên), *Đại Nam liệt truyện*, *Việt sử lược*, *Nguyễn Phúc tộc thế phả* (NXB Thuận Hoá, 1995) | Nguồn chính, đủ để xác thực |
| **B — Nghiên cứu / di vật** | Học giả, văn bia, sắc phong | *Đại Việt thông sử* (Lê Quý Đôn), *Việt Nam sử lược* (Trần Trọng Kim), công trình Viện Sử học, Nguyễn Khắc Thuần *Thế thứ các triều vua Việt Nam*, văn bia lăng/đền | Bổ sung, đối chiếu, giải quyết dị bản |
| **C — Tham khảo** | Bách khoa mở | Wikipedia, Wikidata | Chỉ dẫn + diff tự động. **Không đủ để publish** |
| **Loại trừ** | Tiểu thuyết / dã sử | *Hoàng Lê nhất thống chí*, truyện dân gian, báo mạng không nguồn | Không dùng làm nguồn fact |

Bản dịch tiếng Việt của Toàn thư, Cương mục có trên vi.wikisource → AI đọc được và trích
dẫn được theo quyển/kỷ. Cần kiểm tra giấy phép từng bản dịch trước khi **trích dài**;
trích dẫn ngắn + vị trí (quyển, tờ) thì không vướng.

## Mức tin cậy của từng dữ kiện
| Mức | Điều kiện | Hiển thị |
|-----|-----------|----------|
| `confirmed` | ≥2 nguồn tầng A/B độc lập khớp nhau | bình thường |
| `single_source` | 1 nguồn tầng A, không nguồn nào phản bác | bình thường + chú "theo Toàn thư" |
| `disputed` | Các nguồn mâu thuẫn | biểu tượng ⚠ + liệt kê dị bản |
| `legendary` | Chỉ có trong truyền thuyết/dã sử | không vào cây chính |

Áp dụng cho **từng fact**, không phải từng người (vd: tên của bà mẹ `confirmed` nhưng năm
sinh `disputed`).

## Khả thi theo từng triều

| Triều | Độ đầy đủ tư liệu | Ước lượng số người (trục chính) | Ghi chú |
|-------|-------------------|--------------------------------|---------|
| Ngô, Đinh, Tiền Lê | Thấp — chép ngắn, nhiều chỗ thiếu | 20–40 mỗi triều | Hợp làm 1 "cụm" nhỏ |
| Lý | Trung bình | ~100 | Gốc tích Lý Công Uẩn có yếu tố truyền thuyết → `legendary`/`disputed` |
| **Trần** | **Tốt** — Toàn thư chép kỹ | **150–250** | Nội hôn chằng chịt (Trần Thủ Độ, Lý Chiêu Hoàng…) → minh hoạ đẹp tính năng thông gia |
| Hồ | Thấp, ngắn | ~20 | |
| Hậu Lê (Lê sơ + Lê trung hưng) | Tốt | 200–300 | Thế thứ trung hưng phức tạp (con nuôi, lập từ chi xa) |
| Mạc | Trung bình | ~60 | Toàn thư chép với quan điểm thù địch |
| Chúa Trịnh | Trung bình–tốt | ~100 | |
| Tây Sơn | Thấp–trung bình | ~40 | Nhiều tư liệu bị huỷ sau 1802 |
| Chúa Nguyễn + **Nhà Nguyễn** | **Rất tốt** — Thực lục, Liệt truyện, Thế phả hoàng tộc | 500–1.500+ | Minh Mạng riêng đã có 142 con (78 hoàng tử, 64 công chúa) → phải giới hạn phạm vi |

## Khoảng trống của schema hiện tại

Schema `persons`/`families` đã gánh được phần lớn (âm lịch có cấu trúc, `courtesy_name`,
`posthumous_name`, `nickname`, một người nhiều `families` = nhiều vợ). Còn thiếu:

1. **Không có chỗ lưu nguồn/trích dẫn theo từng fact** → cốt lõi của yêu cầu "xác thực".
2. **Không có quan hệ con nuôi / thừa tự.** `birth_family_id` chỉ là cha mẹ đẻ. Sử cần
   cả hai: vd Dục Đức, Đồng Khánh, Kiến Phúc là con nuôi của Tự Đức nhưng con đẻ của các
   hoàng tử khác. Thiếu cái này thì cây thế thứ nhà Nguyễn sai.
3. **Không có trường vua/triều đại:** miếu hiệu (Thái Tông), niên hiệu (nhiều, có mốc
   đổi), thời gian trị vì, thứ tự đời vua, tước hiệu (hoàng hậu/phi/tần, vương, công chúa).
4. **Ngày tháng không chính xác:** `birth_date` là kiểu `date` — không lưu được "chỉ biết
   năm", "khoảng năm", hay "trước năm X".
5. **`max_persons` mặc định 500** — nhà Nguyễn sẽ vượt.
6. **Không có cờ "dòng họ lịch sử"**: cần chỉ đọc với mọi người, chủ sở hữu là platform
   admin, hiển thị nhãn riêng, không tính vào thống kê dòng họ thật.

## Mô hình dữ liệu đề xuất

### Migration `2026MMDDHHMMSS_historical_clans.sql`
```
-- 1. Cờ dòng họ lịch sử
alter table clans add column kind text not null default 'family'
  check (kind in ('family','historical'));
-- historical: visibility='public', max_persons nâng (vd 3000), chỉ platform admin sửa (RLS)

-- 2. Danh mục nguồn
create table historical_sources (
  id uuid pk, code text unique,           -- 'TT' (Toàn thư), 'CM' (Cương mục), 'DNTL', 'DNLT', 'NPTTP'...
  title text not null, author text, edition text, translator text,
  published_year int, tier text check (tier in ('A','B','C')), url text
);

-- 3. Trích dẫn theo từng fact
create table person_citations (
  id uuid pk, clan_id uuid, person_id uuid references persons on delete cascade,
  field text not null,                    -- 'existence','full_name','birth','death','father','mother',
                                          -- 'spouse:<family_id>','reign','title','posthumous_name'...
  value text,                             -- giá trị nguồn này ghi (để lưu dị bản)
  source_id uuid references historical_sources,
  locator text,                           -- 'Bản kỷ, Q.5, tờ 12a' / 'Chính biên, Đệ nhị kỷ, Q.3'
  quote text,                             -- đoạn trích ngắn nguyên văn bản dịch
  confidence text check (confidence in ('confirmed','single_source','disputed','legendary')),
  reviewed_by uuid, reviewed_at timestamptz
);

-- 4. Thông tin trị vì / tước hiệu
create table person_reigns (
  person_id uuid, clan_id uuid, dynasty text, ordinal int,   -- vua thứ mấy của triều
  temple_name text,                       -- miếu hiệu
  era_names jsonb,                        -- [{name:'Thiệu Long', from_year:1258, to_year:1272}]
  reign_start_year int, reign_end_year int,
  role text check (role in ('emperor','lord','regent','retired_emperor'))  -- vua, chúa, nhiếp chính, Thái thượng hoàng
);
-- tước hiệu hậu phi/hoàng tử: dùng bảng person_titles (person_id, title, from_year, to_year)

-- 5. Con nuôi / thừa tự
alter table persons add column adoptive_family_id uuid references families;

-- 6. Độ chính xác ngày tháng
alter table persons
  add column birth_year_precision text check (birth_year_precision in ('exact','year','circa','before','after')),
  add column death_year_precision text check (...);
-- Năm âm lịch đã có sẵn (birth_lunar_year…); 'circa' = khoảng.

-- 7. Khoá ngoài ổn định để import lại không trùng
alter table persons add column external_key text;  -- vd 'tran.thai-tong', 'nguyen.minh-mang'
create unique index on persons (clan_id, external_key) where external_key is not null;
```
`adoptive_family_id` cũng có ích cho dòng họ thường (con nuôi rất phổ biến) → làm chung.

## Quy trình thu thập & xác thực (pipeline)

Pattern giống skill **so-tay-viet-bai** (AI soạn → `needs_review` → người duyệt), nhưng
chặt hơn vì là sử liệu.

```
1. Khung thế thứ  ─►  2. Trích xuất  ─►  3. Đối chiếu  ─►  4. Người duyệt  ─►  5. Import  ─►  6. Phản hồi
  (danh sách vua,      (AI đọc từng       (nguồn thứ 2 +     (chuyên môn sử)      (script             (nút "Báo
   cha-con trục chính)  quyển → JSON       diff Wikidata)                          idempotent)          sai sót")
                        + trích dẫn)
```

1. **Khung thế thứ** — người lập tay (không AI) danh sách vua/chúa theo thứ tự + quan hệ
   cha-con/kế vị của trục chính, mỗi dòng có trích dẫn Toàn thư/Thực lục. Đây là "xương
   sống" để mọi bước sau đối chiếu vào.
2. **Trích xuất có trích dẫn** — subagent đọc bản dịch theo từng quyển/kỷ, xuất JSON
   `drafts/<trieu>/<quyen>.json`: mỗi người + mỗi fact kèm `{source, locator, quote}`.
   Prompt cấm suy luận; fact nào không có quote nguyên văn thì bị validator loại.
   Model rẻ (haiku/sonnet) cho trích xuất — giống quy ước của skill Sổ tay.
3. **Đối chiếu tự động**
   - Gộp người trùng (cùng một người xuất hiện ở nhiều quyển, nhiều tên gọi: tên huý,
     miếu hiệu, thuỵ hiệu, tước).
   - So với nguồn tầng A/B thứ hai (Cương mục, Liệt truyện, Thế phả) → set `confidence`.
   - Diff với Wikidata (cha P22, mẹ P25, vợ/chồng P26, năm sinh/mất) → mọi chỗ lệch thành
     danh sách "cần người xem" (Wikidata sai không có nghĩa là mình sai, nhưng phải xem).
   - Kiểm tra logic: cha mẹ sinh trước con ≥12 năm, không ai mất trước khi con sinh quá
     ~1 năm (với cha), không vòng lặp tổ tiên, thời gian trị vì không chồng lấn trong một
     triều (trừ Thái thượng hoàng — đặc trưng nhà Trần).
4. **Người duyệt** — trang admin "Duyệt sử liệu": từng fact hiện quote + nguồn, nút
   Chấp nhận / Sửa / Đánh dấu dị bản. Lý tưởng là mời người có chuyên môn (giáo viên sử,
   hội viên Hội Sử học, Hội đồng Nguyễn Phúc tộc với nhà Nguyễn) duyệt và **ghi tên người
   duyệt công khai** — tăng độ tin cậy, và là kênh lan truyền.
5. **Import** — `scripts/seed-historical-clan.ts <trieu>`: chỉ nhận fact đã duyệt, upsert
   theo `external_key` (chạy lại được, không trùng), gọi `bulk_import_persons` để nhanh.
   Áp migration thủ công trên self-host như mọi lần.
6. **Phản hồi sau publish** — nút "Báo sai sót + nguồn" trên từng người → vào hàng chờ
   admin. Mỗi sửa đổi ghi lại lịch sử (ai sửa, vì nguồn nào).

## Form người phải đầy đủ + chính xác
Dữ liệu lịch sử phải hiện đúng trong **form Sửa người** như mọi dòng họ khác — không chỉ
nằm ở bảng trích dẫn.
- **Điền mọi trường nguồn có:** Họ tên, Giới tính, Ngày sinh, Ngày mất (âm), Tuổi thọ,
  Tên húy, Tên tự, Tên thụy, Nơi sinh, Nơi an táng, Con thứ mấy, Tiểu sử. `--check` in
  bảng độ đầy đủ từng trường để thấy chỗ còn trống (trống chỉ khi nguồn không ghi).
- **Giá trị form phải khớp nguồn:** citation của các trường trên bắt buộc có `value`;
  giá trị điền vào form phải trùng giá trị của ít nhất một nguồn (dị bản thì chọn một,
  các bản còn lại lưu ở trích dẫn).
- **Ngày từ năm 1800 trở đi dựng bằng đúng hàm của form** (`buildPersonDateColumns`): mở
  form ra thấy đúng, bấm Lưu không làm mất gì (đã kiểm round-trip).
  - Đủ ngày/tháng/năm âm → lưu âm + ngày dương quy đổi.
  - Chỉ năm âm → năm dương (độ chính xác "năm") để cây và tuổi thọ hiện được.
  - Năm + tháng âm → chỉ lưu được năm (tháng Chạp có thể sang năm dương sau — tự tính);
    tháng nêu trong tiểu sử. Validator cảnh báo.
  - Chỉ tháng/ngày âm → lưu âm; **ngày giỗ tự suy ra** từ ngày mất như form.
  - Ngày âm không có thật (tháng nhuận sai…) → lỗi (quy đổi ngược để bắt).
- **Ngày trước năm 1800: KHÔNG quy đổi ra ngày dương.** Lưu đúng ngày âm như sử chép +
  năm (độ chính xác "năm") để cây hiện năm; ngày giỗ lấy thẳng từ tháng/ngày âm.
  - Lý do: lịch Việt thời đó (Thụ Thời, Hiệp Kỷ…) khác thuật toán hiện đại; ngày dương
    "quy đổi" sẽ là giá trị suy diễn.
  - (Đã sửa 28/10/2026) Thư viện `@dqcai/vn-lunar` 1.0.1 chép thiếu chữ số hex cuối ở 54
    giá trị bảng năm 1200–1799 → các năm tận cùng 8, 9 quy đổi sai. Đã vá tại chỗ trong
    `src/lib/lunarDate.ts` (+ bản vendor cho edge function); dữ liệu cũ của người dùng
    sửa bằng `scripts/fix-pre1800-lunar-dates.ts`.
  - Năm hiển thị = năm âm; tháng 11–12 âm có thể đã sang năm dương sau (validator cảnh báo).
  - Hạn chế: form Sửa người hiện chỉ hiện năm cho các ngày này; bấm Lưu trên form sẽ xoá
    tháng/ngày âm → **không sửa dòng họ lịch sử bằng form**, sửa file nháp rồi nhập lại.
- **Họ tên:** vua/chúa ghi tên thường gọi trong sử (họ + miếu hiệu, vd "Trần Thái Tông");
  **Tên húy** ghi họ + tên húy. Tìm kiếm quét cả hai.
- **Tuổi thọ:** ghi đúng như sử chép ("thọ 60 tuổi" — tuổi ta).

## Tiểu sử — ngắn gọn, văn phong sử
- 2–5 câu, **≤ 500 ký tự** (validator cảnh báo), tối đa 800 (lỗi).
- Lối chép sử: ngôi thứ ba, câu trần thuật, mốc năm can chi + năm dương, không cảm thán,
  không tính từ phóng đại ("vô cùng", "huyền thoại"…), không bình luận. Vd: *"Vua tên húy
  là Cảnh, con thứ của … Năm Ất Dậu (1225) được … nhường ngôi. Ở ngôi 33 năm, truyền ngôi
  cho con, lên làm Thái thượng hoàng."*
- Chỉ viết điều có trong nguồn (citation `bio`); chi tiết form không chứa được (tháng âm
  lẻ, miếu hiệu/niên hiệu cho tới khi có UI P2) đưa vào đây.
- Cuối tiểu sử **tự thêm một dòng nguồn** khi nhập: "Theo: Đại Việt sử ký toàn thư (Bản kỷ
  Q.5); …" — người xem thấy nguồn ngay cả trước khi có tab Nguồn.

## Thuỷ tổ + số đời
App tính đời từ thuỷ tổ (`is_root` = đời 1; con đẻ = đời cha/mẹ + 1; vợ/chồng cùng đời).
Validator mô phỏng đúng thuật toán `recompute_generation_for_clan`; script import đối
chiếu lại với DB sau khi nhập.
- **Đúng một thuỷ tổ** = tổ xa nhất mà chính sử chép rõ tên của dòng (xác định ở bước lập
  khung, có trích dẫn). Thuỷ tổ không có cha mẹ trong file.
- **Mọi người phải nối được về thuỷ tổ**, nếu không sẽ không có đời, không lên cây → lỗi.
  Cha mẹ của dâu/rể (vd vua nhà Lý là cha của Lý Chiêu Hoàng) thuộc dòng họ khác: để ở
  dòng họ đó, nối thông gia sau.
- Con nuôi / thừa tự phải có cả **cha mẹ đẻ** trong file — app tính đời và vẽ cây theo
  cha mẹ đẻ; quan hệ nuôi ghi ở `adoptive_parents`.
- `--check` in số người theo từng đời để soát hình dáng cây.

## Tên tự / Tên húy / Tên thụy
- Điền vào 3 ô sẵn có của form; mỗi tên cần trích dẫn có `value` khớp. Nhiều tên húy →
  "A; B". Miếu hiệu ở Trị vì; tôn hiệu, phong tước ở Tước hiệu.
- Vua/chúa thiếu tên húy / tên thụy / tên tự → cảnh báo (sử hầu như luôn chép), báo cáo
  độ đầy đủ có cột riêng cho vua/chúa.

## Ảnh
- Ảnh đại diện **chỉ lấy từ Wikimedia Commons**, giấy phép PD / CC0 / CC BY / CC BY-SA, có
  trang nguồn và tác giả (trừ PD/CC0). Script tải, nén như app (≤ 512px, ~80 KB) và
  upload `person-photos/{clan}/{person}.jpg`.
- Bắt buộc ghi **loại ảnh**: ảnh chụp thật / chân dung vẽ đương thời / tranh vẽ đời sau.
  Tranh, tượng đời sau được ghi rõ "không phải chân dung thật" ở dòng ghi công cuối tiểu sử.
- Thực tế: nhà Nguyễn có ảnh chụp từ cuối thế kỷ 19; các triều trước hầu như chỉ có tranh
  đời sau → để trống còn hơn dùng ảnh gây hiểu lầm. Ảnh lăng, đền, sắc phong đưa vào module
  Mộ phần / Di sản (giai đoạn sau).

## Lăng tẩm → module Mộ phần
- Mục `resting_places` trong file nháp → `resting_places` + người an táng + ảnh (≤ 1280px,
  ~250 KB như app). Bật `public_show_graves` cho dòng họ lịch sử để khách xem được.
- **Địa danh như sử chép** (`location_name`, vd "hương Tinh Cương, phủ Long Hưng") tách
  khỏi **địa chỉ ngày nay** (`address`). Địa chỉ ngày nay, hiện trạng (còn / đã mất / dời)
  và năm xây cần nguồn tầng A/B (hồ sơ di tích, công trình nghiên cứu); giá trị phải khớp.
- Toạ độ: cho phép theo Wikidata (tầng C) nhưng cảnh báo — nên đối chiếu hồ sơ di tích.
- Mỗi người an táng cần trích dẫn (`occupant:<i>`); validator cảnh báo nếu ô "Nơi an táng"
  của người đó không nhắc tên lăng.
- Ghi chú ≤ 500 ký tự, văn phong sử, cuối tự thêm dòng nguồn; chú thích ảnh tự kèm ghi công.

## Di sản dòng họ
- Mục `heritage` → `heritage_items` (place / custom / story / artifact) + người liên quan +
  ảnh (ảnh đầu làm ảnh bìa). Bật `public_show_heritage`.
- Vd: đền thờ các vua, tư liệu (chiếu, hịch, bia), giai thoại có trong chính sử. Mỗi người
  liên quan cần trích dẫn (`person:<i>`). Nội dung ≤ 1.000 ký tự (cứng 1.500), tóm tắt ≤ 200.
- Lễ hội / tục lệ ngày nay (không có trong chính sử) cần nguồn tầng B; truyền thuyết →
  `legendary`, ghi rõ "tương truyền".

## Sự kiện
- Mục `events` → module Sự kiện: lễ hội đền, tế lăng (`tomb_visit` gắn lăng)… ngày âm lịch
  hằng năm, có trích dẫn ngày (`date`, giá trị khớp nguồn). Bật `public_show_events`.
- **Không khai giỗ** cho người đã có ngày mất — app tự sinh giỗ từ ngày mất (khai thêm là
  trùng → lỗi).
- Mốc lịch sử một lần (lên ngôi, chiến thắng…) không đưa vào Sự kiện; nằm ở Trị vì / tiểu
  sử / di sản.

## Thông gia giữa các dòng họ lịch sử
- Mục `same_person_links`: người này cũng có ở dòng họ lịch sử khác (vd Lý Chiêu Hoàng —
  con gái trong cây nhà Lý, vợ trong cây nhà Trần) → `person_links` `same_person` đã xác
  nhận; app hiện quan hệ thông gia giữa hai cây.
- Cần trích dẫn `same_person`. Dòng họ kia chưa nhập → bỏ qua kèm cảnh báo, chạy lại sau.
- Đây cũng là cách đưa cha mẹ của dâu/rể vào: để họ ở dòng họ của mình rồi nối thông gia,
  không nhập lẫn vào cây (không nối được về thuỷ tổ).

## Vua chúa nhiều vợ, mỗi vợ nhiều con
- **Mỗi cặp vua – vợ là một hôn nhân riêng**, có `spouse_order` (1 = chính thất…) — nhập
  vào `families.spouse_order` sẵn có, cây và trang người xếp vợ theo đó. Thiếu thứ tự khi
  có ≥ 2 vợ → cảnh báo; trùng thứ tự → lỗi.
- **Phẩm vị hậu phi** (Hoàng hậu, Phi, Tần, Chiêu nghi…) ghi ở tước hiệu của người vợ.
- **Mỗi người con gắn vào đúng hôn nhân của mẹ.** Con không rõ mẹ → một hôn nhân "khuyết
  mẹ" duy nhất của vua (≥ 2 cái → lỗi). Khai trùng cặp vợ chồng → lỗi.
- **Con thứ mấy** = thứ tự trong tất cả các con của cha (qua mọi bà vợ), chỉ khi nguồn
  ghi; trùng số giữa các con cùng cha → cảnh báo. "Hoàng tử thứ N" (sử đếm riêng con trai)
  → ghi ở tước hiệu/tiểu sử, không ghi vào "con thứ mấy".
- Một bà có thể có nhiều đời chồng (vd tái giá) — mỗi cuộc là một hôn nhân.

## Phạm vi mỗi triều (để không bùng nổ số người)
- **Gồm:** vua/chúa, hậu phi có ghi tên trong sử, con có tên trong sử (hoàng tử, công
  chúa), các nhân vật hoàng tộc có vai trò (vd Trần Thủ Độ, Trần Hưng Đạo), cha mẹ/tổ
  tiên của người sáng lập triều đến mức sử chép.
- **Không gồm:** hậu duệ chi xa không có trong chính sử; người còn sống.
- Nhà Nguyễn: bản đầu chỉ làm trục vua/chúa + hậu + con của vua; các hệ (phòng) hoàng
  tộc để giai đoạn sau, theo Thế phả.

## UI hiển thị
- Nhãn **"Dữ liệu lịch sử · đã đối chiếu nguồn"** trên trang dòng họ + trang share.
- Chi tiết người: thêm khối **Trị vì** (miếu hiệu, niên hiệu, năm trị vì) và tab
  **Nguồn** (danh sách trích dẫn theo từng fact, dị bản nếu có).
- Fact `disputed` hiện ⚠, bấm vào xem các dị bản.
- Đường nét đứt cho quan hệ con nuôi/thừa tự trên cây.
- Mục mới **"Gia phả các triều đại"** ở trang khám phá/landing, mỗi triều 1 thẻ.
- Tận dụng module sẵn có: **Mộ phần** (lăng vua: Thái Lăng, Hiếu Lăng…), **Di sản**
  (đền Trần, đền Đô, Thế Miếu…), **giỗ** (ngày giỗ vua theo âm lịch → sự kiện nhắc).
- Zalo Mini App: chỉ đọc, hiển thị như dòng họ công khai bình thường + nhãn lịch sử.

## Lộ trình

| Giai đoạn | Nội dung | Kết quả |
|-----------|----------|---------|
| **P0 — Nền tảng** | Migration (kind, sources, citations, reigns, adoptive, precision, external_key), RLS chỉ-đọc, validator JSON, script import | Chưa có dữ liệu, sẵn hạ tầng |
| **P1 — Thí điểm Nhà Trần** | Khung 12 vua → trích xuất Toàn thư + Cương mục → duyệt → publish | 1 triều ~150–250 người, đo thời gian duyệt/người |
| **P2 — UI nguồn + báo sai sót** | Tab Nguồn, nhãn, ⚠ dị bản, nút báo sai sót, trang "Gia phả các triều đại" | Người dùng thấy và kiểm được nguồn |
| **P3 — Nhà Nguyễn (trục chính)** | 9 chúa + 13 vua + hậu + con vua, theo Thực lục + Liệt truyện + Thế phả | Triều được search nhiều nhất |
| **P4 — Lý, Hậu Lê, Trịnh** | Mở rộng theo nhịp duyệt được | |
| **P5 — Các triều ngắn** | Ngô–Đinh–Tiền Lê, Hồ, Mạc, Tây Sơn | Bộ đủ các triều |

**Vì sao thí điểm Nhà Trần trước Nhà Nguyễn:** Toàn thư có bản dịch đọc được trên
Wikisource (trích dẫn dễ), tất cả đã mất (không vướng người sống), quy mô vừa (~200 người)
để chạy thử pipeline duyệt; cấu trúc nội hôn + Thái thượng hoàng đủ khó để thử schema.
Nhà Nguyễn giá trị hơn nhưng to và có hậu duệ còn sống — làm sau khi pipeline đã ổn.

## Rủi ro
| Rủi ro | Giảm thiểu |
|--------|------------|
| AI "ảo giác" quan hệ/ngày tháng | Bắt buộc quote nguyên văn + validator + người duyệt; không fact nào vào DB mà không qua người |
| Khâu duyệt là nút cổ chai | Màn duyệt nhanh (1 fact/1 click), ưu tiên trục chính trước, mời cộng tác viên chuyên môn |
| Mâu thuẫn giữa các nguồn | Lưu dị bản, không ép chọn một |
| Vấn đề nhạy cảm chính trị/dòng tộc | Tên trung tính, ghi quan điểm của nguồn; với Nguyễn Phúc tộc nên liên hệ Hội đồng trị sự trước khi publish rộng |
| Bản quyền bản dịch | Chỉ trích ngắn + vị trí; kiểm tra giấy phép trước khi đưa trích đoạn dài |
| Lịch âm cổ quy đổi sai | Lưu âm lịch như nguồn, dương lịch gắn cờ "quy đổi" |
| Lẫn số liệu lịch sử vào thống kê/leaderboard dòng họ thật | Lọc `kind='historical'` khỏi stats, leaderboard, giới hạn gói |

## Trạng thái P1 — Nhà Trần (28/10/2026)
- `data/historical/tran.json` (BẢN NHÁP, chưa duyệt): 38 người / 12 đời (thuỷ tổ Trần
  Kinh → Thiếu Đế), 26 hôn nhân, 12 vua có trị vì + miếu hiệu + niên hiệu, 12 lăng,
  4 di sản từ chính sử (Hịch tướng sĩ; Binh thư yếu lược & Vạn Kiếp tông bí truyền thư;
  Hội nghị Diên Hồng; Hội nghị Bình Than), 2 liên kết thông gia chờ nhà Lý / họ Hồ.
- Các nhánh: Trần Liễu, Trần Quốc Khang (cha đẻ Trần Liễu, cha nuôi Thái Tông — dùng
  `adoptive_parents`), Hưng Đạo vương Trần Quốc Tuấn + Thiên Thành công chúa, Trần Quốc
  Tảng (nối tới Thuận Thánh hoàng hậu), Trần Quốc Nghiễn, Trần Quang Khải, Trần Nhật
  Duật, Trần Ích Tắc. Trần Thủ Độ KHÔNG đưa vào: sử chỉ chép "從叔", không nối được.
- Nguồn: nguyên văn chữ Hán Toàn thư (Q.4–8), Cương mục (Chính biên Q.6–11), Việt sử
  lược (phụ 陳朝紀年) — 399 trích dẫn; `verify_quotes.py`: 399/399 có thật trong nguyên
  văn, đúng năm can chi. Mức tin cậy: 57 dữ kiện khớp ≥ 2 nguồn, 266 một nguồn, 2 dị bản
  (tháng mất Nghệ Tông: Toàn thư tháng 12 / Cương mục tháng 11; lăng Hiến Tông: Xương An
  lăng / An lăng).
- Bản số Wikisource chép sai can chi ở vài tiêu đề năm (Toàn thư: 1255, 1265, 1268,
  1288, 1292, 1388, 1395; Cương mục: 1272, 1279, 1300) — `verify_quotes.py` tự nhận ra
  (lệch khỏi năm liền kề) và in danh sách errata.
- Sinh lại bản khung: `scripts/historical/gen_tran.py` (+ `gen_tran_ext.py`).
- Việc của người duyệt: đối chiếu phiên âm / dịch với bản dịch tiếng Việt; 3 bà phi họ
  Lê của Minh Tông có trùng người không; họ tên đầy đủ Trần Quốc Nghiễn (sử chỉ chép 巘);
  tuổi thọ Nhật Duật (77) lệch 1 năm với năm sinh 1255; đổi `review.status` → `verified`.
- Chưa có: đền Trần, lễ khai ấn — mới chỉ thấy tin báo chí, chưa có văn bản quyết định
  xếp hạng (nguồn tầng B); địa giới đã đổi sau sáp nhập tỉnh 2025 → cần xác minh địa chỉ.

## Đã chốt (28/10/2026)
1. Triều thí điểm: **Nhà Trần**.
2. (Tạm) bản đầu admin tự duyệt; mời người duyệt ngoài tính sau.
3. (Tạm) chưa thay `demo_clan_id`.
4. (Tạm) chưa cho liên kết dòng họ người dùng vào dòng họ lịch sử — xem lại sau P3.

## Trạng thái P0 (xong)
- Migration `20261028120000_historical_clans.sql`: `clans.kind/external_key` (chốt chỉ
  platform admin đổi), `historical_sources`, `person_citations`, `person_reigns`,
  `person_titles`, `persons.adoptive_family_id/external_key/*_date_qualifier`,
  `families.external_key`. Ngày "chỉ biết năm" dùng `*_date_precision` có sẵn.
- Danh mục nguồn: `data/historical/sources.json` (chưa điền bản dịch cụ thể — điền khi
  bắt đầu trích).
- Định dạng file nháp + validator: `scripts/historical/validate-lib.ts`
  (test: `src/test/historical-validate.test.ts`).
- Import: `npx tsx --tsconfig tsconfig.app.json scripts/seed-historical-clan.ts <file> [--check] [--include-drafts]`.
- **Định dạng file nháp** (`data/historical/<trieu>.json`): `clan` + `persons[]` +
  `unions[]`. Mỗi dữ kiện có giá trị phải có citation cùng `field` (`existence`, `birth`,
  `death`, `parents`, `adoptive_parents`, `posthumous_name`, `reign:<i>`, `title:<i>`,
  `union`…); citation = `{source, locator, quote, value?}`. Chỉ mục có
  `review.status = "verified"` được nhập.
- Chưa làm: regen `database.types.ts` (làm khi merge, tránh kéo theo bảng Zalo từ DB
  local); áp migration lên self-host (khi bắt đầu nhập dữ liệu thật); lọc
  `kind='historical'` khỏi bảng xếp hạng (P2).
