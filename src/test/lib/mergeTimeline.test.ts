import { describe, expect, it } from "vitest";

import { computeClanTimeline } from "@/lib/timeline/computeClanTimeline";
import {
  buildMilestones,
  candidateToInput,
  pendingSuggestions,
  type TimelineRow,
} from "@/lib/timeline/mergeTimeline";
import type { PersonForTree } from "@/lib/queries/tree";

const ICONS = ["tree", "scroll", "family", "cradle", "candle"];

function p(id: string, o: Partial<PersonForTree> = {}): PersonForTree {
  return {
    id,
    full_name: id,
    gender: "M",
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: null,
    birth_family_id: null,
    branch_id: null,
    photo_path: null,
    ...o,
  };
}
const row = (o: Partial<TimelineRow>): TimelineRow => ({
  id: "r1",
  clan_id: "c",
  person_id: null,
  on_clan: true,
  era: null,
  year: 1950,
  sort_order: 0,
  title: "Mốc",
  body: null,
  icon_key: null,
  photo_person_id: null,
  image_url: null,
  context_title: null,
  context_body: null,
  source_key: null,
  ...o,
});
const cands = () =>
  computeClanTimeline([
    p("root", { is_root: true, birth_date: "1900-01-01", generation: 1 }),
    p("a", { birth_date: "1930-01-01", generation: 2 }),
    p("b", { birth_date: "1932-01-01", generation: 2 }),
  ]);

describe("buildMilestones — dòng thời gian là dữ liệu riêng", () => {
  it("không có hàng nào thì không có mốc (không tự lấy từ cây)", () => {
    expect(buildMilestones([], ICONS)).toEqual([]);
  });

  it("mốc vào đúng giai đoạn theo năm, kèm bối cảnh, hình hợp lệ hoặc mặc định", () => {
    const m = buildMilestones(
      [row({ id: "m1", year: 1945, title: "Về quê", body: "Cả nhà về quê", icon_key: "khong-co" })],
      ICONS,
    );
    expect(m).toHaveLength(1);
    expect(m[0].key).toBe("row:m1");
    expect(m[0].bucket.id).toBe("decade:1940");
    expect(m[0].iconKey).toBe("scroll");
    expect(m[0].eras.length).toBeGreaterThan(0);
    expect(m[0].fromTree).toBe(false);
  });

  it("xếp theo năm; body null thành chuỗi rỗng", () => {
    const m = buildMilestones(
      [row({ id: "b", year: 1990 }), row({ id: "a", year: 1920, icon_key: "tree" })],
      ICONS,
    );
    expect(m.map((x) => x.year)).toEqual([1920, 1990]);
    expect(m[0].iconKey).toBe("tree");
    expect(m[0].body).toBe("");
  });

  it("bối cảnh: mặc định theo năm, tự sửa thắng, rỗng thì ẩn", () => {
    const [def] = buildMilestones([row({ year: 1975 })], ICONS);
    expect(def.context?.title).toBe("Đất nước chia hai miền");
    const [custom] = buildMilestones(
      [row({ year: 1975, context_title: "Năm về quê", context_body: "Một\nHai" })],
      ICONS,
    );
    expect(custom.context?.title).toBe("Năm về quê");
    expect(custom.context?.bullets).toEqual(["Một", "Hai"]);
    const [hidden] = buildMilestones(
      [row({ year: 1975, context_title: "", context_body: "" })],
      ICONS,
    );
    expect(hidden.context).toBeNull();
  });

  it("cùng một năm: xếp theo số thứ tự, bằng nhau thì theo tên", () => {
    const m = buildMilestones(
      [
        row({ id: "c", year: 1975, sort_order: 2, title: "Ba" }),
        row({ id: "a", year: 1975, sort_order: 1, title: "Hai" }),
        row({ id: "b", year: 1975, sort_order: 1, title: "Một" }),
        row({ id: "z", year: 1970, sort_order: 9, title: "Trước" }),
      ],
      ICONS,
    );
    expect(m.map((x) => x.title)).toEqual(["Trước", "Hai", "Một", "Ba"]);
    expect(m[1].sortOrder).toBe(1);
  });

  it("mốc sao chép từ gia phả được đánh dấu fromTree", () => {
    expect(buildMilestones([row({ source_key: "decade:1900:root" })], ICONS)[0].fromTree).toBe(true);
  });
});

describe("gợi ý từ gia phả", () => {
  it("mọi gợi ý đều có năm đại diện", () => {
    for (const c of cands()) expect(Number.isInteger(c.year)).toBe(true);
    expect(cands().find((c) => c.kind === "root")?.year).toBe(1900);
  });

  it("chưa thêm gì thì còn nguyên danh sách gợi ý", () => {
    expect(pendingSuggestions(cands(), [])).toHaveLength(cands().length);
  });

  it("gợi ý đã được sao chép thì không gợi ý lại, kể cả khi mốc đã bị sửa chữ", () => {
    const first = cands()[0];
    const rows = [row({ source_key: first.key, title: "Đã đổi tên" })];
    const left = pendingSuggestions(cands(), rows);
    expect(left.some((c) => c.key === first.key)).toBe(false);
    expect(left).toHaveLength(cands().length - 1);
  });

  it("xoá mốc (không còn hàng) thì gợi ý hiện lại", () => {
    const first = cands()[0];
    expect(pendingSuggestions(cands(), []).some((c) => c.key === first.key)).toBe(true);
  });

  it("sao chép gợi ý thành mốc: giữ năm, chữ, hình, ảnh người và khoá nguồn", () => {
    const c = cands().find((x) => x.kind === "root")!;
    expect(candidateToInput(c)).toEqual({
      year: 1900,
      title: c.title,
      body: c.body,
      icon_key: c.iconKey,
      photo_person_id: c.photoPersonId,
      image_url: null,
      person_id: null,
      on_clan: true,
      context_title: null,
      context_body: null,
      source_key: c.key,
    });
  });

  it("mốc đã sao chép độc lập với cây: cây đổi/mất người thì mốc vẫn còn nguyên", () => {
    const c = cands().find((x) => x.kind === "root")!;
    const saved = [row({ id: "s1", ...candidateToInput(c) })];
    // cây trống hoàn toàn
    expect(computeClanTimeline([])).toEqual([]);
    const m = buildMilestones(saved, ICONS);
    expect(m).toHaveLength(1);
    expect(m[0].title).toBe(c.title);
  });
});
