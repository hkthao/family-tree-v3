import { QueryClient } from "@tanstack/react-query";
import { get, set, del } from "idb-keyval";
import type {
  PersistedClient,
  Persister,
} from "@tanstack/react-query-persist-client";

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

/**
 * Dữ liệu của trang dòng họ / link chia sẻ chứa URL ảnh KÝ SẴN, sống 1 giờ (share-view ký 3600s). Cache lâu hơn (staleTime 4h,
 * lưu bền 24h trong IndexedDB) thì mở lại sau >1 giờ là ảnh lỗi "exp claim timestamp check failed". Nên các truy vấn này:
 * không lưu bền, và coi là cũ sau 30 phút (nhỏ hơn hạn của URL) rồi nạp lại khi mở trang.
 */
export const SIGNED_URL_QUERY_ROOTS = ["site", "share-view"] as const;
export const SIGNED_URL_STALE_MS = 1000 * 60 * 30;
export const hasSignedUrls = (queryKey: readonly unknown[]): boolean =>
  (SIGNED_URL_QUERY_ROOTS as readonly unknown[]).includes(queryKey[0]);
for (const root of SIGNED_URL_QUERY_ROOTS) {
  queryClient.setQueryDefaults([root], {
    staleTime: SIGNED_URL_STALE_MS,
    gcTime: SIGNED_URL_STALE_MS,
    refetchOnMount: true,
  });
}

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
