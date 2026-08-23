import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Repo này là mã nguồn mở, nên **địa chỉ máy chủ và đường dẫn hạ tầng
 * không được nằm trong file được git theo dõi**.
 *
 * Không phải lo xa: đã từng lọt thật — IP của VPS xuất hiện trong README
 * của landing, trong plan, và tệ nhất là trong một màn hình React nên nó
 * đi thẳng vào bundle trình duyệt công khai.
 *
 * Dọn một lần thì lần sau lại lọt. Test này là cái chốt.
 *
 * Chi tiết hạ tầng thật để ở doc vận hành NGOÀI repo (hoặc file đã
 * .gitignore). Trong repo dùng placeholder `<host>`, `<supabase-dir>`.
 */

/** Chỉ quét file git theo dõi — file local chưa commit thì không sao. */
function trackedFiles(): string[] {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

const SKIP = [
  /^package-lock\.json$/,
  /\.svg$/, // toạ độ path trông giống IP
  /\.(png|jpe?g|webp|ico|woff2?|pdf|mp4)$/i,
  /^src\/test\/lib\/noInfraSecrets\.test\.ts$/, // chính nó
];

interface Rule {
  name: string;
  re: RegExp;
  /** Giá trị local/ví dụ được phép. */
  allow?: RegExp;
  /** File khớp thì bỏ qua rule này (không bỏ qua các rule khác). */
  allowIn?: RegExp;
}

const RULES: Rule[] = [
  {
    name: "địa chỉ IPv4 công khai",
    re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
    // Loopback, 0.0.0.0 và dải private là vô hại.
    allow: /^(127\.|0\.0\.0\.0$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/,
  },
  { name: "hostname VPS nhà cung cấp", re: /srv\d{6,}|hstgr\.cloud/gi },
  { name: "bí danh SSH nội bộ", re: /\bfamily-tree-db\b/g },
  {
    name: "đường dẫn tuyệt đối trên máy chủ",
    re: /\/root\/[a-z-]+/g,
    // Workflow deploy buộc phải biết thư mục đích, và `/root/supabase`
    // đúng là đường dẫn mặc định trong tài liệu self-host của Supabase —
    // không có ĐỊA CHỈ MÁY CHỦ (nằm trong secret) thì nó vô dụng.
    //
    // Vẫn chặn ở mọi nơi khác: mã ứng dụng đi vào bundle trình duyệt,
    // README và docs thì được đọc trực tiếp trên GitHub. Chính một
    // component React từng làm lộ `root@<ip>:/root/supabase/...`.
    allowIn: /^\.github\/workflows\//,
  },
];

describe("không rò thông tin hạ tầng vào mã nguồn mở", () => {
  const files = trackedFiles().filter((f) => !SKIP.some((re) => re.test(f)));

  it("quét được danh sách file (chống test pass giả)", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(RULES)("không có $name", ({ re, allow, allowIn }) => {
    const hits: string[] = [];
    for (const file of files) {
      if (allowIn?.test(file)) continue;
      let text: string;
      try {
        text = readFileSync(file, "utf8");
      } catch {
        continue; // file nhị phân
      }
      for (const m of text.matchAll(re)) {
        const value = m[0];
        if (allow?.test(value)) continue;
        // Số phiên bản 4 nhóm (17.6.1.127) không phải IP — loại bằng
        // cách yêu cầu mỗi nhóm ≤ 255 và cả chuỗi không nằm cạnh chữ.
        if (/^\d+(\.\d+){3}$/.test(value)) {
          const parts = value.split(".").map(Number);
          if (parts.some((n) => n > 255)) continue;
        }
        const line = text.slice(0, m.index).split("\n").length;
        hits.push(`${file}:${line} → ${value}`);
      }
    }
    expect(
      hits,
      `Thông tin hạ tầng bị lộ trong file được git theo dõi:\n  ${hits.join(
        "\n  ",
      )}\nDùng placeholder <host> / <supabase-dir>, để chi tiết thật ở doc ngoài repo.`,
    ).toEqual([]);
  });
});
