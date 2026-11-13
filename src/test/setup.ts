// Tiếng Việt là ngôn ngữ nguồn: kích hoạt sẵn để mọi chuỗi qua `t` ra đúng tiếng Việt như trước.
import "@/lib/i18n";
import { config } from "dotenv";
import { createElement } from "react";
import { expect, vi } from "vitest";
import { i18n } from "@/lib/i18n";
import * as matchers from "@testing-library/jest-dom/matchers";

// Load .env.local for SUPABASE_URL + keys
config({ path: ".env.local" });
config({ path: ".env" });

expect.extend(matchers);

// `<Trans>` (macro đa ngôn ngữ) đòi có I18nProvider; test dựng thành phần trực tiếp không có Provider.
// Bọc sẵn Provider quanh Trans để mọi test không phải tự bọc.
vi.mock("@lingui/react", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@lingui/react")>();
  return {
    ...mod,
    Trans: (props: Parameters<typeof mod.Trans>[0]) =>
      createElement(mod.I18nProvider, { i18n }, createElement(mod.Trans, props)),
  };
});
