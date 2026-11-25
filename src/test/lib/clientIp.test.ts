import { describe, expect, it } from "vitest";

import {
  clientIp,
  isPrivateIp,
} from "../../../supabase/functions/_shared/clientIp";

/**
 * Sau proxy Docker (userland-proxy) mọi khách có cùng IP nội bộ → trần "theo IP" thành trần TOÀN HỆ THỐNG. isPrivateIp nhận ra tình huống đó
 * để các function nới / bỏ trần theo IP thay vì khoá cả hệ thống.
 */
const H = (h: Record<string, string>) => ({
  get: (k: string) => h[k.toLowerCase()] ?? null,
});

describe("isPrivateIp", () => {
  it("địa chỉ nội bộ / không biết → true", () => {
    for (const ip of [
      "172.18.0.1",
      "172.16.0.5",
      "172.31.255.255",
      "10.0.0.8",
      "192.168.1.9",
      "127.0.0.1",
      "169.254.1.1",
      "100.64.0.1",
      "::1",
      "fd12::1",
      "fe80::1",
      "::ffff:172.18.0.1",
      "unknown",
      "",
      "rác",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });
  it("địa chỉ công khai → false", () => {
    for (const ip of [
      "8.8.8.8",
      "203.0.113.7",
      "172.15.0.1",
      "172.32.0.1",
      "192.169.0.1",
      "2001:db8::1",
      "::ffff:8.8.8.8",
    ]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });
});

describe("clientIp", () => {
  it("lấy IP đầu của X-Forwarded-For; rồi X-Real-IP; không có thì unknown", () => {
    expect(clientIp(H({ "x-forwarded-for": "8.8.8.8, 172.18.0.1" }))).toBe(
      "8.8.8.8",
    );
    expect(clientIp(H({ "x-real-ip": "9.9.9.9" }))).toBe("9.9.9.9");
    expect(clientIp(H({}))).toBe("unknown");
    expect(clientIp(H({ "x-forwarded-for": " " }))).toBe("unknown");
  });
});
