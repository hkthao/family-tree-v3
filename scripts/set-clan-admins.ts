/**
 * For each (clan_id, admin_email) pair below:
 *   1. Find or create a Supabase auth user with email_confirm=true
 *      and a random 6-digit numeric password.
 *   2. Transfer clans.owner_id to that user.
 *   3. Upsert a clan_members row (role='admin').
 *
 * Platform admin's existing clan_members row is left in place
 * (per user request) so they can still see the clan in "Của tôi".
 *
 * Prints email + temp password at the end — share with each admin
 * so they can log in and change it.
 */
import { createClient } from "@supabase/supabase-js";
import { randomInt } from "node:crypto";
import { readFileSync } from "node:fs";
import { config } from "dotenv";

config({ path: ".env.deploy" });

const ASSIGNMENTS_FILE =
  process.env.ASSIGNMENTS_FILE ?? "scripts/.clan-admin-assignments.json";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const PLATFORM_ADMIN_ID = "03034d18-8866-4246-a027-6b5bffc55fa9";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

interface Assignment {
  clanId: string;
  clanName: string;
  email: string;
}

function loadAssignments(): Assignment[] {
  const raw = readFileSync(ASSIGNMENTS_FILE, "utf8");
  return JSON.parse(raw) as Assignment[];
}

const ASSIGNMENTS: Assignment[] = loadAssignments();

function gen6digit(): string {
  return String(randomInt(100_000, 1_000_000));
}

async function findUserByEmail(email: string): Promise<string | null> {
  let page = 1;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers: ${error.message}`);
    const found = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (found) return found.id;
    if (data.users.length < 200) return null;
    page++;
  }
}

interface Result {
  email: string;
  clanName: string;
  userId: string;
  password: string | null;
  status: "created" | "existing";
}

async function run(): Promise<void> {
  const results: Result[] = [];
  for (const a of ASSIGNMENTS) {
    console.log(`\n=== ${a.clanName} <- ${a.email} ===`);

    let userId = await findUserByEmail(a.email);
    let password: string | null = null;
    let status: Result["status"] = "existing";

    if (!userId) {
      password = gen6digit();
      const { data, error } = await sb.auth.admin.createUser({
        email: a.email,
        password,
        email_confirm: true,
      });
      if (error) throw new Error(`createUser ${a.email}: ${error.message}`);
      userId = data.user!.id;
      status = "created";
      console.log(`  created auth user ${userId}`);
    } else {
      console.log(`  found existing auth user ${userId}`);
    }

    // Ensure a profiles row exists so FK from clans.owner_id and
    // clan_members.user_id can be satisfied (a trigger normally
    // does this on auth.users insert, but belt-and-suspenders).
    const profRes = await sb
      .from("profiles")
      .upsert(
        { id: userId, display_name: a.email.split("@")[0] },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (profRes.error) {
      console.warn(`  profiles upsert: ${profRes.error.message}`);
    }

    // Transfer ownership
    const ownerUpd = await sb
      .from("clans")
      .update({ owner_id: userId })
      .eq("id", a.clanId);
    if (ownerUpd.error) throw new Error(`owner update: ${ownerUpd.error.message}`);
    console.log(`  owner_id -> ${userId}`);

    // Upsert clan_members admin row
    const memUp = await sb
      .from("clan_members")
      .upsert(
        {
          clan_id: a.clanId,
          user_id: userId,
          role: "admin",
          invited_by: PLATFORM_ADMIN_ID,
        },
        { onConflict: "clan_id,user_id" },
      );
    if (memUp.error) throw new Error(`clan_members upsert: ${memUp.error.message}`);
    console.log(`  clan_members(admin) upserted`);

    results.push({
      email: a.email,
      clanName: a.clanName,
      userId,
      password,
      status,
    });
  }

  console.log(`\n\n========== SUMMARY ==========`);
  for (const r of results) {
    console.log(
      `${r.clanName}\n  email: ${r.email}\n  status: ${r.status}\n  password: ${r.password ?? "(unchanged, existing user)"}\n  user_id: ${r.userId}\n`,
    );
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
