/**
 * Migrate family data from the old site (family-api.thaohk.com)
 * into the new Supabase Cloud project.
 *
 * Old shape (per member):
 *   id, code, fullName, gender Male/Female, dateOfBirth/Death ISO,
 *   occupation, fatherId/motherId/husbandId/wifeId, avatarUrl,
 *   familyId, familyName, isRoot, isPrivate
 *
 * New shape (per migration row):
 *   persons (full_name, gender M/F, is_living, is_root, birth_date,
 *     death_date, bio = "code + occupation", branch_id = null,
 *     birth_family_id (FK to a families row built from parent pair),
 *     photo_path (if avatar present))
 *   families (one row per unique (fatherId, motherId) pair AND
 *     per unique (husbandId, wifeId) marriage pair)
 *   clans (one row, owner = thao.hk90@gmail.com)
 *
 * Usage:
 *   1. Fill OLD_API_TOKEN env (token from browser DevTools) +
 *      SUPABASE_SERVICE_ROLE_KEY in .env.deploy
 *   2. npx tsx scripts/migrate-from-thaohk.ts
 *
 * Idempotent against re-runs by SUFFIX_NAME — change clan name
 * suffix if you want a clean second pass without dedupe headaches.
 */

import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

config({ path: ".env.deploy" });

// ─── Config ──────────────────────────────────────────────────────

const OLD_API_BASE = "https://family-api.thaohk.com";
const OLD_API_TOKEN = process.env.OLD_API_TOKEN ?? "";
const OLD_FAMILY_ID = process.env.OLD_FAMILY_ID ?? "e4757d91-509b-4ac0-8807-8d0b82e3b7ec";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OWNER_EMAIL = process.env.MIGRATE_OWNER_EMAIL ?? "thao.hk90@gmail.com";

const MIGRATE_PHOTOS = process.env.MIGRATE_PHOTOS !== "false"; // default true

if (!OLD_API_TOKEN || !SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing OLD_API_TOKEN (env), VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (.env.deploy)",
  );
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ─── Old-site types (only fields we use) ─────────────────────────

interface OldMember {
  id: string;
  code: string;
  fullName: string;
  gender: "Male" | "Female";
  isRoot: boolean;
  dateOfBirth: string | null;
  dateOfDeath: string | null;
  occupation: string | null;
  avatarUrl: string | null;
  fatherId: string | null;
  motherId: string | null;
  husbandId: string | null;
  wifeId: string | null;
}

interface OldFamily {
  id: string;
  name: string;
  avatarUrl?: string | null;
  description?: string | null;
  address?: string | null;
}

interface PagedResponse<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
}

// ─── Helpers ─────────────────────────────────────────────────────

async function oldApi<T>(path: string): Promise<T> {
  const res = await fetch(`${OLD_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${OLD_API_TOKEN}` },
  });
  if (!res.ok) {
    throw new Error(`${path} → ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as T;
}

/** Convert old ISO timestamp to a Vietnam-local yyyy-mm-dd. */
function toLocalDate(iso: string | null): string | null {
  if (!iso) return null;
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date(iso));
}

function pairKey(a: string | null, b: string | null): string | null {
  if (!a && !b) return null;
  return `${a ?? ""}|${b ?? ""}`;
}

async function lookupOwnerUserId(email: string): Promise<string> {
  const { data, error } = await sb.auth.admin.listUsers({ perPage: 200 });
  if (error) throw new Error(`listUsers: ${error.message}`);
  const u = data.users.find(
    (x) => x.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!u) {
    throw new Error(
      `Owner email ${email} not found in auth.users. Signup first.`,
    );
  }
  return u.id;
}

async function downloadAvatarAndUpload(
  avatarUrl: string,
  clanId: string,
  personId: string,
): Promise<string | null> {
  try {
    const res = await fetch(avatarUrl);
    if (!res.ok) return null;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000) return null;
    const path = `${clanId}/${personId}.jpg`;
    const { error } = await sb.storage
      .from("person-photos")
      .upload(path, buf, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/jpeg",
      });
    if (error) return null;
    return path;
  } catch {
    return null;
  }
}

// ─── Main ────────────────────────────────────────────────────────

async function main() {
  console.log(`Migrating family ${OLD_FAMILY_ID}`);

  // 1. Fetch family meta (name, etc.)
  let family: OldFamily;
  try {
    family = await oldApi<OldFamily>(`/api/family/${OLD_FAMILY_ID}`);
  } catch (e) {
    console.warn(`  family fetch failed (${(e as Error).message}); using fallback name`);
    family = { id: OLD_FAMILY_ID, name: "Migrated Family" };
  }
  console.log(`  family: ${family.name}`);

  // 2. Fetch ALL members (paginate)
  const members: OldMember[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const r = await oldApi<PagedResponse<OldMember>>(
      `/api/member/search?page=${page}&itemsPerPage=50&familyId=${OLD_FAMILY_ID}&searchQuery=`,
    );
    members.push(...r.items);
    totalPages = r.totalPages;
    page++;
  }
  console.log(`  fetched ${members.length} members across ${totalPages} pages`);

  // 3. Look up owner
  const ownerId = await lookupOwnerUserId(OWNER_EMAIL);
  console.log(`  owner: ${OWNER_EMAIL} (${ownerId})`);

  // 4. Create clan
  const clanName = `Họ ${family.name}`;
  const descParts: string[] = [];
  if (family.description) descParts.push(family.description.trim());
  if (family.address) descParts.push(`Địa chỉ: ${family.address.trim()}`);
  const description =
    descParts.length > 0
      ? descParts.join("\n\n")
      : `Nhập từ family-api.thaohk.com (familyId ${OLD_FAMILY_ID})`;
  const clanRes = await sb
    .from("clans")
    .insert({
      name: clanName,
      description,
      owner_id: ownerId,
      visibility: "private",
      max_persons: Math.max(500, members.length + 100),
      max_users: 10,
    })
    .select("id")
    .single();
  if (clanRes.error) throw new Error(`create clan: ${clanRes.error.message}`);
  const clanId = clanRes.data.id;
  console.log(`  clan: ${clanName} (${clanId})`);

  // 5. Plan ID maps
  const oldToNewPersonId = new Map<string, string>();
  for (const m of members) oldToNewPersonId.set(m.id, randomUUID());

  // 6. Build families — ONE map keyed by (husband_id, wife_id).
  //    Both birth-family lookup (children → parents) and marriage
  //    lookup (spouse pair) end up pointing at the SAME (father,
  //    mother) tuple. Using a single map dedupes the case where a
  //    couple both have children in the dataset AND show up as
  //    each other's husband/wife — previously this produced two
  //    `families` rows for the same union, surfaced in the UI as
  //    a duplicate "Vợ/chồng" entry on the person detail page.
  const familyByKey = new Map<string, { id: string; husbandId: string | null; wifeId: string | null }>();

  function addFamily(husbandOldId: string | null, wifeOldId: string | null): string | null {
    if (!husbandOldId && !wifeOldId) return null;
    const k = pairKey(husbandOldId, wifeOldId)!;
    const existing = familyByKey.get(k);
    if (existing) return existing.id;
    const row = {
      id: randomUUID(),
      husbandId: husbandOldId ? (oldToNewPersonId.get(husbandOldId) ?? null) : null,
      wifeId: wifeOldId ? (oldToNewPersonId.get(wifeOldId) ?? null) : null,
    };
    familyByKey.set(k, row);
    return row.id;
  }

  // 6a. Birth families: each (fatherId, motherId) pair.
  for (const m of members) addFamily(m.fatherId, m.motherId);

  // 6b. Marriage families: canonicalise spouse direction on gender
  //     so (X male, A female) reached from either side keys identical.
  for (const m of members) {
    if (!m.husbandId && !m.wifeId) continue;
    const husbandOld = m.gender === "Male" ? m.id : m.husbandId;
    const wifeOld    = m.gender === "Male" ? m.wifeId : m.id;
    addFamily(husbandOld, wifeOld);
  }

  const allFamilies = [...familyByKey.values()];
  console.log(`  families: ${allFamilies.length} (deduped birth + marriage)`);

  // 7. Insert persons (without husband/wife on families yet — they'd
  //    create circular FK; create families with NULL hb/wf first,
  //    then update after persons exist)
  const personRows = members.map((m) => {
    const birthFamilyKey = pairKey(m.fatherId, m.motherId);
    const birth_family_id =
      birthFamilyKey ? (familyByKey.get(birthFamilyKey)?.id ?? null) : null;
    const birth_date = toLocalDate(m.dateOfBirth);
    const death_date = toLocalDate(m.dateOfDeath);
    const bioParts: string[] = [];
    if (m.occupation) bioParts.push(`Nghề: ${m.occupation}`);
    if (m.code) bioParts.push(`Mã cũ: ${m.code}`);
    return {
      id: oldToNewPersonId.get(m.id)!,
      clan_id: clanId,
      full_name: m.fullName,
      gender: m.gender === "Male" ? "M" : "F",
      is_living: !m.dateOfDeath,
      is_root: !!m.isRoot,
      birth_date,
      birth_date_precision: birth_date ? "day" : null,
      death_date,
      death_date_precision: death_date ? "day" : null,
      birth_family_id,
      bio: bioParts.length > 0 ? bioParts.join("\n") : null,
    };
  });

  // First insert all families with husband_id/wife_id = null to
  // dodge the persons↔families circular FK (persons.birth_family_id
  // → families.id, families.husband_id → persons.id).
  const familiesIns = await sb.from("families").insert(
    allFamilies.map((f) => ({
      id: f.id,
      clan_id: clanId,
      husband_id: null,
      wife_id: null,
      union_type: "marriage",
    })),
  );
  if (familiesIns.error) throw new Error(`families insert: ${familiesIns.error.message}`);

  // Insert persons in batches of 50
  for (let i = 0; i < personRows.length; i += 50) {
    const batch = personRows.slice(i, i + 50);
    const res = await sb.from("persons").insert(batch);
    if (res.error) throw new Error(`persons insert: ${res.error.message}`);
  }
  console.log(`  inserted ${personRows.length} persons`);

  // Now update families with husband_id/wife_id (persons exist)
  for (const f of allFamilies) {
    const res = await sb
      .from("families")
      .update({ husband_id: f.husbandId, wife_id: f.wifeId })
      .eq("id", f.id);
    if (res.error) {
      console.warn(`    family ${f.id} update: ${res.error.message}`);
    }
  }
  console.log(`  wired ${allFamilies.length} family spouse links`);

  // 8. Avatars — sequential to be polite to Cloudinary
  if (MIGRATE_PHOTOS) {
    console.log(`  migrating avatars…`);
    let uploaded = 0;
    for (const m of members) {
      if (!m.avatarUrl) continue;
      const personId = oldToNewPersonId.get(m.id)!;
      const path = await downloadAvatarAndUpload(m.avatarUrl, clanId, personId);
      if (path) {
        await sb.from("persons").update({ photo_path: path }).eq("id", personId);
        uploaded++;
      }
    }
    console.log(`  uploaded ${uploaded} avatars`);
  }

  console.log(`\nDone. Clan ${clanId} created with ${members.length} persons.`);
  console.log(`Open https://family-tree-v3.netlify.app/clans/${clanId}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
