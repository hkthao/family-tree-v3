import { describe, expect, it } from "vitest";

import {
  chunkByBytes,
  encodeSubject,
} from "../../../supabase/functions/_shared/mail";

/**
 * Tiêu đề email tiếng Việt — chỗ đã hỏng thật trên production: Gmail in
 * ra nguyên chuỗi `=?utf-8?Q?[D=c3=b2ng H=e1=bb=8d Vi=e1=bb=87t]…` thay
 * vì tiêu đề, vì thư viện nhét cả tiêu đề dài vào MỘT encoded-word quá
 * giới hạn 75 ký tự của RFC 2047.
 *
 * Test giải mã ngược lại để kiểm — chỉ nhìn chuỗi mã hoá thì không biết
 * nó có đúng không.
 */

/** Giải mã ngược RFC 2047, đóng vai Gmail. */
function decodeSubject(encoded: string): string {
  return encoded
    .split(/\r\n /)
    .map((word) => {
      const m = /^=\?UTF-8\?B\?(.*)\?=$/.exec(word);
      if (!m) return word;
      const bin = atob(m[1]);
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    })
    .join("");
}

/** Mỗi encoded-word phải ≤ 75 ký tự — đây chính là luật bị vi phạm. */
function longestWord(encoded: string): number {
  return Math.max(...encoded.split(/\r\n /).map((w) => w.length));
}

describe("encodeSubject", () => {
  const real = "[Dòng Họ Việt] Còn 7 ngày: Giỗ Huỳnh Xuân Tại";

  it("giải mã ngược ra đúng tiêu đề gốc", () => {
    expect(decodeSubject(encodeSubject(real))).toBe(real);
  });

  it("không encoded-word nào vượt 75 ký tự", () => {
    expect(longestWord(encodeSubject(real))).toBeLessThanOrEqual(75);
  });

  it("tiêu đề rất dài vẫn đúng và vẫn trong giới hạn", () => {
    const long =
      "[Dòng Họ Việt] Nhắc giỗ cụ tổ Nguyễn Văn Đại Đường và các cụ trong chi thứ ba — còn đúng bảy ngày nữa, mời con cháu về dự";
    const enc = encodeSubject(long);
    expect(decodeSubject(enc)).toBe(long);
    expect(longestWord(enc)).toBeLessThanOrEqual(75);
  });

  it("tiêu đề toàn ASCII thì để nguyên, không mã hoá vô ích", () => {
    expect(encodeSubject("Weekly digest")).toBe("Weekly digest");
  });

  it("bỏ xuống dòng trong tiêu đề — chèn header là lỗ hổng thật", () => {
    // Tên người có xuống dòng thì kẻ xấu chèn được header giả vào email.
    expect(encodeSubject("A\r\nBcc: ke-xau@example.com")).toBe(
      "A Bcc: ke-xau@example.com",
    );
  });

  it("emoji (ngoài BMP) không bị cắt đôi", () => {
    const s = "🎉".repeat(30) + " Chúc mừng";
    expect(decodeSubject(encodeSubject(s))).toBe(s);
  });
});

describe("chunkByBytes", () => {
  it("không khúc nào vượt số byte cho phép", () => {
    const enc = new TextEncoder();
    const chunks = chunkByBytes("Giỗ cụ tổ Nguyễn Văn Đại".repeat(5));
    for (const c of chunks) expect(enc.encode(c).length).toBeLessThanOrEqual(45);
  });

  it("ghép lại phải ra đúng chuỗi ban đầu", () => {
    const s = "Dòng Họ Việt — nhắc giỗ";
    expect(chunkByBytes(s, 10).join("")).toBe(s);
  });

  it("chuỗi rỗng không sinh khúc rác", () => {
    expect(chunkByBytes("")).toEqual([]);
  });
});
