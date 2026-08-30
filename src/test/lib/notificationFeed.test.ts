import { describe, expect, it } from "vitest";

import { mergeFeed, unreadTotal } from "@/lib/notificationFeed";
import type { InboxItem } from "@/lib/queries/notifications";

/**
 * Cái chuông gộp hai nguồn: thông báo nền tảng (admin viết, ai cũng
 * thấy) và hộp thư riêng (đúng những gì đã gửi cho chính người này).
 * Sắp xếp và đếm chưa đọc là hai chỗ dễ sai mà lại khó thấy bằng mắt.
 */

const ann = (id: string, at: string | null, title = id) => ({
  id,
  title,
  body: null,
  published_at: at,
  level: "info" as const,
});

const inbox = (
  id: string,
  at: string,
  read = false,
  url: string | null = "/clans/x/events",
): InboxItem => ({
  id,
  title: `Nhắc ${id}`,
  body: "Ngày 2026-09-05.",
  url,
  sent_at: at,
  read_at: read ? at : null,
  channel: "email",
});

describe("mergeFeed", () => {
  it("trộn hai nguồn, mới nhất lên đầu", () => {
    const rows = mergeFeed(
      [ann("a1", "2026-08-01T00:00:00Z"), ann("a2", "2026-08-20T00:00:00Z")],
      new Set(),
      [inbox("n1", "2026-08-10T00:00:00Z"), inbox("n2", "2026-08-30T00:00:00Z")],
    );
    expect(rows.map((r) => r.id)).toEqual(["n2", "a2", "n1", "a1"]);
  });

  it("id trùng nhau giữa hai nguồn vẫn có khoá riêng", () => {
    // Hai bảng khác nhau nên id hoàn toàn có thể trùng; dùng id làm khoá
    // React là mất một dòng và không ai hiểu vì sao.
    const rows = mergeFeed([ann("x", "2026-08-01T00:00:00Z")], new Set(), [
      inbox("x", "2026-08-02T00:00:00Z"),
    ]);
    expect(new Set(rows.map((r) => r.key)).size).toBe(2);
  });

  it("tin chưa xuất bản xuống CUỐI, không nhảy lên đầu", () => {
    // Date.parse(null) ra NaN, mà NaN trong hàm so sánh làm loạn cả thứ
    // tự chứ không chỉ sai một dòng.
    const rows = mergeFeed(
      [ann("nháp", null), ann("cũ", "2026-01-01T00:00:00Z")],
      new Set(),
      [inbox("mới", "2026-08-30T00:00:00Z")],
    );
    expect(rows.map((r) => r.id)).toEqual(["mới", "cũ", "nháp"]);
  });

  it("đọc rồi thì đánh dấu đã đọc, từ đúng nguồn của nó", () => {
    const rows = mergeFeed(
      [ann("a1", "2026-08-01T00:00:00Z")],
      new Set(["a1"]),
      [inbox("n1", "2026-08-02T00:00:00Z", true), inbox("n2", "2026-08-03T00:00:00Z")],
    );
    expect(rows.find((r) => r.id === "a1")?.read).toBe(true);
    expect(rows.find((r) => r.id === "n1")?.read).toBe(true);
    expect(rows.find((r) => r.id === "n2")?.read).toBe(false);
  });

  it("giữ đường dẫn của hộp thư riêng để bấm vào đúng chỗ", () => {
    const rows = mergeFeed([], new Set(), [
      inbox("n1", "2026-08-02T00:00:00Z", false, "/clans/abc/events"),
    ]);
    expect(rows[0].url).toBe("/clans/abc/events");
    expect(rows[0].kind).toBe("inbox");
  });

  it("hai nguồn rỗng thì không sinh dòng rác", () => {
    expect(mergeFeed([], new Set(), [])).toEqual([]);
  });
});

describe("unreadTotal", () => {
  it("cộng cả hai nguồn — người dùng chỉ thấy một con số", () => {
    expect(unreadTotal(2, 3)).toBe(5);
  });

  it("số âm (lỗi đếm) không làm tổng nhỏ đi", () => {
    expect(unreadTotal(-5, 3)).toBe(3);
  });
});
