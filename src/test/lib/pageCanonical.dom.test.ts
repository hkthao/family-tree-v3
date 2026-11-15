/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from "vitest";

import { SITE_ORIGIN, applyDocumentMeta } from "@/lib/pageTitle";

/**
 * index.html chỉ có canonical của TRANG CHỦ; nếu không đặt lại theo từng trang thì mọi trang công khai bị công cụ
 * tìm kiếm / AI coi là bản sao của trang chủ.
 */
describe("applyDocumentMeta — canonical và og:url", () => {
  beforeEach(() => {
    document.head.innerHTML =
      '<link rel="canonical" href="https://giapha.thaohk.com/" />';
    window.history.pushState({}, "", "/docs/lich-am-duong?x=1#top");
  });

  const canonical = () =>
    document.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  it("đặt canonical theo đường dẫn trang, bỏ query và hash, dùng tên miền production", () => {
    applyDocumentMeta({ title: "Lịch âm dương" });
    expect(canonical()?.href).toBe(`${SITE_ORIGIN}/docs/lich-am-duong`);
    expect(
      document
        .querySelector('meta[property="og:url"]')
        ?.getAttribute("content"),
    ).toBe(`${SITE_ORIGIN}/docs/lich-am-duong`);
  });

  it("trang chủ: không thừa dấu / ở cuối cho đường dẫn con, giữ nguyên '/' cho gốc", () => {
    window.history.pushState({}, "", "/");
    applyDocumentMeta({ title: "Trang chủ" });
    expect(canonical()?.href).toBe(`${SITE_ORIGIN}/`);
    window.history.pushState({}, "", "/so-tay/");
    applyDocumentMeta({ title: "Sổ tay" });
    expect(canonical()?.href).toBe(`${SITE_ORIGIN}/so-tay`);
  });

  it("trang noindex: gỡ canonical", () => {
    applyDocumentMeta({ title: "Chia sẻ", noindex: true });
    expect(canonical()).toBeNull();
  });

  it("chưa có thẻ canonical thì tự tạo", () => {
    document.head.innerHTML = "";
    applyDocumentMeta({ title: "Hướng dẫn" });
    expect(canonical()?.href).toBe(`${SITE_ORIGIN}/docs/lich-am-duong`);
  });
});
