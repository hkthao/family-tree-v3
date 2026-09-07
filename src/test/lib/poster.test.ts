import { describe, expect, it } from "vitest";

import { buildPoster, DEFAULT_POSTER_CONFIG } from "@/lib/poster/buildPoster";
import { posterRegions, POSTER_SIZES } from "@/lib/poster/frame";
import { layoutPosterTree } from "@/lib/poster/treeLayout";
import type { FamilyForTree, PersonForTree } from "@/lib/queries/tree";

/**
 * Bảng gia phả in khổ lớn.
 *
 * Vì sao test kỹ phần bố cục: sai ở đây chỉ lộ ra SAU KHI in — người ta
 * mang file ra tiệm, in tấm A1 trên bạt, treo lên rồi mới thấy hai ô đè
 * nhau hoặc chữ chạy ra ngoài khung. Không có bước "sửa rồi tải lại" như
 * trên web.
 */

const person = (
  id: string,
  over: Partial<PersonForTree> = {},
): PersonForTree =>
  ({
    id,
    full_name: over.full_name ?? `Nguyễn Văn ${id}`,
    gender: "M",
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: null,
    birth_family_id: null,
    branch_id: null,
    photo_path: null,
    ...over,
  }) as PersonForTree;

const family = (
  id: string,
  husband: string | null,
  wife: string | null,
): FamilyForTree => ({
  id,
  husband_id: husband,
  wife_id: wife,
  spouse_order: null,
  created_at: null,
});

/** Ông tổ – vợ – ba con – hai cháu. */
function clan() {
  const persons = [
    person("to", { is_root: true, full_name: "Nguyễn Phúc Tổ" }),
    person("vo-to", { gender: "F", full_name: "Trần Thị Tổ" }),
    person("c1", { birth_family_id: "f1", birth_order: 1 }),
    person("c2", { birth_family_id: "f1", birth_order: 2 }),
    person("c3", { birth_family_id: "f1", birth_order: 3 }),
    person("vo-c1", { gender: "F", full_name: "Lê Thị Dâu" }),
    person("ch1", { birth_family_id: "f2", birth_order: 1 }),
    person("ch2", { birth_family_id: "f2", birth_order: 2 }),
  ];
  const families = [
    family("f1", "to", "vo-to"),
    family("f2", "c1", "vo-c1"),
  ];
  return { persons, families };
}

const opts = { showSpouses: true, showYears: true };

describe("layoutPosterTree — hàng theo đời", () => {
  it("mỗi đời một hàng, tính theo độ sâu từ gốc", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, opts);
    const rowOf = (id: string) => l.cards.find((c) => c.id === id)!.row;
    expect(rowOf("to")).toBe(0);
    expect(rowOf("vo-to")).toBe(0);
    expect(rowOf("c1")).toBe(1);
    expect(rowOf("c3")).toBe(1);
    expect(rowOf("ch1")).toBe(2);
    expect(l.rows).toBe(3);
  });

  it("cùng một hàng thì các ô KHÔNG đè lên nhau", () => {
    // Ô đè nhau là lỗi duy nhất không sửa được sau khi in.
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, opts);
    for (let row = 0; row < l.rows; row++) {
      const xs = l.cards
        .filter((c) => c.row === row)
        .map((c) => c.cx)
        .sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) {
        expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(l.cardW - 0.01);
      }
    }
  });

  it("cha mẹ nằm giữa các con", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, opts);
    const to = l.cards.find((c) => c.id === "to")!;
    const voTo = l.cards.find((c) => c.id === "vo-to")!;
    const kids = l.cards.filter((c) => ["c1", "c2", "c3"].includes(c.id));
    const coupleCenter = (to.cx + voTo.cx) / 2;
    const kidsCenter =
      (Math.min(...kids.map((k) => k.cx)) + Math.max(...kids.map((k) => k.cx))) / 2;
    expect(Math.abs(coupleCenter - kidsCenter)).toBeLessThan(l.cardW * 0.6);
  });

  it("dâu/rể là ô phụ, không phải một đời riêng", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, opts);
    const dau = l.cards.find((c) => c.id === "vo-c1")!;
    expect(dau.kind).toBe("spouse");
    expect(dau.row).toBe(1); // cùng hàng với chồng, không đẩy xuống hàng dưới
  });

  it("tắt vợ/chồng thì tấm chỉ còn dòng máu", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, {
      ...opts,
      showSpouses: false,
    });
    expect(l.cards.some((c) => c.kind === "spouse")).toBe(false);
    expect(l.cards.some((c) => c.id === "vo-to")).toBe(false);
  });

  it("in từ một người thì CHÍNH người đó là gốc, không phải cha họ", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, { ...opts, focalId: "c1" });
    expect(l.cards.find((c) => c.id === "c1")!.row).toBe(0);
    expect(l.cards.some((c) => c.id === "to")).toBe(false);
  });

  it("giới hạn số đời cắt từ gốc xuống", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(persons, families, { ...opts, generations: 2 });
    expect(l.rows).toBe(2);
    expect(l.cards.some((c) => c.id === "ch1")).toBe(false);
  });

  it("dữ liệu vòng (cha là con của chính con mình) không làm treo máy", () => {
    // Đã gặp dữ liệu nhập tay kiểu này; thà bỏ một nhánh còn hơn đứng máy.
    const persons = [
      person("a", { is_root: true, birth_family_id: "f2" }),
      person("b", { birth_family_id: "f1" }),
    ];
    const families = [family("f1", "a", null), family("f2", "b", null)];
    const l = layoutPosterTree(persons, families, opts);
    expect(l.cards.length).toBeGreaterThan(0);
  });

  it("người không nối được vào nhánh nào được ĐẾM, không âm thầm mất", () => {
    const { persons, families } = clan();
    const l = layoutPosterTree(
      [...persons, person("le-loi", { full_name: "Người rời rạc" })],
      families,
      opts,
    );
    expect(l.omitted).toBe(1);
  });
});

describe("posterRegions — một bố cục cho mọi phần hoa văn", () => {
  const sizes = ["A3", "A2", "A1", "A0"] as const;

  it("mọi vùng nằm gọn trong tờ giấy", () => {
    for (const size of sizes) {
      const r = posterRegions(size);
      const { w, h } = POSTER_SIZES[size];
      for (const [name, box] of Object.entries({
        border: r.border,
        inner: r.inner,
        banner: r.banner,
        tree: r.tree,
        columnLeft: r.columnLeft,
        columnRight: r.columnRight,
      })) {
        expect(box.x, `${size}/${name}.x`).toBeGreaterThanOrEqual(0);
        expect(box.y, `${size}/${name}.y`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w, `${size}/${name} phải`).toBeLessThanOrEqual(w);
        expect(box.y + box.h, `${size}/${name} đáy`).toBeLessThanOrEqual(h);
      }
    }
  });

  it("cây KHÔNG chồng lên băng tên hay hai cột câu đối", () => {
    for (const size of sizes) {
      const r = posterRegions(size);
      expect(r.tree.y).toBeGreaterThanOrEqual(r.banner.y + r.banner.h);
      expect(r.tree.x).toBeGreaterThanOrEqual(r.columnLeft.x + r.columnLeft.w);
      expect(r.tree.x + r.tree.w).toBeLessThanOrEqual(r.columnRight.x);
    }
  });

  it("bỏ cột câu đối thì cây rộng ra, không để lại lỗ trống", () => {
    const withCols = posterRegions("A1", { columns: true, banner: true });
    const without = posterRegions("A1", { columns: false, banner: true });
    expect(without.tree.w).toBeGreaterThan(withCols.tree.w);
  });
});

describe("buildPoster", () => {
  const cfg = { ...DEFAULT_POSTER_CONFIG, title: "HỌ NGUYỄN" };

  it("mọi nét vẽ nằm trong tờ giấy", () => {
    const { persons, families } = clan();
    const doc = buildPoster(persons, families, cfg);
    for (const p of doc.prims) {
      if (p.k === "rect") {
        expect(p.x).toBeGreaterThanOrEqual(-0.5);
        expect(p.y).toBeGreaterThanOrEqual(-0.5);
        expect(p.x + p.w).toBeLessThanOrEqual(doc.w + 0.5);
        expect(p.y + p.h).toBeLessThanOrEqual(doc.h + 0.5);
      }
      if (p.k === "text") {
        expect(p.x).toBeGreaterThanOrEqual(0);
        expect(p.x).toBeLessThanOrEqual(doc.w);
        expect(p.y).toBeLessThanOrEqual(doc.h);
      }
    }
  });

  it("khổ to hơn thì chữ in ra TO hơn, không phải cùng cỡ", () => {
    const { persons, families } = clan();
    const a3 = buildPoster(persons, families, { ...cfg, size: "A3" });
    const a0 = buildPoster(persons, families, { ...cfg, size: "A0" });
    expect(a0.namePt).toBeGreaterThan(a3.namePt);
  });

  it("cảnh báo khi chữ nhỏ tới mức in ra phải soi", () => {
    // Dòng họ đông + khổ nhỏ = chữ li ti. Nói trước, đừng để in xong mới biết.
    const persons: PersonForTree[] = [
      person("to", { is_root: true }),
    ];
    const families: FamilyForTree[] = [family("f1", "to", null)];
    for (let i = 0; i < 400; i++) {
      persons.push(person(`k${i}`, { birth_family_id: "f1", birth_order: i }));
    }
    const doc = buildPoster(persons, families, { ...cfg, size: "A3" });
    expect(doc.namePt).toBeLessThan(4.5);
    expect(doc.warnings.join(" ")).toMatch(/soi/);
  });

  it("thiếu tên dòng họ thì nhắc, chứ không in ra băng tên trống", () => {
    const { persons, families } = clan();
    const doc = buildPoster(persons, families, { ...cfg, title: "  " });
    expect(doc.warnings.join(" ")).toMatch(/tên dòng họ/i);
  });

  it("cây hai đời không bị kéo dãn dính đỉnh–đáy tấm", () => {
    // Rải kín tấm là tốt, nhưng rải tới mức hai hàng dính hai mép thì
    // nét nối dài ngoẵng, trông như in lỗi.
    const persons = [
      person("to", { is_root: true }),
      person("con", { birth_family_id: "f1" }),
    ];
    const families = [family("f1", "to", null)];
    const doc = buildPoster(persons, families, { ...cfg, size: "A1" });
    const ys = doc.prims
      .filter((p) => p.k === "rect" && p.rx)
      .map((p) => (p.k === "rect" ? p.y : 0))
      .sort((a, b) => a - b);
    const cardH = doc.prims
      .filter((p) => p.k === "rect" && p.rx)
      .map((p) => (p.k === "rect" ? p.h : 0))[0];
    expect(ys[ys.length - 1] - ys[0]).toBeLessThanOrEqual(cardH * 5 + 1);
  });

  it("đổi mẫu hoa văn không làm đổi bố cục cây", () => {
    // Đó là điểm của việc dùng chung một bố cục: hoa văn là lớp phủ,
    // không phải thứ đẩy cây đi chỗ khác.
    const { persons, families } = clan();
    const a = buildPoster(persons, families, { ...cfg, border: "hoi-van", corner: "may" });
    const b = buildPoster(persons, families, { ...cfg, border: "kep-thanh", corner: "sen" });
    const cardsOf = (d: typeof a) =>
      d.prims.filter((p) => p.k === "rect" && p.rx).map((p) => (p.k === "rect" ? [p.x, p.y] : []));
    expect(cardsOf(a)).toEqual(cardsOf(b));
  });
});
