import { describe, expect, it } from "vitest";

import { norm, resolveClanInput, type ClanBrief } from "../../../mcp-server/src/clans";

const c = (id: string, name: string, n = 10, description: string | null = null): ClanBrief => ({ id, name, description, person_count: n });
const A = c("11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "Dòng họ Huỳnh", 1200, "Đắk Lắk");
const B = c("22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "Họ Huỳnh Văn", 45, "Hà Nội");
const C = c("33333333-cccc-4ccc-8ccc-cccccccccccc", "Dòng họ Đỗ", 50);

describe("norm", () => {
  it("bỏ dấu, đ→d, thường hoá, gộp khoảng trắng", () => {
    expect(norm("  Dòng   HỌ Đỗ ")).toBe("dong ho do");
  });
});

describe("resolveClanInput", () => {
  it("tên không dấu / sai hoa thường vẫn khớp, ưu tiên khớp chính xác", () => {
    expect(resolveClanInput([A, C], "do")).toEqual({ id: C.id });
    expect(resolveClanInput([A, B, C], "dong ho huynh")).toEqual({ id: A.id });
    expect(resolveClanInput([A, C], "HUỲNH")).toEqual({ id: A.id });
  });
  it("mơ hồ → liệt kê ứng viên kèm mô tả, số người, mã ngắn", () => {
    const r = resolveClanInput([A, B, C], "huynh");
    expect("error" in r && r.error).toContain("2 dòng họ khớp");
    expect("error" in r && r.error).toContain("Đắk Lắk");
    expect("error" in r && r.error).toContain("1200 người");
    expect("error" in r && r.error).toContain("mã 11111111");
  });
  it("không khớp → báo và liệt kê các họ được phép", () => {
    const r = resolveClanInput([A, C], "Nguyễn");
    expect("error" in r && r.error).toContain("Dòng họ Đỗ");
  });
  it("nhận mã đầy đủ hoặc 8 ký tự đầu, nhưng chỉ trong danh sách được phép", () => {
    expect(resolveClanInput([A, C], A.id)).toEqual({ id: A.id });
    expect(resolveClanInput([A, C], "33333333")).toEqual({ id: C.id });
    expect("error" in resolveClanInput([A], C.id)).toBe(true);
  });
  it("không nói gì: một họ thì dùng luôn, nhiều họ thì phải chỉ rõ", () => {
    expect(resolveClanInput([A], undefined)).toEqual({ id: A.id });
    expect("error" in resolveClanInput([A, C], "")).toBe(true);
  });
  it("tên trùng hệt nhau → mơ hồ, không tự chọn", () => {
    const r = resolveClanInput([A, c("44444444-dddd-4ddd-8ddd-dddddddddddd", "Dòng họ Huỳnh", 3)], "Dòng họ Huỳnh");
    expect("error" in r).toBe(true);
  });
});
