import { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";
import type { PersistedClient, Persister } from "@tanstack/react-query-persist-client";

/**
 * React Query config for this app.
 *
 * Family-tree data changes rarely after the admin finishes entering it.
 * Strategy:
 * - Long staleTime → no auto refetch
 * - Disable refetchOnWindowFocus / Reconnect / Mount
 * - Long gcTime so cache stays in memory all session
 * - Persist to IndexedDB so re-opening the PWA shows data instantly
 * - Refresh proactively via clans.data_version check + "Làm mới" button
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 60 * 4, // 4 hours
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 1,
    },
  },
});

const IDB_KEY = "family-tree-rq-cache";

/** IndexedDB persister via idb-keyval. localStorage is too small for our data. */
export const persister: Persister = {
  persistClient: async (client: PersistedClient) => {
    await set(IDB_KEY, client);
  },
  restoreClient: async () => {
    return (await get<PersistedClient>(IDB_KEY)) ?? undefined;
  },
  removeClient: async () => {
    await del(IDB_KEY);
  },
};

/**
 * Wipe all cached queries AND remove the IndexedDB blob.
 * MUST be called on sign-out so the next user on the same device doesn't
 * see the previous user's data hydrate from cache.
 */
export async function clearAllCache(): Promise<void> {
  queryClient.clear();
  await persister.removeClient();
}
