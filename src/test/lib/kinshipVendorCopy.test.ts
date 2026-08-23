import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Edge Function không import được `src/lib/*.ts` — deploy chỉ scp thư
 * mục `supabase/functions/`, nên bất cứ import nào trỏ ra ngoài đều
 * không được đóng gói theo. Vì vậy có vài bản sao trong `_shared/vendor/`.
 *
 * Bản sao là nợ kỹ thuật. Test này giữ cho chúng không trôi: sửa bản gốc
 * mà quên chép sang thì fail ngay ở đây, chứ không phải phát hiện khi trợ
 * lý AI trả lời sai cách xưng hô hay sai ngày giỗ trên production.
 */

interface VendorFile {
  source: string;
  vendor: string;
  marker: string;
  /** Khác biệt được phép, áp lên bản GỐC trước khi so sánh. */
  rewrites?: Array<[from: string, to: string]>;
}

const VENDORED: VendorFile[] = [
  {
    source: "src/lib/kinship.ts",
    vendor: "supabase/functions/_shared/vendor/kinship.ts",
    marker: "// ─── nguyên văn src/lib/kinship.ts ─",
  },
  {
    source: "src/lib/lunarDate.ts",
    vendor: "supabase/functions/_shared/vendor/lunarDate.ts",
    marker: "// ─── nguyên văn src/lib/lunarDate.ts ─",
    // Deno cần specifier npm:. Đây là khác biệt DUY NHẤT được phép.
    rewrites: [
      ['from "@dqcai/vn-lunar";', 'from "npm:@dqcai/vn-lunar@1.0.1";'],
    ],
  },
];

describe.each(VENDORED)("bản sao $vendor", ({ source, vendor, marker, rewrites }) => {
  it("giống bản gốc (bỏ khối chú thích đầu file)", () => {
    let expected = readFileSync(source, "utf8");
    for (const [from, to] of rewrites ?? []) {
      expect(
        expected.includes(from),
        `Bản gốc ${source} không còn chứa "${from}" — cập nhật lại rewrites trong test.`,
      ).toBe(true);
      expected = expected.replace(from, to);
    }

    const copy = readFileSync(vendor, "utf8");
    const at = copy.indexOf(marker);
    expect(
      at,
      `Không thấy dấu mốc trong ${vendor}. Chép lại từ ${source} rồi chèn lại khối chú thích.`,
    ).toBeGreaterThan(-1);

    const body = copy.slice(copy.indexOf("\n", at) + 1);
    expect(
      body,
      `${vendor} đã trôi khỏi ${source}. Chép lại rồi chèn khối chú thích và các rewrite ở đầu.`,
    ).toBe(expected);
  });

  it("còn cảnh báo không-sửa-ở-đây ở đầu file", () => {
    expect(readFileSync(vendor, "utf8").slice(0, 200)).toContain(
      "KHÔNG SỬA Ở ĐÂY",
    );
  });
});
