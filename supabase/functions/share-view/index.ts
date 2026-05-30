/**
 * share-view: serves the anonymous tree viewer (plan §9).
 *
 * Anonymous clients hit /functions/v1/share-view?token=… with no JWT.
 * This function:
 *   1. Rate-limits the IP (60 req/min, bucketed in share_view_rate).
 *   2. Looks up share_links by token, rejects revoked / expired.
 *   3. Pulls persons + families for the clan, scoped to root_person_id
 *      if set, then masks every sensitive column for living persons.
 *   4. Returns JSON shaped for the family-chart adapter on the client.
 *
 * Service role key + DB access stay inside this function — anon viewers
 * never touch Postgres directly.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const RATE_PER_MINUTE = 60;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

function err(message: string, status: number): Response {
  return json({ error: message }, { status });
}

interface PersonRow {
  id: string;
  full_name: string;
  gender: "M" | "F";
  is_living: boolean;
  is_root: boolean;
  generation: number | null;
  branch_id: string | null;
  birth_family_id: string | null;
  birth_date: string | null;
  birth_date_precision: string | null;
  death_date: string | null;
  death_date_precision: string | null;
}

interface FamilyRow {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return err("Method not allowed", 405);

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return err("Missing token", 400);

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 1. Rate limit ----
  const windowStart = new Date(Math.floor(Date.now() / 60_000) * 60_000).toISOString();
  // Atomic-ish bump: upsert with on-conflict increment via raw SQL would
  // be nicer, but supabase-js lacks that; do a select-then-update which
  // is good enough for a soft limit.
  const { data: rateRow } = await sb
    .from("share_view_rate")
    .select("id, request_count")
    .eq("ip", ip)
    .eq("window_start", windowStart)
    .maybeSingle();
  if (rateRow) {
    if (rateRow.request_count >= RATE_PER_MINUTE) {
      return err("Rate limit exceeded — try again in a minute.", 429);
    }
    await sb
      .from("share_view_rate")
      .update({ request_count: rateRow.request_count + 1 })
      .eq("id", rateRow.id);
  } else {
    await sb
      .from("share_view_rate")
      .insert({ ip, window_start: windowStart, request_count: 1 });
    // Opportunistic GC on the cold path.
    sb.rpc("prune_share_view_rate").then(() => {/* fire-and-forget */});
  }

  // ---- 2. Validate token ----
  const { data: link, error: linkErr } = await sb
    .from("share_links")
    .select("clan_id, root_person_id, expires_at, is_revoked, scope")
    .eq("token", token)
    .maybeSingle();
  if (linkErr) return err(linkErr.message, 500);
  if (!link) return err("Link không tồn tại.", 404);
  if (link.is_revoked) return err("Link đã bị thu hồi.", 410);
  if (new Date(link.expires_at) < new Date()) {
    return err("Link đã hết hạn.", 410);
  }

  // ---- 3. Fetch persons + families ----
  const personSelect =
    "id, full_name, gender, is_living, is_root, generation, branch_id, birth_family_id, birth_date, birth_date_precision, death_date, death_date_precision";
  const { data: persons, error: pErr } = await sb
    .from("persons")
    .select(personSelect)
    .eq("clan_id", link.clan_id)
    .is("deleted_at", null);
  if (pErr) return err(pErr.message, 500);
  const { data: families, error: fErr } = await sb
    .from("families")
    .select("id, husband_id, wife_id")
    .eq("clan_id", link.clan_id)
    .is("deleted_at", null);
  if (fErr) return err(fErr.message, 500);

  let scopedPersons = (persons ?? []) as PersonRow[];
  let scopedFamilies = (families ?? []) as FamilyRow[];

  // ---- 4. Optional subtree scoping ----
  // When root_person_id is set, keep only that person + their descendants
  // and the families connecting them.
  if (link.root_person_id) {
    const kept = new Set<string>([link.root_person_id]);
    const familyById = new Map(scopedFamilies.map((f) => [f.id, f]));
    const childrenByFamily = new Map<string, string[]>();
    for (const p of scopedPersons) {
      if (!p.birth_family_id) continue;
      const arr = childrenByFamily.get(p.birth_family_id) ?? [];
      arr.push(p.id);
      childrenByFamily.set(p.birth_family_id, arr);
    }
    const familiesByParent = new Map<string, string[]>();
    for (const f of scopedFamilies) {
      for (const pid of [f.husband_id, f.wife_id]) {
        if (!pid) continue;
        const arr = familiesByParent.get(pid) ?? [];
        arr.push(f.id);
        familiesByParent.set(pid, arr);
      }
    }
    const queue = [link.root_person_id];
    const familiesKept = new Set<string>();
    while (queue.length > 0) {
      const cur = queue.shift()!;
      for (const fid of familiesByParent.get(cur) ?? []) {
        if (familiesKept.has(fid)) continue;
        familiesKept.add(fid);
        const fam = familyById.get(fid);
        if (!fam) continue;
        // Also bring in the spouse so the family-chart card renders.
        for (const sp of [fam.husband_id, fam.wife_id]) {
          if (sp && !kept.has(sp)) kept.add(sp);
        }
        for (const c of childrenByFamily.get(fid) ?? []) {
          if (!kept.has(c)) {
            kept.add(c);
            queue.push(c);
          }
        }
      }
    }
    scopedPersons = scopedPersons.filter((p) => kept.has(p.id));
    scopedFamilies = scopedFamilies.filter((f) => familiesKept.has(f.id));
  }

  // ---- 5. Mask living-person columns ----
  const masked = scopedPersons.map((p) => {
    if (!p.is_living) return p;
    return {
      id: p.id,
      full_name: p.full_name,
      gender: p.gender,
      is_living: true,
      is_root: p.is_root,
      generation: p.generation,
      branch_id: p.branch_id,
      birth_family_id: p.birth_family_id,
      birth_date: null,
      birth_date_precision: null,
      death_date: null,
      death_date_precision: null,
    };
  });

  return json({
    clan_id: link.clan_id,
    root_person_id: link.root_person_id,
    persons: masked,
    families: scopedFamilies,
  });
});
