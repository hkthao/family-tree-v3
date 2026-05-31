import { supabase } from "@/lib/supabase";

export interface ShareViewPerson {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  generation: number | null;
  branch_id: string | null;
  birth_family_id: string | null;
  birth_date: string | null;
  birth_date_precision: "day" | "month" | "year" | null;
  death_date: string | null;
  death_date_precision: "day" | "month" | "year" | null;
  /** Short-lived signed URL for deceased persons' photos. Null for the
   *  living (their photos are masked) and for anyone without an upload. */
  photo_url: string | null;
}

export interface ShareViewFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

export interface ShareViewPayload {
  clan_id: string;
  root_person_id: string | null;
  persons: ShareViewPerson[];
  families: ShareViewFamily[];
}

/**
 * Hit the share-view Edge Function from an anonymous client. The supabase
 * client object handles auth headers (or lack of); the function itself
 * has verify_jwt = false.
 */
export async function fetchShareView(token: string): Promise<ShareViewPayload> {
  // functions.invoke uses POST by default; we use GET with the token in
  // the query string so the function logic is HTTP-cache-friendly.
  const base = import.meta.env.VITE_SUPABASE_URL;
  const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const url = `${base}/functions/v1/share-view?token=${encodeURIComponent(token)}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      // Supabase Edge Functions require the anon key as `apikey` header
      // even when verify_jwt is false (otherwise the gateway rejects).
      apikey: anon,
      Authorization: `Bearer ${anon}`,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      body.error ?? `share-view error (${res.status})`,
    );
  }
  const payload = (await res.json()) as ShareViewPayload;
  // The function returns photo_url as a path-only string (no origin),
  // because the storage helper inside Supabase Local would otherwise
  // bake Docker-internal hostnames. Prepend our reachable base.
  return {
    ...payload,
    persons: payload.persons.map((p) => ({
      ...p,
      photo_url:
        p.photo_url && p.photo_url.startsWith("/")
          ? `${base}${p.photo_url}`
          : p.photo_url,
    })),
  };
}

// Re-export the supabase client so callers can import it from the same
// module if needed; keeps the import surface tidy.
export { supabase };
