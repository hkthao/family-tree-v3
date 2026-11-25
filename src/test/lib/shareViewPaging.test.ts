import { describe, expect, it } from "vitest";

import { fetchAllRows } from "../../../supabase/functions/share-view/paging";

/** Dòng họ đông hơn max_rows của PostgREST (1000) không được mất người ở cây chia sẻ. */
const source = (n: number, maxRows = Infinity) => {
  const all = Array.from({ length: n }, (_, i) => ({ id: i }));
  const calls: [number, number][] = [];
  return { calls, page: async (from: number, to: number) => (calls.push([from, to]), { data: all.slice(from, Math.min(to + 1, from + maxRows)), error: null }) };
};

describe("fetchAllRows", () => {
  it("5000 hàng → đủ 5000 qua 6 trang (trang cuối rỗng), thứ tự giữ nguyên", async () => {
    const s = source(5000, 1000);
    const r = await fetchAllRows(s.page);
    expect(r.data).toHaveLength(5000);
    expect(r.data[0].id).toBe(0);
    expect(r.data[4999].id).toBe(4999);
    expect(r.truncated).toBe(false);
    expect(s.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999], [5000, 5999]]);
  });

  it("ít hơn một trang → đúng một lần gọi; rỗng → rỗng", async () => {
    const s = source(37);
    expect((await fetchAllRows(s.page)).data).toHaveLength(37);
    expect(s.calls).toHaveLength(1);
    expect((await fetchAllRows(source(0).page)).data).toEqual([]);
  });

  it("đúng bội số của trang (2000) vẫn dừng đúng, không lặp vô hạn", async () => {
    const s = source(2000, 1000);
    expect((await fetchAllRows(s.page)).data).toHaveLength(2000);
    expect(s.calls).toHaveLength(3);
  });

  it("chốt an toàn: vượt maxRows thì cắt và báo truncated", async () => {
    const r = await fetchAllRows(source(10_000).page, { pageSize: 1000, maxRows: 3000 });
    expect(r.data).toHaveLength(3000);
    expect(r.truncated).toBe(true);
  });

  it("lỗi giữa chừng được trả ra, không nuốt", async () => {
    let n = 0;
    const r = await fetchAllRows(async () => (++n === 2 ? { data: null, error: { message: "boom" } } : { data: Array.from({ length: 1000 }, (_, i) => i), error: null }));
    expect(r.error).toEqual({ message: "boom" });
  });
});
