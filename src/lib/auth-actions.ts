import { clearAll as clearAiChatHistory } from "@/lib/aiChatHistory";
import { clearAllCache } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";

/**
 * Sign out + wipe cache + clear IndexedDB + drop AI chat history.
 *
 * Critical for shared devices: without clearing the persisted RQ cache,
 * the next user signing in on the same browser would see the previous
 * user's data hydrate instantly before the new RLS-filtered queries land.
 *
 * Trợ lý AI cũng vào diện này — người lớn tuổi hay dùng chung máy tính
 * bảng với con cháu, và lịch sử trò chuyện nằm ở localStorage nên không
 * tự mất theo phiên đăng nhập.
 */
export async function signOutAndClearCache(): Promise<void> {
  await supabase.auth.signOut();
  clearAiChatHistory();
  await clearAllCache();
}
