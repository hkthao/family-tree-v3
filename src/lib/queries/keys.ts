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
  myClans: (userId: string, params: unknown) =>
    ["clans", "mine", userId, params] as const,
  communityClans: (userId: string, params: unknown) =>
    ["clans", "community", userId, params] as const,
  clan: (clanId: string, userId: string) => ["clan", clanId, userId] as const,
  clanDataVersion: (clanId: string) =>
    ["clan-data-version", clanId] as const,
  persons: (clanId: string, userId: string, params: unknown) =>
    ["persons", clanId, userId, params] as const,
  person: (personId: string, userId: string) =>
    ["person", personId, userId] as const,
  personRelationships: (personId: string, userId: string) =>
    ["person-relationships", personId, userId] as const,
  treeData: (clanId: string, userId: string, source: string = "persons") =>
    ["tree-data", clanId, userId, source] as const,
  clanMembers: (clanId: string, userId: string) =>
    ["clan-members", clanId, userId] as const,
  clanStats: (clanId: string, userId: string) =>
    ["clan-stats", clanId, userId] as const,
  branches: (clanId: string, userId: string) =>
    ["branches", clanId, userId] as const,
  shareLinks: (clanId: string, userId: string) =>
    ["share-links", clanId, userId] as const,
  shareLinksPage: (clanId: string, userId: string, params: unknown) =>
    ["share-links-page", clanId, userId, params] as const,
  personLinksForClan: (clanId: string, userId: string) =>
    ["person-links", "clan", clanId, userId] as const,
  pendingPersonLinksCount: (clanId: string, userId: string) =>
    ["person-links", "pending-count", clanId, userId] as const,
  personLinksForPerson: (personId: string, userId: string) =>
    ["person-links", "person", personId, userId] as const,
  personLinkPeek: (linkId: string, userId: string) =>
    ["person-link-peek", linkId, userId] as const,
  personLinkTokenPreview: (token: string) =>
    ["person-link-token", token] as const,
  audit: (clanId: string, userId: string, params: unknown) =>
    ["audit", clanId, userId, params] as const,
  events: (clanId: string, userId: string) =>
    ["events", clanId, userId] as const,
  anniversaries: (clanId: string, userId: string) =>
    ["anniversaries", clanId, userId] as const,
  subscriptions: (clanId: string, userId: string) =>
    ["subscriptions", clanId, userId] as const,
  relativesIndex: (clanId: string, userId: string) =>
    ["relatives-index", clanId, userId] as const,
  adminProfiles: () => ["admin-profiles"] as const,
  platformDbStats: () => ["platform-db-stats"] as const,
  adminClans: () => ["admin-clans"] as const,
  adminFeedback: () => ["admin-feedback"] as const,
  adminUserClans: (userId: string) => ["admin-user-clans", userId] as const,
  contributions: (clanId: string, userId: string, params: unknown) =>
    ["contributions", clanId, userId, params] as const,
  contribution: (id: string, userId: string) =>
    ["contribution", id, userId] as const,
  pendingContributionsCount: (clanId: string, userId: string) =>
    ["pending-contributions-count", clanId, userId] as const,
  clanTodoSummary: (clanId: string, userId: string) =>
    ["clan-todo-summary", clanId, userId] as const,
  clanTodoItems: (
    clanId: string,
    userId: string,
    category: string,
    page: number,
  ) => ["clan-todo-items", clanId, userId, category, page] as const,
  clanTodoCount: (clanId: string, userId: string) =>
    ["clan-todo-count", clanId, userId] as const,
  clanCompletion: (clanId: string, userId: string) =>
    ["clan-completion", clanId, userId] as const,
  kinshipIndex: (clanId: string, userId: string) =>
    ["kinship-index", clanId, userId] as const,
  inlawGhostSpouses: (clanId: string, userId: string) =>
    ["inlaw-ghost-spouses", clanId, userId] as const,
};
