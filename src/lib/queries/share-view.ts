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
  birth_order: number | null;
  birth_date: string | null;
  birth_date_precision: "day" | "month" | "year" | null;
  death_date: string | null;
  death_date_precision: "day" | "month" | "year" | null;
  /** Short-lived signed URL for deceased persons' photos. Null for the
   *  living (their photos are masked) and for anyone without an upload. */
  photo_url: string | null;
  // Extra detail fields. Only present in scope='single_person' responses
  // and only for deceased persons; always undefined in tree_view.
  courtesy_name?: string | null;
  posthumous_name?: string | null;
  nickname?: string | null;
  birth_place?: string | null;
  burial_place?: string | null;
  bio?: string | null;
  birth_lunar_year?: number | null;
  birth_lunar_month?: number | null;
  birth_lunar_day?: number | null;
  death_lunar_year?: number | null;
  death_lunar_month?: number | null;
  death_lunar_day?: number | null;
  death_anniv_lunar_month?: number | null;
  death_anniv_lunar_day?: number | null;
}

export interface ShareViewFamily {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  spouse_order: number | null;
  created_at: string | null;
}

export interface ShareViewRestingPlace {
  id: string;
  kind: "grave" | "ashes_temple" | "columbarium" | "scattered" | "other";
  name: string | null;
  location_name: string | null;
  location_detail: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "existing" | "relocated" | "lost";
  person_ids: string[];
  photo_urls: string[];
}

export interface ShareViewRestingPlaceFull {
  id: string;
  clan_id: string;
  kind: "grave" | "ashes_temple" | "columbarium" | "scattered" | "other";
  name: string | null;
  location_name: string | null;
  location_detail: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  status: "existing" | "relocated" | "lost";
  photo_urls: string[];
  occupants: {
    full_name: string;
    gender: "M" | "F";
    is_living: boolean;
    note: string | null;
  }[];
}

export interface ShareViewPayload {
  clan_id: string;
  root_person_id: string | null;
  /** 'tree_view' (default) or 'single_person'. Drives client rendering. */
  scope: string;
  /**
   * Per-clan display offset cho "Đời N". 0 (mặc định) = Thủy tổ là Đời 1;
   * 1 = Thủy tổ là Đời 0. FE trừ offset khi render.
   */
  generation_offset: number;
  persons: ShareViewPerson[];
  families: ShareViewFamily[];
  resting_places?: ShareViewRestingPlace[];
  /** Present only when scope='resting_place' (QR tại mộ). */
  resting_place?: ShareViewRestingPlaceFull;
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
  const fixUrl = (u: string) => (u.startsWith("/") ? `${base}${u}` : u);
  return {
    ...payload,
    // scope='resting_place' returns no persons/families.
    persons: (payload.persons ?? []).map((p) => ({
      ...p,
      photo_url: p.photo_url ? fixUrl(p.photo_url) : p.photo_url,
    })),
    resting_places: payload.resting_places?.map((rp) => ({
      ...rp,
      photo_urls: rp.photo_urls.map(fixUrl),
    })),
    resting_place: payload.resting_place
      ? { ...payload.resting_place, photo_urls: payload.resting_place.photo_urls.map(fixUrl) }
      : undefined,
  };
}

// Re-export the supabase client so callers can import it from the same
// module if needed; keeps the import surface tidy.
export { supabase };
