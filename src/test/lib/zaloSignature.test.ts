import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  safeEqual,
  signatureContent,
  zaloSignature,
} from "../../../supabase/functions/_shared/zaloSignature";

/** Chữ ký webhook Zalo: xếp tên trường a→z, nối giá trị, sha256(+ API Key). */
describe("zaloSignature", () => {
  const body = {
    userId: "4047671499938107249",
    event: "user.revoke.consent",
    timestamp: 1670553442564,
    appId: "2646373759294038927",
  };

  it("nối giá trị theo tên trường a→z, không theo thứ tự trong body", () => {
    expect(signatureContent(body)).toBe(
      "2646373759294038927" + "user.revoke.consent" + "1670553442564" + "4047671499938107249",
    );
  });

  it("giá trị object được JSON.stringify", () => {
    expect(signatureContent({ b: 1, a: { x: 1 } })).toBe('{"x":1}1');
  });

  it("là sha256 hex của nội dung + API Key", async () => {
    const want = createHash("sha256").update(signatureContent(body) + "KEY").digest("hex");
    expect(await zaloSignature(body, "KEY")).toBe(want);
  });

  it("safeEqual", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "ab")).toBe(false);
  });
});
