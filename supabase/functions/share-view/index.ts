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

import { resolveShareAccess } from "./access.ts";
import { subtreeScope } from "./scope.ts";
import { loadKhoe } from "./khoe.ts";
import { fetchAllRows } from "./paging.ts";
import { clientIp, isPrivateIp } from "../_shared/clientIp.ts";
import { handlePart, loadHeritageItem } from "./parts.ts";
import { buildShareSections } from "./sections.ts";
import { buildShareCard } from "./shareCard.ts";

/**
 * Ảnh là link ngoài (vd ảnh Wikimedia Commons của dòng họ lịch sử) — photo_path
 * / path bắt đầu bằng https://. Dùng thẳng, không ký URL trong bucket.
 */
const isExternalPhoto = (p: string | null | undefined): p is string =>
  !!p && p.startsWith("https://");

/** Bỏ origin khỏi signed URL (xem giải thích ở bước 5) — client tự ghép VITE_SUPABASE_URL. */
const stripOrigin = (u: string) => u.replace(/^https?:\/\/[^/]+/, "");

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Scope của link xem được cả cây (trang dòng họ dùng được): xem cây thường và link mời góp. */
const SITE_SCOPES = ["tree_view", "contribute"];
const CARD_IMAGE_BASE = Deno.env.get("CARD_IMAGE_BASE") ?? `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/card-shares`;
const shareCard = (clanRow: unknown) => buildShareCard(clanRow, CARD_IMAGE_BASE);

const RATE_PER_MINUTE = 60;
/** Hệ số nhân trần khi IP khách không định danh được (bộ đếm dùng chung toàn hệ thống). */
const SHARED_BUCKET_FACTOR = 25;
/** Các lần gọi `part=` (duyệt nhiều trang) có bộ đếm riêng, nới hơn. */
const RATE_PER_MINUTE_PARTS = 240;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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
  // Chế độ xem trước công khai theo clan (không cần token / không đăng nhập):
  // ?clan=<id> — chỉ phục vụ dòng họ đã bật công khai + cho xem cây.
  const clanParam = url.searchParams.get("clan");
  const khoeToken = url.searchParams.get("khoe");
  if (!token && !clanParam && !khoeToken) return err("Missing token", 400);

  const part = url.searchParams.get("part") ?? (khoeToken ? "khoe" : null);
  const ipRaw = clientIp(req.headers);
  // Bộ đếm riêng cho `part=` để duyệt trang không ăn vào hạn mức của lần tải cây.
  const ip = part ? `${ipRaw}|part` : ipRaw;
  // Không định danh được khách (IP nội bộ sau proxy Docker) → mọi người chung MỘT bộ đếm: nới trần để không khoá cả hệ thống (_shared/clientIp.ts).
  const rateLimit =
    (part ? RATE_PER_MINUTE_PARTS : RATE_PER_MINUTE) *
    (isPrivateIp(ipRaw) ? SHARED_BUCKET_FACTOR : 1);

  const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- 1. Rate limit ----
  const windowStart = new Date(
    Math.floor(Date.now() / 60_000) * 60_000,
  ).toISOString();
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
    if (rateRow.request_count >= rateLimit) {
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
    sb.rpc("prune_share_view_rate").then(() => {
      /* fire-and-forget */
    });
  }

  // ---- 1b. Thiệp khoe: không qua share_links (bảng card_shares) ----
  if (khoeToken) {
    const r = await loadKhoe(sb, khoeToken);
    return json(r.body, {
      status: r.status,
      headers:
        r.status === 200 ? { "Cache-Control": "public, max-age=60" } : {},
    });
  }

  // ---- 2. Resolve context: share TOKEN, hoặc CLAN công khai (không token) — access.ts ----
  const access = await resolveShareAccess(sb, token, clanParam);
  if (!access.ok) return err(access.error, access.status);
  const link = access.link;

  // ---- 2b. Fetch clan-level toggles that affect masking + display ----
  const { data: clanRow } = await sb
    .from("clans")
    .select("name, description, hide_photos_in_share, generation_offset, share_sections, share_og_path, share_og_updated_at")
    .eq("id", link.clan_id)
    .maybeSingle();
  const hidePhotos = !!clanRow?.hide_photos_in_share;
  const generationOffset = clanRow?.generation_offset ?? 0;
  const clanName = (clanRow?.name as string | null) ?? null;

  // ---- part=…: các lần gọi theo phần cho trang dòng họ (parts.ts). Chỉ scope tree_view (link token xem cây hoặc
  // trang công khai); link QR mộ / di sản / một người giữ giao diện cũ.
  if (part) {
    if (!SITE_SCOPES.includes(link.scope))
      return err("Link này không hỗ trợ trang dòng họ.", 403);
    const r = await handlePart(
      {
        sb,
        clanId: link.clan_id,
        hidePhotos,
        sections: (clanRow?.share_sections as string[] | null) ?? [],
        publicChannel: !token,
        rootPersonId: link.root_person_id,
        sign: async (paths) => {
          const m = new Map<string, string>();
          const { data: signed } = await sb.storage
            .from("person-photos")
            .createSignedUrls([...new Set(paths)], 3600);
          for (const s of signed ?? [])
            if (s.signedUrl && s.path) m.set(s.path, stripOrigin(s.signedUrl));
          return m;
        },
      },
      part,
      url.searchParams,
    );
    return json(r.body, {
      status: r.status,
      // Link có thể bị thu hồi: chỉ cache ngắn.
      headers:
        r.status === 200 ? { "Cache-Control": "public, max-age=60" } : {},
    });
  }

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
      const inBucket = photos.filter(
        (p: { path: string }) => !isExternalPhoto(p.path),
      );
      const signedByPath = new Map<string, string>();
      if (inBucket.length > 0) {
        const { data: signed } = await sb.storage
          .from("person-photos")
          .createSignedUrls(
            inBucket.map((p: { path: string }) => p.path),
            3600,
          );
        for (const s of signed ?? []) {
          if (s.signedUrl && s.path)
            signedByPath.set(s.path, stripOrigin(s.signedUrl));
        }
      }
      photo_urls = photos
        .map((p: { path: string }) =>
          isExternalPhoto(p.path) ? p.path : signedByPath.get(p.path),
        )
        .filter((u: string | undefined): u is string => !!u);
    }
    // deno-lint-ignore no-explicit-any
    const occupants = ((rp as any).resting_place_occupants ?? [])
      .map(
        (o: {
          note: string | null;
          person: {
            full_name: string;
            gender: string;
            is_living: boolean;
          } | null;
        }) => {
          if (!o.person) return null;
          return {
            full_name: o.person.is_living
              ? "(Người đang sống)"
              : o.person.full_name,
            gender: o.person.gender,
            is_living: o.person.is_living,
            note: o.note,
          };
        },
      )
      .filter(Boolean);

    // deno-lint-ignore no-explicit-any
    const {
      resting_place_occupants: _o,
      resting_place_photos: _p,
      deleted_at: _d,
      ...rpFields
    } = rp as any;
    return json({
      clan_id: link.clan_id,
      scope: "resting_place",
      resting_place: { ...rpFields, photo_urls, occupants },
    });
  }

  // ---- scope='heritage_item': QR di sản → trả thẳng nội dung mục di sản
  // + ảnh + ghi âm (signed url) + người liên quan (che tên người còn sống).
  if (link.scope === "heritage_item" && link.root_heritage_item_id) {
    const r = await loadHeritageItem(
      sb,
      link.root_heritage_item_id,
      null,
      hidePhotos,
    );
    if (r.status !== 200) return json(r.body, { status: r.status });
    return json({
      clan_id: link.clan_id,
      scope: "heritage_item",
      heritage_item: r.body,
    });
  }

  // ---- 3. Fetch persons + families ----
  const personSelect =
    "id, full_name, gender, is_living, is_root, generation, branch_id, birth_family_id, birth_order, birth_date, birth_date_precision, death_date, death_date_precision, photo_path, courtesy_name, posthumous_name, nickname, birth_place, burial_place, bio, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day, death_anniv_lunar_month, death_anniv_lunar_day";
  // Phân trang: PostgREST cắt âm thầm ở max_rows (1000) nên họ đông hơn sẽ mất người ở cây chia sẻ (paging.ts).
  const { data: persons, error: pErr } = await fetchAllRows((a, b) =>
    sb
      .from("persons")
      .select(personSelect)
      .eq("clan_id", link.clan_id)
      .is("deleted_at", null)
      .order("id")
      .range(a, b),
  );
  if (pErr) return err(pErr.message, 500);
  const { data: families, error: fErr } = await fetchAllRows((a, b) =>
    sb
      .from("families")
      .select("id, husband_id, wife_id, spouse_order, created_at")
      .eq("clan_id", link.clan_id)
      .is("deleted_at", null)
      .order("id")
      .range(a, b),
  );
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
      const birthFam = scopedFamilies.find(
        (f) => f.id === focal.birth_family_id,
      );
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
    // Default tree_view scope with subtree: focal + all descendants and the families connecting them (scope.ts).
    const { kept, familiesKept } = subtreeScope(
      scopedPersons,
      scopedFamilies,
      link.root_person_id,
    );
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
  for (const p of allPhotoPaths)
    if (isExternalPhoto(p)) photoUrlByPath.set(p, p);
  const bucketPhotoPaths = allPhotoPaths.filter((p) => !isExternalPhoto(p));
  if (bucketPhotoPaths.length > 0) {
    const { data: signed } = await sb.storage
      .from("person-photos")
      .createSignedUrls([...new Set(bucketPhotoPaths)], 3600);
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
      // Ngày giỗ âm lịch của người ĐÃ MẤT (ngày mất đã có sẵn ở trên) — trang Sự kiện & giỗ / Sắp tới tính từ đây.
      // Trước đây chỉ có ở scope single_person nên tab giỗ của trang chia sẻ luôn rỗng.
      death_anniv_lunar_month: p.death_anniv_lunar_month,
      death_anniv_lunar_day: p.death_anniv_lunar_day,
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
    const deceasedIds = scopedPersons
      .filter((p) => !p.is_living)
      .map((p) => p.id);
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
          for (const ph of rp.resting_place_photos ?? []) {
            if (!isExternalPhoto(ph.path)) photoPaths.add(ph.path);
          }
        }
        byId.get(rp.id).person_ids.push((o as { person_id: string }).person_id);
      }
      const signedMap = new Map<string, string>();
      if (photoPaths.size > 0) {
        const { data: signed } = await sb.storage
          .from("person-photos")
          .createSignedUrls([...photoPaths], 3600);
        for (const row of signed ?? []) {
          if (row.signedUrl && row.path)
            signedMap.set(row.path, stripOrigin(row.signedUrl));
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
            .map((ph: { path: string }) =>
              isExternalPhoto(ph.path) ? ph.path : signedMap.get(ph.path),
            )
            .filter((u: string | undefined): u is string => !!u),
        };
      });
    }
  }

  // ---- 5. Sự kiện + Di sản cho trang XEM THỬ công khai (?clan=<id>). CHỈ
  // trả khi là xem-công-khai (không mở rộng dữ liệu cho share-link riêng tư).
  // Giỗ được client tính từ death_anniv_lunar_* của người đã mất (đã có sẵn).
  const isPublicPreview = !token && !!clanParam;
  let events: unknown[] = [];
  let heritage: unknown[] = [];
  // Chỉ trả phần admin đã bật trong clans.share_sections (cùng cờ với link chia sẻ và RLS; trước đây trang xem
  // thử trả cả hai phần bất kể cờ — lệch so với public_show_* của RLS).
  const previewSections = (clanRow?.share_sections as string[] | null) ?? [];
  if (isPublicPreview && previewSections.includes("events")) {
    const { data: ev } = await sb
      .from("events")
      .select(
        "id, title, event_type, date_solar, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id, notes",
      )
      .eq("clan_id", link.clan_id);
    events = ev ?? [];
  }
  if (isPublicPreview && previewSections.includes("heritage")) {
    const { data: he } = await sb
      .from("heritage_items")
      .select("id, category, title, summary, body, location_name, built_year")
      .eq("clan_id", link.clan_id)
      .is("deleted_at", null)
      .order("category", { ascending: true })
      .order("sort", { ascending: true });
    heritage = he ?? [];
  }

  // ---- 8. Cộng đồng (docs/plan-dong-gop-cong-dong.md): lượt ghé + ký ức được phép hiện.
  // Ký ức chỉ lên trang chia sẻ khi: đã hiện (status visible), người kể cho hiện ở trang chia sẻ
  // (visibility share), và kể về người ĐÃ MẤT trong phạm vi link (hoặc ký ức chung của họ).
  // Client gửi ?visit=1 một lần / phiên trình duyệt để đếm lượt ghé.
  if (url.searchParams.get("visit") === "1") {
    await sb.rpc("bump_clan_visit", {
      p_clan_id: link.clan_id,
      p_source: "share",
    });
  }
  const { data: communityStats } = await sb.rpc("clan_public_community_stats", {
    p_clan_id: link.clan_id,
  });
  const deceasedInScope = new Set(
    scopedPersons.filter((p) => !p.is_living).map((p) => p.id),
  );
  const { data: memRows } = await sb
    .from("person_memories")
    .select(
      "id, person_id, kind, body, media_path, media_mime, external_url, identify, question_id, duration_sec, year_approx, place, author_name, author_relation, created_at, author:profiles!person_memories_author_user_id_fkey(display_name)",
    )
    .eq("clan_id", link.clan_id)
    .eq("status", "visible")
    .eq("visibility", "share")
    .order("created_at", { ascending: false })
    .limit(80);
  // deno-lint-ignore no-explicit-any
  const memAllowed = ((memRows ?? []) as any[])
    .filter((m) => m.person_id === null || deceasedInScope.has(m.person_id))
    .filter((m) => !(hidePhotos && m.kind === "photo"))
    .slice(0, 40);
  const memPaths = memAllowed
    .map((m) => m.media_path as string | null)
    .filter((p): p is string => !!p);
  const memSigned = new Map<string, string>();
  if (memPaths.length > 0) {
    const { data: signed } = await sb.storage
      .from("person-photos")
      .createSignedUrls(memPaths, 3600);
    for (const row of signed ?? []) {
      if (row.signedUrl && row.path)
        memSigned.set(row.path, stripOrigin(row.signedUrl));
    }
  }
  // Ảnh "đây là ai?": khung khuôn mặt. Khách chỉ thấy TÊN khi đã xác nhận; gợi ý chưa duyệt chỉ
  // thấy số lượng (plan §11, câu 8). Người còn sống đã xác nhận vẫn hiện tên (như cây chia sẻ).
  const identifyIds = memAllowed
    .filter((m) => m.identify)
    .map((m) => m.id as string);
  // deno-lint-ignore no-explicit-any
  const facesByMemory = new Map<string, any[]>();
  if (identifyIds.length > 0) {
    const { data: faces } = await sb
      .from("photo_faces")
      .select(
        "id, memory_id, box_x, box_y, box_w, box_h, status, suggested_name, suggested_note, person:persons(full_name)",
      )
      .in("memory_id", identifyIds)
      .neq("status", "rejected")
      .order("created_at", { ascending: true });
    for (const f of faces ?? []) {
      // deno-lint-ignore no-explicit-any
      const ff = f as any;
      const confirmed = ff.status === "confirmed";
      const arr = facesByMemory.get(ff.memory_id) ?? [];
      arr.push({
        id: ff.id,
        box: [ff.box_x, ff.box_y, ff.box_w, ff.box_h],
        confirmed,
        label: confirmed ? (ff.person?.full_name ?? ff.suggested_name) : null,
        note: confirmed ? ff.suggested_note : null,
      });
      facesByMemory.set(ff.memory_id, arr);
    }
  }

  // Câu hỏi (P1 "Hỏi ông bà"): câu hỏi đang mở + đã có trả lời gần đây — để khách trả lời qua link.
  const { data: qRows } = await sb
    .from("family_questions")
    .select("id, question, status, about_person_id, ask_person_id, created_at")
    .eq("clan_id", link.clan_id)
    .neq("status", "closed")
    .order("created_at", { ascending: false })
    .limit(20);
  const scopedIds = new Set(scopedPersons.map((p) => p.id));
  const questions = (qRows ?? []).filter(
    (q) =>
      (!q.about_person_id || scopedIds.has(q.about_person_id)) &&
      (!q.ask_person_id || scopedIds.has(q.ask_person_id)),
  );

  const memories = memAllowed.map((m) => ({
    id: m.id,
    person_id: m.person_id,
    kind: m.kind,
    body: m.body,
    // Tệp trong bucket → URL ký; link ngoài (https) → dùng thẳng.
    media_url: m.media_path
      ? (memSigned.get(m.media_path) ?? null)
      : (m.external_url ?? null),
    is_external: !m.media_path && !!m.external_url,
    identify: !!m.identify,
    question_id: m.question_id ?? null,
    faces: facesByMemory.get(m.id) ?? [],
    media_mime: m.media_mime,
    duration_sec: m.duration_sec,
    year_approx: m.year_approx,
    place: m.place,
    author_name: m.author?.display_name ?? m.author_name ?? null,
    author_relation: m.author_relation,
    created_at: m.created_at,
  }));
  // Link tự tạm dừng vì nhận quá nhiều (có thể bị lộ) → trang vẫn xem được, chỉ ẩn phần góp.
  // Tab "Tổng quan" của link chia sẻ: các phần admin chọn (clans.share_sections). Chỉ cho link token
  // (trang xem công khai /xem/clans/… giữ public_show_* riêng).
  const shareSections =
    token && link.scope !== "single_person"
      ? await buildShareSections(
          {
            sb,
            clanId: link.clan_id,
            hidePhotos,
            sign: async (paths) => {
              const m = new Map<string, string>();
              const { data: signed } = await sb.storage
                .from("person-photos")
                .createSignedUrls([...new Set(paths)], 3600);
              for (const r of signed ?? [])
                if (r.signedUrl && r.path)
                  m.set(r.path, stripOrigin(r.signedUrl));
              return m;
            },
          },
          (clanRow?.share_sections as string[] | null) ?? [],
          scopedPersons,
          generationOffset,
        )
      : {};

  const canContribute =
    !!token &&
    link.scope !== "resting_place" &&
    link.scope !== "heritage_item" &&
    !link.contrib_paused_at;

  return json({
    clan_id: link.clan_id,
    clan_name: clanName,
    share_card: SITE_SCOPES.includes(link.scope) ? shareCard(clanRow) : undefined,
    root_person_id: link.root_person_id,
    sections: shareSections,
    community: {
      can_contribute: canContribute,
      recipient_label: link.recipient_label ?? null,
      stats: communityStats ?? null,
      memories,
      questions,
    },
    scope: link.scope,
    // Các khoá share_sections đang bật — trang dòng họ dựng menu từ đây (cả link token lẫn trang công khai).
    site_sections: SITE_SCOPES.includes(link.scope)
      ? ((clanRow?.share_sections as string[] | null) ?? [])
      : undefined,
    generation_offset: generationOffset,
    persons: masked,
    families: scopedFamilies,
    resting_places: restingPlaces,
    events,
    heritage,
  });
});
