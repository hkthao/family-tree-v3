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

import { createClient } from "jsr:@supabase/supabase-js@2";

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
  birth_order: number | null;
  birth_date: string | null;
  birth_date_precision: string | null;
  death_date: string | null;
  death_date_precision: string | null;
  photo_path: string | null;
  // Extras used by the single_person card view. Always selected but
  // only included in the response when scope === 'single_person'.
  courtesy_name: string | null;
  posthumous_name: string | null;
  nickname: string | null;
  birth_place: string | null;
  burial_place: string | null;
  bio: string | null;
  birth_lunar_year: number | null;
  birth_lunar_month: number | null;
  birth_lunar_day: number | null;
  death_lunar_year: number | null;
  death_lunar_month: number | null;
  death_lunar_day: number | null;
  death_anniv_lunar_month: number | null;
  death_anniv_lunar_day: number | null;
}

interface FamilyRow {
  id: string;
  husband_id: string | null;
  wife_id: string | null;
  spouse_order: number | null;
  created_at: string | null;
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
    .select("clan_id, root_person_id, root_resting_place_id, root_heritage_item_id, expires_at, is_revoked, scope")
    .eq("token", token)
    .maybeSingle();
  if (linkErr) return err(linkErr.message, 500);
  if (!link) return err("Link không tồn tại.", 404);
  if (link.is_revoked) return err("Link đã bị thu hồi.", 410);
  if (new Date(link.expires_at) < new Date()) {
    return err("Link đã hết hạn.", 410);
  }

  // ---- 2b. Fetch clan-level toggles that affect masking + display ----
  const { data: clanRow } = await sb
    .from("clans")
    .select("hide_photos_in_share, generation_offset")
    .eq("id", link.clan_id)
    .maybeSingle();
  const hidePhotos = !!clanRow?.hide_photos_in_share;
  const generationOffset = clanRow?.generation_offset ?? 0;

  // ---- scope='resting_place': QR tại mộ → trả thẳng thông tin nơi an
  // nghỉ + người an nghỉ (che tên người còn sống) + ảnh. Bỏ qua pipeline
  // persons/families bên dưới.
  if (link.scope === "resting_place" && link.root_resting_place_id) {
    const { data: rp } = await sb
      .from("resting_places")
      .select(
        "id, clan_id, kind, name, location_name, location_detail, address, latitude, longitude, status, deleted_at, resting_place_occupants(note, person:persons(full_name, gender, is_living)), resting_place_photos(path, sort)",
      )
      .eq("id", link.root_resting_place_id)
      .maybeSingle();
    if (!rp || rp.deleted_at) return err("Nơi an nghỉ không còn.", 404);

    // deno-lint-ignore no-explicit-any
    const photos = [...((rp as any).resting_place_photos ?? [])].sort(
      (a: { sort: number }, b: { sort: number }) => a.sort - b.sort,
    );
    let photo_urls: string[] = [];
    if (!hidePhotos && photos.length > 0) {
      const { data: signed } = await sb.storage
        .from("person-photos")
        .createSignedUrls(photos.map((p: { path: string }) => p.path), 3600);
      photo_urls = (signed ?? [])
        .filter((s) => s.signedUrl)
        .map((s) => stripOrigin(s.signedUrl!));
    }
    // deno-lint-ignore no-explicit-any
    const occupants = ((rp as any).resting_place_occupants ?? [])
      .map((o: { note: string | null; person: { full_name: string; gender: string; is_living: boolean } | null }) => {
        if (!o.person) return null;
        return {
          full_name: o.person.is_living ? "(Người đang sống)" : o.person.full_name,
          gender: o.person.gender,
          is_living: o.person.is_living,
          note: o.note,
        };
      })
      .filter(Boolean);

    // deno-lint-ignore no-explicit-any
    const { resting_place_occupants: _o, resting_place_photos: _p, deleted_at: _d, ...rpFields } = rp as any;
    return json({
      clan_id: link.clan_id,
      scope: "resting_place",
      resting_place: { ...rpFields, photo_urls, occupants },
    });
  }

  // ---- scope='heritage_item': QR di sản → trả thẳng nội dung mục di sản
  // + ảnh + ghi âm (signed url) + người liên quan (che tên người còn sống).
  if (link.scope === "heritage_item" && link.root_heritage_item_id) {
    const { data: hi } = await sb
      .from("heritage_items")
      .select(
        "id, clan_id, category, title, summary, body, location_name, address, latitude, longitude, built_year, deleted_at, heritage_media(kind, path, caption, sort, duration_sec), heritage_people(role_note, person:persons(full_name, gender, is_living))",
      )
      .eq("id", link.root_heritage_item_id)
      .maybeSingle();
    if (!hi || hi.deleted_at) return err("Mục di sản không còn.", 404);

    // deno-lint-ignore no-explicit-any
    const media = [...((hi as any).heritage_media ?? [])].sort(
      (a: { sort: number }, b: { sort: number }) => a.sort - b.sort,
    );
    const photoItems = media.filter((m: { kind: string }) => m.kind === "photo");
    const audioItems = media.filter((m: { kind: string }) => m.kind === "audio");
    // Ảnh chịu cờ ẩn ảnh; ghi âm luôn cho phép (không phải ảnh người sống).
    const toSign = [
      ...(hidePhotos ? [] : photoItems),
      ...audioItems,
    ];
    const signedMap = new Map<string, string>();
    if (toSign.length > 0) {
      const { data: signed } = await sb.storage
        .from("person-photos")
        .createSignedUrls(toSign.map((m: { path: string }) => m.path), 3600);
      (signed ?? []).forEach((s, i) => {
        if (s.signedUrl) signedMap.set(toSign[i].path, stripOrigin(s.signedUrl));
      });
    }
    const photo_urls = photoItems
      .map((m: { path: string }) => signedMap.get(m.path))
      .filter(Boolean);
    const audios = audioItems
      .map((m: { path: string; duration_sec: number | null }) => ({
        url: signedMap.get(m.path),
        duration_sec: m.duration_sec,
      }))
      .filter((a: { url: string | undefined }) => !!a.url);
    // deno-lint-ignore no-explicit-any
    const people = ((hi as any).heritage_people ?? [])
      .map((l: { role_note: string | null; person: { full_name: string; gender: string; is_living: boolean } | null }) => {
        if (!l.person) return null;
        return {
          full_name: l.person.is_living ? "(Người đang sống)" : l.person.full_name,
          gender: l.person.gender,
          role_note: l.role_note,
        };
      })
      .filter(Boolean);

    // deno-lint-ignore no-explicit-any
    const { heritage_media: _m, heritage_people: _pp, deleted_at: _d, ...hiFields } = hi as any;
    return json({
      clan_id: link.clan_id,
      scope: "heritage_item",
      heritage_item: { ...hiFields, photo_urls, audios, people },
    });
  }

  // ---- 3. Fetch persons + families ----
  const personSelect =
    "id, full_name, gender, is_living, is_root, generation, branch_id, birth_family_id, birth_order, birth_date, birth_date_precision, death_date, death_date_precision, photo_path, courtesy_name, posthumous_name, nickname, birth_place, burial_place, bio, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day, death_anniv_lunar_month, death_anniv_lunar_day";
  const { data: persons, error: pErr } = await sb
    .from("persons")
    .select(personSelect)
    .eq("clan_id", link.clan_id)
    .is("deleted_at", null);
  if (pErr) return err(pErr.message, 500);
  const { data: families, error: fErr } = await sb
    .from("families")
    .select("id, husband_id, wife_id, spouse_order, created_at")
    .eq("clan_id", link.clan_id)
    .is("deleted_at", null);
  if (fErr) return err(fErr.message, 500);

  let scopedPersons = (persons ?? []) as PersonRow[];
  let scopedFamilies = (families ?? []) as FamilyRow[];

  // ---- 4. Optional subtree scoping ----
  // Two modes:
  //  - scope='single_person': focal + parents + spouse(s) + children (one
  //    hop each). Used by the personal QR code on tombstones / cards.
  //  - default (tree_view): focal + all descendants. Used by the public
  //    tree view link.
  if (link.scope === "single_person" && link.root_person_id) {
    const focal = scopedPersons.find((p) => p.id === link.root_person_id);
    if (!focal) {
      return err("Người này không còn trong gia phả.", 404);
    }
    const kept = new Set<string>([focal.id]);
    const familiesKept = new Set<string>();

    // Parents — via the focal's birth_family. Both the family record and
    // both parents are included so the card can render names.
    if (focal.birth_family_id) {
      familiesKept.add(focal.birth_family_id);
      const birthFam = scopedFamilies.find((f) => f.id === focal.birth_family_id);
      if (birthFam) {
        if (birthFam.husband_id) kept.add(birthFam.husband_id);
        if (birthFam.wife_id) kept.add(birthFam.wife_id);
      }
    }

    // Marriages — every family where focal is a spouse. Pull in the
    // partner + all children of that union.
    const childrenByFamily = new Map<string, string[]>();
    for (const p of scopedPersons) {
      if (!p.birth_family_id) continue;
      const arr = childrenByFamily.get(p.birth_family_id) ?? [];
      arr.push(p.id);
      childrenByFamily.set(p.birth_family_id, arr);
    }
    for (const f of scopedFamilies) {
      if (f.husband_id === focal.id || f.wife_id === focal.id) {
        familiesKept.add(f.id);
        for (const sp of [f.husband_id, f.wife_id]) {
          if (sp && sp !== focal.id) kept.add(sp);
        }
        for (const c of childrenByFamily.get(f.id) ?? []) {
          kept.add(c);
        }
      }
    }

    scopedPersons = scopedPersons.filter((p) => kept.has(p.id));
    scopedFamilies = scopedFamilies.filter((f) => familiesKept.has(f.id));
  } else if (link.root_person_id) {
    // Default tree_view scope with subtree: focal + all descendants and
    // the families connecting them.
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

  // ---- 5. Sign photo URLs for everyone with an upload ----
  // Per clan owner preference, share view shows portraits for both
  // living and deceased members. Dates / places / bio remain masked
  // for the living — only the photo itself is treated as
  // family-approved-public when uploaded. The hide_photos_in_share
  // clan toggle short-circuits this path entirely so the response
  // carries no photo_url for anyone — useful for clans with
  // children or members who prefer not to appear publicly.
  //
  // We strip the absolute origin from each signed URL because inside
  // Supabase Local the storage helper bakes Docker-internal hostnames
  // (kong:8000 / supabase_edge_runtime_*:8081) that the browser can
  // never resolve. The client knows its own Supabase URL via
  // VITE_SUPABASE_URL and prepends it back. Works in cloud + local
  // without needing forwarded-host headers.
  const allPhotoPaths = hidePhotos
    ? []
    : scopedPersons
        .filter((p) => p.photo_path)
        .map((p) => p.photo_path as string);
  const photoUrlByPath = new Map<string, string>();
  if (allPhotoPaths.length > 0) {
    const { data: signed } = await sb.storage
      .from("person-photos")
      .createSignedUrls([...new Set(allPhotoPaths)], 3600);
    const stripOrigin = (u: string) => u.replace(/^https?:\/\/[^/]+/, "");
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path) {
        photoUrlByPath.set(row.path, stripOrigin(row.signedUrl));
      }
    }
  }

  // ---- 6. Mask living-person dates/places + attach signed photo URL ----
  // Extra columns (places, bio, lunar dates, alt names) only ride along
  // when the link is scope='single_person' — the tree view doesn't render
  // them and we'd rather not leak them in a generic anonymous payload.
  const includeExtras = link.scope === "single_person";
  const masked = scopedPersons.map((p) => {
    const photo_url = p.photo_path
      ? (photoUrlByPath.get(p.photo_path) ?? null)
      : null;
    if (p.is_living) {
      return {
        id: p.id,
        full_name: p.full_name,
        gender: p.gender,
        is_living: true,
        is_root: p.is_root,
        generation: p.generation,
        branch_id: p.branch_id,
        birth_family_id: p.birth_family_id,
        birth_order: p.birth_order,
        birth_date: null,
        birth_date_precision: null,
        death_date: null,
        death_date_precision: null,
        photo_url,
      };
    }
    const base = {
      id: p.id,
      full_name: p.full_name,
      gender: p.gender,
      is_living: false,
      is_root: p.is_root,
      generation: p.generation,
      branch_id: p.branch_id,
      birth_family_id: p.birth_family_id,
      birth_order: p.birth_order,
      birth_date: p.birth_date,
      birth_date_precision: p.birth_date_precision,
      death_date: p.death_date,
      death_date_precision: p.death_date_precision,
      photo_url,
    };
    if (!includeExtras) return base;
    return {
      ...base,
      courtesy_name: p.courtesy_name,
      posthumous_name: p.posthumous_name,
      nickname: p.nickname,
      birth_place: p.birth_place,
      burial_place: p.burial_place,
      bio: p.bio,
      birth_lunar_year: p.birth_lunar_year,
      birth_lunar_month: p.birth_lunar_month,
      birth_lunar_day: p.birth_lunar_day,
      death_lunar_year: p.death_lunar_year,
      death_lunar_month: p.death_lunar_month,
      death_lunar_day: p.death_lunar_day,
      death_anniv_lunar_month: p.death_anniv_lunar_month,
      death_anniv_lunar_day: p.death_anniv_lunar_day,
    };
  });

  // ---- 7. Resting places (mộ phần & tro cốt) — single_person only ----
  // Mirrors burial_place: only ride along on the detailed single-person
  // card, not the generic tree payload.
  // deno-lint-ignore no-explicit-any
  let restingPlaces: any[] = [];
  if (includeExtras) {
    const deceasedIds = scopedPersons.filter((p) => !p.is_living).map((p) => p.id);
    if (deceasedIds.length > 0) {
      const { data: occ } = await sb
        .from("resting_place_occupants")
        .select(
          "person_id, resting_place:resting_places(id, kind, name, location_name, location_detail, address, latitude, longitude, status, deleted_at, resting_place_photos(path, sort))",
        )
        .in("person_id", deceasedIds);
      // deno-lint-ignore no-explicit-any
      const byId = new Map<string, any>();
      const photoPaths = new Set<string>();
      for (const o of occ ?? []) {
        // deno-lint-ignore no-explicit-any
        const rp = (o as any).resting_place;
        if (!rp || rp.deleted_at) continue;
        if (!byId.has(rp.id)) {
          byId.set(rp.id, { ...rp, person_ids: [] as string[] });
          for (const ph of rp.resting_place_photos ?? []) photoPaths.add(ph.path);
        }
        byId.get(rp.id).person_ids.push((o as { person_id: string }).person_id);
      }
      const signedMap = new Map<string, string>();
      if (photoPaths.size > 0) {
        const { data: signed } = await sb.storage
          .from("person-photos")
          .createSignedUrls([...photoPaths], 3600);
        for (const row of signed ?? []) {
          if (row.signedUrl && row.path) signedMap.set(row.path, stripOrigin(row.signedUrl));
        }
      }
      restingPlaces = [...byId.values()].map((rp) => {
        const photos = [...(rp.resting_place_photos ?? [])].sort(
          (a: { sort: number }, b: { sort: number }) => a.sort - b.sort,
        );
        const { resting_place_photos: _p, deleted_at: _d, ...rest } = rp;
        return {
          ...rest,
          photo_urls: photos
            .map((ph: { path: string }) => signedMap.get(ph.path))
            .filter((u: string | undefined): u is string => !!u),
        };
      });
    }
  }

  return json({
    clan_id: link.clan_id,
    root_person_id: link.root_person_id,
    scope: link.scope,
    generation_offset: generationOffset,
    persons: masked,
    families: scopedFamilies,
    resting_places: restingPlaces,
  });
});
