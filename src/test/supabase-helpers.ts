import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

import type { Database } from "@/lib/database.types";

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!ANON_KEY) throw new Error("VITE_SUPABASE_ANON_KEY missing in env");
if (!SERVICE_KEY) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing in env");

export type Client = SupabaseClient<Database>;

/** Admin client with service-role privileges — bypasses RLS. */
export function adminClient(): Client {
  return createClient<Database>(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Anonymous (unauthenticated) client — used for testing anon access. */
export function anonClient(): Client {
  return createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface TestUser {
  id: string;
  email: string;
  password: string;
  displayName: string;
  /** A client signed in as this user (RLS applies). */
  client: Client;
}

const PASSWORD = "test-password-1234";

/** Create an auth user via admin API and return a client signed in as them. */
export async function createTestUser(opts?: {
  displayName?: string;
  isPlatformAdmin?: boolean;
  isSuspended?: boolean;
  maxClans?: number;
}): Promise<TestUser> {
  const admin = adminClient();
  const email = `test-${randomUUID()}@example.test`;
  const displayName = opts?.displayName ?? `Test ${email.slice(0, 6)}`;

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !created.user) {
    throw new Error(`createUser failed: ${error?.message}`);
  }
  const userId = created.user.id;

  // Adjust profile cols that require platform admin (bypass RLS via admin client)
  if (
    opts?.isPlatformAdmin ||
    opts?.isSuspended ||
    (opts?.maxClans !== undefined && opts.maxClans !== 1)
  ) {
    const { error: upErr } = await admin
      .from("profiles")
      .update({
        is_platform_admin: opts.isPlatformAdmin ?? false,
        is_suspended: opts.isSuspended ?? false,
        max_clans: opts.maxClans ?? 1,
      })
      .eq("id", userId);
    if (upErr) throw new Error(`profile update failed: ${upErr.message}`);
  }

  // Sign in to get a client carrying this user's JWT
  const userClient = createClient<Database>(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await userClient.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (signInErr) throw new Error(`signIn failed: ${signInErr.message}`);

  return { id: userId, email, password: PASSWORD, displayName, client: userClient };
}

/** Create a clan owned by `owner` (must be signed in). */
export async function createTestClan(
  owner: TestUser,
  opts?: { name?: string; visibility?: "private" | "public"; maxPersons?: number; maxUsers?: number },
): Promise<string> {
  const { data, error } = await owner.client
    .from("clans")
    .insert({
      name: opts?.name ?? `Test Clan ${randomUUID().slice(0, 8)}`,
      owner_id: owner.id,
      visibility: opts?.visibility ?? "private",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`createClan failed: ${error?.message}`);

  // Trigger auto_add_owner_as_admin already adds the owner as 'admin' member.

  // Apply custom limits via admin (RLS would block clan admin from changing these)
  if (opts?.maxPersons !== undefined || opts?.maxUsers !== undefined) {
    const admin = adminClient();
    const { error: limitErr } = await admin
      .from("clans")
      .update({
        max_persons: opts.maxPersons,
        max_users: opts.maxUsers,
      })
      .eq("id", data.id);
    if (limitErr) throw new Error(`clan limits update failed: ${limitErr.message}`);
  }

  return data.id;
}

/** Add `user` as a member of `clanId` with given role (via admin to bypass max_users for setup). */
export async function addMember(
  clanId: string,
  user: TestUser,
  role: "admin" | "editor" | "viewer",
): Promise<void> {
  const admin = adminClient();
  const { error } = await admin
    .from("clan_members")
    .insert({ clan_id: clanId, user_id: user.id, role });
  if (error) throw new Error(`addMember failed: ${error.message}`);
}

/** Clean up: delete all test users (cascades to profiles, clans owned, members). */
export async function deleteUser(userId: string): Promise<void> {
  const admin = adminClient();
  await admin.auth.admin.deleteUser(userId);
}
