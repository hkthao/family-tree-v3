#!/usr/bin/env node
/**
 * Chuyển bản nháp JSON của skill so-tay-viet-bai (khuôn custom_entries cũ) thành content/so-tay/<slug>.md.
 *   node scripts/draft-to-md.mjs <draft.json> [...]      (một object hoặc một mảng bài)
 * Luôn đặt status: needs_review; bài chỉ lên web/app khi đổi thành published.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const out = join(dirname(fileURLToPath(import.meta.url)), "../content/so-tay");
mkdirSync(out, { recursive: true });
const slugify = (s) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const toMd = (t) => esc(t ?? "").replace(/\n(?!\n)/g, "  \n");
const CATS = ["tho_cung", "vong_doi", "le_tet", "le_hoi", "sinh_hoat", "van_khan"];

for (const f of process.argv.slice(2)) {
  const j = JSON.parse(readFileSync(f, "utf8"));
  for (const e of Array.isArray(j) ? j : [j]) {
    if (!e.title || !CATS.includes(e.category)) throw new Error(`${f}: thiếu title hoặc category sai (${e.category})`);
    const slug = slugify(e.title.replace(/\(.*?\)/g, "")) || slugify(e.title);
    const body = (e.sections ?? [])
      .map((s) => `## ${s.heading}\n\n${s.image_url ? `<figure><img src="${s.image_url}" alt="${esc(s.image_caption ?? s.heading)}" loading="lazy" />${s.image_caption ? `<figcaption>${esc(s.image_caption)}</figcaption>` : ""}</figure>\n\n` : ""}${toMd(s.body)}\n`)
      .join("\n");
    const fm = {
      status: "needs_review",
      title: e.title,
      description: e.short_description || e.title,
      updated: new Date().toISOString().slice(0, 10),
      category: e.category,
      tags: e.regions ?? [],
      aliases: e.aliases ?? [],
      regions: e.regions ?? [],
      lunar_month: e.lunar_month ?? null,
      timing: e.timing || undefined,
      scope: e.scope ?? null,
      mandatory_level: e.mandatory_level ?? null,
      origins: e.origins ?? [],
      reliability: e.reliability ?? null,
      applicable_to: e.applicable_to || undefined,
      cover_image_url: e.cover_image_url || undefined,
      faq: e.faq ?? [],
      related: (e.related_titles ?? []).map((t) => slugify(t.replace(/\(.*?\)/g, ""))),
      sources: e.sources ? [{ name: e.sources }] : [],
    };
    writeFileSync(join(out, `${slug}.md`), `---\n${YAML.stringify(fm, { lineWidth: 0, aliasDuplicateObjects: false })}---\n\n${body}`);
    console.log("ok", slug);
  }
}
