import { QueryClient } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { __internal } from "@/hooks/useClanFreshness";
import { queryKeys } from "@/lib/queries/keys";

const { invalidateClanQueries, readLastSynced, writeLastSynced, lastSyncedKey } =
  __internal;

describe("useClanFreshness internals", () => {
  describe("invalidateClanQueries", () => {
    it("invalidates persons + tree-data + clan-members + clan for the target clan", async () => {
      const qc = new QueryClient();
      const clan = "clan-x";
      const user = "u";

      qc.setQueryData(queryKeys.persons(clan, user, { page: 1 }), { rows: [] });
      qc.setQueryData(queryKeys.treeData(clan, user), { persons: [] });
      qc.setQueryData(queryKeys.clanMembers(clan, user), []);
      qc.setQueryData(queryKeys.clan(clan, user), { id: clan });

      await invalidateClanQueries(qc, clan);

      expect(qc.getQueryState(queryKeys.persons(clan, user, { page: 1 }))?.isInvalidated).toBe(true);
      expect(qc.getQueryState(queryKeys.treeData(clan, user))?.isInvalidated).toBe(true);
      expect(qc.getQueryState(queryKeys.clanMembers(clan, user))?.isInvalidated).toBe(true);
      expect(qc.getQueryState(queryKeys.clan(clan, user))?.isInvalidated).toBe(true);
    });

    it("ignores queries from a different clan", async () => {
      const qc = new QueryClient();
      qc.setQueryData(queryKeys.persons("other", "u", { page: 1 }), { rows: [] });
      qc.setQueryData(queryKeys.treeData("other", "u"), { persons: [] });

      await invalidateClanQueries(qc, "target");

      expect(qc.getQueryState(queryKeys.persons("other", "u", { page: 1 }))?.isInvalidated).toBe(false);
      expect(qc.getQueryState(queryKeys.treeData("other", "u"))?.isInvalidated).toBe(false);
    });
  });

  describe("lastSynced localStorage", () => {
    beforeEach(() => {
      // jsdom would give us a real localStorage; node we stub.
      if (typeof localStorage === "undefined") {
        const store = new Map<string, string>();
        vi.stubGlobal("localStorage", {
          getItem: (k: string) => store.get(k) ?? null,
          setItem: (k: string, v: string) => store.set(k, v),
          removeItem: (k: string) => store.delete(k),
          clear: () => store.clear(),
          key: () => null,
          length: 0,
        });
      } else {
        localStorage.clear();
      }
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("writeLastSynced + readLastSynced round-trip per clan", () => {
      const t = new Date("2026-05-30T10:15:00Z");
      writeLastSynced("c1", t);
      const got = readLastSynced("c1");
      expect(got?.getTime()).toBe(t.getTime());
    });

    it("returns null for an unseen clan", () => {
      expect(readLastSynced("never-synced")).toBeNull();
    });

    it("uses a clan-scoped key", () => {
      expect(lastSyncedKey("c1")).not.toBe(lastSyncedKey("c2"));
    });
  });
});
