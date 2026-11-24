# Bài lễ hội (landing /le-hoi/)

Mỗi bài một file `<slug>.json`; `node scripts/build-landing-guides.mjs` sinh `landing/le-hoi/<slug>.html`, `landing/le-hoi.html`, sitemap, llms.txt.
Kế hoạch: `docs/plan-bai-viet-le-hoi-seo.md`. Sách *60 lễ hội truyền thống Việt Nam* chỉ để tham khảo chủ đề — KHÔNG chép/dịch sát; viết lại bằng lời mình, đối chiếu ≥2 nguồn công khai.

## Schema
```
{
  "slug": "hoi-chua-huong",                 // kebab-case không dấu, trùng tên file
  "title": "…",                              // ≤ 62 ký tự, có từ khoá chính + ý chính (thời gian/địa điểm)
  "short": "Hội chùa Hương",                 // tên ngắn cho breadcrumb/liên kết
  "description": "…",                        // 140–160 ký tự
  "updated": "2026-11-24",
  "minutes": 6,
  "when": "Mùng 6 tháng Giêng – hết tháng Ba âm lịch",   // hiện ở thẻ hub
  "where": "Hương Sơn, Hà Nội",                          // tên hành chính HIỆN HÀNH
  "lead": "<strong>Câu trả lời trực tiếp 1–2 câu</strong> …",   // HTML
  "infobox": [["Thời gian","…"],["Địa điểm","…"],["Thờ","…"],["Hoạt động chính","…"]],   // giá trị là HTML
  "images": [{"file":"hoi-chua-huong-1.webp","alt":"…","caption":"…","credit":"Tên tác giả, CC BY-SA 4.0 (<a href=\"URL trang Commons\">Wikimedia Commons</a>)","w":1200,"h":800}],
  "sections": [{"h2":"…","html":"<p>…</p>","image":1}],   // image: chỉ số trong images (bỏ qua nếu không có); images[0] là ảnh đầu bài
  "faq": [{"q":"…","a":"… (văn bản thuần, không HTML)"}],  // 4–5 câu
  "heritage": "…HTML… 2–3 câu nối lễ hội với tổ tiên/dòng họ/ngày giỗ, tự nhiên, không quảng cáo",
  "soTay": "Cúng ông Công ông Táo",           // tuỳ chọn: tên bài Sổ tay liên quan
  "related": ["slug-bài-khác-trong-đợt-1"],   // 3 slug
  "sources": [{"name":"…","url":"https://…"}]  // ≥3 nguồn thật, URL thật đã mở được; có thể thêm dòng tên sách không url
}
```
