import { describe, expect, it } from "vitest";

import {
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
});
