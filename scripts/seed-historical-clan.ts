/**
 * Nhập một DÒNG HỌ LỊCH SỬ (gia phả một triều vua chúa) từ file nháp JSON đã
 * duyệt. Xem docs/plan-gia-pha-vua-chua.md và scripts/historical/validate-lib.ts.
 *
 *   Chỉ kiểm tra:  npx tsx --tsconfig tsconfig.app.json scripts/seed-historical-clan.ts data/historical/tran.json --check
 *   LOCAL:         npx tsx --tsconfig tsconfig.app.json scripts/seed-historical-clan.ts data/historical/tran.json
 *   PROD:          SUPABASE_SERVICE_ROLE_KEY=<self-host key> VITE_SUPABASE_URL=<url> \
 *                  npx tsx --tsconfig tsconfig.app.json scripts/seed-historical-clan.ts data/historical/tran.json
 *
 * - File có lỗi (thiếu trích dẫn, quan hệ vô lý…) → dừng, không ghi gì.
 * - Chỉ nhập người/hôn nhân có review.status = 'verified'.
 *   --include-drafts nhập cả bản nháp — với Supabase local; lên production phải
 *   thêm --publish-unreviewed (trang hiện nhãn "Bản đang duyệt").
 * - Ảnh (photo): ghi thẳng link ảnh thu nhỏ Wikimedia Commons (không tải về,
 *   không nén) — app dùng link https:// trực tiếp. --skip-photos bỏ qua.
 * - Sự kiện thường niên → Sự kiện (giỗ KHÔNG khai: app tự sinh từ ngày mất).
 * - Lăng tẩm → Mộ phần, di sản → Di sản dòng họ;
 *   thông gia → person_links 'same_person' đã xác nhận (khi dòng họ kia đã nhập).
 * - Chạy lại được: upsert theo external_key; trích dẫn/trị vì/tước hiệu của
 *   dòng họ được xoá và ghi lại từ file.
 */
import { readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  completeness,
  composeBio,
  composeProse,
  photoCaption,
  generationSummary,
  isPublishable,
  validate,
  type DateColumns,
  type DynastyFile,
  type PersonDraft,
  type SourceDef,
} from "./historical/validate-lib.ts";

config({ path: ".env.local" });

const args = process.argv.slice(2);
const filePath = args.find((a) => !a.startsWith("--"));
const checkOnly = args.includes("--check");
const includeDrafts = args.includes("--include-drafts");
const skipPhotos = args.includes("--skip-photos");
if (!filePath) {
  console.error("Cách dùng: npx tsx --tsconfig tsconfig.app.json scripts/seed-historical-clan.ts <file.json> [--check] [--include-drafts] [--skip-photos]");
  process.exit(1);
}

const file = JSON.parse(readFileSync(filePath, "utf8")) as DynastyFile;
const sources = JSON.parse(readFileSync("data/historical/sources.json", "utf8")) as SourceDef[];

const result = validate(file, sources, { publishOnly: !includeDrafts });
result.warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
if (result.errors.length) {
  result.errors.forEach((e) => console.error(`  ✗ ${e}`));
  console.error(`\n${result.errors.length} lỗi — không nhập.`);
  process.exit(1);
}

const keep = <T extends { review?: PersonDraft["review"] }>(x: T) => includeDrafts || isPublishable(x.review);
const persons = file.persons.filter(keep);
const unions = file.unions.filter(keep);
const graves = (file.resting_places ?? []).filter(keep);
const heritage = (file.heritage ?? []).filter(keep);
const links = (file.same_person_links ?? []).filter(keep);
const events = (file.events ?? []).filter(keep);
console.log(
  `✓ Hợp lệ. Sẽ nhập ${persons.length}/${file.persons.length} người, ${unions.length}/${file.unions.length} hôn nhân` +
    (includeDrafts ? " (KỂ CẢ BẢN NHÁP)" : " (đã duyệt)"),
);
console.log("\nĐộ đầy đủ các trường trên form:");
const rulers = completeness(file, (p) => !!p.reigns?.length);
for (const [i, c] of completeness(file).entries()) {
  const r = rulers[i];
  console.log(`  ${c.label.padEnd(16)} ${String(c.filled).padStart(4)}/${c.total}` + (r.total ? `   (vua/chúa ${r.filled}/${r.total})` : ""));
}
console.log("\nSố người theo đời:");
for (const [g, n] of generationSummary(result.generations)) console.log(`  Đời ${String(g).padStart(2)}: ${n}`);
if (checkOnly) process.exit(0);

const URL = process.env.VITE_SUPABASE_URL!;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!URL || !KEY) {
  console.error("Thiếu VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
// Bản nháp lên production chỉ khi chủ dự án chủ động đồng ý (trang hiện nhãn
// "Bản đang duyệt" cho trích dẫn chưa có người duyệt).
const allowUnreviewed = args.includes("--publish-unreviewed");
if (includeDrafts && !/127\.0\.0\.1|localhost/.test(URL) && !allowUnreviewed) {
  console.error("--include-drafts chỉ dùng với Supabase local (thêm --publish-unreviewed để đưa bản nháp lên production).");
  process.exit(1);
}
const admin = createClient(URL, KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function must<T>(label: string, r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}

/** Cột ngày đã dựng bởi validator (đúng như form ghi) → tên cột persons. */
function dateCols(prefix: "birth" | "death", c: DateColumns | null | undefined) {
  return {
    [`${prefix}_date`]: c?.date ?? null,
    [`${prefix}_date_precision`]: c?.precision ?? null,
    [`${prefix}_date_qualifier`]: c?.qualifier ?? null,
    [`${prefix}_lunar_year`]: c?.lunar_year ?? null,
    [`${prefix}_lunar_month`]: c?.lunar_month ?? null,
    [`${prefix}_lunar_day`]: c?.lunar_day ?? null,
    [`${prefix}_lunar_is_leap`]: c?.lunar_is_leap ?? false,
  };
}

const UA = "giapha-historical-import/1.0 (https://giapha.thaohk.com)";

/**
 * Link ảnh thu nhỏ của Wikimedia (không tải về, không nén): app dùng thẳng link
 * https:// (xem isExternalPhoto ở src/lib/photoUpload.ts). `width` lấy theo
 * kích thước chuẩn của Wikimedia (500 = ảnh đại diện, 960 = ảnh lăng / di sản).
 * Kiểm link mở được; lỗi thì dùng link ảnh gốc.
 *   …/commons/e/ee/Ten.jpg → …/commons/thumb/e/ee/Ten.jpg/500px-Ten.jpg
 */
async function commonsThumb(url: string, width: number): Promise<string> {
  const m = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/)([0-9a-f]\/[0-9a-f]{2}\/)([^/]+)$/.exec(url);
  if (!m) return url;
  const thumb = `${m[1]}thumb/${m[2]}${m[3]}/${width}px-${m[3]}`;
  try {
    // Wikimedia yêu cầu User-Agent nhận diện được.
    const res = await fetch(thumb, { method: "HEAD", headers: { "User-Agent": UA } });
    if (res.ok) return thumb;
    console.warn(`  ⚠ Ảnh thu nhỏ ${width}px lỗi ${res.status} — dùng ảnh gốc: ${m[3]}`);
  } catch {
    console.warn(`  ⚠ Không kiểm được ảnh thu nhỏ — dùng ảnh gốc: ${m[3]}`);
  }
  return url;
}

async function main() {
  // 1. Danh mục nguồn
  must("sources", await admin.from("historical_sources").upsert(sources, { onConflict: "code" }));
  const srcRows = must("sources", await admin.from("historical_sources").select("id, code"));
  const sourceId = new Map((srcRows ?? []).map((s) => [s.code as string, s.id as string]));

  // 2. Dòng họ
  const padmin = must(
    "platform admin",
    await admin.from("profiles").select("id").eq("is_platform_admin", true).limit(1).maybeSingle(),
  );
  if (!padmin) throw new Error("Không tìm thấy platform admin để làm chủ dòng họ.");

  const clanFields = {
    name: file.clan.name,
    description: file.clan.description ?? null,
    kind: "historical",
    historical_category: file.clan.category,
    visibility: "public",
    max_persons: 3000,
    // Người ngoài xem được Mộ phần (lăng tẩm) + Di sản của dòng họ lịch sử.
    public_show_graves: true,
    public_show_heritage: true,
    public_show_events: true,
  };
  const existing = must(
    "clan",
    await admin.from("clans").select("id").eq("external_key", file.clan.key).maybeSingle(),
  );
  let clanId: string;
  if (existing) {
    clanId = existing.id;
    must("clan", await admin.from("clans").update(clanFields).eq("id", clanId));
  } else {
    const created = must(
      "clan",
      await admin
        .from("clans")
        .insert({ ...clanFields, external_key: file.clan.key, owner_id: padmin.id })
        .select("id")
        .single(),
    );
    clanId = created!.id;
  }
  console.log(`Dòng họ: ${file.clan.name} (${clanId})`);

  // 3. Người — lượt 1 chưa gắn cha mẹ (families cần id người trước).
  const personRow = (p: PersonDraft, families?: Map<string, string>) => ({
    clan_id: clanId,
    external_key: p.key,
    full_name: p.full_name,
    gender: p.gender,
    is_living: false,
    is_root: p.is_root ?? false,
    nickname: p.nickname ?? null,
    courtesy_name: p.courtesy_name ?? null,
    posthumous_name: p.posthumous_name ?? null,
    birth_place: p.birth_place ?? null,
    burial_place: p.burial_place ?? null,
    birth_order: p.birth_order ?? null,
    lifespan_years: p.lifespan ?? null,
    bio: composeBio(p, sources),
    death_anniv_lunar_month: result.columns.get(p.key)?.death_anniv_lunar_month ?? null,
    death_anniv_lunar_day: result.columns.get(p.key)?.death_anniv_lunar_day ?? null,
    death_anniv_lunar_is_leap: result.columns.get(p.key)?.death_anniv_lunar_is_leap ?? false,
    ...dateCols("birth", result.columns.get(p.key)?.birth),
    ...dateCols("death", result.columns.get(p.key)?.death),
    ...(families && {
      birth_family_id: (p.parents && families.get(p.parents)) ?? null,
      adoptive_family_id: (p.adoptive_parents && families.get(p.adoptive_parents)) ?? null,
    }),
  });

  const pRows = must(
    "persons",
    await admin
      .from("persons")
      .upsert(persons.map((p) => personRow(p)), { onConflict: "clan_id,external_key" })
      .select("id, external_key"),
  );
  const personId = new Map((pRows ?? []).map((r) => [r.external_key as string, r.id as string]));

  // 4. Hôn nhân
  const fRows = must(
    "families",
    await admin
      .from("families")
      .upsert(
        unions.map((u) => ({
          clan_id: clanId,
          external_key: u.key,
          husband_id: (u.husband && personId.get(u.husband)) ?? null,
          wife_id: (u.wife && personId.get(u.wife)) ?? null,
          spouse_order: u.spouse_order ?? null,
          union_type: u.union_type ?? "marriage",
          notes: u.notes ?? null,
        })),
        { onConflict: "clan_id,external_key" },
      )
      .select("id, external_key"),
  );
  const familyId = new Map((fRows ?? []).map((r) => [r.external_key as string, r.id as string]));

  // 5. Người — lượt 2 gắn cha mẹ đẻ / cha mẹ nuôi.
  if (persons.length) {
    must(
      "persons (parents)",
      await admin
        .from("persons")
        .upsert(persons.map((p) => personRow(p, familyId)), { onConflict: "clan_id,external_key" }),
    );
  }

  // 6. Ảnh đại diện: link ảnh thu nhỏ Wikimedia, không tải về.
  if (!skipPhotos) {
    const withPhoto = persons.filter((p) => p.photo);
    for (const p of withPhoto) {
      const link = await commonsThumb(p.photo!.url, 500);
      must(`ảnh ${p.key}`, await admin.from("persons").update({ photo_path: link }).eq("id", personId.get(p.key)!));
    }
    if (withPhoto.length) console.log(`✓ Ảnh: ${withPhoto.length} người (link Wikimedia).`);
  }

  // 7. Lăng tẩm → Mộ phần.
  const graveId = new Map<string, string>();
  if (graves.length) {
    const rows = must(
      "resting_places",
      await admin
        .from("resting_places")
        .upsert(
          graves.map((g) => ({
            clan_id: clanId,
            external_key: g.key,
            kind: g.kind ?? "grave",
            name: g.name,
            location_name: g.location_name ?? null,
            address: g.address ?? null,
            latitude: g.latitude ?? null,
            longitude: g.longitude ?? null,
            status: g.status ?? "existing",
            built_year: g.built_year ?? null,
            notes: composeProse(g.notes, g.citations, sources),
          })),
          { onConflict: "clan_id,external_key" },
        )
        .select("id, external_key"),
    );
    (rows ?? []).forEach((r) => graveId.set(r.external_key as string, r.id as string));
    const ids = [...graveId.values()];
    must("occupants", await admin.from("resting_place_occupants").delete().in("resting_place_id", ids));
    const occ = graves.flatMap((g) =>
      g.occupants.filter((k) => personId.has(k)).map((k) => ({
        resting_place_id: graveId.get(g.key)!,
        person_id: personId.get(k)!,
        clan_id: clanId,
      })),
    );
    if (occ.length) must("occupants", await admin.from("resting_place_occupants").insert(occ));
  }

  // 8. Di sản dòng họ.
  const heritageId = new Map<string, string>();
  if (heritage.length) {
    const rows = must(
      "heritage_items",
      await admin
        .from("heritage_items")
        .upsert(
          heritage.map((h, i) => ({
            clan_id: clanId,
            external_key: h.key,
            category: h.category,
            title: h.title,
            summary: h.summary ?? null,
            body: composeProse(h.body, h.citations, sources),
            location_name: h.location_name ?? null,
            address: h.address ?? null,
            latitude: h.latitude ?? null,
            longitude: h.longitude ?? null,
            built_year: h.built_year ?? null,
            status: "active",
            sort: i,
            created_by: padmin.id,
          })),
          { onConflict: "clan_id,external_key" },
        )
        .select("id, external_key"),
    );
    (rows ?? []).forEach((r) => heritageId.set(r.external_key as string, r.id as string));
    const ids = [...heritageId.values()];
    must("heritage_people", await admin.from("heritage_people").delete().in("item_id", ids));
    const people = heritage.flatMap((h) =>
      (h.people ?? []).filter((x) => personId.has(x.person)).map((x) => ({
        item_id: heritageId.get(h.key)!,
        person_id: personId.get(x.person)!,
        clan_id: clanId,
        role_note: x.role_note ?? null,
      })),
    );
    if (people.length) must("heritage_people", await admin.from("heritage_people").insert(people));
  }

  // 9. Ảnh lăng / di sản: link ảnh thu nhỏ Wikimedia, không tải về. Ghi lại toàn bộ.
  if (!skipPhotos) {
    let n = 0;
    for (const g of graves) {
      const id = graveId.get(g.key)!;
      must(`ảnh ${g.key}`, await admin.from("resting_place_photos").delete().eq("resting_place_id", id));
      const rows = [];
      for (const [i, ph] of (g.photos ?? []).entries()) {
        rows.push({ resting_place_id: id, clan_id: clanId, path: await commonsThumb(ph.url, 960), caption: photoCaption(ph), sort: i });
      }
      if (rows.length) must(`ảnh ${g.key}`, await admin.from("resting_place_photos").insert(rows));
      n += rows.length;
    }
    for (const h of heritage) {
      const id = heritageId.get(h.key)!;
      await admin.from("heritage_items").update({ cover_media_id: null }).eq("id", id);
      must(`ảnh ${h.key}`, await admin.from("heritage_media").delete().eq("item_id", id));
      const rows = [];
      for (const [i, ph] of (h.photos ?? []).entries()) {
        // heritage_media có sẵn cột external_url cho link ngoài.
        rows.push({ item_id: id, clan_id: clanId, kind: "photo", path: null, external_url: await commonsThumb(ph.url, 960), caption: photoCaption(ph), sort: i });
      }
      if (rows.length) {
        must(`ảnh ${h.key}`, await admin.from("heritage_media").insert(rows));
        const first = must(
          "cover",
          await admin.from("heritage_media").select("id").eq("item_id", id).order("sort").limit(1).maybeSingle(),
        );
        if (first) must("cover", await admin.from("heritage_items").update({ cover_media_id: first.id }).eq("id", id));
      }
      n += rows.length;
    }
    if (n) console.log(`✓ Ảnh lăng / di sản: ${n} (link Wikimedia).`);
  }

  // 10a. Sự kiện thường niên.
  const eventId = new Map<string, string>();
  if (events.length) {
    const rows = must(
      "events",
      await admin
        .from("events")
        .upsert(
          events.map((e) => ({
            clan_id: clanId,
            external_key: e.key,
            title: e.title,
            event_type: e.event_type ?? "custom",
            date_solar: e.date.solar ?? null,
            lunar_month: e.date.lunar_month ?? null,
            lunar_day: e.date.lunar_day ?? null,
            lunar_is_leap: e.date.lunar_leap ?? false,
            is_yearly: e.is_yearly ?? true,
            related_person_id: (e.related_person && personId.get(e.related_person)) ?? null,
            resting_place_id: (e.resting_place && graveId.get(e.resting_place)) ?? null,
            notes: composeProse(e.notes, e.citations, sources),
          })),
          { onConflict: "clan_id,external_key" },
        )
        .select("id, external_key"),
    );
    (rows ?? []).forEach((r) => eventId.set(r.external_key as string, r.id as string));
  }

  // 10. Trích dẫn, trị vì, tước hiệu — ghi lại toàn bộ.
  for (const t of ["person_citations", "person_reigns", "person_titles"]) {
    must(t, await admin.from(t).delete().eq("clan_id", clanId));
  }

  const citations = [
    ...persons.flatMap((p) => p.citations.map((c) => ({ c, key: p.key, review: p.review, person_id: personId.get(p.key)! }))),
    ...unions.flatMap((u) => u.citations.map((c) => ({ c, key: u.key, review: u.review, family_id: familyId.get(u.key)! }))),
    ...graves.flatMap((g) => g.citations.map((c) => ({ c, key: g.key, review: g.review, resting_place_id: graveId.get(g.key)! }))),
    ...heritage.flatMap((h) => h.citations.map((c) => ({ c, key: h.key, review: h.review, heritage_item_id: heritageId.get(h.key)! }))),
    ...events.flatMap((e) => e.citations.map((c) => ({ c, key: e.key, review: e.review, event_id: eventId.get(e.key)! }))),
  ].map(({ c, key, review, ...target }) => ({
    clan_id: clanId,
    person_id: null,
    family_id: null,
    resting_place_id: null,
    heritage_item_id: null,
    event_id: null,
    ...target,
    field: c.field,
    value: c.value ?? null,
    source_id: sourceId.get(c.source)!,
    locator: c.locator,
    quote: c.quote,
    confidence: result.confidence.get(key)?.get(c.field) ?? "single_source",
    note: c.note ?? null,
    reviewed_by: isPublishable(review) ? review?.by ?? null : null,
    reviewed_at: isPublishable(review) ? review?.at ?? null : null,
  }));
  if (citations.length) must("person_citations", await admin.from("person_citations").insert(citations));

  const reigns = persons.flatMap((p) =>
    (p.reigns ?? []).map((r, i) => ({
      clan_id: clanId,
      sort: i,
      person_id: personId.get(p.key)!,
      dynasty: r.dynasty,
      ordinal: r.ordinal ?? null,
      role: r.role ?? "emperor",
      temple_name: r.temple_name ?? null,
      era_names: r.era_names ?? [],
      reign_start_year: r.start_year ?? null,
      reign_end_year: r.end_year ?? null,
      notes: r.notes ?? null,
    })),
  );
  if (reigns.length) must("person_reigns", await admin.from("person_reigns").insert(reigns));

  const titles = persons.flatMap((p) =>
    (p.titles ?? []).map((t, i) => ({
      clan_id: clanId,
      sort: i,
      person_id: personId.get(p.key)!,
      title: t.title,
      from_year: t.from_year ?? null,
      to_year: t.to_year ?? null,
      notes: t.notes ?? null,
    })),
  );
  if (titles.length) must("person_titles", await admin.from("person_titles").insert(titles));

  // 11. Thông gia: cùng một người ở dòng họ lịch sử khác.
  let linked = 0;
  for (const l of links) {
    const other = must(
      "thông gia",
      await admin.from("clans").select("id").eq("external_key", l.other_clan).eq("kind", "historical").maybeSingle(),
    );
    const otherPerson = other
      ? must(
          "thông gia",
          await admin.from("persons").select("id").eq("clan_id", other.id).eq("external_key", l.other_person).maybeSingle(),
        )
      : null;
    if (!other || !otherPerson) {
      console.warn(`  ⚠ Thông gia ${l.person} ↔ ${l.other_clan}/${l.other_person}: dòng họ/người kia chưa nhập — chạy lại sau`);
      continue;
    }
    const a = personId.get(l.person)!;
    const b = otherPerson.id as string;
    const exists = must(
      "thông gia",
      await admin
        .from("person_links")
        .select("id")
        .neq("status", "revoked")
        .or(`and(person_a_id.eq.${a},person_b_id.eq.${b}),and(person_a_id.eq.${b},person_b_id.eq.${a})`),
    );
    if (exists?.length) continue;
    must(
      "thông gia",
      await admin.from("person_links").insert({
        link_type: "same_person",
        status: "confirmed",
        clan_a_id: clanId,
        person_a_id: a,
        clan_b_id: other.id,
        person_b_id: b,
        note: l.note ?? null,
        created_by: padmin.id,
        confirmed_by: padmin.id,
        confirmed_at: new Date().toISOString(),
      }),
    );
    linked++;
  }
  if (links.length) console.log(`✓ Thông gia: ${linked} liên kết mới / ${links.length}.`);

  // Đối chiếu số đời DB tính với mô phỏng của validator.
  const gens = must(
    "generation",
    await admin.from("persons").select("external_key, generation").eq("clan_id", clanId).is("deleted_at", null),
  );
  const genMismatch = (gens ?? []).filter(
    (r) => r.external_key && result.generations.has(r.external_key) && result.generations.get(r.external_key) !== r.generation,
  );
  genMismatch.forEach((r) =>
    console.warn(`  ⚠ Đời lệch: ${r.external_key} DB=${r.generation} dự kiến=${result.generations.get(r.external_key)}`),
  );
  if (!genMismatch.length) console.log("✓ Số đời trong DB khớp dự kiến.");

  // Người có trong DB nhưng đã bị bỏ khỏi file / chưa duyệt → chỉ báo, không xoá.
  const all = must(
    "persons",
    await admin.from("persons").select("external_key, full_name").eq("clan_id", clanId).is("deleted_at", null),
  );
  const stale = (all ?? []).filter((r) => r.external_key && !personId.has(r.external_key));
  stale.forEach((r) => console.warn(`  ⚠ Trong DB nhưng không có trong lần nhập này: ${r.external_key} (${r.full_name})`));

  console.log(
    `✓ Đã nhập ${persons.length} người, ${unions.length} hôn nhân, ${graves.length} lăng, ${heritage.length} di sản, ${events.length} sự kiện, ` +
      `${citations.length} trích dẫn, ${reigns.length} trị vì, ${titles.length} tước hiệu.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
