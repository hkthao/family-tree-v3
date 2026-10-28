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
 *   --include-drafts nhập cả bản nháp — CHỈ cho phép với Supabase local.
 * - Ảnh (photo): tải từ Wikimedia Commons, nén như app (≤ 512px, ~80 KB, dùng
 *   `sips` của macOS) rồi upload person-photos/{clan}/{person}.jpg.
 *   --skip-photos bỏ qua bước này.
 * - Chạy lại được: upsert theo external_key; trích dẫn/trị vì/tước hiệu của
 *   dòng họ được xoá và ghi lại từ file.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

import {
  completeness,
  composeBio,
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
if (includeDrafts && !/127\.0\.0\.1|localhost/.test(URL)) {
  console.error("--include-drafts chỉ dùng với Supabase local.");
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
    visibility: "public",
    max_persons: 3000,
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

  // 6. Ảnh đại diện.
  if (!skipPhotos) {
    const withPhoto = persons.filter((p) => p.photo);
    const dir = mkdtempSync(join(tmpdir(), "historical-photos-"));
    try {
      for (const p of withPhoto) {
        const id = personId.get(p.key)!;
        const res = await fetch(p.photo!.url, {
          // Wikimedia yêu cầu User-Agent nhận diện được.
          headers: { "User-Agent": "giapha-historical-import/1.0 (https://giapha.thaohk.com)" },
        });
        if (!res.ok) {
          console.warn(`  ⚠ Ảnh ${p.key}: tải lỗi ${res.status} — bỏ qua`);
          continue;
        }
        const src = join(dir, `${p.key}.src`);
        const out = join(dir, `${p.key}.jpg`);
        writeFileSync(src, Buffer.from(await res.arrayBuffer()));
        // Nén giống photoUpload.ts: cạnh dài ≤ 512px, JPEG, hạ chất lượng tới khi ≤ 80 KB.
        for (const q of [80, 70, 60, 50]) {
          execFileSync("sips", ["-Z", "512", "-s", "format", "jpeg", "-s", "formatOptions", String(q), src, "--out", out], {
            stdio: "ignore",
          });
          if (statSync(out).size <= 80 * 1024) break;
        }
        const path = `${clanId}/${id}.jpg`;
        must(
          `ảnh ${p.key}`,
          await admin.storage
            .from("person-photos")
            .upload(path, readFileSync(out), { upsert: true, contentType: "image/jpeg", cacheControl: "3600" }),
        );
        must(`ảnh ${p.key}`, await admin.from("persons").update({ photo_path: path }).eq("id", id));
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
    if (withPhoto.length) console.log(`✓ Ảnh: ${withPhoto.length} người.`);
  }

  // 7. Trích dẫn, trị vì, tước hiệu — ghi lại toàn bộ.
  for (const t of ["person_citations", "person_reigns", "person_titles"]) {
    must(t, await admin.from(t).delete().eq("clan_id", clanId));
  }

  const citations = [
    ...persons.flatMap((p) => p.citations.map((c) => ({ c, key: p.key, review: p.review, person_id: personId.get(p.key)!, family_id: null }))),
    ...unions.flatMap((u) => u.citations.map((c) => ({ c, key: u.key, review: u.review, person_id: null, family_id: familyId.get(u.key)! }))),
  ].map(({ c, key, review, person_id, family_id }) => ({
    clan_id: clanId,
    person_id,
    family_id,
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
    (p.reigns ?? []).map((r) => ({
      clan_id: clanId,
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
    (p.titles ?? []).map((t) => ({
      clan_id: clanId,
      person_id: personId.get(p.key)!,
      title: t.title,
      from_year: t.from_year ?? null,
      to_year: t.to_year ?? null,
      notes: t.notes ?? null,
    })),
  );
  if (titles.length) must("person_titles", await admin.from("person_titles").insert(titles));

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
    `✓ Đã nhập ${persons.length} người, ${unions.length} hôn nhân, ${citations.length} trích dẫn, ` +
      `${reigns.length} trị vì, ${titles.length} tước hiệu.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
