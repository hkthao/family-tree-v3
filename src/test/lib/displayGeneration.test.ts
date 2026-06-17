import { describe, expect, it } from "vitest";

import { displayGen, displayGenLabel } from "@/lib/displayGeneration";

describe("displayGeneration helpers", () => {
  it("null generation always renders as null / empty", () => {
    expect(displayGen(null)).toBeNull();
    expect(displayGen(null, 0)).toBeNull();
    expect(displayGen(null, 1)).toBeNull();
    expect(displayGenLabel(null)).toBe("");
    expect(displayGenLabel(null, 1)).toBe("");
  });

  it("offset = 0 keeps DB generation as-is (Thủy tổ là Đời 1, default)", () => {
    expect(displayGen(1, 0)).toBe(1);
    expect(displayGen(5, 0)).toBe(5);
    expect(displayGenLabel(3, 0)).toBe("Đời 3");
  });

  it("offset = 1 shifts so Thủy tổ là Đời 0", () => {
    expect(displayGen(1, 1)).toBe(0);
    expect(displayGen(2, 1)).toBe(1);
    expect(displayGen(5, 1)).toBe(4);
    expect(displayGenLabel(1, 1)).toBe("Đời 0");
    expect(displayGenLabel(4, 1)).toBe("Đời 3");
  });

  it("default offset is 0 when omitted", () => {
    expect(displayGen(2)).toBe(2);
    expect(displayGenLabel(2)).toBe("Đời 2");
  });
});
