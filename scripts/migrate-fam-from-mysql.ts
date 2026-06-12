/**
 * Import FAM-* families from the old MySQL DB (family-tree-mysql-prod on VPS)
 * into Supabase Cloud — only families with member count > 1.
 *
 * Input: /tmp/fam-import/families.jsonl + members.jsonl (already dumped via
 * mysql --skip-column-names from the prod container).
 *
 * One MySQL family → one Supabase clan. Same pattern as
 * scripts/migrate-from-thaohk.ts (clan + families + persons + avatars),
 * but reads from local JSONL dumps instead of the old HTTP API.
 *
 * Skips a family if a clan with the same name already exists for the owner.
 */
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.deploy" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OWNER_ID =
  process.env.MIGRATE_OWNER_ID ?? "03034d18-8866-4246-a027-6b5bffc55fa9";
const MIGRATE_PHOTOS = process.env.MIGRATE_PHOTOS !== "false";

const DUMP_DIR = process.env.DUMP_DIR ?? "/tmp/fam-import";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.deploy");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface OldFamily {
  id: string;
  code: string;
  name: string;
  description: string | null;
  address: string | null;
  avatar_url: string | null;
}

interface OldMember {
  id: string;
  code: string;
  family_id: string;
  full_name: string;
  gender: "Male" | "Female" | null;
  is_root: number | boolean;
  date_of_birth: string | null;
  date_of_death: string | null;
  occupation: string | null;
  avatar_url: string | null;
  father_id: string | null;
  mother_id: string | null;
  husband_id: string | null;
  wife_id: string | null;
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8")
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as T);
}

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

async function clanExists(name: string): Promise<string | null> {
  const { data, error } = await sb
    .from("clans")
    .select("id")
    .eq("owner_id", OWNER_ID)
    .eq("name", name)
    .maybeSingle();
  if (error) throw new Error(`clanExists: ${error.message}`);
  return data?.id ?? null;
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

async function importFamily(fam: OldFamily, members: OldMember[]): Promise<void> {
  const clanName = fam.name.trim();
  console.log(`\n=== ${fam.code} — ${clanName} (${members.length} members) ===`);

  const existing = await clanExists(clanName);
  if (existing) {
    console.log(`  SKIP — clan "${clanName}" already exists (${existing})`);
    return;
  }

  const descParts: string[] = [];
  if (fam.description) descParts.push(fam.description.trim());
  if (fam.address) descParts.push(`Địa chỉ: ${fam.address.trim()}`);
  descParts.push(`Nhập từ family_tree_db (familyId ${fam.id}, code ${fam.code})`);

  const clanRes = await sb
    .from("clans")
    .insert({
      name: clanName,
      description: descParts.join("\n\n"),
      owner_id: OWNER_ID,
      visibility: "private",
      max_persons: Math.max(500, members.length + 100),
      max_users: 10,
    })
    .select("id")
    .single();
  if (clanRes.error) throw new Error(`create clan: ${clanRes.error.message}`);
  const clanId = clanRes.data.id;
  console.log(`  clan created: ${clanId}`);

  const oldToNew = new Map<string, string>();
  for (const m of members) oldToNew.set(m.id, randomUUID());

  const familyByKey = new Map<
    string,
    { id: string; husbandId: string | null; wifeId: string | null }
  >();
  const addFamily = (h: string | null, w: string | null): string | null => {
    if (!h && !w) return null;
    const k = pairKey(h, w)!;
    const existing = familyByKey.get(k);
    if (existing) return existing.id;
    const row = {
      id: randomUUID(),
      husbandId: h ? (oldToNew.get(h) ?? null) : null,
      wifeId: w ? (oldToNew.get(w) ?? null) : null,
    };
    familyByKey.set(k, row);
    return row.id;
  };

  for (const m of members) addFamily(m.father_id, m.mother_id);
  for (const m of members) {
    if (!m.husband_id && !m.wife_id) continue;
    const isMale = m.gender === "Male";
    const husbandOld = isMale ? m.id : m.husband_id;
    const wifeOld = isMale ? m.wife_id : m.id;
    addFamily(husbandOld, wifeOld);
  }
  const allFamilies = [...familyByKey.values()];
  console.log(`  families (birth+marriage, deduped): ${allFamilies.length}`);

  const personRows = members.map((m) => {
    const birthFamilyKey = pairKey(m.father_id, m.mother_id);
    const birth_family_id = birthFamilyKey
      ? (familyByKey.get(birthFamilyKey)?.id ?? null)
      : null;
    const birth_date = toLocalDate(m.date_of_birth);
    const death_date = toLocalDate(m.date_of_death);
    const bioParts: string[] = [];
    if (m.occupation) bioParts.push(`Nghề: ${m.occupation}`);
    if (m.code) bioParts.push(`Mã cũ: ${m.code}`);
    const gender = m.gender === "Male" ? "M" : m.gender === "Female" ? "F" : "M";
    return {
      id: oldToNew.get(m.id)!,
      clan_id: clanId,
      full_name: m.full_name,
      gender,
      is_living: !m.date_of_death,
      is_root: !!m.is_root,
      birth_date,
      birth_date_precision: birth_date ? "day" : null,
      death_date,
      death_date_precision: death_date ? "day" : null,
      birth_family_id,
      bio: bioParts.length > 0 ? bioParts.join("\n") : null,
    };
  });

  const famIns = await sb.from("families").insert(
    allFamilies.map((f) => ({
      id: f.id,
      clan_id: clanId,
      husband_id: null,
      wife_id: null,
      union_type: "marriage",
    })),
  );
  if (famIns.error) throw new Error(`families insert: ${famIns.error.message}`);

  for (let i = 0; i < personRows.length; i += 50) {
    const batch = personRows.slice(i, i + 50);
    const res = await sb.from("persons").insert(batch);
    if (res.error) throw new Error(`persons insert: ${res.error.message}`);
  }
  console.log(`  inserted ${personRows.length} persons`);

  for (const f of allFamilies) {
    const res = await sb
      .from("families")
      .update({ husband_id: f.husbandId, wife_id: f.wifeId })
      .eq("id", f.id);
    if (res.error) console.warn(`    family ${f.id}: ${res.error.message}`);
  }
  console.log(`  wired ${allFamilies.length} spouse links`);

  if (MIGRATE_PHOTOS) {
    let uploaded = 0;
    for (const m of members) {
      if (!m.avatar_url) continue;
      const personId = oldToNew.get(m.id)!;
      const path = await downloadAvatarAndUpload(m.avatar_url, clanId, personId);
      if (path) {
        await sb.from("persons").update({ photo_path: path }).eq("id", personId);
        uploaded++;
      }
    }
    if (uploaded > 0) console.log(`  uploaded ${uploaded} avatars`);
  }

  console.log(`  DONE — https://giapha.thaohk.com/clans/${clanId}`);
}

async function main(): Promise<void> {
  const families = readJsonl<OldFamily>(`${DUMP_DIR}/families.jsonl`);
  const members = readJsonl<OldMember>(`${DUMP_DIR}/members.jsonl`);
  const byFamily = new Map<string, OldMember[]>();
  for (const m of members) {
    const arr = byFamily.get(m.family_id) ?? [];
    arr.push(m);
    byFamily.set(m.family_id, arr);
  }
  for (const fam of families) {
    const ms = byFamily.get(fam.id) ?? [];
    if (ms.length <= 1) {
      console.log(`SKIP ${fam.code} — only ${ms.length} member(s)`);
      continue;
    }
    await importFamily(fam, ms);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
