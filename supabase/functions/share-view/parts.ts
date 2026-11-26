/**
 * share-view?part=… — các lần gọi theo phần cho trang dòng họ (docs/plan-trang-dong-ho.md, mục 3.2).
 *
 * Mỗi phần: (1) chỉ phục vụ khi khoá tương ứng đang bật trong clans.share_sections — cùng cờ với link chia sẻ và
 * RLS; (2) giới hạn số dòng + phân trang; (3) KHÔNG trả toạ độ / địa chỉ chi tiết / người còn sống.
 * Không import Deno-only nên test được bằng vitest với client giả.
 */

import {
  firstImageUrl,
  postDisplayTitle,
  postExcerpt,
  readMinutes,
} from "../_shared/vendor/postMarkdown.ts";
import { fetchAllRows } from "./paging.ts";
import { subtreeScope } from "./scope.ts";

// deno-lint-ignore no-explicit-any
type Sb = any;

export interface PartCtx {
  sb: Sb;
  clanId: string;
  hidePhotos: boolean;
  /** clans.share_sections */
  sections: string[];
  /** Ký URL ảnh trong bucket → đường dẫn không kèm origin. */
  sign: (paths: string[]) => Promise<Map<string, string>>;
  /** true = trang dòng họ công khai (không token): chi tiết người đã mất vốn đã công khai (RLS) nên không cần khoá `profiles`. */
  publicChannel?: boolean;
  /** Link giới hạn cây con (share_links.root_person_id): hồ sơ người chỉ xem được trong phạm vi đó. */
  rootPersonId?: string | null;
}

export type PartResult = { status: number; body: unknown };

const ok = (body: unknown): PartResult => ({ status: 200, body });
const fail = (status: number, error: string): PartResult => ({
  status,
  body: { error },
});

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const POST_TYPES = ["news", "event", "birth", "death", "notice"];
const HERITAGE_CATEGORIES = ["place", "custom", "story", "artifact"];
const KINDS = ["grave", "ashes_temple", "columbarium", "scattered", "other"];
const HONOR_CATEGORIES = [
  "donation_money",
  "donation_labor",
  "academic",
  "other",
];

const isExternal = (p: string | null | undefined): p is string =>
  !!p && p.startsWith("https://");
const stripOrigin = (u: string) => u.replace(/^https?:\/\/[^/]+/, "");

export function parsePaging(
  q: URLSearchParams,
  defPer: number,
  maxPer: number,
) {
  const int = (v: string | null, d: number) => {
    const n = Number.parseInt(v ?? "", 10);
    return Number.isFinite(n) && n > 0 ? n : d;
  };
  const per = Math.min(int(q.get("per"), defPer), maxPer);
  const page = Math.min(int(q.get("page"), 1), 10_000);
  return { page, per, from: (page - 1) * per, to: (page - 1) * per + per - 1 };
}

const off = () => fail(404, "Mục này không được chia sẻ.");

export async function handlePart(
  ctx: PartCtx,
  part: string,
  q: URLSearchParams,
): Promise<PartResult> {
  const on = (k: string) => ctx.sections.includes(k);
  switch (part) {
    case "posts":
      return on("board") ? posts(ctx, q) : off();
    case "post":
      return on("board") ? post(ctx, q) : off();
    case "events":
      return on("events") ? events(ctx) : off();
    case "heritage":
      return on("heritage") ? heritageList(ctx, q) : off();
    case "heritage_item":
      return on("heritage") ? heritageOne(ctx, q) : off();
    case "graves":
      return on("graves") ? graves(ctx, q) : off();
    case "honor":
      return on("honor") ? honor(ctx, q) : off();
    case "info":
      return on("info") ? info(ctx) : off();
    case "stats":
      return stats(ctx);
    case "map":
      return on("map") ? mapCounts(ctx) : off();
    case "person":
      return person(ctx, q);
    case "mosaic":
      return on("mosaic") ? mosaic(ctx) : off();
    case "search_index":
      return searchIndex(ctx);
    default:
      return fail(400, "part không hợp lệ.");
  }
}

// ─── Hồ sơ một người (tiểu sử cá nhân) ─────────────────────────────

const PERSON_COLS =
  "id, full_name, generation, is_living, courtesy_name, posthumous_name, nickname, birth_place, burial_place, bio, birth_lunar_year, birth_lunar_month, birth_lunar_day, death_lunar_year, death_lunar_month, death_lunar_day";

/**
 * Chi tiết hồ sơ của MỘT người đã mất ngoài những gì payload cây đã có (tên, ngày, ảnh, quan hệ): tên hiệu / tự / húy / thụy,
 * ngày âm, nơi sinh / an táng, tiểu sử, dấu mốc, bài viết, di sản, nơi an nghỉ. Người còn sống chỉ trả tên + đời.
 * Tiểu sử / nơi chốn / dấu mốc chỉ khi `profile` (kênh công khai, hoặc link token có khoá `profiles`); bài viết / di sản / mộ phần theo
 * khoá `board` / `heritage` / `graves`. Không toạ độ, không địa chỉ.
 */
async function person(ctx: PartCtx, q: URLSearchParams): Promise<PartResult> {
  const id = q.get("id") ?? "";
  if (!UUID.test(id)) return fail(400, "id không hợp lệ.");
  const { data: p, error } = await ctx.sb
    .from("persons")
    .select(PERSON_COLS)
    .eq("id", id)
    .eq("clan_id", ctx.clanId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) return fail(500, error.message);
  if (!p) return fail(404, "Không tìm thấy người này.");
  if (ctx.rootPersonId) {
    // Phân trang (paging.ts): họ đông hơn max_rows mà đọc một lần sẽ tính sai phạm vi cây con.
    const [ps, fs] = await Promise.all([
      fetchAllRows<{ id: string; birth_family_id: string | null }>((a, b) =>
        ctx.sb
          .from("persons")
          .select("id, birth_family_id")
          .eq("clan_id", ctx.clanId)
          .is("deleted_at", null)
          .order("id")
          .range(a, b),
      ),
      fetchAllRows<{
        id: string;
        husband_id: string | null;
        wife_id: string | null;
      }>((a, b) =>
        ctx.sb
          .from("families")
          .select("id, husband_id, wife_id")
          .eq("clan_id", ctx.clanId)
          .is("deleted_at", null)
          .order("id")
          .range(a, b),
      ),
    ]);
    if (ps.error || fs.error)
      return fail(500, "Không đọc được dữ liệu dòng họ.");
    if (!subtreeScope(ps.data, fs.data, ctx.rootPersonId).kept.has(id))
      return fail(404, "Không tìm thấy người này.");
  }
  if (p.is_living)
    return ok({
      living: true,
      id: p.id,
      full_name: p.full_name,
      generation: p.generation,
    });

  const on = (k: string) => ctx.sections.includes(k);
  const profile = !!ctx.publicChannel || on("profiles");
  const base = { living: false, id: p.id, profile };
  const detail = profile
    ? {
        courtesy_name: p.courtesy_name,
        posthumous_name: p.posthumous_name,
        nickname: p.nickname,
        birth_place: p.birth_place,
        burial_place: p.burial_place,
        bio: p.bio,
        birth_lunar: {
          year: p.birth_lunar_year,
          month: p.birth_lunar_month,
          day: p.birth_lunar_day,
        },
        death_lunar: {
          year: p.death_lunar_year,
          month: p.death_lunar_month,
          day: p.death_lunar_day,
        },
      }
    : {};

  const [milestones, posts, heritage, graves] = await Promise.all([
    profile
      ? ctx.sb
          .from("clan_timeline_milestones")
          .select("year, era, title, body")
          .eq("clan_id", ctx.clanId)
          .eq("person_id", id)
          .order("year", { ascending: true })
          .order("sort_order", { ascending: true })
          .limit(50)
      : null,
    on("board")
      ? ctx.sb
          .from("clan_posts")
          .select("id, type, title, body, created_at")
          .eq("clan_id", ctx.clanId)
          .eq("person_id", id)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(6)
      : null,
    on("heritage")
      ? ctx.sb
          .from("heritage_people")
          .select(
            "role_note, item:heritage_items(id, category, title, status, deleted_at)",
          )
          .eq("clan_id", ctx.clanId)
          .eq("person_id", id)
      : null,
    on("graves")
      ? ctx.sb
          .from("resting_place_occupants")
          .select(
            "place:resting_places(id, kind, name, location_name, status, deleted_at)",
          )
          .eq("clan_id", ctx.clanId)
          .eq("person_id", id)
      : null,
  ]);
  return ok({
    ...base,
    ...detail,
    milestones: (
      (milestones?.data ?? []) as {
        year: number;
        era: string | null;
        title: string;
        body: string | null;
      }[]
    ).map((m) => ({ year: m.year, era: m.era, title: m.title, body: m.body })),
    // deno-lint-ignore no-explicit-any
    posts: ((posts?.data ?? []) as any[]).map((x) => ({
      id: x.id,
      type: x.type,
      title: postDisplayTitle(x.title, x.body),
      created_at: x.created_at,
    })),
    heritage: (
      (heritage?.data ?? []) as {
        role_note: string | null;
        item: {
          id: string;
          category: string;
          title: string;
          status: string;
          deleted_at: string | null;
        } | null;
      }[]
    )
      .filter((h) => h.item && !h.item.deleted_at && h.item.status === "active")
      .map((h) => ({
        id: h.item!.id,
        category: h.item!.category,
        title: h.item!.title,
        role_note: h.role_note,
      })),
    graves: (
      (graves?.data ?? []) as {
        place: {
          id: string;
          kind: string;
          name: string | null;
          location_name: string | null;
          status: string;
          deleted_at: string | null;
        } | null;
      }[]
    )
      .filter((g) => g.place && !g.place.deleted_at)
      .map((g) => ({
        id: g.place!.id,
        kind: g.place!.kind,
        name: g.place!.name,
        location_name: g.place!.location_name,
        status: g.place!.status,
      })),
  });
}

// ─── Bản đồ: CHỈ số đếm theo tỉnh (không địa chỉ, không tên người) ─────

async function mapCounts(ctx: PartCtx): Promise<PartResult> {
  const [{ data: addr }, { data: graves }, { data: provs }] = await Promise.all(
    [
      ctx.sb
        .from("person_addresses")
        .select("province_code")
        .eq("clan_id", ctx.clanId)
        .eq("country", "VN")
        .not("province_code", "is", null),
      ctx.sb
        .from("resting_places")
        .select("province_code")
        .eq("clan_id", ctx.clanId)
        .is("deleted_at", null)
        .not("province_code", "is", null),
      ctx.sb.from("vn_provinces").select("code, name"),
    ],
  );
  const count = (rows: { province_code: string }[] | null) => {
    const m: Record<string, number> = {};
    for (const r of rows ?? [])
      m[r.province_code] = (m[r.province_code] ?? 0) + 1;
    return m;
  };
  return ok({
    people: count(addr),
    graves: count(graves),
    province_names: Object.fromEntries(
      ((provs ?? []) as { code: string; name: string }[]).map((p) => [
        p.code,
        p.name,
      ]),
    ),
  });
}

// ─── Ảnh ghép đại gia đình: bức mới nhất + các mảnh đã duyệt (ẩn hết khi dòng họ bật "ẩn ảnh") ─────

async function mosaic(ctx: PartCtx): Promise<PartResult> {
  if (ctx.hidePhotos) return ok({ mosaic: null });
  const { data: m } = await ctx.sb
    .from("clan_mosaics")
    .select("id, title, description, cols, slots")
    .eq("clan_id", ctx.clanId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!m) return ok({ mosaic: null });
  const { data: tiles } = await ctx.sb
    .from("clan_mosaic_tiles")
    .select("position, photo_path, caption")
    .eq("mosaic_id", m.id)
    .eq("status", "approved")
    .order("position", { ascending: true })
    .limit(150);
  // deno-lint-ignore no-explicit-any
  const rows = (tiles ?? []) as any[];
  const paths = rows
    .map((t) => t.photo_path)
    .filter((p: string) => p && !isExternal(p));
  const signed = paths.length
    ? await ctx.sign(paths)
    : new Map<string, string>();
  return ok({
    mosaic: {
      title: m.title,
      description: m.description,
      cols: m.cols,
      slots: m.slots,
      tiles: rows.map((t) => ({
        position: t.position,
        caption: t.caption,
        photo_url: isExternal(t.photo_path)
          ? t.photo_path
          : (signed.get(t.photo_path) ?? null),
      })),
    },
  });
}

// ─── Giới thiệu dòng họ ────────────────────────────────────────────

async function info(ctx: PartCtx): Promise<PartResult> {
  const [{ data: clan }, { data: book }] = await Promise.all([
    ctx.sb
      .from("clans")
      .select("description")
      .eq("id", ctx.clanId)
      .maybeSingle(),
    ctx.sb
      .from("clan_book_texts")
      .select("origin_place, ancestral_hall, ancestor_anniversary, chief_name")
      .eq("clan_id", ctx.clanId)
      .maybeSingle(),
  ]);
  return ok({
    description: clan?.description ?? null,
    origin_place: book?.origin_place ?? null,
    ancestral_hall: book?.ancestral_hall ?? null,
    ancestor_anniversary: book?.ancestor_anniversary ?? null,
    chief_name: book?.chief_name ?? null,
  });
}

/**
 * Số liệu CẢ dòng họ cho đầu trang chủ (tổng số người, đời lớn nhất). Payload cây của link có `root_person_id` chỉ chứa
 * cây con (người gốc + con cháu + vợ/chồng) nên đếm từ payload ra thấp hơn số thật. Chỉ trả hai con số tổng hợp, không lộ ai.
 */
async function stats(ctx: PartCtx): Promise<PartResult> {
  const [{ count, error }, { data: top }] = await Promise.all([
    ctx.sb
      .from("persons")
      .select("id", { count: "exact", head: true })
      .eq("clan_id", ctx.clanId)
      .is("deleted_at", null),
    ctx.sb
      .from("persons")
      .select("generation")
      .eq("clan_id", ctx.clanId)
      .is("deleted_at", null)
      .not("generation", "is", null)
      .order("generation", { ascending: false })
      .limit(1),
  ]);
  if (error) return fail(500, error.message);
  return ok({
    total: count ?? 0,
    max_generation: (top?.[0]?.generation as number | null) ?? null,
  });
}

// ─── Bảng tin ──────────────────────────────────────────────────────

async function posts(ctx: PartCtx, q: URLSearchParams): Promise<PartResult> {
  const { page, per, from, to } = parsePaging(q, 10, 30);
  const type = q.get("type");
  if (type && !POST_TYPES.includes(type))
    return fail(400, "type không hợp lệ.");
  let query = ctx.sb
    .from("clan_posts")
    .select("id, type, title, body, pinned, created_at", { count: "exact" })
    .eq("clan_id", ctx.clanId)
    .eq("status", "published");
  if (type) query = query.eq("type", type);
  const { data, count, error } = await query
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) return fail(500, error.message);
  // deno-lint-ignore no-explicit-any
  const items = ((data ?? []) as any[]).map((p) => ({
    id: p.id,
    type: p.type,
    title: postDisplayTitle(p.title, p.body),
    excerpt: postExcerpt(p.body),
    cover: ctx.hidePhotos ? null : firstImageUrl(p.body),
    pinned: !!p.pinned,
    created_at: p.created_at,
    read_minutes: readMinutes(p.body),
  }));
  return ok({ items, page, per, total: count ?? items.length });
}

async function post(ctx: PartCtx, q: URLSearchParams): Promise<PartResult> {
  const id = q.get("id") ?? "";
  if (!UUID.test(id)) return fail(400, "id không hợp lệ.");
  const { data: p, error } = await ctx.sb
    .from("clan_posts")
    .select("id, type, title, body, pinned, created_at, updated_at")
    .eq("id", id)
    .eq("clan_id", ctx.clanId)
    .eq("status", "published")
    .maybeSingle();
  if (error) return fail(500, error.message);
  if (!p) return fail(404, "Bài viết không còn.");
  const neighbour = async (dir: "older" | "newer") => {
    const base = ctx.sb
      .from("clan_posts")
      .select("id, title, body")
      .eq("clan_id", ctx.clanId)
      .eq("status", "published");
    const { data } = await (
      dir === "older"
        ? base
            .lt("created_at", p.created_at)
            .order("created_at", { ascending: false })
        : base
            .gt("created_at", p.created_at)
            .order("created_at", { ascending: true })
    )
      .limit(1)
      .maybeSingle();
    return data
      ? { id: data.id, title: postDisplayTitle(data.title, data.body) }
      : null;
  };
  const [prev, next] = await Promise.all([
    neighbour("older"),
    neighbour("newer"),
  ]);
  return ok({
    id: p.id,
    type: p.type,
    title: postDisplayTitle(p.title, p.body),
    body: p.body,
    pinned: !!p.pinned,
    created_at: p.created_at,
    updated_at: p.updated_at,
    read_minutes: readMinutes(p.body),
    prev,
    next,
  });
}

// ─── Sự kiện ───────────────────────────────────────────────────────

async function events(ctx: PartCtx): Promise<PartResult> {
  const { data, error } = await ctx.sb
    .from("events")
    .select(
      "id, title, event_type, date_solar, lunar_month, lunar_day, lunar_is_leap, is_yearly, related_person_id, notes",
    )
    .eq("clan_id", ctx.clanId)
    .limit(500);
  if (error) return fail(500, error.message);
  return ok({ items: data ?? [] });
}

// ─── Di sản ────────────────────────────────────────────────────────

async function heritageList(
  ctx: PartCtx,
  q: URLSearchParams,
): Promise<PartResult> {
  const { page, per, from, to } = parsePaging(q, 12, 30);
  const category = q.get("category");
  if (category && !HERITAGE_CATEGORIES.includes(category))
    return fail(400, "category không hợp lệ.");
  let query = ctx.sb
    .from("heritage_items")
    .select(
      "id, category, title, summary, location_name, built_year, cover:heritage_media!heritage_items_cover_fk(path, external_url)",
      { count: "exact" },
    )
    .eq("clan_id", ctx.clanId)
    .eq("status", "active")
    .is("deleted_at", null);
  if (category) query = query.eq("category", category);
  const { data, count, error } = await query
    .order("sort", { ascending: true })
    .range(from, to);
  if (error) return fail(500, error.message);
  // deno-lint-ignore no-explicit-any
  const rows = (data ?? []) as any[];
  const paths = ctx.hidePhotos
    ? []
    : rows
        .map((r) => r.cover?.path)
        .filter((p: string | null) => p && !isExternal(p));
  const signed = paths.length
    ? await ctx.sign(paths)
    : new Map<string, string>();
  const items = rows.map((r) => ({
    id: r.id,
    category: r.category,
    title: r.title,
    summary: r.summary,
    location_name: r.location_name,
    built_year: r.built_year,
    photo_url: ctx.hidePhotos
      ? null
      : isExternal(r.cover?.external_url)
        ? r.cover.external_url
        : r.cover?.path
          ? isExternal(r.cover.path)
            ? r.cover.path
            : (signed.get(r.cover.path) ?? null)
          : null,
  }));
  return ok({ items, page, per, total: count ?? items.length });
}

/**
 * Một mục di sản đầy đủ (nội dung + ảnh + ghi âm + video + người liên quan, che tên người còn sống). Dùng chung với
 * link QR di sản (scope heritage_item) — truyền `clanId` để chặn xem mục của dòng họ khác (null = không kiểm).
 */
export async function loadHeritageItem(
  sb: Sb,
  itemId: string,
  clanId: string | null,
  hidePhotos: boolean,
  /** true: chỉ mục đang hoạt động (trang dòng họ); false: như link QR từ trước tới nay. */
  activeOnly = false,
): Promise<PartResult> {
  const { data: hi } = await sb
    .from("heritage_items")
    .select(
      "id, clan_id, category, title, summary, body, location_name, address, latitude, longitude, built_year, status, deleted_at, heritage_media!heritage_media_item_id_fkey(kind, path, external_url, caption, sort, duration_sec), heritage_people(role_note, person:persons(full_name, gender, is_living))",
    )
    .eq("id", itemId)
    .maybeSingle();
  if (
    !hi ||
    hi.deleted_at ||
    (clanId && hi.clan_id !== clanId) ||
    (activeOnly && hi.status !== "active")
  ) {
    return fail(404, "Mục di sản không còn.");
  }

  type MediaRow = {
    kind: string;
    path: string | null;
    external_url: string | null;
    duration_sec: number | null;
    sort: number;
  };
  const media = [...(hi.heritage_media ?? [])].sort(
    (a: MediaRow, b: MediaRow) => a.sort - b.sort,
  ) as MediaRow[];
  const photoItems = media.filter((m) => m.kind === "photo");
  const audioItems = media.filter((m) => m.kind === "audio");
  const videoItems = media.filter((m) => m.kind === "video");
  // Chỉ ký URL cho file trong bucket; link ngoài dùng thẳng. Ảnh chịu cờ ẩn ảnh; audio/video luôn cho phép.
  const toSign = [...(hidePhotos ? [] : photoItems), ...audioItems].filter(
    (m) => !!m.path,
  );
  const signedMap = new Map<string, string>();
  if (toSign.length > 0) {
    const { data: signed } = await sb.storage
      .from("person-photos")
      .createSignedUrls(
        toSign.map((m) => m.path as string),
        3600,
      );
    (signed ?? []).forEach((s: { signedUrl?: string }, i: number) => {
      if (s.signedUrl)
        signedMap.set(toSign[i].path as string, stripOrigin(s.signedUrl));
    });
  }
  // Link ngoài chỉ chấp nhận https (phòng XSS/mixed-content), khớp client.
  const safeExt = (u: string | null): string | undefined => {
    if (!u) return undefined;
    try {
      return new URL(u).protocol === "https:" ? u : undefined;
    } catch {
      return undefined;
    }
  };
  const srcOf = (m: MediaRow): string | undefined =>
    safeExt(m.external_url) ?? (m.path ? signedMap.get(m.path) : undefined);
  const photo_urls = hidePhotos ? [] : photoItems.map(srcOf).filter(Boolean);
  const audios = audioItems
    .map((m) => ({ url: srcOf(m), duration_sec: m.duration_sec }))
    .filter((a) => !!a.url);
  const videos = videoItems
    .map((m) => ({ url: safeExt(m.external_url) }))
    .filter((v) => !!v.url);
  const people = (hi.heritage_people ?? [])
    .map(
      (l: {
        role_note: string | null;
        person: {
          full_name: string;
          gender: string;
          is_living: boolean;
        } | null;
      }) => {
        if (!l.person) return null;
        return {
          full_name: l.person.is_living
            ? "(Người đang sống)"
            : l.person.full_name,
          gender: l.person.gender,
          role_note: l.role_note,
        };
      },
    )
    .filter(Boolean);
  const {
    heritage_media: _m,
    heritage_people: _pp,
    deleted_at: _d,
    status: _st,
    ...fields
  } = hi;
  return ok({ ...fields, photo_urls, audios, videos, people });
}

async function heritageOne(
  ctx: PartCtx,
  q: URLSearchParams,
): Promise<PartResult> {
  const id = q.get("id") ?? "";
  if (!UUID.test(id)) return fail(400, "id không hợp lệ.");
  const r = await loadHeritageItem(
    ctx.sb,
    id,
    ctx.clanId,
    ctx.hidePhotos,
    true,
  );
  if (r.status !== 200) return r;
  // Trang dòng họ không trả toạ độ / địa chỉ chi tiết (khác link QR di sản).
  // deno-lint-ignore no-explicit-any
  const {
    latitude: _la,
    longitude: _lo,
    address: _ad,
    ...safe
  } = r.body as any;
  return ok(safe);
}

// ─── Mộ phần & tro cốt ─────────────────────────────────────────────

async function graves(ctx: PartCtx, q: URLSearchParams): Promise<PartResult> {
  const { page, per, from, to } = parsePaging(q, 12, 30);
  const kind = q.get("kind");
  if (kind && !KINDS.includes(kind)) return fail(400, "kind không hợp lệ.");
  let query = ctx.sb
    .from("resting_places")
    .select(
      "id, kind, name, location_name, status, built_year, resting_place_occupants(person:persons(full_name, is_living, deleted_at))",
      { count: "exact" },
    )
    .eq("clan_id", ctx.clanId)
    .is("deleted_at", null);
  if (kind) query = query.eq("kind", kind);
  const { data, count, error } = await query
    .order("created_at", { ascending: true })
    .range(from, to);
  if (error) return fail(500, error.message);
  // deno-lint-ignore no-explicit-any
  const items = ((data ?? []) as any[]).map((g) => ({
    id: g.id,
    kind: g.kind,
    name: g.name,
    location_name: g.location_name,
    status: g.status,
    built_year: g.built_year,
    occupants: (g.resting_place_occupants ?? [])
      // deno-lint-ignore no-explicit-any
      .map((o: any) => o.person)
      // deno-lint-ignore no-explicit-any
      .filter((p: any) => p && !p.is_living && !p.deleted_at)
      // deno-lint-ignore no-explicit-any
      .map((p: any) => p.full_name),
  }));
  return ok({ items, page, per, total: count ?? items.length });
}

// ─── Bảng vàng công đức ────────────────────────────────────────────

async function honor(ctx: PartCtx, q: URLSearchParams): Promise<PartResult> {
  const { page, per, from, to } = parsePaging(q, 12, 30);
  const category = q.get("category");
  if (category && !HONOR_CATEGORIES.includes(category))
    return fail(400, "category không hợp lệ.");
  let query = ctx.sb
    .from("honor_entries")
    .select("id, honoree_name, category, amount, note, occurred_on", {
      count: "exact",
    })
    .eq("clan_id", ctx.clanId)
    .is("deleted_at", null);
  if (category) query = query.eq("category", category);
  const { data, count, error } = await query
    .order("occurred_on", { ascending: false, nullsFirst: false })
    .order("sort", { ascending: true })
    .range(from, to);
  if (error) return fail(500, error.message);
  return ok({
    items: data ?? [],
    page,
    per,
    total: count ?? (data ?? []).length,
  });
}

// ─── Chỉ mục tìm kiếm (gọn, tải lười) ──────────────────────────────

const SEARCH_CAP = 500;

async function searchIndex(ctx: PartCtx): Promise<PartResult> {
  const on = (k: string) => ctx.sections.includes(k);
  const out: { kind: string; id: string; title: string; sub?: string }[] = [];
  const jobs: Promise<void>[] = [];
  if (on("board")) {
    jobs.push(
      (async () => {
        const { data } = await ctx.sb
          .from("clan_posts")
          .select("id, title, body")
          .eq("clan_id", ctx.clanId)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(SEARCH_CAP);
        // deno-lint-ignore no-explicit-any
        for (const p of (data ?? []) as any[])
          out.push({
            kind: "post",
            id: p.id,
            title: postDisplayTitle(p.title, p.body),
          });
      })(),
    );
  }
  if (on("heritage")) {
    jobs.push(
      (async () => {
        const { data } = await ctx.sb
          .from("heritage_items")
          .select("id, title")
          .eq("clan_id", ctx.clanId)
          .eq("status", "active")
          .is("deleted_at", null)
          .limit(SEARCH_CAP);
        // deno-lint-ignore no-explicit-any
        for (const h of (data ?? []) as any[])
          out.push({ kind: "heritage", id: h.id, title: h.title });
      })(),
    );
  }
  if (on("graves")) {
    jobs.push(
      (async () => {
        const { data } = await ctx.sb
          .from("resting_places")
          .select(
            "id, name, resting_place_occupants(person:persons(full_name, is_living, deleted_at))",
          )
          .eq("clan_id", ctx.clanId)
          .is("deleted_at", null)
          .limit(SEARCH_CAP);
        // deno-lint-ignore no-explicit-any
        for (const g of (data ?? []) as any[]) {
          const who = (g.resting_place_occupants ?? [])
            // deno-lint-ignore no-explicit-any
            .map((o: any) => o.person)
            // deno-lint-ignore no-explicit-any
            .filter((p: any) => p && !p.is_living && !p.deleted_at)
            // deno-lint-ignore no-explicit-any
            .map((p: any) => p.full_name)
            .join(", ");
          out.push({
            kind: "grave",
            id: g.id,
            title: g.name ?? who,
            ...(g.name && who ? { sub: who } : {}),
          });
        }
      })(),
    );
  }
  if (on("honor")) {
    jobs.push(
      (async () => {
        const { data } = await ctx.sb
          .from("honor_entries")
          .select("id, honoree_name")
          .eq("clan_id", ctx.clanId)
          .is("deleted_at", null)
          .limit(SEARCH_CAP);
        // deno-lint-ignore no-explicit-any
        for (const h of (data ?? []) as any[])
          out.push({ kind: "honor", id: h.id, title: h.honoree_name });
      })(),
    );
  }
  await Promise.all(jobs);
  return ok({ items: out.slice(0, SEARCH_CAP) });
}
