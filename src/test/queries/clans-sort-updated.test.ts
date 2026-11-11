import { afterAll, describe, expect, it } from "vitest";

import { createClan, listMyClans } from "@/lib/queries/clans";

import { addMember, createTestUser, deleteUser } from "../supabase-helpers";

describe("queries: clans sort=updated (cập nhật gần đây)", () => {
  const cleanup: string[] = [];
  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("dòng họ vừa được sửa nổi lên đầu, khác với sắp theo mới tạo", async () => {
    // Mỗi người chỉ được tạo 1 dòng họ (max_clans) → B do người khác tạo rồi mời user vào.
    const user = await createTestUser({ displayName: "Sorter" });
    const other = await createTestUser({ displayName: "Other" });
    cleanup.push(user.id, other.id);
    const a = await createClan({ name: "Họ A cũ" }, user.id, user.client);
    const b = await createClan({ name: "Họ B mới" }, other.id, other.client);
    await addMember(b.id, user, "viewer");

    const params = { page: 1, pageSize: 10 } as const;
    const byNewest = await listMyClans(user.id, { ...params, sort: "newest" }, user.client);
    expect(byNewest.rows.map((r) => r.id)).toEqual([b.id, a.id]);

    // Sửa Họ A → updated_at của A mới hơn B.
    await new Promise((r) => setTimeout(r, 20));
    const { error } = await user.client
      .from("clans")
      .update({ description: "vừa sửa" })
      .eq("id", a.id);
    expect(error).toBeNull();

    const byUpdated = await listMyClans(user.id, { ...params, sort: "updated" }, user.client);
    expect(byUpdated.rows.map((r) => r.id)).toEqual([a.id, b.id]);
  });
});
