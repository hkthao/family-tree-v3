import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  adminClient,
  anonClient,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * RLS cho bảng `podcast_episodes`.
 *
 * Bảng này khác các bảng khác ở một điểm dễ sai: nội dung là của NỀN TẢNG,
 * không thuộc dòng họ nào, và cố ý cho khách chưa đăng nhập đọc — podcast
 * là thứ để lan ra ngoài. Nhưng "đọc được" chỉ áp dụng cho tập ĐANG HIỆN:
 * tập admin đã ẩn thì phải kín, kể cả với người đã đăng nhập.
 */
describe("RLS: podcast_episodes", () => {
  let admin: TestUser;
  let user: TestUser;
  let visibleId: string;
  let hiddenId: string;

  beforeAll(async () => {
    admin = await createTestUser({
      displayName: "PodAdmin",
      isPlatformAdmin: true,
    });
    user = await createTestUser({ displayName: "PodUser" });

    await adminClient()
      .from("podcast_episodes")
      .delete()
      .gte("created_at", "1970-01-01");

    const { data, error } = await adminClient()
      .from("podcast_episodes")
      .insert([
        {
          fb_video_id: "vis-1",
          title: "Tập đang hiện",
          permalink_url: "https://www.facebook.com/reel/1/",
          published_at: new Date().toISOString(),
          is_visible: true,
        },
        {
          fb_video_id: "hid-1",
          title: "Tập đã ẩn",
          permalink_url: "https://www.facebook.com/reel/2/",
          published_at: new Date().toISOString(),
          is_visible: false,
        },
      ])
      .select("id, fb_video_id");
    if (error) throw new Error(error.message);
    visibleId = data!.find((r) => r.fb_video_id === "vis-1")!.id;
    hiddenId = data!.find((r) => r.fb_video_id === "hid-1")!.id;
  });

  afterAll(async () => {
    await adminClient()
      .from("podcast_episodes")
      .delete()
      .gte("created_at", "1970-01-01");
    await deleteUser(admin.id);
    await deleteUser(user.id);
  });

  it("khách chưa đăng nhập đọc được tập đang hiện", async () => {
    // Cố ý mở cho anon: link podcast chia sẻ ra Zalo/Facebook mà bắt đăng
    // nhập mới nghe được thì chẳng ai nghe.
    const { data, error } = await anonClient()
      .from("podcast_episodes")
      .select("id, title");
    expect(error).toBeNull();
    expect(data?.map((r) => r.id)).toEqual([visibleId]);
  });

  it("tập đã ẩn thì kín với cả khách lẫn người đã đăng nhập", async () => {
    const anon = await anonClient()
      .from("podcast_episodes")
      .select("id")
      .eq("id", hiddenId);
    expect(anon.data).toEqual([]);

    const member = await user.client
      .from("podcast_episodes")
      .select("id")
      .eq("id", hiddenId);
    expect(member.data).toEqual([]);
  });

  it("platform admin thấy cả tập đã ẩn", async () => {
    const { data } = await admin.client
      .from("podcast_episodes")
      .select("id")
      .eq("id", hiddenId);
    expect(data?.length).toBe(1);
  });

  it("người dùng thường KHÔNG sửa được tập", async () => {
    // Không có cái này thì ai đăng nhập cũng đổi được tiêu đề podcast của
    // cả nền tảng.
    const { error } = await user.client
      .from("podcast_episodes")
      .update({ title: "Đổi trộm" })
      .eq("id", visibleId);
    const { data: after } = await adminClient()
      .from("podcast_episodes")
      .select("title")
      .eq("id", visibleId)
      .single();
    expect(after?.title).toBe("Tập đang hiện");
    void error; // RLS chặn im lặng (0 dòng) hoặc báo lỗi — cái nào cũng được
  });

  it("người dùng thường KHÔNG thêm/xoá được tập", async () => {
    const ins = await user.client.from("podcast_episodes").insert({
      fb_video_id: "lau-1",
      title: "Tập lậu",
      permalink_url: "https://www.facebook.com/reel/9/",
      published_at: new Date().toISOString(),
    });
    expect(ins.error).not.toBeNull();

    await user.client.from("podcast_episodes").delete().eq("id", visibleId);
    const { data: still } = await adminClient()
      .from("podcast_episodes")
      .select("id")
      .eq("id", visibleId);
    expect(still?.length).toBe(1);
  });

  it("admin sửa được tiêu đề và ẩn/hiện", async () => {
    const { error } = await admin.client
      .from("podcast_episodes")
      .update({ title: "Tiêu đề biên tập", title_edited: true })
      .eq("id", visibleId);
    expect(error).toBeNull();
    const { data } = await adminClient()
      .from("podcast_episodes")
      .select("title, title_edited")
      .eq("id", visibleId)
      .single();
    expect(data?.title).toBe("Tiêu đề biên tập");
    expect(data?.title_edited).toBe(true);
  });

  it("trùng id video bên Facebook thì bị chặn — đồng bộ lại không nhân bản", async () => {
    const { error } = await adminClient().from("podcast_episodes").insert({
      fb_video_id: "vis-1",
      title: "Bản trùng",
      permalink_url: "https://www.facebook.com/reel/1/",
      published_at: new Date().toISOString(),
    });
    expect(error).not.toBeNull();
  });
});

/**
 * Bảng token Facebook: cách bảo vệ mạnh nhất của nó là KHÔNG CÓ POLICY NÀO.
 * Test này giữ đúng điều đó — một policy "tiện tay" thêm vào sau này là đủ
 * để token đọc được Trang rơi vào tay bất kỳ ai đăng nhập.
 */
describe("RLS: fb_page_credentials", () => {
  let admin: TestUser;
  let user: TestUser;

  beforeAll(async () => {
    admin = await createTestUser({
      displayName: "FbAdmin",
      isPlatformAdmin: true,
    });
    user = await createTestUser({ displayName: "FbUser" });
    await adminClient().from("fb_page_credentials").delete().neq("page_id", "");
    const { error } = await adminClient().from("fb_page_credentials").insert({
      page_id: "111",
      page_name: "Trang thử",
      ciphertext: "YmFuIG1hIGdpYQ==",
      hint: "••••abcd",
      is_active: true,
    });
    if (error) throw new Error(error.message);
  });

  afterAll(async () => {
    await adminClient().from("fb_page_credentials").delete().neq("page_id", "");
    await deleteUser(admin.id);
    await deleteUser(user.id);
  });

  it("KHÔNG ai đọc được bản mã qua API — kể cả platform admin", async () => {
    for (const [who, client] of [
      ["khách", anonClient()],
      ["người dùng", user.client],
      ["platform admin", admin.client],
    ] as const) {
      const { data, error } = await client
        .from("fb_page_credentials")
        .select("ciphertext");
      // Hoặc bị chặn hẳn, hoặc trả 0 dòng — cái nào cũng được, miễn là
      // KHÔNG có bản mã nào lọt ra.
      expect(data ?? [], `${who} không được thấy bản mã`).toEqual([]);
      void error;
    }
  });

  it("admin xem được trạng thái qua RPC, và trong đó không có token", async () => {
    const { data, error } = await admin.client.rpc(
      "fb_page_credentials_status",
    );
    expect(error).toBeNull();
    expect(data?.length).toBe(1);
    const row = data![0] as Record<string, unknown>;
    expect(row.page_name).toBe("Trang thử");
    expect(row.hint).toBe("••••abcd");
    expect(Object.keys(row)).not.toContain("ciphertext");
  });

  it("người dùng thường gọi RPC đó thì bị từ chối", async () => {
    const { error } = await user.client.rpc("fb_page_credentials_status");
    expect(error).not.toBeNull();
  });
});
