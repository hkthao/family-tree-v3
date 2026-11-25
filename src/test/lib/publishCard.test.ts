import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
const upsert = vi.fn();
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: { getUser: async () => ({ data: { user: { id: "u1" } } }) },
    storage: { from: () => ({ upload: (...a: unknown[]) => upload(...a), getPublicUrl: (p: string) => ({ data: { publicUrl: `https://st/${p}` } }) }) },
    from: () => ({ upsert: (...a: unknown[]) => upsert(...a) }),
  },
}));

import { publishKhoeCard } from "@/lib/cards/publishCard";

const base = { token: "tok", clanId: "c1", blob: new Blob(["png"]), title: "T", ttlDays: 7 };
beforeEach(() => {
  upload.mockReset().mockResolvedValue({ error: null });
  upsert.mockReset().mockResolvedValue({ error: null });
});

describe("publishKhoeCard — ảnh OG", () => {
  it("có ogBlob: tải thêm JPEG vào <clan>/<token>-og.jpg và lưu og_image_path", async () => {
    await publishKhoeCard({ ...base, ogBlob: new Blob(["jpg"]) });
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0]).toBe("c1/tok.png");
    expect(upload.mock.calls[1]).toEqual(["c1/tok-og.jpg", expect.any(Blob), { contentType: "image/jpeg", upsert: true }]);
    expect(upsert.mock.calls[0][0]).toMatchObject({ image_path: "c1/tok.png", og_image_path: "c1/tok-og.jpg" });
  });

  it("không có ogBlob: chỉ ảnh thiệp, og_image_path = null", async () => {
    await publishKhoeCard(base);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(upsert.mock.calls[0][0].og_image_path).toBeNull();
  });

  it("tải ảnh OG lỗi: thiệp vẫn lưu, og_image_path = null (không làm hỏng chia sẻ)", async () => {
    upload.mockResolvedValueOnce({ error: null }).mockResolvedValueOnce({ error: { message: "quota" } });
    await publishKhoeCard({ ...base, ogBlob: new Blob(["jpg"]) });
    expect(upsert.mock.calls[0][0].og_image_path).toBeNull();
  });

  it("tải ảnh thiệp chính lỗi: ném lỗi, không ghi dòng card_shares", async () => {
    upload.mockResolvedValueOnce({ error: { message: "denied" } });
    await expect(publishKhoeCard(base)).rejects.toThrow("denied");
    expect(upsert).not.toHaveBeenCalled();
  });
});
