// SVG → PNG bằng Playwright. Dùng: node rasterize.mjs <dir>
import { readdirSync, readFileSync } from "node:fs";
import { chromium } from "playwright";
const dir = process.argv[2] ?? "build-bg";
const b = await chromium.launch();
for (const f of readdirSync(dir).filter((f) => f.endsWith(".svg"))) {
  const svg = readFileSync(`${dir}/${f}`, "utf8");
  const [, w, h] = svg.match(/width="(\d+)" height="(\d+)"/);
  const p = await b.newPage({ viewport: { width: +w, height: +h } });
  await p.setContent(`<body style="margin:0">${svg}</body>`);
  await p.screenshot({ path: `${dir}/${f.replace(".svg", ".png")}` });
  await p.close();
}
await b.close();
