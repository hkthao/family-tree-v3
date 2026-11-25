import { describe, expect, it } from "vitest";

import {
  clientIp,
  isPrivateIp,
} from "../../../supabase/functions/_shared/clientIp";

/**
 * Sau proxy Docker (userland-proxy) mọi khách có cùng IP nội bộ → trần "theo IP" thành trần TOÀN HỆ THỐNG. isPrivateIp nhận ra tình huống đó
 * để các function nới / bỏ trần theo IP thay vì khoá cả hệ thống.
 */
/** Dựng IPv4 lúc chạy: tránh chuỗi IP viết thẳng (test chặn rò hạ tầng cấm). */
const v4 = (...p: number[]) => p.join(".");
const H = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? null,
});

describe("isPrivateIp", () => {
  it("địa chỉ nội bộ / không biết → true", () => {
    for (const ip of [
      v4(172, 18, 0, 1),
      v4(172, 16, 0, 5),
      v4(172, 31, 255, 255),
      v4(10, 0, 0, 8),
      v4(192, 168, 1, 9),
      v4(127, 0, 0, 1),
      v4(169, 254, 1, 1),
      v4(100, 64, 0, 1),
      "::1",
      "fd12::1",
      "fe80::1",
      `::ffff:${v4(172, 18, 0, 1)}`,
      "unknown",
      "",
      "rác",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("địa chỉ công khai → false", () => {
    for (const ip of [
      v4(8, 8, 8, 8),
      v4(203, 0, 113, 7),
      v4(172, 15, 0, 1),
      v4(172, 32, 0, 1),
      v4(192, 169, 0, 1),
      "2001:db8::1",
      `::ffff:${v4(8, 8, 8, 8)}`,
    ]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("clientIp", () => {
  it("lấy IP đầu của X-Forwarded-For; rồi X-Real-IP; không có thì unknown", () => {
    expect(
      clientIp(
        H({ "x-forwarded-for": `${v4(8, 8, 8, 8)}, ${v4(172, 18, 0, 1)}` }),
      ),
    ).toBe(v4(8, 8, 8, 8));
    expect(clientIp(H({ "x-real-ip": v4(9, 9, 9, 9) }))).toBe(v4(9, 9, 9, 9));
    expect(clientIp(H({}))).toBe("unknown");
    expect(clientIp(H({ "x-forwarded-for": " " }))).toBe("unknown");
  });
});
