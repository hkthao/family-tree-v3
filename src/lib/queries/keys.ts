/**
 * Centralized React Query keys.
 *
 * Convention: the `viewerScope` segment (user id) is part of every key so
 * cached data is bound to the current viewer. If user A signs out and user B
 * signs in on the same device, B will not pick up A's cached entries even if
 * the IndexedDB blob survived (it shouldn't — clearAllCache runs on sign-out).
 */
export const queryKeys = {
  myProfile: (userId: string) => ["profile", userId] as const,
  myBlockingClans: (userId: string) => ["blocking-clans", userId] as const,
  myClans: (userId: string) => ["clans", "mine", userId] as const,
  clan: (clanId: string, userId: string) => ["clan", clanId, userId] as const,
  clanDataVersion: (clanId: string) =>
    ["clan-data-version", clanId] as const,
  persons: (clanId: string, userId: string, params: unknown) =>
    ["persons", clanId, userId, params] as const,
  person: (personId: string, userId: string) =>
    ["person", personId, userId] as const,
  personRelationships: (personId: string, userId: string) =>
    ["person-relationships", personId, userId] as const,
  treeData: (clanId: string, userId: string) =>
    ["tree-data", clanId, userId] as const,
  clanMembers: (clanId: string, userId: string) =>
    ["clan-members", clanId, userId] as const,
  clanStats: (clanId: string, userId: string) =>
    ["clan-stats", clanId, userId] as const,
  branches: (clanId: string, userId: string) =>
    ["branches", clanId, userId] as const,
  shareLinks: (clanId: string, userId: string) =>
    ["share-links", clanId, userId] as const,
  audit: (clanId: string, userId: string, params: unknown) =>
    ["audit", clanId, userId, params] as const,
  adminProfiles: () => ["admin-profiles"] as const,
  adminClans: () => ["admin-clans"] as const,
  adminUserClans: (userId: string) => ["admin-user-clans", userId] as const,
};
