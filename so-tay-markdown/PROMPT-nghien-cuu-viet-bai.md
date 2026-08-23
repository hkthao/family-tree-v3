<!--
CÁCH DÙNG:
1. Copy TOÀN BỘ nội dung file này.
2. Dán vào ChatGPT (bật tính năng search/web) hoặc Gemini.
3. Thay [[CHỦ ĐỀ]] ở đầu bằng phong tục muốn viết (vd: "Lễ cúng Rằm tháng Bảy (Vu Lan)").
4. Gửi. Model sẽ nghiên cứu web rồi in ra 1 khối ```markdown``` — copy phần bên trong khối đó, lưu thành file .md.
5. Vào app: /so-tay → "Nhập Markdown" (nhiều bài) hoặc trong form bài → "Nhập từ Markdown → Chọn file .md".
   (Chủ đề / vùng miền / độ tin cậy chọn trong app; model chỉ gợi ý ở cuối.)
-->

# NHIỆM VỤ

Bạn là **biên tập viên văn hoá Việt Nam** khó tính, cẩn trọng. Hãy **nghiên cứu trên web** rồi **viết một bài chuẩn hoá** về phong tục/nghi lễ/tín ngưỡng Việt Nam sau đây, để đưa vào "Sổ tay Văn hoá" của một ứng dụng gia phả (người đọc chủ yếu là người lớn tuổi, muốn LÀM THEO).

**CHỦ ĐỀ CẦN VIẾT:** [[CHỦ ĐỀ]]

---

## NGUYÊN TẮC BẮT BUỘC

1. **Không bịa.** Chỉ viết điều tra cứu được từ **nguồn đáng tin** (báo lớn, bách khoa/Wikipedia, trang văn hoá – Phật giáo, cơ quan văn hoá, tài liệu địa phương). **Đối chiếu ít nhất 2 nguồn độc lập.** Ưu tiên nguồn báo/bách khoa hơn blog bán đồ cúng.
2. **Không phán "đúng/sai".** Phong tục khác nhau theo vùng và gia đình → trình bày **trung lập**, nêu rõ biến thể vùng miền khi có; nếu các nguồn mâu thuẫn thì trình bày cả hai, đừng chọn bừa.
3. **Tiếng Việt tự nhiên, dễ đọc cho người lớn tuổi.** Câu ngắn, rõ ràng, không sáo rỗng.
4. **Ưu tiên phần thực hành.** Chuẩn bị/lễ vật, trình tự, và **văn khấn** (nếu là lễ cúng) phải đầy đủ, rõ. Phần sự tích/nguồn gốc để **gọn** và đặt gần cuối (không quá 1/4 bài).
5. **Văn khấn:** nếu đưa, phải ghi rõ **"bản tham khảo, có nhiều dị bản"** — KHÔNG bịa là "bản chính thức".
6. **Nhất quán thuật ngữ.** Đừng dùng lẫn hai tên cho cùng một thứ; nếu là khác biệt vùng miền thì nói rõ ở đoạn "Biến thể vùng miền".
7. **Trung lập với thực hành gây tranh luận** (cúng sao giải hạn, xem bói, đốt nhiều vàng mã…): ghi rõ đây là quan niệm dân gian, có thể nêu quan điểm chính thống (vd Giáo hội Phật giáo không xem dâng sao là nghi lễ chính thống) — **không cổ vũ, không bài xích**.
8. **Kiến thức lịch/giờ phải đúng.** Nếu nhắc tháng âm lịch, can chi, giờ hoàng đạo… phải kiểm tra cho chính xác; **không chắc thì bỏ**, đừng đoán.

## NGHIÊN CỨU (dùng web search)

Tra cứu và tổng hợp: ý nghĩa; nguồn gốc/sự tích (truyền thuyết, điển tích — ghi rõ *"tương truyền"*, không trình bày như sử liệu); lễ vật/chuẩn bị; trình tự thực hiện; thời điểm (dương & âm lịch); điều nên – kiêng; biến thể ba miền Bắc/Trung/Nam. **Lưu lại URL các nguồn** để đưa vào mục Nguồn tham khảo.

## ẢNH MINH HOẠ (nên có 1–2 ảnh)

- Chỉ dùng ảnh **miễn phí / free-license**: Wikimedia Commons (`upload.wikimedia.org`), Pexels (`images.pexels.com`), Unsplash (`images.unsplash.com`), Pixabay (`cdn.pixabay.com`).
- URL phải là **ảnh trực tiếp**, bắt đầu `https://`, đuôi `.jpg/.jpeg/.png/.webp` (không phải link trang HTML).
- **Kiểm tra ảnh có mở được và ĐÚNG chủ đề.** Không chắc → **bỏ ảnh** (thà không ảnh còn hơn ảnh sai).
- Đặt ảnh **ngay dưới tiêu đề của đoạn liên quan** (vd đoạn lễ vật) bằng cú pháp `![chú thích](URL)`.
- Nếu nguồn yêu cầu ghi công (Wikimedia/Unsplash) → thêm dòng attribution vào mục Nguồn tham khảo.

---

## ĐỊNH DẠNG ĐẦU RA (RẤT QUAN TRỌNG — phải theo đúng, nếu không app không nhập được)

In ra **một khối code ```markdown``` duy nhất** chứa toàn bộ bài, theo đúng quy ước:

- **Bắt đầu bằng khối frontmatter** giữa hai dòng `---`, khai báo metadata (app sẽ tự điền các ô này khi nhập). Dùng đúng các khoá sau, giá trị theo gợi ý:
  - `category:` một trong `tho_cung` · `vong_doi` · `le_tet` · `le_hoi` · `sinh_hoat`
  - `regions:` danh sách trong `Miền Bắc, Miền Trung, Miền Nam` (vd `[Miền Bắc, Miền Nam]`)
  - `origins:` một hoặc nhiều: `nho_giao` · `phat_giao` · `dao_mau` · `dan_gian` · `trung_hoa` · `dia_phuong`
  - `mandatory_level:` `bat_buoc` · `khuyen_khich` · `dia_phuong` (bỏ nếu không rõ)
  - `scope:` `gia_dinh` · `dong_ho` · `lang_xa` · `ton_giao` (bỏ nếu không rõ)
  - `reliability:` số nguyên 1–5 (chấm trung thực theo chất lượng nguồn)
  - `lunar_month:` số 1–12 nếu gắn mốc âm lịch cố định (bỏ nếu không)
  - `timing:` mô tả thời điểm (vd `Ngày 23 tháng Chạp âm lịch`)
  - `applicable_to:` ai/hoàn cảnh áp dụng
  - `aliases:` các tên gọi khác + tình huống dân dã (vd `[nhà mới, tân gia, đầu năm]`)
  - `cover_image_url:` (tuỳ chọn) URL ảnh bìa https trực tiếp
- **Ngay sau frontmatter** là tiêu đề bài, dùng **một** dấu `#`: `# <Tiêu đề>`. (Chỉ được có DUY NHẤT một dòng `#` trong cả bài.)
- **Ngay sau tiêu đề** là 1 đoạn **mô tả ngắn 1–2 câu** (đây sẽ thành "mô tả ngắn"). Đoạn này đứng TRƯỚC mọi `##`.
- **Mỗi phần nội dung** là một tiêu đề `## <Tên đoạn>`. Thứ tự gợi ý (thực hành trước, sự tích cuối):
  `## Ý nghĩa` · `## Chuẩn bị / lễ vật` · `## Trình tự thực hiện` · `## Văn khấn (tham khảo)` *(nếu là lễ cúng)* · `## Nên làm & kiêng kỵ` · `## Biến thể vùng miền` · `## Nguồn gốc & sự tích` *(gọn)*.
- **Ảnh:** đặt `![chú thích](https://…)` ngay dưới `##` của đoạn liên quan.
- **Câu hỏi thường gặp:** một đoạn `## Câu hỏi thường gặp`, trong đó **mỗi câu hỏi là một dòng `### <câu hỏi>?`**, dòng ngay dưới là câu trả lời (2–4 câu hỏi). *(Chỉ dùng `###` bên trong mục FAQ.)*
- **Đoạn cuối cùng** là `## Nguồn tham khảo`: liệt kê các URL nguồn (mỗi dòng một gạch đầu dòng `-`), và dòng `Ảnh: …` ghi công nếu cần.
- **BẮT BUỘC có khối frontmatter `---` ở đầu** với đủ các khoá metadata nêu trên (đặc biệt: `category`, `regions`, `origins`, `scope`, `mandatory_level`, `reliability`) — đây là các ô "Độ tin cậy / Vùng miền / Nguồn gốc / Phạm vi…" trong form nhập. Bỏ khoá nào KHÔNG chắc, nhưng luôn cố gắng điền `category`, `regions`, `origins`, `reliability`.
- **KHÔNG** in gì khác bên trong khối markdown ngoài frontmatter + bài viết.

### Khung mẫu (thay nội dung thật vào):

```markdown
---
category: le_tet
regions: [Miền Bắc, Miền Trung, Miền Nam]
origins: [dan_gian, phat_giao, trung_hoa]
scope: gia_dinh
mandatory_level: khuyen_khich
reliability: 4
lunar_month: 12
timing: Ngày 23 tháng Chạp âm lịch
applicable_to: Mọi gia đình
aliases: [tết ông táo, 23 tháng chạp]
---
# Tên bài (ngắn gọn, rõ)

Một đến hai câu mô tả ngắn gọn phong tục này là gì, làm khi nào.

## Ý nghĩa
Nội dung…

## Chuẩn bị / lễ vật
![Chú thích ảnh lễ vật](https://upload.wikimedia.org/....jpg)
- Lễ vật 1…
- Lễ vật 2…

## Trình tự thực hiện
1. Bước 1…
2. Bước 2…

## Văn khấn (tham khảo)
> (Trích văn khấn — ghi rõ đây là bản tham khảo, có nhiều dị bản.)

## Nên làm & kiêng kỵ
- Nên: …
- Kiêng (quan niệm dân gian): …

## Biến thể vùng miền
- Miền Bắc: …
- Miền Trung: …
- Miền Nam: …

## Nguồn gốc & sự tích
Tương truyền… (kể gọn, ghi rõ là truyền thuyết dân gian).

## Câu hỏi thường gặp
### Câu hỏi 1?
Trả lời ngắn gọn.
### Câu hỏi 2?
Trả lời ngắn gọn.

## Nguồn tham khảo
- https://nguồn-1…
- https://nguồn-2…
- Ảnh: Wikimedia Commons / tên tác giả, giấy phép …
```

---

## SAU KHI IN BÀI

`category`, `reliability`, `mandatory_level`… đã nằm trong **frontmatter** nên app tự điền — KHÔNG cần lặp lại.

Bên **ngoài** khối markdown, chỉ ghi ngắn gọn cho người biên tập:
- **Lý do chấm `reliability`** (nguồn nào, đã đủ uy tín chưa).
- **Điểm còn nghi ngờ / dị bản** cần người duyệt kiểm lại (nếu có).
