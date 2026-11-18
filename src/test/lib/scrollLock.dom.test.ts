/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";

import { lockBodyScroll } from "@/lib/scrollLock";

describe("lockBodyScroll", () => {
  it("đóng LỆCH thứ tự (mở A, mở B, đóng A, đóng B) vẫn mở lại cuộn — trước đây body kẹt hidden", () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    a();
    expect(document.body.style.overflow).toBe("hidden");
    b();
    expect(document.body.style.overflow).toBe("");
  });

  it("nhả hai lần chỉ tính một", () => {
    const a = lockBodyScroll();
    const b = lockBodyScroll();
    a();
    a();
    expect(document.body.style.overflow).toBe("hidden");
    b();
    expect(document.body.style.overflow).toBe("");
  });
});
