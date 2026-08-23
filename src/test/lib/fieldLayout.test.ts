import { describe, expect, it } from "vitest";

import { splitFieldClasses } from "@/components/ui/field-layout";

/**
 * Ô nhập có icon được bọc trong một div `relative`. Nếu class chiều
 * ngang rơi vào ô mà không rơi vào khung, khung vẫn rộng hết cỡ còn ô
 * co lại → icon và mũi tên neo theo khung, trôi ra xa ô. Đúng lỗi đã
 * thấy ở "Model cho hỏi đáp" (`max-w-sm`).
 */
describe("splitFieldClasses", () => {
  it("đưa class chiều ngang ra khung, giữ phần còn lại ở ô", () => {
    const r = splitFieldClasses("max-w-sm h-11 font-mono");
    expect(r.wrapper).toBe("max-w-sm");
    expect(r.field).toBe("h-11 font-mono");
  });

  it("nhận cả flex-1, min-w, w-auto, ml — những thứ quyết định chỗ đứng", () => {
    const r = splitFieldClasses("flex-1 min-w-[160px] w-auto ml-1 text-sm");
    expect(r.wrapper.split(" ").sort()).toEqual(
      ["flex-1", "min-w-[160px]", "ml-1", "w-auto"].sort(),
    );
    expect(r.field).toBe("text-sm");
  });

  it("giữ nguyên tiền tố responsive", () => {
    const r = splitFieldClasses("sm:w-48 h-10");
    expect(r.wrapper).toBe("sm:w-48");
    expect(r.field).toBe("h-10");
  });

  it("không nhầm class chỉ TRÔNG giống chiều ngang", () => {
    const r = splitFieldClasses("whitespace-nowrap shrink-0");
    expect(r.wrapper).toBe("shrink-0");
    expect(r.field).toBe("whitespace-nowrap");
  });

  it("không có class thì trả rỗng", () => {
    expect(splitFieldClasses()).toEqual({ wrapper: "", field: "" });
  });
});
