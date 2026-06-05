import { describe, expect, it } from "vitest";

import {
  traceLineage,
  type LineageFamily,
  type LineagePerson,
} from "@/lib/lineage";

function makePerson(
  overrides: Partial<LineagePerson> & Pick<LineagePerson, "id" | "full_name">,
): LineagePerson {
  return {
    gender: "M",
    is_living: false,
    is_root: false,
    generation: null,
    birth_family_id: null,
    birth_date: null,
    death_date: null,
    photo_path: null,
    ...overrides,
  };
}

describe("traceLineage", () => {
  it("returns a single step for an unknown starting id", () => {
    const r = traceLineage([], [], "missing");
    expect(r.steps).toEqual([]);
    expect(r.reachedRoot).toBe(false);
  });

  it("returns just self when the starting person has no birth_family", () => {
    const me = makePerson({ id: "me", full_name: "Tôi" });
    const r = traceLineage([me], [], "me");
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].person.id).toBe("me");
    expect(r.steps[0].arrivedVia).toBe("self");
    expect(r.reachedRoot).toBe(false);
  });

  it("walks 3 generations via the paternal line by default", () => {
    const tof = makePerson({
      id: "tof",
      full_name: "Thuỷ tổ",
      is_root: true,
      generation: 1,
    });
    const fam1: LineageFamily = { id: "f1", husband_id: "tof", wife_id: null };
    const father = makePerson({
      id: "father",
      full_name: "Cha",
      birth_family_id: "f1",
      generation: 2,
    });
    const fam2: LineageFamily = {
      id: "f2",
      husband_id: "father",
      wife_id: "mother",
    };
    const mother = makePerson({
      id: "mother",
      full_name: "Mẹ",
      gender: "F",
      generation: 2,
    });
    const me = makePerson({
      id: "me",
      full_name: "Tôi",
      is_living: true,
      birth_family_id: "f2",
      generation: 3,
    });
    const r = traceLineage(
      [tof, father, mother, me],
      [fam1, fam2],
      "me",
    );
    expect(r.steps.map((s) => s.person.id)).toEqual(["me", "father", "tof"]);
    expect(r.steps[1].arrivedVia).toBe("father");
    expect(r.steps[2].arrivedVia).toBe("father");
    expect(r.reachedRoot).toBe(true);
    expect(r.forkPoints).toEqual(["me"]); // me had both parents
  });

  it("honours the maternal override via choices map", () => {
    const father = makePerson({ id: "father", full_name: "Cha" });
    const mother = makePerson({
      id: "mother",
      full_name: "Mẹ",
      gender: "F",
    });
    const fam: LineageFamily = {
      id: "f",
      husband_id: "father",
      wife_id: "mother",
    };
    const me = makePerson({
      id: "me",
      full_name: "Tôi",
      is_living: true,
      birth_family_id: "f",
    });
    const r = traceLineage(
      [father, mother, me],
      [fam],
      "me",
      { me: "maternal" },
    );
    expect(r.steps.map((s) => s.person.id)).toEqual(["me", "mother"]);
    expect(r.steps[1].arrivedVia).toBe("mother");
  });

  it("stops cleanly when the requested parent slot is empty", () => {
    // Birth family has only a mother — paternal walk hits dead end.
    const mother = makePerson({ id: "mother", full_name: "Mẹ", gender: "F" });
    const fam: LineageFamily = { id: "f", husband_id: null, wife_id: "mother" };
    const me = makePerson({
      id: "me",
      full_name: "Tôi",
      is_living: true,
      birth_family_id: "f",
    });
    const r = traceLineage([mother, me], [fam], "me");
    expect(r.steps).toHaveLength(1);
    expect(r.reachedRoot).toBe(false);
  });

  it("guards against cycles by refusing to revisit a person", () => {
    // Pathological: a person is their own great-grandparent through bad
    // data. We should still terminate.
    const a = makePerson({ id: "a", full_name: "A", birth_family_id: "fb" });
    const b = makePerson({ id: "b", full_name: "B", birth_family_id: "fa" });
    const fa: LineageFamily = { id: "fa", husband_id: "a", wife_id: null };
    const fb: LineageFamily = { id: "fb", husband_id: "b", wife_id: null };
    const r = traceLineage([a, b], [fa, fb], "a");
    // Walk: a → b (via fb) → would loop to a (via fa) but cycle guard stops.
    expect(r.steps.map((s) => s.person.id)).toEqual(["a", "b"]);
  });
});
