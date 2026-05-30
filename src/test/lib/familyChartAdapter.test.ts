import { describe, expect, it } from "vitest";

import { pickDefaultFocal, toFamilyChart } from "@/lib/familyChartAdapter";
import type {
  FamilyForTree,
  PersonForTree,
} from "@/lib/queries/tree";

function p(
  id: string,
  name: string,
  gender: "M" | "F",
  opts: Partial<PersonForTree> = {},
): PersonForTree {
  return {
    id,
    full_name: name,
    gender,
    is_living: true,
    is_root: false,
    birth_date: null,
    death_date: null,
    generation: null,
    birth_family_id: null,
    ...opts,
  };
}

function f(id: string, h: string | null, w: string | null): FamilyForTree {
  return { id, husband_id: h, wife_id: w };
}

describe("familyChartAdapter.toFamilyChart", () => {
  it("returns empty array for empty input", () => {
    expect(toFamilyChart([], [])).toEqual([]);
  });

  it("maps a lone person to a datum with no rels", () => {
    const out = toFamilyChart([p("p1", "Solo", "M")], []);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("p1");
    expect(out[0].data.gender).toBe("M");
    expect(out[0].data["full name"]).toBe("Solo");
    expect(out[0].rels).toEqual({ parents: [], spouses: [], children: [] });
  });

  it("links husband and wife as mutual spouses", () => {
    const persons = [
      p("h", "Husband", "M"),
      p("w", "Wife", "F"),
    ];
    const families = [f("F1", "h", "w")];
    const out = toFamilyChart(persons, families);

    const husband = out.find((d) => d.id === "h")!;
    const wife = out.find((d) => d.id === "w")!;
    expect(husband.rels.spouses).toEqual(["w"]);
    expect(wife.rels.spouses).toEqual(["h"]);
  });

  it("attaches children to both parents and lists parents on child", () => {
    const persons = [
      p("dad", "Dad", "M"),
      p("mom", "Mom", "F"),
      p("kid", "Kid", "M", { birth_family_id: "F1" }),
    ];
    const families = [f("F1", "dad", "mom")];
    const out = toFamilyChart(persons, families);

    const dad = out.find((d) => d.id === "dad")!;
    const mom = out.find((d) => d.id === "mom")!;
    const kid = out.find((d) => d.id === "kid")!;

    expect(dad.rels.children).toEqual(["kid"]);
    expect(mom.rels.children).toEqual(["kid"]);
    expect(kid.rels.parents.sort()).toEqual(["dad", "mom"]);
  });

  it("single-parent family: child has one parent only", () => {
    const persons = [
      p("dad", "Dad", "M"),
      p("kid", "Kid", "F", { birth_family_id: "F1" }),
    ];
    const families = [f("F1", "dad", null)];
    const out = toFamilyChart(persons, families);

    expect(out.find((d) => d.id === "kid")!.rels.parents).toEqual(["dad"]);
    expect(out.find((d) => d.id === "dad")!.rels.children).toEqual(["kid"]);
  });

  it("polygamy / remarriage: husband has multiple spouses and children across families", () => {
    const persons = [
      p("h", "Husband", "M"),
      p("w1", "Wife 1", "F"),
      p("w2", "Wife 2", "F"),
      p("c1", "Child of 1", "M", { birth_family_id: "F1" }),
      p("c2", "Child of 2", "F", { birth_family_id: "F2" }),
    ];
    const families = [f("F1", "h", "w1"), f("F2", "h", "w2")];
    const out = toFamilyChart(persons, families);

    const husband = out.find((d) => d.id === "h")!;
    expect(husband.rels.spouses.sort()).toEqual(["w1", "w2"]);
    expect(husband.rels.children.sort()).toEqual(["c1", "c2"]);

    // Wives only see their own children
    expect(out.find((d) => d.id === "w1")!.rels.children).toEqual(["c1"]);
    expect(out.find((d) => d.id === "w2")!.rels.children).toEqual(["c2"]);
  });
});

describe("pickDefaultFocal", () => {
  it("returns null for empty list", () => {
    expect(pickDefaultFocal([])).toBeNull();
  });

  it("prefers an is_root person over generation order", () => {
    const persons = [
      p("a", "A", "M", { generation: 1 }),
      p("b", "B", "M", { generation: 1, is_root: true }),
      p("c", "C", "F", { generation: 2 }),
    ];
    expect(pickDefaultFocal(persons)).toBe("b");
  });

  it("falls back to lowest generation when no is_root", () => {
    const persons = [
      p("a", "A", "M", { generation: 3 }),
      p("b", "B", "F", { generation: 2 }),
      p("c", "C", "M", { generation: 5 }),
    ];
    expect(pickDefaultFocal(persons)).toBe("b");
  });

  it("falls back to first person when no generations set", () => {
    expect(pickDefaultFocal([p("a", "A", "M"), p("b", "B", "F")])).toBe("a");
  });
});
