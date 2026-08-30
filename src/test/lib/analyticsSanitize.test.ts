import { describe, expect, it } from "vitest";

import { isAdminArea, sanitizeUrl } from "@/lib/analytics";

/**
 * Regression net for the leak found in the Aug 2026 analytics review:
 * Supabase implicit-flow tokens (hash) and capability tokens (path)
 * were being written to the analytics DB, which is readable by anyone
 * holding an Umami share link.
 */
describe("sanitizeUrl", () => {
  it("drops the hash, where Supabase puts the access token", () => {
    expect(
      sanitizeUrl("/clans", "#access_token=eyJhbGciOiJIUzI1NiJ9.payload.sig"),
    ).toBe("/clans");
  });

  it("drops a hash appended to the pathname itself", () => {
    expect(sanitizeUrl("/clans#access_token=eyJ.a.b&refresh_token=xyz")).toBe(
      "/clans",
    );
  });

  it("redacts capability tokens in the path", () => {
    expect(sanitizeUrl("/share/VYdEpWme2afChR1-OR6UgFRwZasUO9uP")).toBe(
      "/share/<token>",
    );
    expect(sanitizeUrl("/join/aea6fS1R8yDUXIFITad7AcwHCW4M5dP2")).toBe(
      "/join/<token>",
    );
    expect(sanitizeUrl("/khoe/abc123")).toBe("/khoe/<token>");
    expect(sanitizeUrl("/inlaws/confirm/abc123")).toBe(
      "/inlaws/confirm/<token>",
    );
  });

  it("keeps segments after the token", () => {
    expect(sanitizeUrl("/share/secret123/tree")).toBe("/share/<token>/tree");
  });

  it("leaves the bare prefix alone when there is no token", () => {
    expect(sanitizeUrl("/share")).toBe("/share");
  });

  it("does not redact clan ids — they are RLS-protected, not secrets", () => {
    const p = "/clans/69a6ac21-90ce-45fc-8a24-45f79521819b/people";
    expect(sanitizeUrl(p)).toBe(p);
  });

  it("redacts auth query params but keeps page state", () => {
    expect(sanitizeUrl("/login", "?next=%2Fclans&code=abc123")).toBe(
      "/login?next=%2Fclans&code=%3Credacted%3E",
    );
    expect(sanitizeUrl("/clans", "?tab=community&page=2")).toBe(
      "/clans?tab=community&page=2",
    );
  });

  it("handles a hash riding along with a query string", () => {
    expect(sanitizeUrl("/clans", "?tab=community#access_token=eyJ.a.b")).toBe(
      "/clans?tab=community",
    );
  });
});

describe("isAdminArea", () => {
  /**
   * Khu quản trị không được đếm vào số liệu sản phẩm — không phải vì
   * riêng tư mà vì số liệu SAI. Tháng 8 có một phiên 100 lượt xem
   * `/clans` + 75 lượt `/admin`: người vận hành soi bảng điều khiển,
   * nằm lẫn trong số liệu người dùng thật và làm tỉ lệ chuyển đổi đẹp
   * hơn thực tế.
   */
  it("nhận diện khu quản trị", () => {
    expect(isAdminArea("/admin")).toBe(true);
    expect(isAdminArea("/admin/cai-dat")).toBe(true);
    expect(isAdminArea("/admin/orders/123")).toBe(true);
  });

  it("KHÔNG bắt nhầm đường dẫn chỉ tình cờ bắt đầu bằng 'admin'", () => {
    // Nếu dùng startsWith("/admin") trần thì mấy đường này bị nuốt mất,
    // và ta im lặng mất số liệu của tính năng thật.
    expect(isAdminArea("/administrator")).toBe(false);
    expect(isAdminArea("/adminfoo")).toBe(false);
    expect(isAdminArea("/clans/admin")).toBe(false);
    expect(isAdminArea("/clans/x/settings")).toBe(false);
  });
});
