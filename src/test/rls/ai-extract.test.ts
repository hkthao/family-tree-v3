import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { applyProposal, type Proposal } from "@/lib/queries/aiExtract";
import {
  addMember,
  createTestClan,
  createTestUser,
  deleteUser,
  type TestUser,
} from "../supabase-helpers";

/**
 * Ghi thật vào gia phả từ đề xuất của trợ lý (GĐ 5).
 *
 * Đây là đoạn code rủi ro nhất của cả plan — nó chạm dữ liệu gia phả —
 * nên phải chạy trên database thật chứ không mock: quan hệ cha/con/vợ
 * chồng nằm ở bảng `families` và mấy RPC gán quan hệ, mock thì chỉ chứng
 * minh được là mình gọi đúng hàm, không chứng minh được cây họ ra đúng.
 *
 * Ca quan trọng nhất là ca cuối: **người xem không ghi được**. Máy chủ đã
 * không đưa tool đề xuất cho họ, nhưng nếu chỉ dựa vào đó thì một client
 * tự chế vẫn ghi được — RLS mới là lớp chặn thật.
 */
describe("applyProposal — ghi người từ đề xuất của trợ lý", () => {
  let owner: TestUser;
  let viewer: TestUser;
  let clanId: string;
  let anchorId: string;

  beforeAll(async () => {
    owner = await createTestUser({ displayName: "ExtractOwner" });
    viewer = await createTestUser({ displayName: "ExtractViewer" });
    clanId = await createTestClan(owner, { name: "Họ Bóc Tách" });
    await addMember(clanId, viewer, "viewer");

    const { data, error } = await owner.client
      .from("persons")
      .insert({
        clan_id: clanId,
        full_name: "Nguyễn Văn Tổ",
        gender: "M",
        is_root: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    anchorId = data.id;
  });

  afterAll(async () => {
    await deleteUser(owner.id);
    await deleteUser(viewer.id);
  });

  it("thêm con vào người đã có, kèm năm sinh chỉ biết tới năm", async () => {
    const proposal: Proposal = {
      people: [
        {
          tempId: "p1",
          fullName: "Nguyễn Văn Con",
          gender: "M",
          birthYear: 1970,
          deathYear: null,
          relation: "child",
          relatedTo: anchorId,
          note: null,
        },
      ],
    };

    const res = await applyProposal(clanId, proposal, owner.client);
    expect(res.added).toBe(1);

    const { data } = await owner.client
      .from("persons")
      .select("full_name, birth_date, birth_date_precision, birth_family_id")
      .eq("full_name", "Nguyễn Văn Con")
      .single();
    expect(data?.birth_date).toBe("1970-01-01");
    // Chỉ biết năm thì phải ghi rõ là chỉ biết năm, không giả vờ biết ngày.
    expect(data?.birth_date_precision).toBe("year");
    expect(data?.birth_family_id).not.toBeNull();
  });

  it("người sau gắn được vào người vừa tạo trong cùng một đề xuất", async () => {
    // "Ông A có con là B, B có con là C" — C phải chờ B có id thật.
    const proposal: Proposal = {
      people: [
        {
          tempId: "b",
          fullName: "Trần Thị Dâu",
          gender: "F",
          birthYear: null,
          deathYear: null,
          relation: "spouse",
          relatedTo: anchorId,
          note: null,
        },
        {
          tempId: "c",
          fullName: "Trần Văn Cháu",
          gender: "M",
          birthYear: null,
          deathYear: null,
          relation: "child",
          relatedTo: "b",
          note: null,
        },
      ],
    };

    const res = await applyProposal(clanId, proposal, owner.client);
    expect(res.added).toBe(2);

    const { data: child } = await owner.client
      .from("persons")
      .select("id, birth_family_id")
      .eq("full_name", "Trần Văn Cháu")
      .single();
    expect(child?.birth_family_id).not.toBeNull();

    // Gia đình của cháu phải có mẹ là người vừa được tạo ở bước trước.
    const { data: mother } = await owner.client
      .from("persons")
      .select("id")
      .eq("full_name", "Trần Thị Dâu")
      .single();
    const { data: family } = await owner.client
      .from("families")
      .select("wife_id")
      .eq("id", child!.birth_family_id!)
      .single();
    expect(family?.wife_id).toBe(mother?.id);
  });

  it("có năm mất thì người đó được ghi là đã khuất", async () => {
    const res = await applyProposal(
      clanId,
      {
        people: [
          {
            tempId: "d",
            fullName: "Nguyễn Văn Cụ",
            gender: "M",
            birthYear: 1900,
            deathYear: 1975,
            relation: "parent",
            relatedTo: anchorId,
            note: "Cụ tổ đời trước",
          },
        ],
      },
      owner.client,
    );
    expect(res.added).toBe(1);

    const { data } = await owner.client
      .from("persons")
      .select("is_living, death_date, bio")
      .eq("full_name", "Nguyễn Văn Cụ")
      .single();
    expect(data?.is_living).toBe(false);
    expect(data?.death_date).toBe("1975-01-01");
    expect(data?.bio).toBe("Cụ tổ đời trước");
  });

  it("người xem KHÔNG ghi được, dù gọi thẳng hàm", async () => {
    await expect(
      applyProposal(
        clanId,
        {
          people: [
            {
              tempId: "x",
              fullName: "Người Lạ",
              gender: "M",
              birthYear: null,
              deathYear: null,
              relation: "child",
              relatedTo: anchorId,
              note: null,
            },
          ],
        },
        viewer.client,
      ),
    ).rejects.toThrow();

    const { data } = await owner.client
      .from("persons")
      .select("id")
      .eq("full_name", "Người Lạ");
    expect(data ?? []).toHaveLength(0);
  });
});
