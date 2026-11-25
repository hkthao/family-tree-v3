/**
 * Các phần admin chọn chia sẻ ở tab "Tổng quan" của link chia sẻ (clans.share_sections).
 * Chỉ dựng phần được bật; mỗi phần giới hạn số dòng và bỏ dữ liệu nhạy cảm:
 *   - map: CHỈ số đếm theo tỉnh (không địa chỉ, không tên người);
 *   - graves: tên, loại, khu vực, người an nghỉ ĐÃ MẤT — không toạ độ / địa chỉ chi tiết;
 *   - người còn sống không bao giờ hiện tên trong mộ phần / bảng vàng (bảng vàng ghi tên người được
 *     vinh danh do admin nhập, giữ nguyên).
 */

// deno-lint-ignore no-explicit-any
type Sb = any;

export const SHARE_SECTION_KEYS = ["info", "board", "events", "map", "heritage", "graves", "honor", "mosaic", "profiles"] as const;
export type ShareSectionKey = (typeof SHARE_SECTION_KEYS)[number];

interface Ctx {
  sb: Sb;
  clanId: string;
  hidePhotos: boolean;
  sign: (paths: string[]) => Promise<Map<string, string>>;
}

const isExternal = (p: string | null | undefined): p is string => !!p && p.startsWith("https://");

export async function buildShareSections(
  ctx: Ctx,
  keys: string[],
  persons: { id: string; full_name: string; is_living: boolean; is_root: boolean; generation: number | null }[],
  generationOffset: number,
): Promise<Record<string, unknown>> {
  const on = new Set(keys.filter((k) => (SHARE_SECTION_KEYS as readonly string[]).includes(k)));
  const out: Record<string, unknown> = {};
  const { sb, clanId } = ctx;
  const jobs: Promise<void>[] = [];

  if (on.has("info")) {
    jobs.push(
      (async () => {
        const [{ data: clan }, { data: book }] = await Promise.all([
          sb.from("clans").select("description").eq("id", clanId).maybeSingle(),
          sb
            .from("clan_book_texts")
            .select("origin_place, ancestral_hall, ancestor_anniversary, chief_name")
            .eq("clan_id", clanId)
            .maybeSingle(),
        ]);
        const gens = persons.map((p) => p.generation).filter((g): g is number => g != null);
        const root = persons.find((p) => p.is_root);
        out.info = {
          description: clan?.description ?? null,
          root_name: root ? (root.is_living ? null : root.full_name) : null,
          persons: persons.length,
          generations: gens.length ? Math.max(...gens) - generationOffset : null,
          origin_place: book?.origin_place ?? null,
          ancestral_hall: book?.ancestral_hall ?? null,
          ancestor_anniversary: book?.ancestor_anniversary ?? null,
          chief_name: book?.chief_name ?? null,
        };
      })(),
    );
  }

  if (on.has("board")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("clan_posts")
          .select("id, type, title, body, pinned, created_at")
          .eq("clan_id", clanId)
          .eq("status", "published")
          .order("pinned", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(6);
        out.board = ((data ?? []) as Record<string, unknown>[]).map((p) => ({
          id: p.id,
          type: p.type,
          title: p.title,
          excerpt: String(p.body ?? "").slice(0, 400),
          pinned: !!p.pinned,
          created_at: p.created_at,
        }));
      })(),
    );
  }

  if (on.has("map")) {
    jobs.push(
      (async () => {
        const [{ data: addr }, { data: graves }, { data: provs }] = await Promise.all([
          sb.from("person_addresses").select("province_code").eq("clan_id", clanId).eq("country", "VN").not("province_code", "is", null),
          sb.from("resting_places").select("province_code").eq("clan_id", clanId).is("deleted_at", null).not("province_code", "is", null),
          sb.from("vn_provinces").select("code, name"),
        ]);
        const count = (rows: { province_code: string }[] | null) => {
          const m: Record<string, number> = {};
          for (const r of rows ?? []) m[r.province_code] = (m[r.province_code] ?? 0) + 1;
          return m;
        };
        out.map = {
          people: count(addr),
          graves: count(graves),
          province_names: Object.fromEntries(((provs ?? []) as { code: string; name: string }[]).map((p) => [p.code, p.name])),
        };
      })(),
    );
  }

  if (on.has("heritage")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("heritage_items")
          .select("id, category, title, summary, location_name, built_year, cover:heritage_media!heritage_items_cover_fk(path, external_url)")
          .eq("clan_id", clanId)
          .is("deleted_at", null)
          .order("sort", { ascending: true })
          .limit(12);
        // deno-lint-ignore no-explicit-any
        const rows = (data ?? []) as any[];
        const paths = ctx.hidePhotos ? [] : rows.map((r) => r.cover?.path).filter((p: string | null) => p && !isExternal(p));
        const signed = paths.length ? await ctx.sign(paths) : new Map<string, string>();
        out.heritage = rows.map((r) => ({
          id: r.id,
          category: r.category,
          title: r.title,
          summary: r.summary,
          location_name: r.location_name,
          built_year: r.built_year,
          photo_url: ctx.hidePhotos
            ? null
            : r.cover?.external_url?.startsWith("https://")
              ? r.cover.external_url
              : r.cover?.path
                ? (isExternal(r.cover.path) ? r.cover.path : (signed.get(r.cover.path) ?? null))
                : null,
        }));
      })(),
    );
  }

  if (on.has("graves")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("resting_places")
          .select("id, kind, name, location_name, status, built_year, resting_place_occupants(person:persons(full_name, is_living))")
          .eq("clan_id", clanId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true })
          .limit(30);
        // deno-lint-ignore no-explicit-any
        out.graves = ((data ?? []) as any[]).map((g) => ({
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
            .filter((p: any) => p && !p.is_living)
            // deno-lint-ignore no-explicit-any
            .map((p: any) => p.full_name),
        }));
      })(),
    );
  }

  if (on.has("honor")) {
    jobs.push(
      (async () => {
        const { data } = await sb
          .from("honor_entries")
          .select("id, honoree_name, category, amount, note, occurred_on")
          .eq("clan_id", clanId)
          .is("deleted_at", null)
          .order("occurred_on", { ascending: false, nullsFirst: false })
          .order("sort", { ascending: true })
          .limit(30);
        out.honor = data ?? [];
      })(),
    );
  }

  if (on.has("mosaic") && !ctx.hidePhotos) {
    jobs.push(
      (async () => {
        const { data: m } = await sb
          .from("clan_mosaics")
          .select("id, title, description, cols, slots")
          .eq("clan_id", clanId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!m) return;
        const { data: tiles } = await sb
          .from("clan_mosaic_tiles")
          .select("position, photo_path, caption")
          .eq("mosaic_id", m.id)
          .eq("status", "approved")
          .order("position", { ascending: true })
          .limit(150);
        // deno-lint-ignore no-explicit-any
        const rows = (tiles ?? []) as any[];
        const paths = rows.map((t) => t.photo_path).filter((p: string) => p && !isExternal(p));
        const signed = paths.length ? await ctx.sign(paths) : new Map<string, string>();
        out.mosaic = {
          title: m.title,
          description: m.description,
          cols: m.cols,
          slots: m.slots,
          tiles: rows.map((t) => ({
            position: t.position,
            caption: t.caption,
            photo_url: isExternal(t.photo_path) ? t.photo_path : (signed.get(t.photo_path) ?? null),
          })),
        };
      })(),
    );
  }

  await Promise.all(jobs);
  return out;
}
