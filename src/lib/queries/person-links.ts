/**
 * Cross-clan in-law links (Section 28 of plan.md).
 *
 * Each function wraps one RPC or one PostgREST round-trip. The
 * structural pattern matches share-links.ts.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabase as defaultClient } from "@/lib/supabase";

type Client = SupabaseClient<Database>;

export type PersonLinkStatus = "pending" | "confirmed" | "revoked";

export interface PersonLink {
  id: string;
  status: PersonLinkStatus;
  clan_a_id: string;
  person_a_id: string;
  clan_b_id: string | null;
  person_b_id: string | null;
  invite_token: string | null;
  person_b_name_hint: string | null;
  note: string | null;
  created_by: string;
  confirmed_by: string | null;
  created_at: string;
  confirmed_at: string | null;
  revoked_at: string | null;
}

/**
 * Generate a short, URL-safe random token client-side. The DB has a
 * UNIQUE constraint on invite_token — collisions would error out, but
 * with 16 random bytes that's astronomically unlikely.
 */
function makeToken(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Cheap count of pending links involving this clan, on either side.
 * Drives the drawer badge — same role contribution counts play. RLS
 * already filters out rows the caller can't see, so the number we
 * get back is "what's pending and visible to me in this clan".
 *
 * Today (token-only discovery), pending rows always have clan_b_id
 * NULL, so the OR clause only ever matches clan_a_id. When
 * public-discovery lands, admin B's drawer will start counting
 * incoming invites automatically — no badge wiring change needed.
 */
export async function countPendingPersonLinks(
  clanId: string,
  client: Client = defaultClient,
): Promise<number> {
  const { count, error } = await client
    .from("person_links")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending")
    .or(`clan_a_id.eq.${clanId},clan_b_id.eq.${clanId}`);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * Predicate that matches every React Query key touched by the in-law
 * links feature. Used by every mutation's onSuccess to drop ALL
 * caches whose data might have shifted — list views, count badges,
 * single-link peeks, token previews, family-card relatives, and
 * Tree.tsx's badge-dialog one-off. Centralising it ensures the next
 * person adding a query under one of these prefixes gets
 * invalidated for free, instead of silently going stale.
 *
 * Each prefix corresponds to a queryKey[0] used somewhere in the
 * codebase. Add new prefixes here when introducing a new query.
 */
const INLAW_QUERY_PREFIXES = new Set([
  "person-links",
  "person-link-peek",
  "person-link-token",
  "inlaw-peer-relatives",
  "tree-inlaw-dialog",
  "tree-inlaw-peek",
  "inlaw-proposal-preview",
  "inlaw-local-person",
  "inlaw-confirm-search",
  "inlaws-people-search",
  "inlaws-peer-clans",
  "inlaws-peer-persons",
  "inlaw-ghost-spouses",
]);

export function isInlawCacheKey(queryKey: readonly unknown[]): boolean {
  const head = queryKey[0];
  return typeof head === "string" && INLAW_QUERY_PREFIXES.has(head);
}

/** List every link involving the given clan (either side). */
export async function listLinksForClan(
  clanId: string,
  client: Client = defaultClient,
): Promise<PersonLink[]> {
  const { data, error } = await client
    .from("person_links")
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .or(`clan_a_id.eq.${clanId},clan_b_id.eq.${clanId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonLink[];
}

/** Active (confirmed) links involving the given person. */
export async function listLinksForPerson(
  personId: string,
  client: Client = defaultClient,
): Promise<PersonLink[]> {
  const { data, error } = await client
    .from("person_links")
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .eq("status", "confirmed")
    .or(`person_a_id.eq.${personId},person_b_id.eq.${personId}`);
  if (error) throw new Error(error.message);
  return (data ?? []) as PersonLink[];
}

export interface ProposeLinkInput {
  clanAId: string;
  personAId: string;
  personBNameHint?: string;
  note?: string;
  createdBy: string;
}

/**
 * Insert a pending link in token mode. The B side stays null; admin B
 * fills it via `confirmByToken`.
 */
export async function proposeLink(
  input: ProposeLinkInput,
  client: Client = defaultClient,
): Promise<PersonLink> {
  const token = makeToken();
  const { data, error } = await client
    .from("person_links")
    .insert({
      clan_a_id: input.clanAId,
      person_a_id: input.personAId,
      invite_token: token,
      person_b_name_hint: input.personBNameHint?.trim() || null,
      note: input.note?.trim() || null,
      created_by: input.createdBy,
    })
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return data as PersonLink;
}

/**
 * Public-discovery mode propose: admin A already picked clan B and
 * person B from a public-clan search, so the pending row has both
 * sides filled and no invite_token. Admin B sees it in their own
 * /inlaws "Đang chờ" tab + gets emailed by notify-inlaw.
 */
export interface ProposeLinkDirectInput {
  clanAId: string;
  personAId: string;
  clanBId: string;
  personBId: string;
  note?: string;
  createdBy: string;
}

export async function proposeLinkDirect(
  input: ProposeLinkDirectInput,
  client: Client = defaultClient,
): Promise<PersonLink> {
  const { data, error } = await client
    .from("person_links")
    .insert({
      clan_a_id: input.clanAId,
      person_a_id: input.personAId,
      clan_b_id: input.clanBId,
      person_b_id: input.personBId,
      note: input.note?.trim() || null,
      created_by: input.createdBy,
    })
    .select(
      "id, status, clan_a_id, person_a_id, clan_b_id, person_b_id, invite_token, person_b_name_hint, note, created_by, confirmed_by, created_at, confirmed_at, revoked_at",
    )
    .single();
  if (error) throw new Error(error.message);
  return data as PersonLink;
}

/**
 * Admin B accepts a direct-mode pending link they've been offered.
 * The row already has clan_b_id + person_b_id; we just flip status,
 * and the protect_person_link_transitions trigger stamps
 * confirmed_by + confirmed_at.
 */
export async function acceptLinkDirect(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  // .select() forces return=representation so the trigger's raised
  // errors surface as client errors (see RLS test learning).
  const { error } = await client
    .from("person_links")
    .update({ status: "confirmed" })
    .eq("id", linkId)
    .select("status");
  if (error) throw new Error(error.message);
}

export async function revokeLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client
    .from("person_links")
    .update({ status: "revoked" })
    .eq("id", linkId);
  if (error) throw new Error(error.message);
}

/**
 * Fire-and-forget call to the notify-inlaw Edge function. The function
 * inspects the row's CURRENT status and emails the appropriate side
 * — caller doesn't have to tell us which event fired. Errors are
 * swallowed so a Resend outage / network blip never breaks the user's
 * action.
 */
export function notifyInlaw(linkId: string): void {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!base || !anon) return;
  fetch(`${base}/functions/v1/notify-inlaw`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
    body: JSON.stringify({ link_id: linkId }),
  }).catch(() => {
    /* see jsdoc */
  });
}

export async function deletePendingLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<void> {
  const { error } = await client.from("person_links").delete().eq("id", linkId);
  if (error) throw new Error(error.message);
}

// ─── RPC wrappers ────────────────────────────────────────────────────

export interface LinkTokenPreview {
  link_id: string;
  clan_a_name: string;
  person_a_name: string;
  person_a_gender: "M" | "F";
  person_a_birth_year: number | null;
  person_a_death_year: number | null;
  person_b_name_hint: string | null;
  note: string | null;
  created_at: string;
}

export async function resolveTokenPreview(
  token: string,
  client: Client = defaultClient,
): Promise<LinkTokenPreview> {
  const { data, error } = await client.rpc("resolve_link_token", {
    p_token: token,
  });
  if (error) throw new Error(error.message);
  return data as unknown as LinkTokenPreview;
}

export async function confirmByToken(
  args: { token: string; clanBId: string; personBId: string },
  client: Client = defaultClient,
): Promise<string> {
  const { data, error } = await client.rpc("confirm_link_by_token", {
    p_token: args.token,
    p_clan_b: args.clanBId,
    p_person_b: args.personBId,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export interface LinkPeek {
  masked: boolean;
  clan_id: string;
  clan_name: string;
  person_id: string;
  full_name?: string;
  gender?: "M" | "F";
  generation?: number | null;
  birth_year?: number | null;
  death_year?: number | null;
  is_living: boolean;
}

export async function peekLink(
  linkId: string,
  client: Client = defaultClient,
): Promise<LinkPeek> {
  const { data, error } = await client.rpc("get_link_peek", {
    p_link_id: linkId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as LinkPeek;
}

/**
 * Read-through preview for direct-mode pending invites. Admin B
 * normally can't SELECT clan_a or person_a (private clan, RLS); this
 * RPC reaches around RLS to surface the minimal A-side info needed
 * to render the proposal row in /inlaws.
 */
export interface InlawProposalPreview {
  link_id: string;
  status: PersonLinkStatus;
  clan_a_id: string;
  clan_a_name: string;
  person_a_id: string;
  person_a_name: string;
  person_a_gender: "M" | "F";
  person_a_birth_year: number | null;
  person_a_death_year: number | null;
  person_b_name_hint: string | null;
  note: string | null;
  created_at: string;
}

export async function getInlawProposalPreview(
  linkId: string,
  client: Client = defaultClient,
): Promise<InlawProposalPreview> {
  const { data, error } = await client.rpc("get_inlaw_proposal_preview", {
    p_link_id: linkId,
  });
  if (error) throw new Error(error.message);
  return data as unknown as InlawProposalPreview;
}

// ─── Phase 3 — extended family across clans ─────────────────────────

export interface InlawRelativeCard {
  id: string;
  clan_id: string;
  masked: boolean;
  is_living: boolean;
  gender: "M" | "F";
  full_name?: string;
  generation?: number | null;
  birth_year?: number | null;
  death_year?: number | null;
  /**
   * Only set for entries in the `children` list: the OTHER parent
   * (peer's spouse) that the child shares with peer. Null for single-
   * parent family units. Used by InlawMiniTree to anchor each child
   * to the correct (peer, spouse) pair when peer has multiple
   * spouses.
   */
  other_parent_id?: string | null;
}

export interface InlawFocalCard extends InlawRelativeCard {
  /**
   * True when the caller is also a member of the peer clan — UI can
   * render a deep-link to /clans/<peer>/people/<id> that will resolve
   * for them.
   */
  caller_can_visit: boolean;
}

export interface InlawPeerRelatives {
  link_id: string;
  peer_clan_id: string;
  peer_clan_name: string;
  peer: InlawFocalCard;
  parents: InlawRelativeCard[];
  spouses: InlawRelativeCard[];
  children: InlawRelativeCard[];
}

/**
 * One-hop "mini family" of the peer person on a confirmed link.
 * Parents, spouses, children, all masked per hide_living_for_nonmembers
 * if caller isn't a peer-clan member.
 */
export async function getInlawPeerRelatives(
  linkId: string,
  viewingClanId: string | null,
  client: Client = defaultClient,
): Promise<InlawPeerRelatives> {
  const { data, error } = await client.rpc("get_inlaw_peer_relatives", {
    p_link_id: linkId,
    p_viewing_clan_id: viewingClanId ?? undefined,
  });
  if (error) throw new Error(error.message);
  return data as unknown as InlawPeerRelatives;
}

/** One peer-spouse to ghost onto the local clan's tree. */
export interface InlawGhostSpouse {
  /** Local person (in the rendering clan) whose card the ghost
   *  attaches to as a spouse. */
  localPersonId: string;
  linkId: string;
  /** Peer clan info — used for the "Họ X" tag on the ghost card. */
  peerClanId: string;
  peerClanName: string;
  /** Peer-clan spouse who is the actual real-world partner. */
  spouseId: string;
  spouseFullName: string | null;
  spouseGender: "M" | "F";
  spouseBirthYear: number | null;
  spouseDeathYear: number | null;
  spouseIsLiving: boolean;
  /** True when peer-clan masking redacted the name (living person on
   *  a clan that hides living non-members). */
  masked: boolean;
}

/**
 * Pre-compute every "ghost spouse" to render on this clan's tree.
 *
 * For each confirmed inlaw link the clan is part of, look up the peer
 * person's spouses (in the OTHER clan). Those spouses are the people
 * who married into our local person from across the border — their
 * record lives in the peer clan but they belong on OUR tree next to
 * the local half of the link.
 *
 * Returns one entry per ghost candidate (a local person can have
 * multiple ghosts if their peer-side counterpart has multiple
 * spouses). N round-trips because each link gets its own peek RPC —
 * fine up to ~100 links; for bigger clans this would warrant a
 * single SQL function returning the whole bundle.
 */
export async function getInlawGhostSpouses(
  clanId: string,
  client: Client = defaultClient,
): Promise<InlawGhostSpouse[]> {
  const links = await listLinksForClan(clanId, client);
  const confirmed = links.filter(
    (l) => l.status === "confirmed" && l.person_a_id && l.person_b_id,
  );
  if (confirmed.length === 0) return [];

  // Build the "already mirrored locally" set so we never ghost a
  // peer-clan person who ALSO has a local-clan twin via another
  // confirmed link. Example: Kim Hương (Trần) ↔ Kim Hương (Huỳnh)
  // AND Kim Thảo (Trần) ↔ Kim Thảo (Huỳnh). When peeking Kim Hương's
  // peer (Huỳnh), her spouse there is Kim Thảo (Huỳnh) — but that
  // person is ALREADY on this clan's tree as Kim Thảo (Trần). The
  // ghost would duplicate him. Skip when (peerClanId, peerPersonId)
  // already appears as the peer side of some other confirmed link.
  const mirroredPeers = new Set<string>();
  for (const link of confirmed) {
    if (link.clan_a_id === clanId && link.clan_b_id && link.person_b_id) {
      mirroredPeers.add(`${link.clan_b_id}|${link.person_b_id}`);
    } else if (link.clan_b_id === clanId && link.clan_a_id && link.person_a_id) {
      mirroredPeers.add(`${link.clan_a_id}|${link.person_a_id}`);
    }
  }

  // Fetch peer relatives in parallel — one round-trip per link.
  // Pass the viewing clan so the RPC picks the right peer side for
  // users who are members of BOTH clans (otherwise the dual-membership
  // is_clan_member heuristic picks the wrong side and we ghost the
  // wrong person).
  const peers = await Promise.all(
    confirmed.map(async (link) => {
      try {
        const rel = await getInlawPeerRelatives(link.id, clanId, client);
        return { link, rel };
      } catch {
        // RPC may raise if peer clan revoked / data went away —
        // skip silently and the ghost simply doesn't show.
        return null;
      }
    }),
  );

  const out: InlawGhostSpouse[] = [];
  for (const entry of peers) {
    if (!entry) continue;
    const { link, rel } = entry;
    const localPersonId =
      link.clan_a_id === clanId ? link.person_a_id : link.person_b_id;
    if (!localPersonId) continue;

    for (const spouse of rel.spouses ?? []) {
      // Dedup: skip if this peer-spouse is already represented on the
      // local tree via another link's local mirror.
      if (mirroredPeers.has(`${rel.peer_clan_id}|${spouse.id}`)) continue;
      out.push({
        localPersonId,
        linkId: link.id,
        peerClanId: rel.peer_clan_id,
        peerClanName: rel.peer_clan_name,
        spouseId: spouse.id,
        spouseFullName: spouse.full_name ?? null,
        spouseGender: spouse.gender,
        spouseBirthYear: spouse.birth_year ?? null,
        spouseDeathYear: spouse.death_year ?? null,
        spouseIsLiving: spouse.is_living,
        masked: spouse.masked,
      });
    }
  }
  return out;
}

export interface InlawExportEntry {
  /** The local person (in the exporting clan) whose card the link sits on. */
  localPersonId: string;
  peek: LinkPeek;
}

/**
 * Bundle of confirmed links involving the exporting clan, peeked so
 * the peer name + clan are ready for GEDCOM serialization. Each row
 * is one local-person→peer pair; persons with multiple links produce
 * multiple entries.
 *
 * Peer rows that fail to peek (peer person soft-deleted, etc.) are
 * dropped silently — export shouldn't break over one missing link.
 */
export async function getClanInlawExports(
  clanId: string,
  client: Client = defaultClient,
): Promise<InlawExportEntry[]> {
  const links = await listLinksForClan(clanId, client);
  const confirmed = links.filter((l) => l.status === "confirmed");
  const out: InlawExportEntry[] = [];
  for (const l of confirmed) {
    const localId =
      l.clan_a_id === clanId
        ? l.person_a_id
        : l.clan_b_id === clanId
          ? l.person_b_id
          : null;
    if (!localId) continue;
    try {
      const peek = await peekLink(l.id, client);
      out.push({ localPersonId: localId, peek });
    } catch {
      // dead peer / RLS hiccup — skip rather than abort the export
    }
  }
  return out;
}
