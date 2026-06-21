/**
 * giapha-import: platform-admin tool to import a gia phả from
 * vietnamgiapha.com into a clan, server-side.
 *
 * Flow: admin pastes a vietnamgiapha.com link in /admin → this function
 *   1. verifies the caller is a platform admin,
 *   2. SSRF-guards the URL (only vietnamgiapha.com),
 *   3. scrapes the overview + tree + every person page (concurrently),
 *   4. parses with deno-dom + reconstructs marriages/parentage,
 *   5. imports into the target clan (new, or an existing one — with an
 *      optional wipe first), letting DB triggers compute generations.
 *
 * Why server-side: the browser can't cross-origin fetch vietnamgiapha,
 * and the import needs the service-role key. Mirrors the CLI tool
 * scripts/migrate-cao-minh-triet.ts.
 */
import { createClient } from "jsr:@supabase/supabase-js@2";
import { DOMParser } from "jsr:@b-fuze/deno-dom";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const UA = "Mozilla/5.0 (gia-pha importer)";
const CONCURRENCY = 10;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: { ...CORS, "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
const err = (message: string, status: number) => json({ error: message }, { status });

// ─── types ───────────────────────────────────────────────────────────

interface PersonRec {
  oldId: number;
  fullName: string;
  gender: "M" | "F" | null;
  nickname: string | null;
  courtesyName: string | null;
  generation: number | null;
  birthSolar: string | null;
  birthYear: number | null;
  deathSolar: string | null;
  deathYear: number | null;
  deathLunarDay: number | null;
  deathLunarMonth: number | null;
  deathLunarYear: number | null;
  birthPlace: string | null;
  burialPlace: string | null;
  bio: string | null;
  fatherId: number | null;
  motherId: number | null;
  motherAmbiguous: boolean;
  spouseIds: number[];
  childIds: number[];
}
interface FamUnit {
  husband: number | null;
  wife: number | null;
  children: number[];
  spouseOrder: number | null;
}

// ─── HTTP ────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (res.status === 404) return "";
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.text();
    } catch (e) {
      if (attempt === 3) throw e;
      await new Promise((r) => setTimeout(r, 800 * attempt));
    }
  }
  return "";
}

/** Run `fn` over items with bounded concurrency. */
async function pool<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

// ─── parsing (deno-dom) ──────────────────────────────────────────────

// deno-dom returns loosely-typed nodes; treat as any for ergonomics.
// deno-lint-ignore-file no-explicit-any
type El = any;
const parseDoc = (html: string): El =>
  new DOMParser().parseFromString(html, "text/html");

const CAN = ["Giáp","Ất","Bính","Đinh","Mậu","Kỷ","Canh","Tân","Nhâm","Quý"];
const CHI = ["Tý","Sửu","Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi"];
function canChiToYearNear(can: string, chi: string, ref: number): number | null {
  const ci = CAN.indexOf(can);
  const zi = CHI.findIndex((c) => c === chi || (c === "Mão" && chi === "Mẹo"));
  if (ci < 0 || zi < 0) return null;
  let best: number | null = null;
  for (let y = ref - 90; y <= ref + 90; y++) {
    if ((((y - 1984) % 10) + 10) % 10 === ci && (((y - 1984) % 12) + 12) % 12 === zi)
      if (best === null || Math.abs(y - ref) < Math.abs(best - ref)) best = y;
  }
  return best;
}

interface ParsedDate {
  solar: string | null; year: number | null;
  lDay: number | null; lMonth: number | null; lYear: number | null;
}
function parseVietDate(raw: string): ParsedDate {
  const out: ParsedDate = { solar: null, year: null, lDay: null, lMonth: null, lYear: null };
  if (!raw) return out;
  const fm = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{3,4})/);
  if (fm) out.solar = `${fm[3].padStart(4, "0")}-${fm[2].padStart(2, "0")}-${fm[1].padStart(2, "0")}`;
  const lm = raw.match(/(\d{1,2})\s*tháng\s*(\d{1,2})/i);
  if (lm) { out.lDay = Number(lm[1]); out.lMonth = Number(lm[2]); }
  else {
    const lw = raw.match(/(\d{1,2})\s*tháng\s*(giêng|chạp)/i);
    if (lw) { out.lDay = Number(lw[1]); out.lMonth = /chạp/i.test(lw[2]) ? 12 : 1; }
  }
  // "18-8 âm lịch" — ngày-tháng âm dạng số, không có chữ "tháng"
  if (out.lDay === null && out.solar === null && /âm/i.test(raw)) {
    const am = raw.match(/\b(\d{1,2})[-/](\d{1,2})\b/);
    if (am) { out.lDay = Number(am[1]); out.lMonth = Number(am[2]); }
  }
  const cc = raw.match(/năm\s+([A-Za-zÀ-ỹ]+)\s+([A-Za-zÀ-ỹ]+)/);
  if (cc) out.lYear = canChiToYearNear(cc[1], cc[2], out.solar ? Number(out.solar.slice(0, 4)) : 1920);
  if (!out.solar) {
    const ym = raw.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
    if (ym) out.year = Number(ym[1]);
  }
  return out;
}

function idsFromTree(html: string): number[] {
  const doc = parseDoc(html);
  const seen = new Set<number>();
  for (const a of doc.querySelectorAll("a[href]")) {
    const m = (a.getAttribute("href") ?? "").match(/XemChiTietTungNguoi\/\d+\/(\d+)\/giapha/);
    if (m) seen.add(Number(m[1]));
  }
  return [...seen].sort((a, b) => a - b);
}

function parseClan(html: string): { name: string; location: string | null } {
  const doc = parseDoc(html);
  const text = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  const name = (doc.querySelector("h1, h2, title")?.textContent ?? "")
    .split("|")[0].trim() || "Gia phả nhập từ vietnamgiapha";
  const locM = text.match(/(Thôn[^.]*?(?:Hưng Yên|tỉnh [A-ZÀ-Ỹ][^.]*))/);
  return { name, location: locM ? locM[1].trim() : null };
}

function idLinks(ul: El): number[] {
  const ids: number[] = [];
  for (const a of ul.querySelectorAll("a[href]")) {
    const m = (a.getAttribute("href") ?? "").match(/\/(\d+)\/giapha/);
    if (m) ids.push(Number(m[1]));
  }
  return ids;
}

function cleanName(raw: string): { fullName: string; gender: "M" | "F" | null } {
  const gm = raw.match(/\((Nam|Nữ)\)\s*$/);
  const gender = gm ? (gm[1] === "Nam" ? "M" : "F") : null;
  let name = (gm ? raw.slice(0, gm.index) : raw).trim();
  name = name.replace(/^\s*(cụ|bà|ông|cố)(\s[^:]*)?:\s*/i, "");
  name = name.replace(/^(hiệu|tự|huý|húy|tên thường)\s+/i, "");
  name = name.replace(/\s*\([^)]*(?:sinh|\d{4})[^)]*\)\s*$/i, "").trim();
  return { fullName: name, gender };
}

function parsePerson(oldId: number, html: string): PersonRec | null {
  if (!html.trim()) return null;
  const doc = parseDoc(html);
  const meta: Record<string, string> = {};
  for (const dl of doc.querySelectorAll("dl.person-meta")) {
    const kids = [...dl.children];
    for (let i = 0; i < kids.length; i++)
      if (kids[i].tagName === "DT" && kids[i + 1]?.tagName === "DD")
        meta[kids[i].textContent.trim()] = kids[i + 1].textContent.trim();
  }
  const { fullName, gender } = cleanName(meta["Tên"] ?? "");
  if (!fullName) return null; // empty/gap id
  const b = parseVietDate(meta["Ngày sinh"] ?? "");
  const d = parseVietDate((meta["Ngày mất"] ?? "").replace(/&#\d*;?/g, "").trim());

  let generation: number | null = null;
  for (const p of doc.querySelectorAll("p")) {
    const t = p.textContent ?? "";
    if (/Đời thứ/.test(t)) { const m = t.match(/Đời thứ:\s*(\d+)/); if (m) generation = Number(m[1]); }
  }
  const bioEl = doc.querySelector(".legacy-content");
  const bio = bioEl ? (bioEl.textContent ?? "").replace(/\s+/g, " ").trim() : null;

  let spouseIds: number[] = [], childIds: number[] = [];
  for (const ul of doc.querySelectorAll("ul.person-links")) {
    let prev = ul.previousElementSibling;
    while (prev && prev.tagName !== "H3") prev = prev.previousElementSibling;
    const head = (prev?.textContent ?? "").toLowerCase();
    const ids = idLinks(ul).filter((x) => x !== oldId);
    if (/chồng|vợ/.test(head)) spouseIds = ids;
    else if (/con/.test(head)) childIds = ids;
  }
  return {
    oldId, fullName, gender,
    nickname: meta["Tên thường"] || meta["Tên thường gọi"] || null,
    courtesyName: meta["Tên tự"] || null,
    generation,
    birthSolar: b.solar, birthYear: b.year,
    deathSolar: d.solar, deathYear: d.year,
    deathLunarDay: d.lDay, deathLunarMonth: d.lMonth, deathLunarYear: d.lYear,
    birthPlace: meta["Nơi sinh"] || null, burialPlace: meta["An táng"] || null,
    bio: bio || null,
    fatherId: null, motherId: null, motherAmbiguous: false,
    spouseIds, childIds,
  };
}

function buildRelationships(people: PersonRec[]): FamUnit[] {
  const byId = new Map(people.map((p) => [p.oldId, p]));
  const fathers = new Map<number, Set<number>>();
  const mothers = new Map<number, Set<number>>();
  const add = (m: Map<number, Set<number>>, c: number, p: number) => {
    if (!m.has(c)) m.set(c, new Set()); m.get(c)!.add(p);
  };
  for (const p of people) for (const c of p.childIds) {
    if (p.gender === "M") add(fathers, c, p.oldId);
    else if (p.gender === "F") add(mothers, c, p.oldId);
  }
  for (const p of people) {
    p.fatherId = [...(fathers.get(p.oldId) ?? [])][0] ?? null;
    const ms = [...(mothers.get(p.oldId) ?? [])];
    if (ms.length === 1) p.motherId = ms[0];
    else if (ms.length > 1) {
      const father = p.fatherId != null ? byId.get(p.fatherId) : null;
      const firstWife = father?.spouseIds.find((w) => byId.get(w)?.gender === "F");
      p.motherId = firstWife && ms.includes(firstWife) ? firstWife : ms[0];
      p.motherAmbiguous = true;
    }
  }
  const fams = new Map<string, FamUnit>();
  const key = (h: number | null, w: number | null) => `${h ?? "?"}|${w ?? "?"}`;
  const ensure = (h: number | null, w: number | null) => {
    const k = key(h, w);
    if (!fams.has(k)) fams.set(k, { husband: h, wife: w, children: [], spouseOrder: null });
    return fams.get(k)!;
  };
  for (const p of people) {
    if (p.gender !== "M") continue;
    p.spouseIds.filter((w) => byId.get(w)?.gender === "F").forEach((w, i) => (ensure(p.oldId, w).spouseOrder = i + 1));
  }
  for (const p of people) {
    if (p.fatherId == null && p.motherId == null) continue;
    ensure(p.fatherId, p.motherId).children.push(p.oldId);
  }
  return [...fams.values()];
}

// ─── import ──────────────────────────────────────────────────────────

const birthCols = (p: PersonRec) =>
  p.birthSolar ? { date: p.birthSolar, precision: "day" }
  : p.birthYear ? { date: `${p.birthYear}-01-01`, precision: "year" }
  : { date: null, precision: null };
const deathCols = (p: PersonRec) =>
  p.deathSolar ? { date: p.deathSolar, precision: "day" }
  : p.deathYear ? { date: `${p.deathYear}-01-01`, precision: "year" }
  : p.deathLunarYear ? { date: `${p.deathLunarYear}-01-01`, precision: "year" }
  : { date: null, precision: null };

/** Build the (persons, families) JSONB payloads for admin_import_giapha. */
function buildPayload(people: PersonRec[], fams: FamUnit[]) {
  const idMap = new Map<number, string>();
  for (const p of people) idMap.set(p.oldId, crypto.randomUUID());
  const fkey = (f: FamUnit) => `${f.husband}|${f.wife}`;
  const famId = new Map<string, string>();
  const childFamily = new Map<number, string>();
  for (const f of fams) {
    const id = crypto.randomUUID();
    famId.set(fkey(f), id);
    for (const c of f.children) childFamily.set(c, id);
  }
  const families = fams.map((f) => ({
    id: famId.get(fkey(f)),
    husband_id: f.husband != null ? idMap.get(f.husband) ?? null : null,
    wife_id: f.wife != null ? idMap.get(f.wife) ?? null : null,
    spouse_order: f.spouseOrder,
  }));
  const persons = people.map((p) => {
    const b = birthCols(p);
    const d = deathCols(p);
    const hasDeath = !!(p.deathSolar || p.deathYear || p.deathLunarDay || p.deathLunarMonth);
    return {
      id: idMap.get(p.oldId),
      full_name: p.fullName, gender: p.gender ?? "M",
      is_living: !hasDeath,
      is_root: p.fatherId == null && p.motherId == null && p.generation === 1 && p.gender === "M",
      birth_date: b.date, birth_date_precision: b.precision,
      death_date: d.date, death_date_precision: d.precision,
      death_lunar_year: p.deathLunarYear, death_lunar_month: p.deathLunarMonth,
      death_lunar_day: p.deathLunarDay, death_lunar_is_leap: false,
      death_anniv_lunar_month: p.deathLunarMonth, death_anniv_lunar_day: p.deathLunarDay,
      death_anniv_lunar_is_leap: false,
      birth_family_id: childFamily.get(p.oldId) ?? null,
      nickname: p.nickname, courtesy_name: p.courtesyName,
      birth_place: p.birthPlace, burial_place: p.burialPlace, bio: p.bio,
    };
  });
  return { persons, families };
}

// ─── handler: staged job (start → step×N → finalize) ────────────────

const BASE = "https://vietnamgiapha.com";
const BATCH = 60; // detail pages per step (keeps each call well under timeout)

// deno-lint-ignore no-explicit-any
async function requireAdmin(svc: any, req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: { user } } = await svc.auth.getUser(token);
  if (!user) return { user: null, error: err("unauthorized", 401) };
  const { data: prof } = await svc.from("profiles").select("is_platform_admin").eq("id", user.id).maybeSingle();
  if (!prof?.is_platform_admin) return { user: null, error: err("Chỉ admin hệ thống dùng được chức năng này.", 403) };
  return { user, error: null };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return err("method not allowed", 405);

  const svc = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const { user, error: authErr } = await requireAdmin(svc, req);
  if (authErr) return authErr;

  // deno-lint-ignore no-explicit-any
  let body: any;
  try { body = await req.json(); } catch { return err("invalid JSON", 400); }
  const action = body.action ?? "start";

  try {
    // ── start: tree → ids, create job + target clan ──
    if (action === "start") {
      const { sourceUrl, clanId, clanName, replace } = body;
      if (!sourceUrl) return err("Thiếu sourceUrl", 400);
      let srcId: string;
      try {
        const u = new URL(sourceUrl);
        if (!/(^|\.)vietnamgiapha\.com$/.test(u.hostname))
          return err("Chỉ hỗ trợ link từ vietnamgiapha.com", 400);
        const m = u.pathname.match(/\/(\d+)(\/|$)/);
        if (!m) return err("Không nhận ra mã gia phả trong link", 400);
        srcId = m[1];
      } catch { return err("Link không hợp lệ", 400); }

      const overviewHtml = await fetchText(`${BASE}/XemGiaPha/${srcId}/giapha.html`);
      const treeHtml = await fetchText(`${BASE}/XemPhaHe/${srcId}/pha_he.html`);
      const ids = idsFromTree(treeHtml);
      if (ids.length === 0) return err("Không tìm thấy người nào trong gia phả này", 422);
      const clanMeta = parseClan(overviewHtml);

      let targetClanId: string | null = clanId ?? null;
      if (targetClanId) {
        if (replace) {
          await svc.from("persons").delete().eq("clan_id", targetClanId);
          await svc.from("families").delete().eq("clan_id", targetClanId);
        }
      } else {
        const name = (clanName?.trim() || clanMeta.name).replace(/^Gia phả:\s*/i, "").trim();
        const desc = [
          clanMeta.location ? `Quê / nhà thờ tổ: ${clanMeta.location}` : null,
          `Nhập từ vietnamgiapha.com (gia phả #${srcId}).`,
        ].filter(Boolean).join("\n\n");
        const { data: clanRow, error } = await svc.from("clans").insert({
          name, description: desc, owner_id: user.id, visibility: "private",
          max_persons: Math.max(500, ids.length + 100), max_users: 10,
        }).select("id").single();
        if (error) throw new Error(`create clan: ${error.message}`);
        targetClanId = clanRow.id;
      }

      const { data: job, error: jErr } = await svc.from("giapha_import_jobs").insert({
        created_by: user.id, clan_id: targetClanId, source_id: srcId, source_url: sourceUrl,
        all_ids: ids, total: ids.length, scraped: 0, status: "scraping",
      }).select("id").single();
      if (jErr) throw new Error(`create job: ${jErr.message}`);

      return json({
        jobId: job.id, clanId: targetClanId, clanName: clanMeta.name,
        total: ids.length, scraped: 0, status: "scraping",
      });
    }

    // ── step: scrape+parse next batch, append a chunk ──
    if (action === "step") {
      const { jobId } = body;
      if (!jobId) return err("Thiếu jobId", 400);
      const { data: job } = await svc.from("giapha_import_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!job) return err("Job không tồn tại", 404);
      if (job.status !== "scraping")
        return json({ jobId, total: job.total, scraped: job.scraped, status: job.status });

      const allIds: number[] = job.all_ids;
      const slice = allIds.slice(job.scraped, job.scraped + BATCH);
      const details = await pool(slice, CONCURRENCY, (id) =>
        fetchText(`${BASE}/XemChiTietTungNguoi/${job.source_id}/${id}/giapha.html`).then((h) => ({ id, h })));
      const people: PersonRec[] = [];
      for (const { id, h } of details) { const r = parsePerson(id, h); if (r) people.push(r); }

      const seq = Math.floor(job.scraped / BATCH);
      await svc.from("giapha_import_chunks").upsert({ job_id: jobId, seq, people });
      const scraped = Math.min(job.scraped + BATCH, job.total);
      const status = scraped >= job.total ? "ready" : "scraping";
      await svc.from("giapha_import_jobs")
        .update({ scraped, status, updated_at: new Date().toISOString() }).eq("id", jobId);
      return json({ jobId, total: job.total, scraped, status });
    }

    // ── finalize: assemble chunks → import in one txn ──
    if (action === "finalize") {
      const { jobId } = body;
      if (!jobId) return err("Thiếu jobId", 400);
      const { data: job } = await svc.from("giapha_import_jobs").select("*").eq("id", jobId).maybeSingle();
      if (!job) return err("Job không tồn tại", 404);
      if (job.status === "done") return json(job.result);
      if (job.status !== "ready" && job.status !== "importing")
        return err(`Job chưa tải xong (status=${job.status})`, 409);

      await svc.from("giapha_import_jobs").update({ status: "importing" }).eq("id", jobId);
      const { data: chunks } = await svc.from("giapha_import_chunks")
        .select("seq, people").eq("job_id", jobId).order("seq");
      const people: PersonRec[] = [];
      for (const c of chunks ?? []) for (const p of c.people as PersonRec[]) people.push(p);
      const fams = buildRelationships(people);
      const { persons, families } = buildPayload(people, fams);

      const { error: impErr } = await svc.rpc("admin_import_giapha", {
        p_clan_id: job.clan_id, p_persons: persons, p_families: families,
      });
      if (impErr) {
        await svc.from("giapha_import_jobs").update({ status: "error", error: impErr.message }).eq("id", jobId);
        throw new Error(impErr.message);
      }
      const result = {
        ok: true, clanId: job.clan_id,
        counts: { persons: people.length, families: fams.length },
        warnings: {
          ambiguousMothers: people.filter((p) => p.motherAmbiguous).length,
          missingGender: people.filter((p) => !p.gender).length,
          note: "Người không có ngày mất được mặc định 'còn sống' — nên rà lại.",
        },
      };
      await svc.from("giapha_import_jobs").update({ status: "done", result }).eq("id", jobId);
      await svc.from("giapha_import_chunks").delete().eq("job_id", jobId);
      return json(result);
    }

    return err("action không hợp lệ", 400);
  } catch (e) {
    return err(`Import lỗi: ${(e as Error).message}`, 500);
  }
});
