import { createClient } from "@supabase/supabase-js";

import type { Database } from "./database.types";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — check .env.local",
  );
}

/**
 * URL + anon key lộ ra ngoài để gọi Edge Function bằng `fetch` thô.
 *
 * Cần cho phần streaming: `functions.invoke` đọc hết body rồi mới trả
 * về, tức là stream bao nhiêu cũng vô nghĩa. Không có bí mật nào ở đây —
 * anon key vốn nằm sẵn trong bundle.
 */
export const SUPABASE_URL = url;
export const SUPABASE_ANON_KEY = anonKey;

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Force implicit (hash-based) flow so email confirmation +
    // magic-link redirects work even when the user opens the
    // link in a different browser / device / PWA window from
    // where they signed up. PKCE (the default in supabase-js
    // v2.40+) stores a code_verifier in localStorage at signup
    // and only exchanges successfully on that same origin —
    // breaks the common signup-on-desktop / click-link-on-
    // phone flow.
    flowType: "implicit",
  },
});
