import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import { invalidateClanData } from "@/lib/cache";
import { queryKeys } from "@/lib/queries/keys";

function makeClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Infinity, staleTime: Infinity } },
  });
}

describe("invalidateClanData", () => {
  it("invalidates persons + tree-data for the target clan", async () => {
    const qc = makeClient();
    const clanA = "clan-a";
    const clanB = "clan-b";
    const user = "u";

    qc.setQueryData(queryKeys.persons(clanA, user, { page: 1 }), { rows: [] });
    qc.setQueryData(queryKeys.persons(clanB, user, { page: 1 }), { rows: [] });
    qc.setQueryData(queryKeys.treeData(clanA, user), { persons: [], families: [] });
    qc.setQueryData(queryKeys.treeData(clanB, user), { persons: [], families: [] });

    await invalidateClanData(qc, clanA);

    expect(qc.getQueryState(queryKeys.persons(clanA, user, { page: 1 }))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(queryKeys.treeData(clanA, user))?.isInvalidated).toBe(true);
    // Other clan untouched
    expect(qc.getQueryState(queryKeys.persons(clanB, user, { page: 1 }))?.isInvalidated).toBe(false);
    expect(qc.getQueryState(queryKeys.treeData(clanB, user))?.isInvalidated).toBe(false);
  });

  it("invalidates person + person-relationships broadly (keyed by personId, not clanId)", async () => {
    const qc = makeClient();
    const user = "u";

    qc.setQueryData(queryKeys.person("p1", user), { id: "p1" });
    qc.setQueryData(queryKeys.personRelationships("p1", user), { spouses: [] });

    await invalidateClanData(qc, "clan-a");

    expect(qc.getQueryState(queryKeys.person("p1", user))?.isInvalidated).toBe(true);
    expect(qc.getQueryState(queryKeys.personRelationships("p1", user))?.isInvalidated).toBe(true);
  });

  it("does not touch other-clan queries", async () => {
    const qc = makeClient();
    qc.setQueryData(queryKeys.persons("clan-b", "u", { page: 1 }), { rows: [] });
    qc.setQueryData(queryKeys.treeData("clan-b", "u"), { persons: [] });
    qc.setQueryData(queryKeys.clanMembers("clan-b", "u"), []);

    await invalidateClanData(qc, "clan-a");

    expect(qc.getQueryState(queryKeys.persons("clan-b", "u", { page: 1 }))?.isInvalidated).toBe(false);
    expect(qc.getQueryState(queryKeys.treeData("clan-b", "u"))?.isInvalidated).toBe(false);
    expect(qc.getQueryState(queryKeys.clanMembers("clan-b", "u"))?.isInvalidated).toBe(false);
  });
});
