import { clearAllCache } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

/**
 * Sign out + wipe cache + clear IndexedDB.
 *
 * Critical for shared devices: without clearing the persisted RQ cache,
 * the next user signing in on the same browser would see the previous
 * user's data hydrate instantly before the new RLS-filtered queries land.
 */
export async function signOutAndClearCache(): Promise<void> {
  await supabase.auth.signOut();
  await clearAllCache();
}
