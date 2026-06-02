/**
 * Tạo platform admin user trên Supabase Cloud.
 *
 * Usage:
 *   1. Fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong .env.deploy
 *      (tài khoản service-role bypass mọi RLS, KHÔNG commit lên git)
 *   2. Sửa ADMIN_EMAIL + ADMIN_PASSWORD bên dưới
 *   3. npx tsx scripts/create-platform-admin.ts
 *
 * Script sẽ:
 *   - Tạo user qua auth.admin.createUser() — email auto-confirmed
 *   - UPDATE profiles.is_platform_admin = true, max_clans = 100
 *
 * Idempotent: chạy lại với cùng email sẽ báo "user already exists"
 * và chỉ promote profiles row (an toàn).
 */

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.deploy" });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ADMIN_EMAIL = process.argv[2] ?? "";
const ADMIN_PASSWORD = process.argv[3] ?? "";

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.deploy",
  );
  process.exit(1);
}
if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
  console.error("Usage: npx tsx scripts/create-platform-admin.ts <email> <password>");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log(`Creating platform admin: ${ADMIN_EMAIL}`);

  // Try to create the user. If they already exist, look them up.
  const created = await admin.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    email_confirm: true, // skip email confirmation
  });

  let userId: string;
  if (created.error) {
    if (created.error.message.toLowerCase().includes("already")) {
      // Look up by email via the listUsers paginated endpoint (no
      // direct getByEmail in supabase-js). For one-shot admin setup
      // a single page is enough.
      const list = await admin.auth.admin.listUsers({ perPage: 200 });
      const found = list.data.users.find(
        (u) => u.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase(),
      );
      if (!found) {
        throw new Error(
          `Email ${ADMIN_EMAIL} exists but not found in first 200 users. Use SQL Editor instead.`,
        );
      }
      userId = found.id;
      console.log(`  user already exists, promoting (id=${userId})`);
    } else {
      throw new Error(`createUser: ${created.error.message}`);
    }
  } else {
    userId = created.data.user!.id;
    console.log(`  user created (id=${userId})`);
  }

  // Promote to platform admin via profile row.
  const { error: upErr } = await admin
    .from("profiles")
    .update({ is_platform_admin: true, max_clans: 100 })
    .eq("id", userId);
  if (upErr) throw new Error(`promote: ${upErr.message}`);

  console.log("Done. Login at the app and the ★ Platform Admin badge + /admin should appear.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
