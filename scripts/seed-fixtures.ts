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

const VN_PROVINCES = [
  "Hà Nội", "Hải Dương", "Hưng Yên", "Bắc Ninh", "Nam Định", "Thái Bình",
  "Thanh Hóa", "Nghệ An", "Hà Tĩnh", "Quảng Bình", "Quảng Trị", "Huế",
  "Đà Nẵng", "Quảng Nam", "Bình Định", "Khánh Hòa", "Lâm Đồng",
  "Đồng Nai", "Sài Gòn", "Tiền Giang", "Bến Tre", "Vĩnh Long",
];
const COURTESY_TOKENS_M = [
  "Văn Đại", "Trung Dũng", "Hữu Tài", "Đức Trí", "Quang Minh",
  "Bình An", "Trí Đạt", "Hùng Anh",
];
const COURTESY_TOKENS_F = [
  "Diệu Linh", "Hồng Nhung", "Tâm An", "Phương Thảo", "Mai Hoa",
  "Hạnh Phúc", "Thanh Tâm",
];
const POSTHUMOUS_TOKENS = [
  "Trung Hiếu", "Cẩn Trực", "Khoan Hậu", "Đoan Trang", "Cương Nghị",
  "Nhân Đức", "Thuần Hậu",
];
const NICKNAME_TOKENS = [
  "Bé", "Cu", "Cún", "Tí", "Mít", "Bin", "Bo", "Bống", "Nhím", "Sóc",
];

/** Extra optional Vietnamese fields. Caller spreads into the insert. */
function randExtraFields(
  gender: "M" | "F",
  isLiving: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  // Birth place — ~70% of persons
  if (faker.datatype.boolean({ probability: 0.7 })) {
    out.birth_place = faker.helpers.arrayElement(VN_PROVINCES);
  }
  // Nickname (tên húy) — ~40%, the "small-name" parents called as children
  if (faker.datatype.boolean({ probability: 0.4 })) {
    out.nickname = faker.helpers.arrayElement(NICKNAME_TOKENS);
  }
  // Courtesy (tên tự) — ~25%, more common for older generations
  if (faker.datatype.boolean({ probability: 0.25 })) {
    out.courtesy_name = faker.helpers.arrayElement(
      gender === "M" ? COURTESY_TOKENS_M : COURTESY_TOKENS_F,
    );
  }

  // Deceased-only fields
  if (!isLiving) {
    if (faker.datatype.boolean({ probability: 0.5 })) {
      out.burial_place = faker.helpers.arrayElement(VN_PROVINCES);
    }
    if (faker.datatype.boolean({ probability: 0.3 })) {
      out.posthumous_name = faker.helpers.arrayElement(POSTHUMOUS_TOKENS);
    }
    // Lunar anniversary (ngày giỗ) — most deceased should have one so the
    // notify-events cron has something to dispatch.
    if (faker.datatype.boolean({ probability: 0.85 })) {
      out.death_anniv_lunar_month = faker.number.int({ min: 1, max: 12 });
      out.death_anniv_lunar_day = faker.number.int({ min: 1, max: 28 });
      out.death_anniv_lunar_is_leap = false;
    }
  }

  // Bio — rare blurb
  if (faker.datatype.boolean({ probability: 0.08 })) {
    out.bio = faker.lorem.sentence({ min: 8, max: 18 });
  }
  return out;
}

/**
 * Fetch a deterministic portrait from i.pravatar.cc, upload it to the
 * person-photos bucket, and stamp persons.photo_path. Deterministic by
 * person id so a re-seed reproducing the same uuids would land the
 * same faces — useful when debugging visual diffs across runs.
 *
 * pravatar's pool is ~70 portraits so collisions are expected at scale
 * — fine for fixtures. Network blip / 404 is silently skipped: the
 * person renders the gendered placeholder instead. The seed will not
 * abort over one missing avatar.
 */
async function seedPhotoForPerson(
  personId: string,
  clanId: string,
): Promise<void> {
  try {
    const res = await fetch(`https://i.pravatar.cc/300?u=${personId}`);
    if (!res.ok) return;
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength < 1000) return; // probably an error page, skip
    const path = `${clanId}/${personId}.jpg`;
    const { error: upErr } = await admin.storage
      .from("person-photos")
      .upload(path, buf, {
        cacheControl: "3600",
        upsert: true,
        contentType: "image/jpeg",
      });
    if (upErr) return;
    await admin.from("persons").update({ photo_path: path }).eq("id", personId);
  } catch {
    // network error during seed is non-fatal
  }
}

/**
 * Per-generation photo probability. Photos didn't really exist in
 * Vietnam before the 1900s, so gen 1 (born 1850–1900) gets nothing;
 * gen 2–3 occasionally; recent generations more frequently. Tweaked
 * so a 50-person clan ends up with ~15 photos — enough variety in the
 * tree / detail PDF without hammering the placeholder service.
 */
function photoProbabilityForGen(generation: number): number {
  if (generation <= 1) return 0;
  if (generation === 2) return 0.1;
  if (generation === 3) return 0.25;
  if (generation === 4) return 0.45;
  return 0.6;
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
    ...randExtraFields("M", false),
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
    const spouseLiving = faker.datatype.boolean({ probability: 0.3 });
    const spIns = await admin.from("persons").insert({
      id: spouseId,
      clan_id: clanId,
      full_name: spouseName.full,
      gender: spouseGender,
      is_living: spouseLiving,
      ...randExtraFields(spouseGender, spouseLiving),
    });
    if (spIns.error) throw new Error(`spouse insert: ${spIns.error.message}`);
    persons.push({ id: spouseId, gender: spouseGender, generation: parent.generation });
    married.add(parent.id);
    married.add(spouseId);

    if (faker.datatype.boolean({ probability: photoProbabilityForGen(parent.generation) })) {
      await seedPhotoForPerson(spouseId, clanId);
    }

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
      const childLiving =
        parent.generation >= 5
          ? faker.datatype.boolean({ probability: 0.85 })
          : faker.datatype.boolean({ probability: 0.3 });
      const cIns = await admin.from("persons").insert({
        id: childId,
        clan_id: clanId,
        full_name: `${surname} ${childName.full.split(" ").slice(1).join(" ")}`,
        gender: childGender,
        is_living: childLiving,
        birth_family_id: familyId,
        ...randExtraFields(childGender, childLiving),
      });
      if (cIns.error) throw new Error(`child insert: ${cIns.error.message}`);
      const childGeneration = parent.generation + 1;
      persons.push({ id: childId, gender: childGender, generation: childGeneration });

      if (faker.datatype.boolean({ probability: photoProbabilityForGen(childGeneration) })) {
        await seedPhotoForPerson(childId, clanId);
      }
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
    const fillerLiving = faker.datatype.boolean({ probability: 0.75 });
    const { error: fErr } = await admin.from("persons").insert({
      id: fid,
      clan_id: clanId,
      full_name: filler.full,
      gender: fg,
      is_living: fillerLiving,
      ...randExtraFields(fg, fillerLiving),
    });
    if (fErr) throw new Error(`filler insert: ${fErr.message}`);
    persons.push({ id: fid, gender: fg, generation: 0 });

    // Loose fillers are "modern" people in this fixture — higher
    // photo probability than the rooted generations.
    if (faker.datatype.boolean({ probability: 0.5 })) {
      await seedPhotoForPerson(fid, clanId);
    }
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

/**
 * After the clan loop runs, seed a handful of cross-clan in-law links
 * (Section 28 of plan.md) so the `/inlaws` UI has real rows to show.
 *
 * We service-role-INSERT directly with status='confirmed' (skipping
 * the pending→confirmed trigger which expects an admin auth.uid()).
 * Real-app usage always goes through the propose/confirm RPCs, but
 * the trigger only fires on UPDATE — INSERT with all fields set is
 * fine and lets a re-seed produce deterministic fixtures.
 */
interface SeededClan {
  clanId: string;
  ownerId: string;
  label: string;
}

async function pickFemalePerson(clanId: string): Promise<string | null> {
  // Avoid the root (is_root=true) — that's the male thuỷ tổ in this
  // fixture. We want a married-out daughter / dâu — i.e. someone who
  // could plausibly exist in BOTH clans.
  const { data, error } = await admin
    .from("persons")
    .select("id")
    .eq("clan_id", clanId)
    .eq("gender", "F")
    .eq("is_root", false)
    .is("deleted_at", null)
    .limit(50);
  if (error || !data || data.length === 0) return null;
  return faker.helpers.arrayElement(data).id;
}

async function pickMalePerson(clanId: string): Promise<string | null> {
  const { data, error } = await admin
    .from("persons")
    .select("id")
    .eq("clan_id", clanId)
    .eq("gender", "M")
    .eq("is_root", false)
    .is("deleted_at", null)
    .limit(50);
  if (error || !data || data.length === 0) return null;
  return faker.helpers.arrayElement(data).id;
}

async function seedInlawLinks(seeded: SeededClan[]): Promise<void> {
  if (seeded.length < 4) {
    console.log("  (skipping in-law links — need ≥4 clans)");
    return;
  }
  console.log("  Seeding in-law links…");

  // ── 3 confirmed links: pair adjacent clans, link a female on each side.
  // Same human, two records, so we use same-gender on both sides.
  const confirmedPairs: Array<[SeededClan, SeededClan]> = [
    [seeded[0], seeded[1]],
    [seeded[2], seeded[3]],
  ];
  if (seeded.length >= 6) {
    confirmedPairs.push([seeded[4], seeded[5]]);
  }

  for (const [a, b] of confirmedPairs) {
    const personA = await pickFemalePerson(a.clanId);
    const personB = await pickFemalePerson(b.clanId);
    if (!personA || !personB) continue;
    const { error } = await admin.from("person_links").insert({
      clan_a_id: a.clanId,
      person_a_id: personA,
      clan_b_id: b.clanId,
      person_b_id: personB,
      status: "confirmed",
      created_by: a.ownerId,
      confirmed_by: b.ownerId,
      confirmed_at: new Date(Date.now() - 7 * 86400_000).toISOString(),
      note: `Cùng một người — dâu của ${a.label}, con gái của ${b.label}.`,
    });
    if (error) {
      console.warn(`    confirmed link skip (${a.label}↔${b.label}): ${error.message}`);
    }
  }

  // ── Pending links with invite tokens — show up in /clans/:id/inlaws
  // "Đang chờ" tab so manual testing has something to click.
  const pendingFromClans = seeded.slice(0, 3);
  for (const c of pendingFromClans) {
    // Prefer a male — the "rể" archetype, but really anyone works.
    const personA = (await pickMalePerson(c.clanId)) ?? (await pickFemalePerson(c.clanId));
    if (!personA) continue;
    const token = `inlaw-${c.label}-${randomUUID().slice(0, 12)}`;
    const { error } = await admin.from("person_links").insert({
      clan_a_id: c.clanId,
      person_a_id: personA,
      invite_token: token,
      status: "pending",
      created_by: c.ownerId,
      person_b_name_hint: `${faker.helpers.arrayElement(VN_SURNAMES)} Thị ${faker.helpers.arrayElement(VN_GIVEN_F)}, sinh ~${faker.number.int({ min: 1950, max: 1995 })}`,
      note: "Mã mời mẫu — bấm Chép, dán vào tab ẩn danh để thử luồng xác nhận.",
    });
    if (error) {
      console.warn(`    pending link skip (${c.label}): ${error.message}`);
    }
  }

  console.log("  In-law links seeded.");
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
  const seededClans: SeededClan[] = [];

  for (const spec of roster) {
    const owner = await createUser(spec.ownerEmail, spec.ownerName, { maxClans: 1 });
    const clanId = await seedClan(spec.clanLabel, spec.size, owner);
    seededClans.push({ clanId, ownerId: owner, label: spec.clanLabel });

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

  await seedInlawLinks(seededClans);

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
