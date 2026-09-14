import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Hai quy ước trình bày mà mắt thường KHÔNG bắt được khi review code —
 * chỉ lộ ra trên máy người dùng. Xem docs/design-language.md.
 *
 * Cả hai đều đã xảy ra thật và có người dùng báo lại.
 */

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name === "test" || name === "node_modules") continue;
      sourceFiles(p, out);
    } else if (name.endsWith(".tsx") || name.endsWith(".ts")) {
      out.push(p);
    }
  }
  return out;
}

const FILES = sourceFiles("src");

describe("lưới phải khai báo số cột cho MÀN HẸP", () => {
  it("mọi grid có cột theo breakpoint đều có cột nền", () => {
    // `grid gap-2 sm:grid-cols-2` trông như "1 cột trên điện thoại", nhưng
    // cột ngầm đó là `auto` — nó nở theo NỘI DUNG. Một hàng sự kiện có
    // tên dài đo được 523px trong khung 390px: cả trang trôi ngang, chữ
    // "Còn 4 ngày" bị cắt mất. Khai báo `grid-cols-1` thì cột thành
    // `minmax(0,1fr)` và chữ dài tự cắt bằng dấu ba chấm như mong đợi.
    const bad: string[] = [];
    for (const file of FILES) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/"([^"\n]*\bgrid-cols-[^"\n]*)"/g)) {
        const cls = m[1];
        if (!/\b(sm|md|lg|xl|2xl):grid-cols-/.test(cls)) continue;
        if (/(^|\s)grid-cols-/.test(cls)) continue;
        // `lg:grid` = màn hẹp KHÔNG phải lưới (xếp chồng thường), nên
        // không cần khai báo cột nền.
        if (!/(^|\s)grid(\s|$)/.test(cls)) continue;
        bad.push(`${file}: "${cls.trim()}"`);
      }
    }
    expect(bad, `thiếu grid-cols-… cho màn hẹp:\n${bad.join("\n")}`).toEqual([]);
  });
});

describe("ngày hiện cho NGƯỜI đọc", () => {
  it("không nơi nào in thẳng ngày kiểu máy ra màn hình", () => {
    // `2026-09-20` là cách MÁY lưu ngày. Người Việt đọc 20/09/2026.
    // Chuỗi thô từng lọt ra danh sách sự kiện, hộp chi tiết, và theo
    // đó lên cả thiệp chia sẻ gửi cho cả dòng họ.
    const bad: string[] = [];
    for (const file of FILES) {
      if (file.includes("eventWhen") || file.includes("formatDate")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /\$\{[^}]*\b(date_solar|birth_date|death_date)\b[^}]*\}/g,
      )) {
        // Cho phép khi đã đi qua hàm định dạng, và khi chỉ lấy NĂM —
        // "cụ Tường (1920–1998)" là cách viết đúng, không phải ngày thô.
        if (/format|Text\(/.test(m[0])) continue;
        if (/slice\(\s*0\s*,\s*4\s*\)/.test(m[0])) continue;
        bad.push(`${file}: ${m[0]}`);
      }
    }
    expect(bad, `ngày thô lọt ra giao diện:\n${bad.join("\n")}`).toEqual([]);
  });
});
