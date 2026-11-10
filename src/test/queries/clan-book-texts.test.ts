import { afterAll, describe, expect, it } from "vitest";

import {
  EMPTY_BOOK_TEXTS,
  cleanBookTexts,
  getClanBookTexts,
  saveClanBookTexts,
} from "@/lib/queries/clan-book";
import { createClan } from "@/lib/queries/clans";

import { createTestUser, deleteUser } from "../supabase-helpers";

/** Tích hợp với Supabase local: tạo dòng họ đủ cột, rồi lưu/đọc văn bản sổ gia phả. */
describe("queries: clan-book texts + tạo dòng họ đủ thông tin", () => {
  const cleanup: string[] = [];
  afterAll(async () => {
    for (const id of cleanup) await deleteUser(id);
  });

  it("createClan lưu mọi tuỳ chọn hiển thị", async () => {
    const user = await createTestUser({ displayName: "Founder" });
    cleanup.push(user.id);
    const { id } = await createClan(
      {
        name: "Họ Đủ Thông Tin",
        description: "Mô tả",
        visibility: "public",
        avatar_frame: null,
        generation_offset: 1,
        hide_photos_in_share: true,
        display_death_details: true,
        display_living_full_dob: true,
        public_show_tree: false,
        public_show_heritage: false,
        public_show_graves: true,
        public_show_events: false,
      },
      user.id,
      user.client,
    );
    const { data, error } = await user.client
      .from("clans")
      .select(
        "visibility, generation_offset, hide_photos_in_share, display_death_details, display_living_full_dob, public_show_tree, public_show_heritage, public_show_graves, public_show_events",
      )
      .eq("id", id)
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({
      visibility: "public",
      generation_offset: 1,
      hide_photos_in_share: true,
      display_death_details: true,
      display_living_full_dob: true,
      public_show_tree: false,
      public_show_heritage: false,
      public_show_graves: true,
      public_show_events: false,
    });
  });

  it("người tạo lưu và đọc lại đủ thông tin sổ gia phả; lưu từng phần không ghi đè phần kia", async () => {
    const user = await createTestUser({ displayName: "Author" });
    cleanup.push(user.id);
    const { id } = await createClan({ name: "Họ Sổ" }, user.id, user.client);

    expect(await getClanBookTexts(id, user.client)).toBeNull();

    await saveClanBookTexts(
      id,
      cleanBookTexts({
        ...EMPTY_BOOK_TEXTS,
        place_line: "Thôn A, xã B",
        origin_place: "Nơi phát tích",
        ancestral_hall: "Nhà thờ X",
        ancestor_anniversary: "10/3 âm lịch",
        chief_name: "Ông Y",
        compilers: "Ban biên soạn",
        compiled_year: "2026",
        contact: "0900000000",
        preface: "Lời nói đầu",
        phaky: "Phả ký",
        ngoai_pha: "Ngoại phả",
        phu_khao: "Phụ khảo",
      }),
      user.client,
    );
    // Form văn bản chỉ gửi 4 trường chữ: không được xoá thông tin biên soạn.
    await saveClanBookTexts(id, cleanBookTexts({ preface: "Lời nói đầu (sửa)" }), user.client);

    const got = await getClanBookTexts(id, user.client);
    expect(got).toMatchObject({
      place_line: "Thôn A, xã B",
      origin_place: "Nơi phát tích",
      ancestral_hall: "Nhà thờ X",
      ancestor_anniversary: "10/3 âm lịch",
      chief_name: "Ông Y",
      compilers: "Ban biên soạn",
      compiled_year: "2026",
      contact: "0900000000",
      preface: "Lời nói đầu (sửa)",
      phaky: "Phả ký",
      ngoai_pha: "Ngoại phả",
      phu_khao: "Phụ khảo",
    });
  });

  it("người ngoài dòng họ không đọc được và không ghi được", async () => {
    const owner = await createTestUser({ displayName: "Owner" });
    const stranger = await createTestUser({ displayName: "Stranger" });
    cleanup.push(owner.id, stranger.id);
    const { id } = await createClan({ name: "Họ Riêng" }, owner.id, owner.client);
    await saveClanBookTexts(id, cleanBookTexts({ preface: "Bí mật" }), owner.client);

    expect(await getClanBookTexts(id, stranger.client)).toBeNull();
    await expect(
      saveClanBookTexts(id, cleanBookTexts({ preface: "Phá" }), stranger.client),
    ).rejects.toThrow();
  });
});
