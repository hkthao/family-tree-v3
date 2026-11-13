/**
 * @vitest-environment jsdom
 */
import { t } from "@lingui/core/macro";
import { afterEach, describe, expect, it } from "vitest";

import { activateLocale, currentLocale, detectLocale } from "@/lib/i18n";

describe("i18n", () => {
  afterEach(async () => {
    await activateLocale("vi", false);
    localStorage.clear();
  });

  it("tiếng Việt là mặc định và ra đúng câu gốc", () => {
    expect(currentLocale()).toBe("vi");
    expect(t`Tìm kiếm`).toBe("Tìm kiếm");
  });

  it("đổi sang EN dùng catalog đã dịch", async () => {
    await activateLocale("en", false);
    expect(currentLocale()).toBe("en");
    expect(t`Tìm kiếm`).toBe("Search");
    expect(document.documentElement.lang).toBe("en");
  });

  it("chuỗi chưa có bản dịch rơi về tiếng Việt, không hiện khoá", async () => {
    await activateLocale("en", false);
    expect(t`Câu này chưa có trong catalog tiếng Anh`).toBe("Câu này chưa có trong catalog tiếng Anh");
  });

  it("detectLocale: ?lang= thắng lựa chọn đã lưu; không đoán theo trình duyệt (mặc định tiếng Việt)", () => {
    localStorage.setItem("family-tree:locale", "en");
    expect(detectLocale()).toBe("en");
    window.history.pushState({}, "", "/?lang=vi");
    expect(detectLocale()).toBe("vi");
    window.history.pushState({}, "", "/");
    // Giá trị lạ đã lưu → bỏ qua. Trình duyệt báo tiếng Anh vẫn KHÔNG làm app chuyển sang tiếng Anh.
    localStorage.setItem("family-tree:locale", "xx");
    Object.defineProperty(navigator, "languages", { value: ["en-US"], configurable: true });
    expect(detectLocale()).toBe("vi");
  });
});
