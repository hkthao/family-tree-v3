/**
 * Migrate the "Chi họ Cao Minh Triết" gia phả (#1691) from
 * vietnamgiapha.com into this app.
 *
 * ⚠️  PLATFORM-ADMIN TOOL. The `import` step writes with the Supabase
 *     service-role key (from .env.deploy) and bypasses RLS — only the
 *     system admin runs this. Scrape/parse are read-only (no DB).
 *
 * Pipeline (run in order):
 *   npx tsx scripts/migrate-cao-minh-triet.ts scrape   # → /tmp/vgp-1691/html/*.html
 *   npx tsx scripts/migrate-cao-minh-triet.ts parse    # → people.json + review.md + .csv + .ged
 *   npx tsx scripts/migrate-cao-minh-triet.ts import   # (later) → Supabase
 *
 * Source pages:
 *   - XemGiaPha/1691            → clan overview (name, location, intro)
 *   - XemPhaHe/1691/pha_he.html → list of every person id + đời label
 *   - XemChiTietTungNguoi/1691/{id}/giapha.html → per-person detail
 *
 * Data-model notes learned from the source:
 *   - "Là con của" on a person page is UNRELIABLE (a married-in wife's
 *     page points at the husband's father). Parentage is derived from
 *     the authoritative "Con cái" lists instead.
 *   - The "Liên quan (chồng, vợ)" section on a WOMAN's page also lists
 *     co-wives, so only a MAN's spouse list is used to build marriages
 *     (and it carries wife order → spouse_order vợ cả/hai).
 *   - When a man has 2 wives, both wives' "Con cái" lists often repeat
 *     ALL his children — the source can't say which wife is the mother.
 *     Such children default to the first wife (vợ cả) and are flagged
 *     in review.md for manual fixing.
 *
 * Env: GIAPHA_ID (1691) · OUT_DIR (/tmp/vgp-1691) · SCRAPE_LIMIT · SCRAPE_DELAY (1000)
 */
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import { randomUUID } from "node:crypto";
import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { join } from "node:path";

loadEnv({ path: ".env.deploy" });

const GIAPHA_ID = process.env.GIAPHA_ID ?? "1691";
const OUT_DIR = process.env.OUT_DIR ?? "/tmp/vgp-1691";
const HTML_DIR = join(OUT_DIR, "html");
const DELAY = Number(process.env.SCRAPE_DELAY ?? "1000");
const LIMIT = process.env.SCRAPE_LIMIT ? Number(process.env.SCRAPE_LIMIT) : null;
const BASE = "https://vietnamgiapha.com";
const UA = "Mozilla/5.0 (gia-pha migration tooling for own family records)";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Normalized model ────────────────────────────────────────────────

interface PersonRec {
  oldId: number;
  fullName: string;
  gender: "M" | "F" | null;
  nickname: string | null;
  generation: number | null;
  // dates — both calendars, partial-aware
  birthSolar: string | null; // full ISO date
  birthYear: number | null; // year-only fallback
  birthRaw: string | null;
  deathSolar: string | null;
  deathYear: number | null;
  deathLunarDay: number | null;
  deathLunarMonth: number | null;
  deathLunarYear: number | null;
  deathRaw: string | null;
  birthPlace: string | null;
  burialPlace: string | null;
  bio: string | null;
  declaredFatherId: number | null; // from "Là con của" — cross-check only
  fatherId: number | null; // derived from Con-cái lists
  motherId: number | null; // derived; defaulted when ambiguous
  motherAmbiguous: boolean;
  spouseIds: number[]; // raw section ids (polluted for women)
  childIds: number[];
  siblingIds: number[];
  extra: Record<string, string>;
}

interface ClanInfo {
  name: string;
  location: string | null;
  intro: string | null;
}

// ─── HTTP ────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        if (res.status === 404) return "";
        throw new Error(`HTTP ${res.status}`);
      }
      return await res.text();
    } catch (e) {
      if (attempt === 3) throw e;
      await sleep(1500 * attempt);
    }
  }
  return "";
}

// ─── SCRAPE ──────────────────────────────────────────────────────────

const treeUrl = () => `${BASE}/XemPhaHe/${GIAPHA_ID}/pha_he.html`;
const overviewUrl = () => `${BASE}/XemGiaPha/${GIAPHA_ID}/giapha.html`;
const detailUrl = (id: number) =>
  `${BASE}/XemChiTietTungNguoi/${GIAPHA_ID}/${id}/giapha.html`;

function idsFromTree(html: string): { id: number; gen: number | null }[] {
  const doc = new JSDOM(html).window.document;
  const seen = new Map<number, number | null>();
  for (const a of doc.querySelectorAll("a[href]")) {
    const m = a
      .getAttribute("href")!
      .match(/XemChiTietTungNguoi\/\d+\/(\d+)\/giapha/);
    if (!m) continue;
    const id = Number(m[1]);
    const around = (a.closest("li") ?? a.parentElement)?.textContent ?? "";
    const gm = around.match(/(\d+)\.\d+/);
    if (!seen.has(id)) seen.set(id, gm ? Number(gm[1]) : null);
  }
  return [...seen.entries()]
    .map(([id, gen]) => ({ id, gen }))
    .sort((a, b) => a.id - b.id);
}

async function scrape(): Promise<void> {
  mkdirSync(HTML_DIR, { recursive: true });

  console.log("· overview …");
  writeFileSync(join(OUT_DIR, "overview.html"), await fetchText(overviewUrl()));
  await sleep(DELAY);

  console.log("· tree …");
  const treeHtml = await fetchText(treeUrl());
  writeFileSync(join(OUT_DIR, "tree.html"), treeHtml);
  let ids = idsFromTree(treeHtml);
  writeFileSync(join(OUT_DIR, "ids.json"), JSON.stringify(ids, null, 2));
  console.log(`  found ${ids.length} person ids`);

  if (LIMIT) ids = ids.slice(0, LIMIT);

  let done = 0;
  for (const { id } of ids) {
    const file = join(HTML_DIR, `${id}.html`);
    if (existsSync(file)) {
      done++;
      continue;
    }
    writeFileSync(file, await fetchText(detailUrl(id)));
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${ids.length} …`);
    await sleep(DELAY);
  }
  console.log(`✓ scraped ${done} detail pages into ${HTML_DIR}`);
}

// ─── Vietnamese date parsing ─────────────────────────────────────────

const CAN = ["Giáp","Ất","Bính","Đinh","Mậu","Kỷ","Canh","Tân","Nhâm","Quý"];
const CHI = ["Tý","Sửu","Dần","Mão","Thìn","Tỵ","Ngọ","Mùi","Thân","Dậu","Tuất","Hợi"];

function canChiToYearNear(can: string, chi: string, ref: number): number | null {
  const ci = CAN.indexOf(can);
  const zi = CHI.findIndex((c) => c === chi || (c === "Mão" && chi === "Mẹo"));
  if (ci < 0 || zi < 0) return null;
  // pick the matching year NEAREST to ref (can-chi repeats every 60y)
  let best: number | null = null;
  for (let y = ref - 90; y <= ref + 90; y++) {
    if ((((y - 1984) % 10) + 10) % 10 === ci && (((y - 1984) % 12) + 12) % 12 === zi) {
      if (best === null || Math.abs(y - ref) < Math.abs(best - ref)) best = y;
    }
  }
  return best;
}

interface ParsedDate {
  solar: string | null; // full ISO
  year: number | null; // year-only (when no full date)
  lDay: number | null;
  lMonth: number | null;
  lYear: number | null;
}

function parseVietDate(raw: string): ParsedDate {
  const out: ParsedDate = { solar: null, year: null, lDay: null, lMonth: null, lYear: null };
  if (!raw) return out;
  // full solar date: d/m/yyyy or d-m-yyyy, optionally in parens
  const fm = raw.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{3,4})/);
  if (fm) {
    const [, d, mo, y] = fm;
    out.solar = `${y.padStart(4, "0")}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // lunar "ngày X tháng Y" / "X tháng Y" (Y numeric, or giêng=1/chạp=12)
  const lm = raw.match(/(\d{1,2})\s*tháng\s*(\d{1,2})/i);
  if (lm) {
    out.lDay = Number(lm[1]);
    out.lMonth = Number(lm[2]);
  } else {
    const lw = raw.match(/(\d{1,2})\s*tháng\s*(giêng|chạp)/i);
    if (lw) {
      out.lDay = Number(lw[1]);
      out.lMonth = /chạp/i.test(lw[2]) ? 12 : 1;
    }
  }
  // can-chi year
  const cc = raw.match(/năm\s+([A-Za-zÀ-ỹ]+)\s+([A-Za-zÀ-ỹ]+)/);
  if (cc) {
    const ref = out.solar ? Number(out.solar.slice(0, 4)) : 1920;
    out.lYear = canChiToYearNear(cc[1], cc[2], ref);
  }
  // bare 4-digit year (only meaningful when no full solar date)
  if (!out.solar) {
    const ym = raw.match(/\b(1[5-9]\d{2}|20\d{2})\b/);
    if (ym) out.year = Number(ym[1]);
  }
  return out;
}

// ─── PARSE one person ────────────────────────────────────────────────

function idLinks(ul: Element): number[] {
  const ids: number[] = [];
  for (const a of ul.querySelectorAll("a[href]")) {
    const m = a.getAttribute("href")!.match(/\/(\d+)\/giapha/);
    if (m) ids.push(Number(m[1]));
  }
  return ids;
}

function parsePerson(oldId: number, html: string): PersonRec | null {
  if (!html.trim()) return null;
  const doc = new JSDOM(html).window.document;

  const meta: Record<string, string> = {};
  for (const dl of doc.querySelectorAll("dl.person-meta")) {
    const kids = [...dl.children];
    for (let i = 0; i < kids.length; i++) {
      if (kids[i].tagName === "DT" && kids[i + 1]?.tagName === "DD")
        meta[kids[i].textContent!.trim()] = kids[i + 1].textContent!.trim();
    }
  }

  const nameRaw = meta["Tên"] ?? "";
  const gm = nameRaw.match(/^(.*?)\s*\((Nam|Nữ)\)\s*$/);
  const fullName = (gm ? gm[1] : nameRaw).trim();
  const gender = gm ? (gm[2] === "Nam" ? "M" : "F") : null;

  const b = parseVietDate(meta["Ngày sinh"] ?? "");
  const d = parseVietDate((meta["Ngày mất"] ?? "").replace(/&#\d*;?/g, "").trim());

  let declaredFatherId: number | null = null;
  let generation: number | null = null;
  for (const p of doc.querySelectorAll("p")) {
    const t = p.textContent ?? "";
    if (/Là con của/.test(t)) {
      const m = p.querySelector("a[href]")?.getAttribute("href")?.match(/\/(\d+)\/giapha/);
      if (m) declaredFatherId = Number(m[1]);
    }
    if (/Đời thứ/.test(t)) {
      const m = t.match(/Đời thứ:\s*(\d+)/);
      if (m) generation = Number(m[1]);
    }
  }

  const bioEl = doc.querySelector(".legacy-content");
  const bio = bioEl ? (bioEl.textContent ?? "").replace(/\s+/g, " ").trim() : null;

  let spouseIds: number[] = [];
  let childIds: number[] = [];
  let siblingIds: number[] = [];
  for (const ul of doc.querySelectorAll("ul.person-links")) {
    let prev = ul.previousElementSibling;
    while (prev && prev.tagName !== "H3") prev = prev.previousElementSibling;
    const head = (prev?.textContent ?? "").toLowerCase();
    const ids = idLinks(ul).filter((x) => x !== oldId);
    if (/chồng|vợ/.test(head)) spouseIds = ids;
    else if (/con/.test(head)) childIds = ids;
    else if (/anh|em|dâu|rể/.test(head)) siblingIds = ids;
  }

  const known = new Set(["Tên", "Tên thường", "Ngày sinh", "Ngày mất", "An táng"]);
  const extra: Record<string, string> = {};
  for (const [k, v] of Object.entries(meta)) if (!known.has(k)) extra[k] = v;

  return {
    oldId, fullName, gender,
    nickname: meta["Tên thường"] || meta["Tên thường gọi"] || null,
    generation,
    birthSolar: b.solar, birthYear: b.year, birthRaw: meta["Ngày sinh"] || null,
    deathSolar: d.solar, deathYear: d.year,
    deathLunarDay: d.lDay, deathLunarMonth: d.lMonth, deathLunarYear: d.lYear,
    deathRaw: meta["Ngày mất"] || null,
    birthPlace: meta["Nơi sinh"] || null,
    burialPlace: meta["An táng"] || null,
    bio: bio || null,
    declaredFatherId, fatherId: null, motherId: null, motherAmbiguous: false,
    spouseIds, childIds, siblingIds, extra,
  };
}

function parseClan(html: string): ClanInfo {
  const doc = new JSDOM(html).window.document;
  const text = (doc.body?.textContent ?? "").replace(/\s+/g, " ").trim();
  const name =
    (doc.querySelector("h1, h2, title")?.textContent ?? "Chi họ Cao Minh Triết")
      .split("|")[0].trim() || "Chi họ Cao Minh Triết";
  const locM = text.match(/(Thôn[^.]*?Hưng Yên)/);
  return { name, location: locM ? locM[1].trim() : null, intro: text.slice(0, 4000) };
}

// ─── Build relationships ─────────────────────────────────────────────

interface FamUnit {
  husband: number | null;
  wife: number | null;
  children: number[];
  spouseOrder: number | null;
}

/**
 * Derive father/mother for every person from the authoritative "Con cái"
 * lists, and reconstruct marriage units (with wife order) from each
 * man's spouse list.
 */
function buildRelationships(people: PersonRec[]): FamUnit[] {
  const byId = new Map(people.map((p) => [p.oldId, p]));

  // parentage from children lists
  const fathers = new Map<number, Set<number>>();
  const mothers = new Map<number, Set<number>>();
  const add = (m: Map<number, Set<number>>, child: number, parent: number) => {
    if (!m.has(child)) m.set(child, new Set());
    m.get(child)!.add(parent);
  };
  for (const p of people)
    for (const c of p.childIds) {
      if (p.gender === "M") add(fathers, c, p.oldId);
      else if (p.gender === "F") add(mothers, c, p.oldId);
    }

  for (const p of people) {
    const fs = [...(fathers.get(p.oldId) ?? [])];
    const ms = [...(mothers.get(p.oldId) ?? [])];
    p.fatherId = fs[0] ?? null;
    if (ms.length === 1) p.motherId = ms[0];
    else if (ms.length > 1) {
      // ambiguous → default to the father's first wife (vợ cả)
      const father = p.fatherId != null ? byId.get(p.fatherId) : null;
      const firstWife = father?.spouseIds.find((w) => byId.get(w)?.gender === "F");
      p.motherId = firstWife && ms.includes(firstWife) ? firstWife : ms[0];
      p.motherAmbiguous = true;
    }
  }

  // marriages: man → ordered wives
  const fams = new Map<string, FamUnit>();
  const key = (h: number | null, w: number | null) => `${h ?? "?"}|${w ?? "?"}`;
  const ensure = (h: number | null, w: number | null) => {
    const k = key(h, w);
    if (!fams.has(k)) fams.set(k, { husband: h, wife: w, children: [], spouseOrder: null });
    return fams.get(k)!;
  };
  for (const p of people) {
    if (p.gender !== "M") continue;
    const wives = p.spouseIds.filter((w) => byId.get(w)?.gender === "F");
    wives.forEach((w, i) => (ensure(p.oldId, w).spouseOrder = i + 1));
  }
  // assign children to their (father, mother) family
  for (const p of people) {
    if (p.fatherId == null && p.motherId == null) continue;
    ensure(p.fatherId, p.motherId).children.push(p.oldId);
  }
  return [...fams.values()];
}

// ─── EXPORT: CSV + GEDCOM ────────────────────────────────────────────

const csvCell = (v: unknown) => {
  const s = v == null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

function writeCsv(people: PersonRec[], path: string): void {
  const cols = [
    "old_id","full_name","gender","generation","nickname",
    "birth_solar","birth_year","death_solar","death_year",
    "death_lunar_day","death_lunar_month","death_lunar_year","death_raw",
    "birth_place","burial_place","father_id","mother_id","mother_ambiguous",
    "spouse_ids","child_ids","bio",
  ];
  const rows = people.map((p) =>
    [
      p.oldId, p.fullName, p.gender ?? "", p.generation ?? "", p.nickname ?? "",
      p.birthSolar ?? "", p.birthYear ?? "", p.deathSolar ?? "", p.deathYear ?? "",
      p.deathLunarDay ?? "", p.deathLunarMonth ?? "", p.deathLunarYear ?? "", p.deathRaw ?? "",
      p.birthPlace ?? "", p.burialPlace ?? "", p.fatherId ?? "", p.motherId ?? "",
      p.motherAmbiguous ? "1" : "", p.spouseIds.join(";"), p.childIds.join(";"), p.bio ?? "",
    ].map(csvCell).join(","),
  );
  writeFileSync(path, "﻿" + [cols.join(","), ...rows].join("\n"));
}

const GED_MONTHS = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
function gedDate(p: PersonRec, which: "birth" | "death"): string | null {
  if (which === "birth") {
    if (p.birthSolar) { const [y,m,d]=p.birthSolar.split("-").map(Number); return `${d} ${GED_MONTHS[m-1]} ${y}`; }
    return p.birthYear ? String(p.birthYear) : null;
  }
  if (p.deathSolar) { const [y,m,d]=p.deathSolar.split("-").map(Number); return `${d} ${GED_MONTHS[m-1]} ${y}`; }
  if (p.deathYear) return String(p.deathYear);
  if (p.deathLunarYear) return String(p.deathLunarYear);
  return null;
}

function writeGedcom(people: PersonRec[], fams: FamUnit[], path: string): void {
  const L: string[] = [
    "0 HEAD","1 SOUR family-tree-v3","1 GEDC","2 VERS 5.5.1",
    "2 FORM LINEAGE-LINKED","1 CHAR UTF-8",
  ];
  const famsOf = (pid: number) =>
    fams.map((f, i) => ({ f, i })).filter(({ f }) => f.husband === pid || f.wife === pid).map(({ i }) => i + 1);
  const famcOf = (pid: number) => fams.findIndex((f) => f.children.includes(pid));

  for (const p of people) {
    L.push(`0 @I${p.oldId}@ INDI`);
    const parts = p.fullName.trim().split(/\s+/);
    const surn = parts[0] ?? "";
    const givn = parts.slice(1).join(" ");
    L.push(`1 NAME ${givn} /${surn}/`);
    if (surn) L.push(`2 SURN ${surn}`);
    if (givn) L.push(`2 GIVN ${givn}`);
    if (p.gender) L.push(`1 SEX ${p.gender}`);
    const bd = gedDate(p, "birth");
    if (bd) { L.push("1 BIRT"); L.push(`2 DATE ${bd}`); if (p.birthPlace) L.push(`2 PLAC ${p.birthPlace}`); }
    const dd = gedDate(p, "death");
    if (dd || p.deathRaw) {
      L.push("1 DEAT");
      if (dd) L.push(`2 DATE ${dd}`);
      if (p.burialPlace) L.push(`2 PLAC ${p.burialPlace}`);
      if (p.deathRaw) L.push(`2 NOTE Âm lịch: ${p.deathRaw.replace(/&#\d*;?/g, "").trim()}`);
    }
    if (p.nickname) L.push(`1 NICK ${p.nickname}`);
    if (p.bio) L.push(`1 NOTE ${p.bio.replace(/\n/g, " ")}`);
    for (const fi of famsOf(p.oldId)) L.push(`1 FAMS @F${fi}@`);
    const fc = famcOf(p.oldId);
    if (fc >= 0) L.push(`1 FAMC @F${fc + 1}@`);
  }
  fams.forEach((f, i) => {
    L.push(`0 @F${i + 1}@ FAM`);
    if (f.husband != null) L.push(`1 HUSB @I${f.husband}@`);
    if (f.wife != null) L.push(`1 WIFE @I${f.wife}@`);
    for (const c of f.children) L.push(`1 CHIL @I${c}@`);
  });
  L.push("0 TRLR");
  writeFileSync(path, L.join("\n"));
}

// ─── PARSE driver ────────────────────────────────────────────────────

function parse(): void {
  const ids: { id: number; gen: number | null }[] = JSON.parse(
    readFileSync(join(OUT_DIR, "ids.json"), "utf8"),
  );
  const clan = parseClan(readFileSync(join(OUT_DIR, "overview.html"), "utf8"));

  const people: PersonRec[] = [];
  const missing: number[] = [];
  for (const { id } of ids) {
    const file = join(HTML_DIR, `${id}.html`);
    if (!existsSync(file)) { missing.push(id); continue; }
    const rec = parsePerson(id, readFileSync(file, "utf8"));
    if (rec) people.push(rec); else missing.push(id);
  }

  const fams = buildRelationships(people);

  writeFileSync(join(OUT_DIR, "clan.json"), JSON.stringify(clan, null, 2));
  writeFileSync(join(OUT_DIR, "people.json"), JSON.stringify(people, null, 2));
  writeFileSync(join(OUT_DIR, "families.json"), JSON.stringify(fams, null, 2));
  writeCsv(people, join(OUT_DIR, "cao-minh-triet.csv"));
  writeGedcom(people, fams, join(OUT_DIR, "cao-minh-triet.ged"));

  // review
  const byId = new Map(people.map((p) => [p.oldId, p]));
  const noGender = people.filter((p) => !p.gender);
  const noFather = people.filter((p) => p.fatherId == null && p.generation !== 1);
  const multiWife = people.filter((p) => p.gender === "M" && p.spouseIds.filter((w) => byId.get(w)?.gender === "F").length > 1);
  const ambMother = people.filter((p) => p.motherAmbiguous);
  const declaredMismatch = people.filter((p) => p.declaredFatherId != null && p.fatherId != null && p.declaredFatherId !== p.fatherId);
  const deathUnparsed = people.filter((p) => p.deathRaw && !p.deathSolar && !p.deathYear && !p.deathLunarDay);
  const genCount = new Map<number | null, number>();
  for (const p of people) genCount.set(p.generation, (genCount.get(p.generation) ?? 0) + 1);

  const list = (t: string, arr: PersonRec[], extra?: (p: PersonRec) => string) =>
    arr.length
      ? `\n## ${t} (${arr.length})\n` + arr.map((p) => `- [${p.oldId}] ${p.fullName}${extra ? " — " + extra(p) : ""}`).join("\n")
      : `\n## ${t} (0) ✓`;

  const r: string[] = [];
  r.push(`# Review — ${clan.name}\n`);
  r.push(`- Quê/nhà thờ tổ: ${clan.location ?? "(?)"}`);
  r.push(`- Người parse được: **${people.length}** / ${ids.length} id`);
  if (missing.length) r.push(`- Thiếu trang (404/rỗng): ${missing.length} id`);
  r.push(`- Số gia đình dựng được: **${fams.length}**`);
  r.push(`- Phân bố đời: ` + [...genCount.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99)).map(([g, n]) => `đời ${g ?? "?"}=${n}`).join(", "));
  r.push(list("Thiếu giới tính", noGender));
  r.push(list("Thiếu cha (không phải đời 1)", noFather));
  r.push(list("Đa thê — kiểm tra thứ tự vợ", multiWife, (p) => "vợ: " + p.spouseIds.filter((w) => byId.get(w)?.gender === "F").map((w) => byId.get(w)?.fullName).join(", ")));
  r.push(list("Con mẹ mơ hồ (mặc định vợ cả — cần xác nhận)", ambMother, (p) => `mẹ=${byId.get(p.motherId!)?.fullName ?? "?"}`));
  r.push(list('"Là con của" ≠ cha suy ra (đã dùng cha suy ra)', declaredMismatch, (p) => `khai=${p.declaredFatherId}, suy=${p.fatherId}`));
  r.push(list("Ngày mất chưa parse được", deathUnparsed, (p) => p.deathRaw ?? ""));
  writeFileSync(join(OUT_DIR, "review.md"), r.join("\n") + "\n");

  console.log(`✓ parsed ${people.length} people, ${fams.length} families`);
  console.log(`  outputs in ${OUT_DIR}: people.json · families.json · clan.json`);
  console.log(`  · cao-minh-triet.csv (Excel) · cao-minh-triet.ged (GEDCOM 5.5.1) · review.md`);
}

// ─── IMPORT (platform-admin only) ────────────────────────────────────

function getClient() {
  // SB_URL/SB_SERVICE_KEY (local) take precedence over .env.deploy (prod).
  const url = process.env.SB_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SB_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key)
    throw new Error("Thiếu SB_URL/SB_SERVICE_KEY (local) hoặc VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (.env.deploy)");
  return { sb: createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }), url };
}

function birthCols(p: PersonRec) {
  if (p.birthSolar) return { date: p.birthSolar, precision: "day" as const };
  if (p.birthYear) return { date: `${p.birthYear}-01-01`, precision: "year" as const };
  return { date: null, precision: null };
}
function deathCols(p: PersonRec) {
  if (p.deathSolar) return { date: p.deathSolar, precision: "day" as const };
  if (p.deathYear) return { date: `${p.deathYear}-01-01`, precision: "year" as const };
  if (p.deathLunarYear) return { date: `${p.deathLunarYear}-01-01`, precision: "year" as const };
  return { date: null, precision: null };
}

async function importAll(): Promise<void> {
  const { sb, url } = getClient();
  console.log(`→ target: ${url}`);

  const clan: ClanInfo = JSON.parse(readFileSync(join(OUT_DIR, "clan.json"), "utf8"));
  const people: PersonRec[] = JSON.parse(readFileSync(join(OUT_DIR, "people.json"), "utf8"));
  const fams: FamUnit[] = JSON.parse(readFileSync(join(OUT_DIR, "families.json"), "utf8"));

  // owner: explicit env, else first platform admin
  let ownerId = process.env.IMPORT_OWNER_ID ?? null;
  if (!ownerId) {
    const { data } = await sb.from("profiles").select("id").eq("is_platform_admin", true).limit(1).maybeSingle();
    ownerId = data?.id ?? null;
  }
  if (!ownerId) throw new Error("Không tìm thấy owner (đặt IMPORT_OWNER_ID).");
  console.log(`  owner: ${ownerId}`);

  const clanName = (clan.name.replace(/^Gia phả:\s*/i, "").trim()) || "Chi họ Cao Minh Triết";

  // existence / replace
  const ex = await sb.from("clans").select("id").eq("owner_id", ownerId).eq("name", clanName).maybeSingle();
  if (ex.data) {
    if (process.env.IMPORT_REPLACE === "1") {
      console.log(`  clan tồn tại (${ex.data.id}) → xoá (cascade) vì IMPORT_REPLACE=1`);
      const del = await sb.from("clans").delete().eq("id", ex.data.id);
      if (del.error) throw new Error(`delete clan: ${del.error.message}`);
    } else {
      console.log(`  SKIP — clan "${clanName}" đã tồn tại. Đặt IMPORT_REPLACE=1 để import lại.`);
      return;
    }
  }

  const desc = [
    clan.location ? `Quê / nhà thờ tổ: ${clan.location}` : null,
    "Nhập từ vietnamgiapha.com (gia phả #1691) — Chi họ Cao Minh Triết.",
  ].filter(Boolean).join("\n\n");

  const clanRes = await sb.from("clans").insert({
    name: clanName, description: desc, owner_id: ownerId, visibility: "private",
    max_persons: Math.max(500, people.length + 100), max_users: 10,
  }).select("id").single();
  if (clanRes.error) throw new Error(`create clan: ${clanRes.error.message}`);
  const clanId = clanRes.data.id;
  console.log(`  clan created: ${clanId}`);

  // id maps
  const idMap = new Map<number, string>();
  for (const p of people) idMap.set(p.oldId, randomUUID());
  const famKey = (f: FamUnit) => `${f.husband}|${f.wife}`;
  const famId = new Map<string, string>();
  const childFamily = new Map<number, string>();
  for (const f of fams) {
    const id = randomUUID();
    famId.set(famKey(f), id);
    for (const c of f.children) childFamily.set(c, id);
  }

  // 1) families with null spouses (persons reference birth_family_id)
  const famRows = fams.map((f) => ({
    id: famId.get(famKey(f))!, clan_id: clanId,
    husband_id: null, wife_id: null, union_type: "marriage",
    spouse_order: f.spouseOrder,
  }));
  for (let i = 0; i < famRows.length; i += 100) {
    const res = await sb.from("families").insert(famRows.slice(i, i + 100));
    if (res.error) throw new Error(`families insert: ${res.error.message}`);
  }
  console.log(`  inserted ${famRows.length} families`);

  // 2) persons
  const personRows = people.map((p) => {
    const b = birthCols(p);
    const d = deathCols(p);
    const hasDeath = !!(p.deathSolar || p.deathYear || p.deathLunarDay || p.deathLunarMonth);
    return {
      id: idMap.get(p.oldId)!, clan_id: clanId,
      full_name: p.fullName, gender: p.gender ?? "M",
      is_living: !hasDeath,
      is_root: p.fatherId == null && p.motherId == null && p.generation === 1 && p.gender === "M",
      birth_date: b.date, birth_date_precision: b.precision,
      death_date: d.date, death_date_precision: d.precision,
      death_lunar_year: p.deathLunarYear,
      death_lunar_month: p.deathLunarMonth,
      death_lunar_day: p.deathLunarDay,
      death_lunar_is_leap: false,
      death_anniv_lunar_month: p.deathLunarMonth,
      death_anniv_lunar_day: p.deathLunarDay,
      death_anniv_lunar_is_leap: false,
      birth_family_id: childFamily.get(p.oldId) ?? null,
      nickname: p.nickname,
      birth_place: p.birthPlace,
      burial_place: p.burialPlace,
      bio: p.bio,
    };
  });
  for (let i = 0; i < personRows.length; i += 50) {
    const res = await sb.from("persons").insert(personRows.slice(i, i + 50));
    if (res.error) throw new Error(`persons insert @${i}: ${res.error.message}`);
  }
  console.log(`  inserted ${personRows.length} persons`);

  // 3) wire family spouses (now persons exist) → also triggers đời compute
  for (const f of fams) {
    const res = await sb.from("families").update({
      husband_id: f.husband != null ? idMap.get(f.husband) ?? null : null,
      wife_id: f.wife != null ? idMap.get(f.wife) ?? null : null,
    }).eq("id", famId.get(famKey(f))!);
    if (res.error) console.warn(`    family ${famKey(f)}: ${res.error.message}`);
  }
  console.log(`  wired spouse links`);

  // verify
  const pc = await sb.from("persons").select("id", { count: "exact", head: true }).eq("clan_id", clanId).is("deleted_at", null);
  const fc = await sb.from("families").select("id", { count: "exact", head: true }).eq("clan_id", clanId).is("deleted_at", null);
  const gens = await sb.from("persons").select("generation").eq("clan_id", clanId).is("deleted_at", null);
  const dist = new Map<number | null, number>();
  for (const row of gens.data ?? []) dist.set(row.generation, (dist.get(row.generation) ?? 0) + 1);
  console.log(`\n✓ DONE — clan ${clanId}`);
  console.log(`  persons: ${pc.count} · families: ${fc.count}`);
  console.log(`  đời (do trigger tính): ` + [...dist.entries()].sort((a, b) => (a[0] ?? 99) - (b[0] ?? 99)).map(([g, n]) => `${g ?? "?"}=${n}`).join(", "));
  console.log(`  Mở: /clans/${clanId}`);
}

// ─── main ────────────────────────────────────────────────────────────

const cmd = process.argv[2];
(async () => {
  if (cmd === "scrape") await scrape();
  else if (cmd === "parse") parse();
  else if (cmd === "import") await importAll();
  else if (cmd === "list") console.log(readdirSync(HTML_DIR).length, "html files in", HTML_DIR);
  else { console.error("Usage: migrate-cao-minh-triet.ts <scrape|parse|import>"); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });
