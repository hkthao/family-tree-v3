/**
 * @vitest-environment jsdom
 */
import { msg } from "@lingui/core/macro";
import { afterEach, describe, expect, it } from "vitest";

import { activateLocale } from "@/lib/i18n";
import { lazyMessages } from "@/lib/i18n/lazy";

// Khai báo ở MỨC MODULE, đúng như bảng nhãn thật trong mã.
const LABELS = lazyMessages({
  search: msg`Tìm kiếm`,
  other: "giữ nguyên",
  nested: { options: [{ value: "a", label: msg`Tuỳ chọn` }] },
});

describe("lazyMessages", () => {
  afterEach(async () => {
    await activateLocale("vi", false);
  });

  it("dịch theo ngôn ngữ đang dùng LÚC ĐỌC, không đóng băng lúc nạp module", async () => {
    expect(LABELS.search).toBe("Tìm kiếm");
    await activateLocale("en", false);
    expect(LABELS.search).toBe("Search");
    expect(LABELS.nested.options[0].label).toBe("Options");
    await activateLocale("vi", false);
    expect(LABELS.search).toBe("Tìm kiếm");
  });

  it("giữ nguyên giá trị không phải mô tả, và dùng được với Object.entries", () => {
    expect(LABELS.other).toBe("giữ nguyên");
    expect(Object.entries(LABELS).map(([k]) => k)).toEqual(["search", "other", "nested"]);
  });
});
