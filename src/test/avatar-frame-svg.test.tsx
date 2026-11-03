import { describe, expect, it, vi } from "vitest";

import { avatarFrameSvg } from "@/components/PersonAvatar";

describe("avatarFrameSvg", () => {
  it("trả về ruột SVG, không cảnh báo sai chữ hoa/thường", () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const out = avatarFrameSvg("gold");
    expect(out).toContain("<linearGradient");
    expect(out.startsWith("<svg")).toBe(false);
    expect(out.endsWith("</svg>")).toBe(false);
    expect(err).not.toHaveBeenCalled();
    err.mockRestore();
  });
  it("khung lạ → chuỗi rỗng", () => {
    expect(avatarFrameSvg(null)).toBe("");
  });
});
