import { describe, expect, it } from "vitest";

import {
  DEFAULT_CLAN_FORM,
  clanFormFromClan,
  clanFormToColumns,
} from "@/components/ClanFormFields";
import { cleanBookTexts, EMPTY_BOOK_TEXTS } from "@/lib/queries/clan-book";
import { createClan } from "@/lib/queries/clans";

/** Client giả: ghi lại payload insert để kiểm tra form tạo dòng họ gửi đủ cột. */
function fakeClient() {
  const calls: { table: string; payload: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      return {
        insert(payload: Record<string, unknown>) {
          calls.push({ table, payload });
          return {
            select: () => ({ single: async () => ({ data: { id: "c1" }, error: null }) }),
          };
        },
      };
    },
  };
  return { client: client as never, calls };
}

describe("form tạo dòng họ gửi đủ thông tin", () => {
  it("mọi tuỳ chọn trong form đi vào cột của bảng clans", async () => {
    const { client, calls } = fakeClient();
    const values = {
      ...DEFAULT_CLAN_FORM,
      name: "  Họ Nguyễn  ",
      description: " Mô tả ",
      avatar_frame: "gold",
      visibility: "public" as const,
      public_show_tree: false,
      public_show_heritage: false,
      public_show_graves: true,
      public_show_events: false,
      root_is_gen_zero: true,
      display_death_details: true,
      display_living_full_dob: true,
      hide_photos_in_share: true,
    };
    await createClan(clanFormToColumns(values), "u1", client);
    expect(calls[0].table).toBe("clans");
    expect(calls[0].payload).toMatchObject({
      name: "Họ Nguyễn",
      description: "Mô tả",
      visibility: "public",
      owner_id: "u1",
      avatar_frame: "gold",
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

  it("giá trị mặc định: Thủy tổ Đời 1, riêng tư", async () => {
    const { client, calls } = fakeClient();
    await createClan(clanFormToColumns({ ...DEFAULT_CLAN_FORM, name: "A" }), "u1", client);
    expect(calls[0].payload).toMatchObject({ generation_offset: 0, visibility: "private" });
  });

  it("clanFormFromClan đọc lại đúng những gì clanFormToColumns ghi", () => {
    const cols = clanFormToColumns({ ...DEFAULT_CLAN_FORM, name: "A", root_is_gen_zero: true });
    const back = clanFormFromClan({
      ...cols,
      description: cols.description ?? null,
      avatar_frame: null,
    } as never);
    expect(back.root_is_gen_zero).toBe(true);
    expect(back.name).toBe("A");
  });

  it("cleanBookTexts giữ đủ mọi trường sổ gia phả, ô trống thành null", () => {
    const out = cleanBookTexts({
      ...EMPTY_BOOK_TEXTS,
      place_line: " Thôn A ",
      preface: "Lời",
      compilers: "  ",
    });
    expect(Object.keys(out).sort()).toEqual(Object.keys(EMPTY_BOOK_TEXTS).sort());
    expect(out.place_line).toBe("Thôn A");
    expect(out.compilers).toBeNull();
  });
});
