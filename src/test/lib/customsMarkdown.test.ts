import { describe, expect, it } from "vitest";

import {
  extractCoverImage,
  parseCustomMarkdown,
  splitMarkdownEntries,
} from "@/lib/customs/markdown";

describe("parseCustomMarkdown — thân markdown → bài Sổ tay", () => {
  it("lấy H1 làm title, đoạn mở đầu làm short_description", () => {
    const md = `# Lễ nhập trạch (về nhà mới)

Nghi lễ báo cáo thần linh, tổ tiên khi dọn về nhà mới.

## Ý nghĩa
Cầu bình an cho gia đình.`;
    const r = parseCustomMarkdown(md);
    expect(r.title).toBe("Lễ nhập trạch (về nhà mới)");
    expect(r.short_description).toBe(
      "Nghi lễ báo cáo thần linh, tổ tiên khi dọn về nhà mới.",
    );
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].heading).toBe("Ý nghĩa");
    expect(r.sections[0].body).toBe("Cầu bình an cho gia đình.");
  });

  it("mỗi ## là 1 đoạn; giữ xuống dòng trong body", () => {
    const md = `# X

## Chuẩn bị
Mâm ngũ quả.
Hương hoa.

## Trình tự
Bước 1.`;
    const r = parseCustomMarkdown(md);
    expect(r.sections.map((s) => s.heading)).toEqual(["Chuẩn bị", "Trình tự"]);
    expect(r.sections[0].body).toBe("Mâm ngũ quả.\nHương hoa.");
  });

  it("tách ảnh minh hoạ https + chú thích, bỏ khỏi body", () => {
    const md = `# X

## Lễ vật
![Mâm cúng nhập trạch](https://cdn.example.com/mam.jpg)
Bày mâm cúng đầy đủ.`;
    const r = parseCustomMarkdown(md);
    const s = r.sections[0];
    expect(s.image_url).toBe("https://cdn.example.com/mam.jpg");
    expect(s.image_caption).toBe("Mâm cúng nhập trạch");
    expect(s.body).toBe("Bày mâm cúng đầy đủ.");
  });

  it("bỏ qua ảnh không phải https (an toàn)", () => {
    const md = `# X

## A
![x](http://insecure.example/a.jpg)
Nội dung.`;
    const r = parseCustomMarkdown(md);
    expect(r.sections[0].image_url).toBeUndefined();
  });

  it("làm sạch **đậm**, [text](url), `code`", () => {
    const md = `# X

## A
Đây là **quan trọng** và [xem thêm](https://a.b) với \`mã\`.`;
    const r = parseCustomMarkdown(md);
    expect(r.sections[0].body).toBe("Đây là quan trọng và xem thêm với mã.");
  });

  it("heading FAQ → parse ### thành faq[{q,a}]", () => {
    const md = `# X

## Ý nghĩa
Abc.

## Câu hỏi thường gặp
### Nhập trạch có cần xem ngày không?
Nên chọn ngày lành.
### Ở trọ có làm được không?
Có, làm gọn.`;
    const r = parseCustomMarkdown(md);
    expect(r.sections).toHaveLength(1); // chỉ còn "Ý nghĩa"
    expect(r.faq).toEqual([
      {
        q: "Nhập trạch có cần xem ngày không?",
        a: "Nên chọn ngày lành.",
      },
      { q: "Ở trọ có làm được không?", a: "Có, làm gọn." },
    ]);
  });

  it("heading FAQ nhưng không có ### → giữ như đoạn thường", () => {
    const md = `# X

## FAQ
Chưa có câu hỏi.`;
    const r = parseCustomMarkdown(md);
    expect(r.faq).toHaveLength(0);
    expect(r.sections[0].heading).toBe("FAQ");
  });

  it("không có H1 → title rỗng (caller cảnh báo)", () => {
    const r = parseCustomMarkdown("## Chỉ có đoạn\nNội dung.");
    expect(r.title).toBe("");
    expect(r.sections[0].heading).toBe("Chỉ có đoạn");
  });

  it("không cắt nhầm # trong code fence", () => {
    const md = `# X

## Code
\`\`\`
# đây là comment, không phải heading
\`\`\`
Sau fence.`;
    const r = parseCustomMarkdown(md);
    // Quan trọng: `#` trong fence KHÔNG tạo section mới (fence-aware).
    expect(r.sections).toHaveLength(1);
    expect(r.sections[0].body).toContain("đây là comment");
  });
});

describe("parseCustomMarkdown — frontmatter (tuỳ chọn)", () => {
  it("đọc metadata: key enum, nhãn tiếng Việt, mảng, số", () => {
    const md = `---
category: le_tet
mandatory_level: Khuyến khích
reliability: 4
regions: [Miền Bắc, Miền Nam]
origins: dan_gian, Phật giáo
aliases: tết ông táo, 23 tháng chạp
lunar_month: 12
cover_image_url: https://a/x.jpg
---
# Ông Táo

Mô tả.

## Ý nghĩa
abc`;
    const r = parseCustomMarkdown(md);
    expect(r.title).toBe("Ông Táo");
    expect(r.meta.category).toBe("le_tet");
    expect(r.meta.mandatory_level).toBe("khuyen_khich"); // khớp theo nhãn
    expect(r.meta.reliability).toBe(4);
    expect(r.meta.regions).toEqual(["Miền Bắc", "Miền Nam"]);
    expect(r.meta.origins).toEqual(["dan_gian", "phat_giao"]);
    expect(r.meta.aliases).toEqual(["tết ông táo", "23 tháng chạp"]);
    expect(r.meta.lunar_month).toBe(12);
    expect(r.meta.cover_image_url).toBe("https://a/x.jpg");
    // thân bài parse như thường, không dính frontmatter
    expect(r.sections).toHaveLength(1);
  });

  it("bỏ giá trị enum/số không hợp lệ", () => {
    const md = `---
category: khong_ton_tai
reliability: 9
cover_image_url: http://insecure/x.jpg
---
# X
## A
y`;
    const r = parseCustomMarkdown(md);
    expect(r.meta.category).toBeUndefined();
    expect(r.meta.reliability).toBeUndefined();
    expect(r.meta.cover_image_url).toBeUndefined(); // không https
  });

  it("không có frontmatter → meta rỗng", () => {
    const r = parseCustomMarkdown("# X\n## A\nb");
    expect(r.meta).toEqual({});
  });

  it("không nhầm '---' gạch ngang trong thân là frontmatter", () => {
    const md = `# X

## A
Đoạn một.

---

Đoạn hai sau gạch ngang.`;
    const r = parseCustomMarkdown(md);
    expect(r.meta).toEqual({});
    expect(r.title).toBe("X");
  });
});

describe("extractCoverImage — ảnh minh hoạ đầu → ảnh bìa", () => {
  it("lấy ảnh đầu tiên làm bìa và gỡ khỏi đoạn đó", () => {
    const secs = [
      { heading: "Ý nghĩa", body: "abc" },
      { heading: "Lễ vật", body: "def", image_url: "https://a/x.jpg", image_caption: "Mâm" },
      { heading: "Trình tự", body: "ghi", image_url: "https://a/y.jpg" },
    ];
    const r = extractCoverImage(secs);
    expect(r.cover_image_url).toBe("https://a/x.jpg");
    // đoạn "Lễ vật" mất ảnh, các đoạn khác giữ nguyên
    expect(r.sections[1].image_url).toBeUndefined();
    expect(r.sections[1].image_caption).toBeUndefined();
    expect(r.sections[2].image_url).toBe("https://a/y.jpg");
  });

  it("không có ảnh nào → cover null, giữ nguyên", () => {
    const secs = [{ heading: "A", body: "x" }];
    const r = extractCoverImage(secs);
    expect(r.cover_image_url).toBeNull();
    expect(r.sections).toBe(secs);
  });
});

describe("splitMarkdownEntries — nhiều bài trong 1 tài liệu", () => {
  it("tách theo H1", () => {
    const md = `# Bài một
Nội dung 1.

# Bài hai
Nội dung 2.`;
    const chunks = splitMarkdownEntries(md);
    expect(chunks).toHaveLength(2);
    expect(parseCustomMarkdown(chunks[0]).title).toBe("Bài một");
    expect(parseCustomMarkdown(chunks[1]).title).toBe("Bài hai");
  });

  it("bỏ nội dung trước H1 đầu tiên", () => {
    const chunks = splitMarkdownEntries("Rác đầu file\n\n# Bài\nNội dung.");
    expect(chunks).toHaveLength(1);
    expect(parseCustomMarkdown(chunks[0]).title).toBe("Bài");
  });

  it("không tách theo ## (chỉ H1)", () => {
    const md = `# Một bài
## Đoạn A
x
## Đoạn B
y`;
    expect(splitMarkdownEntries(md)).toHaveLength(1);
  });

  it("không cắt theo # trong code fence", () => {
    const md = `# Bài
\`\`\`sh
# không phải bài mới
\`\`\``;
    expect(splitMarkdownEntries(md)).toHaveLength(1);
  });

  it("tách nhiều bài, mỗi bài có frontmatter riêng", () => {
    const md = `---
category: le_tet
---
# Bài một
Nội dung 1.

---
category: vong_doi
---
# Bài hai
Nội dung 2.`;
    const chunks = splitMarkdownEntries(md);
    expect(chunks).toHaveLength(2);
    const a = parseCustomMarkdown(chunks[0]);
    const b = parseCustomMarkdown(chunks[1]);
    expect(a.title).toBe("Bài một");
    expect(a.meta.category).toBe("le_tet");
    expect(b.title).toBe("Bài hai");
    expect(b.meta.category).toBe("vong_doi");
  });
});
