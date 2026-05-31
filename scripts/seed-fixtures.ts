/**
 * Seed Supabase local with realistic Vietnamese fixtures for dev + tests.
 * Run with: npm run seed (after npm run db:reset)
 *
 * Creates:
 *   - 1 platform admin
 *   - 3 clans of size small (50), medium (500), large (5000)
 *   - admin/editor/viewer user per clan
 *   - 1 active + 1 expired share-link per clan
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY in .env.local — service-role bypasses RLS.
 * NEVER ship this script's connection logic to production code paths.
 */

import { createClient } from "@supabase/supabase-js";
import { faker } from "@faker-js/faker";
import { randomUUID } from "node:crypto";
import { config } from "dotenv";

import type { Database } from "../src/lib/database.types.ts";

config({ path: ".env.local" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SERVICE_KEY) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const VN_SURNAMES = [
  "Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Huỳnh", "Phan", "Vũ", "Võ",
  "Đặng", "Bùi", "Đỗ", "Hồ", "Ngô", "Dương", "Lý", "Đoàn",
];
const VN_MIDDLE_M = ["Văn", "Hữu", "Đức", "Quốc", "Anh", "Minh", "Tuấn", "Hùng"];
const VN_MIDDLE_F = ["Thị", "Ngọc", "Thanh", "Mỹ", "Thu", "Hương", "Lan"];
const VN_GIVEN_M = [
  "An", "Bình", "Cường", "Dũng", "Đạt", "Huy", "Khang", "Long", "Nam",
  "Phong", "Quang", "Sơn", "Thắng", "Tuấn", "Việt",
];
const VN_GIVEN_F = [
  "Anh", "Bích", "Châu", "Dung", "Hà", "Hằng", "Hoa", "Hồng", "Lan",
  "Linh", "Mai", "Nga", "Phượng", "Quyên", "Thảo", "Trang",
];

function randName(gender: "M" | "F"): { surname: string; full: string } {
  const surname = faker.helpers.arrayElement(VN_SURNAMES);
  const middle = faker.helpers.arrayElement(
    gender === "M" ? VN_MIDDLE_M : VN_MIDDLE_F,
  );
  const given = faker.helpers.arrayElement(
    gender === "M" ? VN_GIVEN_M : VN_GIVEN_F,
  );
  return { surname, full: `${surname} ${middle} ${given}` };
}

async function createUser(email: string, displayName: string, opts?: { isPlatformAdmin?: boolean; maxClans?: number }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "demo-password-1234",
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) throw new Error(`createUser ${email}: ${error?.message}`);

  if (opts?.isPlatformAdmin || opts?.maxClans !== undefined) {
    await admin
      .from("profiles")
      .update({
        is_platform_admin: opts.isPlatformAdmin ?? false,
        max_clans: opts.maxClans ?? 1,
      })
      .eq("id", data.user.id);
  }
  return data.user.id;
}

async function seedClan(label: string, size: number, ownerId: string): Promise<string> {
  // Pick ONE surname per clan and use it for both the clan name and the
  // person names — they used to be drawn independently, producing a
  // "Họ Đỗ" clan populated with "Dương" persons.
  const surname = faker.helpers.arrayElement(VN_SURNAMES);
  const { data: clan, error } = await admin
    .from("clans")
    .insert({
      name: `Họ ${surname}`,
      description: `Dòng họ ${surname} — bộ dữ liệu mẫu (${label}, ${size} người).`,
      owner_id: ownerId,
      visibility: "private",
      max_persons: size + 100,
      max_users: 10,
    })
    .select("id")
    .single();
  if (error || !clan) throw new Error(`seedClan ${label}: ${error?.message}`);
  const clanId = clan.id;

  // Build a simple tree: 1 root → ~10 children → grandchildren cascading.
  // For size 5000 we keep it shallow but wide.
  const persons: { id: string; gender: "M" | "F"; parentFamily?: string; generation: number }[] = [];

  // Root
  const rootId = randomUUID();
  const root = randName("M");
  const rootIns = await admin.from("persons").insert({
    id: rootId,
    clan_id: clanId,
    full_name: `${surname} ${root.full.split(" ").slice(1).join(" ")}`,
    gender: "M",
    is_root: true,
    is_living: false,
    birth_date: faker.date.between({ from: "1850-01-01", to: "1900-12-31" }).toISOString().slice(0, 10),
    birth_date_precision: "day",
    death_date: faker.date.between({ from: "1920-01-01", to: "1970-12-31" }).toISOString().slice(0, 10),
    death_date_precision: "day",
  });
  if (rootIns.error) throw new Error(`seed root: ${rootIns.error.message}`);
  persons.push({ id: rootId, gender: "M", generation: 1 });

  // BFS: each iteration takes a person who doesn't already have a family
  // and gives them a spouse + 1–4 children. We track who's already
  // "married off" so we don't double-spouse anyone — previously the loop
  // gave a spouse to every parent including ones added as spouses,
  // which both produced weird trees and burned through the size budget
  // on extra spouses that never had children.
  const married = new Set<string>();
  let cursor = 0;
  const families: string[] = [];
  while (persons.length < size && cursor < persons.length) {
    const parent = persons[cursor++];
    if (parent.generation >= 10) continue;
    if (married.has(parent.id)) continue;

    // Spouse
    const spouseId = randomUUID();
    const spouseGender: "M" | "F" = parent.gender === "M" ? "F" : "M";
    const spouseName = randName(spouseGender);
    const spIns = await admin.from("persons").insert({
      id: spouseId,
      clan_id: clanId,
      full_name: spouseName.full,
      gender: spouseGender,
      is_living: faker.datatype.boolean({ probability: 0.3 }),
    });
    if (spIns.error) throw new Error(`spouse insert: ${spIns.error.message}`);
    persons.push({ id: spouseId, gender: spouseGender, generation: parent.generation });
    married.add(parent.id);
    married.add(spouseId);

    // Family
    const familyId = randomUUID();
    const husband = parent.gender === "M" ? parent.id : spouseId;
    const wife = parent.gender === "F" ? parent.id : spouseId;
    await admin.from("families").insert({
      id: familyId,
      clan_id: clanId,
      husband_id: husband,
      wife_id: wife,
      union_type: "marriage",
    });
    families.push(familyId);

    // Children
    const numChildren = faker.number.int({ min: 1, max: 4 });
    for (let i = 0; i < numChildren && persons.length < size; i++) {
      const childId = randomUUID();
      const childGender: "M" | "F" = faker.datatype.boolean() ? "M" : "F";
      const childName = randName(childGender);
      const cIns = await admin.from("persons").insert({
        id: childId,
        clan_id: clanId,
        full_name: `${surname} ${childName.full.split(" ").slice(1).join(" ")}`,
        gender: childGender,
        is_living: parent.generation >= 5 ? faker.datatype.boolean({ probability: 0.85 }) : faker.datatype.boolean({ probability: 0.3 }),
        birth_family_id: familyId,
      });
      if (cIns.error) throw new Error(`child insert: ${cIns.error.message}`);
      persons.push({ id: childId, gender: childGender, generation: parent.generation + 1 });
    }
  }

  // The BFS doesn't always hit the target — small clans cluster at top of
  // tree and married-skip iterations slow growth. Fill the remainder with
  // loose persons (no parents, no spouse) so we reliably land on `size`.
  // Loose persons live in the orphan bucket of the dashboard / Tree, which
  // is itself a useful state to exercise in manual testing.
  while (persons.length < size) {
    const fg: "M" | "F" = faker.datatype.boolean() ? "M" : "F";
    const filler = randName(fg);
    const fid = randomUUID();
    const { error: fErr } = await admin.from("persons").insert({
      id: fid,
      clan_id: clanId,
      full_name: filler.full,
      gender: fg,
      is_living: faker.datatype.boolean({ probability: 0.75 }),
    });
    if (fErr) throw new Error(`filler insert: ${fErr.message}`);
    persons.push({ id: fid, gender: fg, generation: 0 });
  }

  console.log(`  ${label}: ${persons.length} persons, ${families.length} families`);
  return clanId;
}

/** A clan slot: who owns it, what its tree looks like, what extras we add. */
interface ClanSpec {
  ownerEmail: string;
  ownerName: string;
  clanLabel: string; // appears in name; also used to compose tokens
  size: number;
  visibility: "private" | "public";
  withEditor: boolean;
  withViewer: boolean;
  withShareLinks: boolean;
}

function buildClanRoster(): ClanSpec[] {
  const specs: ClanSpec[] = [];

  // --- Named clans (backward-compatible logins kept on purpose) -----------
  specs.push({
    ownerEmail: "small-admin@example.test",
    ownerName: "Small Admin",
    clanLabel: "small",
    size: 50,
    visibility: "private",
    withEditor: true,
    withViewer: true,
    withShareLinks: true,
  });
  specs.push({
    // The 100-member target the user asked for. Use this clan to exercise
    // pagination, search, tree perf, /admin filtering, share-view…
    ownerEmail: "medium-admin@example.test",
    ownerName: "Medium Admin",
    clanLabel: "medium",
    size: 100,
    visibility: "public",
    withEditor: true,
    withViewer: true,
    withShareLinks: true,
  });

  // --- 48 generated clans with a realistic size distribution --------------
  // Sizes weighted toward small (most real-world clans haven't been
  // entered fully yet). Five public ones for share-link / hide-living
  // testing without re-seeding.
  for (let i = 1; i <= 48; i++) {
    const n = i.toString().padStart(3, "0");
    const size = pickClanSize(i);
    specs.push({
      ownerEmail: `clan-${n}-admin@example.test`,
      ownerName: `Clan ${n} Admin`,
      clanLabel: `clan-${n}`,
      size,
      visibility: i % 7 === 0 ? "public" : "private",
      // Editor/viewer only on bigger clans, so we don't bloat user count.
      withEditor: size >= 20,
      withViewer: size >= 20,
      withShareLinks: i % 5 === 0,
    });
  }

  return specs;
}

function pickClanSize(i: number): number {
  // Roughly: a few medium (30–50), most small (5–20), one tiny (1–3) every
  // few rows so the dashboard "empty / starter" state is covered too.
  if (i % 12 === 0) return faker.number.int({ min: 30, max: 50 });
  if (i % 5 === 0) return faker.number.int({ min: 15, max: 30 });
  if (i % 9 === 0) return faker.number.int({ min: 1, max: 3 });
  return faker.number.int({ min: 5, max: 15 });
}

async function main() {
  console.log("Seeding fixtures…");
  const t0 = Date.now();

  const platformAdmin = await createUser(
    "admin@example.test",
    "Platform Admin",
    { isPlatformAdmin: true, maxClans: 10 },
  );
  console.log(`  Platform admin: ${platformAdmin}`);

  const roster = buildClanRoster();
  console.log(`  Planning ${roster.length} clans…`);

  for (const spec of roster) {
    const owner = await createUser(spec.ownerEmail, spec.ownerName, { maxClans: 1 });
    const clanId = await seedClan(spec.clanLabel, spec.size, owner);

    if (spec.visibility === "public") {
      await admin.from("clans").update({ visibility: "public" }).eq("id", clanId);
    }

    if (spec.withEditor) {
      const editorEmail =
        spec.clanLabel.startsWith("clan-")
          ? `${spec.clanLabel}-editor@example.test`
          : `${spec.clanLabel}-editor@example.test`;
      const editor = await createUser(editorEmail, `${spec.ownerName} Editor`);
      await admin
        .from("clan_members")
        .insert({ clan_id: clanId, user_id: editor, role: "editor", invited_by: owner });
    }
    if (spec.withViewer) {
      const viewerEmail = `${spec.clanLabel}-viewer@example.test`;
      const viewer = await createUser(viewerEmail, `${spec.ownerName} Viewer`);
      await admin
        .from("clan_members")
        .insert({ clan_id: clanId, user_id: viewer, role: "viewer", invited_by: owner });
    }

    if (spec.withShareLinks) {
      await admin.from("share_links").insert([
        {
          clan_id: clanId,
          token: `share-${spec.clanLabel}-active-${randomUUID().slice(0, 8)}`,
          created_by: owner,
          expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
          is_revoked: false,
        },
        {
          clan_id: clanId,
          token: `share-${spec.clanLabel}-expired-${randomUUID().slice(0, 8)}`,
          created_by: owner,
          expires_at: new Date(Date.now() - 86400_000).toISOString(),
          is_revoked: false,
        },
      ]);
    }
  }

  const totalSize = roster.reduce((acc, s) => acc + s.size, 0);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(
    `Done in ${dt}s. ${roster.length} clans, ~${totalSize} persons total.`,
  );
  console.log("Login with admin@example.test / demo-password-1234");
  console.log(
    "Big clan for manual perf testing: medium-admin@example.test (100 members, public).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
