import { describe, expect, it } from "vitest";

import {
  firstImageUrl,
  normalizePostMarkdown,
  postDisplayTitle,
  postExcerpt,
  readMinutes,
  stripMarkdown,
} from "@/lib/postMarkdown";

/** Bài Bảng tin dùng Markdown; bài cũ là chữ thường (docs/plan-trang-dong-ho.md, mục 2.1 và 5). */
describe("normalizePostMarkdown", () => {
  it("bài cũ chữ thường: xuống dòng đơn thành xuống dòng cứng", () => {
    expect(normalizePostMarkdown("Mời cả nhà\nvề giỗ tổ\nlúc 8 giờ")).toBe("Mời cả nhà  \nvề giỗ tổ  \nlúc 8 giờ");
  });

  it("dòng trống ngăn đoạn thì giữ nguyên", () => {
    expect(normalizePostMarkdown("Đoạn một\n\nĐoạn hai")).toBe("Đoạn một\n\nĐoạn hai");
  });

  it("không đụng danh sách, trích dẫn, khối code", () => {
    const md = "- một\n- hai\n\n> trích\n> tiếp\n\n```\ndòng a\ndòng b\n```";
    expect(normalizePostMarkdown(md)).toBe(md);
  });

  it("CRLF được chuẩn hoá; dòng đã có 2 dấu cách thì không thêm", () => {
    expect(normalizePostMarkdown("a\r\nb")).toBe("a  \nb");
    expect(normalizePostMarkdown("a  \nb")).toBe("a  \nb");
  });
});

describe("firstImageUrl", () => {
  it("lấy ảnh https đầu tiên (Markdown hoặc thẻ img)", () => {
    expect(firstImageUrl("Chữ ![x](https://a.vn/1.jpg) ![y](https://a.vn/2.jpg)")).toBe("https://a.vn/1.jpg");
    expect(firstImageUrl('<img src="https://a.vn/3.png" alt="">')).toBe("https://a.vn/3.png");
  });

  it("bỏ ảnh http, đường dẫn tương đối, và bài không có ảnh", () => {
    expect(firstImageUrl("![x](http://a.vn/1.jpg)")).toBeNull();
    expect(firstImageUrl("![x](/anh.jpg)")).toBeNull();
    expect(firstImageUrl("Không có ảnh")).toBeNull();
  });
});

describe("stripMarkdown / postExcerpt", () => {
  it("gỡ định dạng, giữ chữ", () => {
    expect(stripMarkdown("## Tiêu đề\n**đậm** và [liên kết](https://a.vn) ![ảnh](https://a.vn/1.jpg)")).toBe(
      "Tiêu đề đậm và liên kết",
    );
  });

  it("cắt theo từ và thêm dấu …; bài ngắn thì giữ nguyên", () => {
    expect(postExcerpt("một hai ba bốn năm", 12)).toBe("một hai ba…");
    expect(postExcerpt("ngắn", 50)).toBe("ngắn");
  });
});

describe("postDisplayTitle", () => {
  it("dùng title khi có, không thì dòng chữ đầu của bài", () => {
    expect(postDisplayTitle("  Tin vui ", "nội dung")).toBe("Tin vui");
    expect(postDisplayTitle(null, "\n\n## Giỗ tổ năm nay\nChi tiết")).toBe("Giỗ tổ năm nay");
    expect(postDisplayTitle("", "**Họp họ** cuối năm")).toBe("Họp họ cuối năm");
  });
});

describe("readMinutes", () => {
  it("tối thiểu 1 phút; ~200 từ/phút", () => {
    expect(readMinutes("ít chữ")).toBe(1);
    expect(readMinutes(Array(600).fill("từ").join(" "))).toBe(3);
  });
});
