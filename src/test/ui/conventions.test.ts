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
    expect(bad, `thiếu grid-cols-… cho màn hẹp:\n${bad.join("\n")}`).toEqual(
      [],
    );
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

describe("ô chọn ngày", () => {
  it('không dùng <input type="date"> / datetime-local gốc', () => {
    // Lịch gốc hiện theo ngôn ngữ máy (tiếng Anh: "November", "Clear", "Today") và lệch style
    // với các ô khác. Dùng DatePicker / DateTimePicker (src/components/ui/date-picker.tsx).
    const bad: string[] = [];
    for (const file of FILES) {
      // Hai tệp này chỉ NHẮC tới ô gốc trong chú thích.
      if (file.includes("date-picker") || file.includes("isoDate")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(
        /\btype=["'{]+(date|datetime-local|month|week)["'}]/g,
      )) {
        bad.push(`${file}: type="${m[1]}"`);
      }
    }
    expect(
      bad,
      `dùng DatePicker thay cho ô ngày gốc:\n${bad.join("\n")}`,
    ).toEqual([]);
  });
});

describe("cỡ nút <Button> theo thang chính thức (48 / 40px)", () => {
  /** Các thẻ `<Button …>` đủ cặp ngoặc (thuộc tính JSX có `=>` và `{}` lồng nhau nên không dùng regex đơn giản). */
  function buttonTags(text: string): string[] {
    const out: string[] = [];
    const re = /<Button\b/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      let j = m.index + m[0].length;
      let depth = 0;
      let q: string | null = null;
      for (; j < text.length; j++) {
        const c = text[j];
        if (q) {
          if (c === q && text[j - 1] !== "\\") q = null;
        } else if (c === '"' || (depth > 0 && (c === "'" || c === "`"))) q = c;
        else if (c === "{") depth++;
        else if (c === "}") depth--;
        else if (c === ">" && depth === 0) break;
      }
      out.push(text.slice(m.index, j + 1));
      re.lastIndex = j;
    }
    return out;
  }

  it("không ép chiều cao lẻ (h-8 / h-9) và không khai lại cỡ có sẵn trên <Button>", () => {
    // Thang cỡ: mặc định 48 · sm 40 · icon 48 · icon-sm 40. Từng có 49 nút ép h-8/h-9/h-10 tự do nên hàng nút
    // cao thấp so le. Nút vuông nhỏ → size="icon-sm"; nút chữ nhỏ → size="sm" (không cần khai thêm h-*).
    const bad: string[] = [];
    for (const file of FILES) {
      if (!file.endsWith(".tsx")) continue;
      for (const tag of buttonTags(readFileSync(file, "utf8"))) {
        const cls = /className="([^"]*)"/.exec(tag)?.[1] ?? "";
        const size = /\bsize="([\w-]+)"/.exec(tag)?.[1];
        const heights = cls.match(/(?<![\w:-])h-(?:8|9)(?![\w-])/g);
        if (heights) bad.push(`${file}: h-8/h-9 trên Button → "${cls.trim()}"`);
        if (size === "sm" && /(?<![\w:-])h-10(?![\w-])/.test(cls)) bad.push(`${file}: size="sm" đã là h-10, bỏ h-10 → "${cls.trim()}"`);
        if (/(?<![\w:-])h-10 w-10(?![\w-])/.test(cls)) bad.push(`${file}: dùng size="icon-sm" thay cho h-10 w-10 → "${cls.trim()}"`);
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
