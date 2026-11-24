#!/usr/bin/env node
/**
 * Chuyển 7 bài hướng dẫn cũ (scripts/landing-guides/data.mjs) sang content/so-tay/*.md, chuyên mục "Kiến thức gia phả"
 * (địa chỉ giữ /huong-dan/<slug>.html). Chạy một lần; chạy lại sẽ ghi đè.
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { guides } from "../../scripts/landing-guides/data.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "../content/so-tay");
const CAT = {
  "cach-lap-gia-pha-dong-ho": "lap_gia_pha",
  "mau-so-gia-pha": "lap_gia_pha",
  "phan-mem-gia-pha-tieng-viet": "lap_gia_pha",
  "cach-tinh-ngay-gio-am-lich": "dong_ho_hoc",
  "cach-xung-ho-ho-hang": "dong_ho_hoc",
  "thuat-ngu-gia-pha": "dong_ho_hoc",
  "chap-ho-tao-mo-gio-to": "dong_ho_hoc",
};
for (const g of guides) {
  const body = g.sections.map((s) => `## ${s.h2}\n\n${s.html.trim()}\n`).join("\n");
  const fm = {
    status: "published",
    title: g.title,
    short: g.short,
    description: g.description,
    updated: g.updated,
    category: CAT[g.slug],
    tags: ["Gia phả", ...(CAT[g.slug] === "dong_ho_hoc" ? ["Dòng họ"] : [])],
    minutes: g.minutes,
    lead: g.lead,
    faq: g.faq,
    related: g.related,
  };
  writeFileSync(join(out, `${g.slug}.md`), `---\n${YAML.stringify(fm, { lineWidth: 0 })}---\n\n${body}`);
  console.log("ok", g.slug);
}
