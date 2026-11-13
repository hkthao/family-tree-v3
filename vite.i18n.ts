import react from "@vitejs/plugin-react";
import { lingui } from "@lingui/vite-plugin";
import type { PluginOption } from "vite";

/**
 * Plugin đa ngôn ngữ DÙNG CHUNG cho `vite.config.ts` và `vitest.config.ts` — hai cấu hình phải
 * giống nhau, nếu không macro `t` / `<Trans>` biên dịch ở app nhưng vỡ khi chạy test.
 *
 * `stripMessageField: false` giữ câu tiếng Việt gốc ngay trong mã → chuỗi chưa có bản dịch luôn
 * rơi về tiếng Việt (kể cả bản production).
 */
export function reactWithLingui(): PluginOption[] {
  return [
    react({
      babel: {
        plugins: [["@lingui/babel-plugin-lingui-macro", { stripMessageField: false }]],
      },
    }),
    // Cho phép `import("…/messages.po")` — catalog được biên dịch lúc build.
    lingui(),
  ];
}
