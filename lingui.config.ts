import { defineConfig } from "@lingui/cli";
import { formatter } from "@lingui/format-po";

/**
 * Đa ngôn ngữ — xem docs/plan-da-ngon-ngu.md.
 *
 * Tiếng Việt là ngôn ngữ NGUỒN: chính câu tiếng Việt trong mã là khoá, nên tiếng Việt không cần
 * catalog riêng và mọi chuỗi chưa dịch tự rơi về tiếng Việt. Thêm ngôn ngữ mới = thêm mã vào
 * `locales` + tệp `src/locales/<mã>/messages.po` + một dòng trong `src/lib/i18n/locales.ts`.
 *
 * Trích chuỗi:  npm run i18n:extract    (cập nhật các tệp .po, giữ bản dịch cũ)
 */
export default defineConfig({
  sourceLocale: "vi",
  locales: ["vi", "en"],
  fallbackLocales: { default: "vi" },
  // Không ghi số dòng (#: file:dòng) vào .po: mỗi lần sửa mã sẽ làm đổi cả tệp dịch, diff rất nhiễu.
  format: formatter({ lineNumbers: false }),
  catalogs: [
    {
      path: "<rootDir>/src/locales/{locale}/messages",
      include: ["<rootDir>/src"],
      exclude: ["**/node_modules/**", "<rootDir>/src/test/**", "**/*.test.*"],
    },
  ],
});
