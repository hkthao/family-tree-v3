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
  const { data: clan, error } = await admin
    .from("clans")
    .insert({
      name: `Họ ${faker.helpers.arrayElement(VN_SURNAMES)} (${label})`,
      description: `Demo clan with ${size} persons`,
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
  const surname = faker.helpers.arrayElement(VN_SURNAMES);
  const persons: { id: string; gender: "M" | "F"; parentFamily?: string; generation: number }[] = [];

  // Root
  const rootId = randomUUID();
  const root = randName("M");
  await admin.from("persons").insert({
    id: rootId,
    clan_id: clanId,
    full_name: `${surname} ${root.full.split(" ").slice(1).join(" ")}`,
    gender: "M",
    is_root: true,
    is_living: false,
    birth_date: faker.date.between({ from: "1850-01-01", to: "1900-12-31" }).toISOString().slice(0, 10),
    death_date: faker.date.between({ from: "1920-01-01", to: "1970-12-31" }).toISOString().slice(0, 10),
  });
  persons.push({ id: rootId, gender: "M", generation: 1 });

  // BFS: each person gets ~2-4 children up to target size
  let cursor = 0;
  const families: string[] = [];
  while (persons.length < size && cursor < persons.length) {
    const parent = persons[cursor++];
    if (parent.generation >= 7) continue; // cap depth for sanity

    // Spouse
    const spouseId = randomUUID();
    const spouseGender: "M" | "F" = parent.gender === "M" ? "F" : "M";
    const spouseName = randName(spouseGender);
    await admin.from("persons").insert({
      id: spouseId,
      clan_id: clanId,
      full_name: spouseName.full,
      gender: spouseGender,
      is_living: faker.datatype.boolean({ probability: 0.3 }),
    });
    persons.push({ id: spouseId, gender: spouseGender, generation: parent.generation });

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
      await admin.from("persons").insert({
        id: childId,
        clan_id: clanId,
        full_name: `${surname} ${childName.full.split(" ").slice(1).join(" ")}`,
        gender: childGender,
        is_living: parent.generation >= 5 ? faker.datatype.boolean({ probability: 0.85 }) : faker.datatype.boolean({ probability: 0.3 }),
        birth_family_id: familyId,
      });
      persons.push({ id: childId, gender: childGender, generation: parent.generation + 1 });
    }
  }

  console.log(`  ${label}: ${persons.length} persons, ${families.length} families`);
  return clanId;
}

async function main() {
  console.log("Seeding fixtures…");

  const platformAdmin = await createUser("admin@example.test", "Platform Admin", { isPlatformAdmin: true, maxClans: 10 });
  console.log(`  Platform admin: ${platformAdmin}`);

  const sizes: Array<{ label: string; size: number }> = [
    { label: "small", size: 50 },
    { label: "medium", size: 500 },
    // 5000 is slow because each insert hits triggers; comment out unless needed.
    // { label: "large", size: 5000 },
  ];

  for (const { label, size } of sizes) {
    const owner = await createUser(
      `${label}-admin@example.test`,
      `${label} Admin`,
      { maxClans: 1 },
    );
    const clanId = await seedClan(label, size, owner);

    // Editor + viewer members
    const editor = await createUser(`${label}-editor@example.test`, `${label} Editor`);
    const viewer = await createUser(`${label}-viewer@example.test`, `${label} Viewer`);
    await admin.from("clan_members").insert([
      { clan_id: clanId, user_id: editor, role: "editor", invited_by: owner },
      { clan_id: clanId, user_id: viewer, role: "viewer", invited_by: owner },
    ]);

    // Share links: 1 active + 1 expired
    await admin.from("share_links").insert([
      {
        clan_id: clanId,
        token: `share-${label}-active-${randomUUID().slice(0, 8)}`,
        created_by: owner,
        expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      },
      {
        clan_id: clanId,
        token: `share-${label}-expired-${randomUUID().slice(0, 8)}`,
        created_by: owner,
        expires_at: new Date(Date.now() - 86400_000).toISOString(),
      },
    ]);
  }

  console.log("Done. Login with admin@example.test / demo-password-1234");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
