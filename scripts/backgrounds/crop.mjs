// Cắt + chỉnh tông tranh thuỷ mặc thật (nguồn Wikimedia Commons, xem docs/credits.md) → PNG sáng/tối, ngang + dọc.
// Dùng: node crop.mjs <srcDir> <outDir>. `crop` = [x,y,w,h] theo tỉ lệ ảnh gốc (bỏ viền lụa/khung/ấn kề bên).
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const items = JSON.parse(readFileSync(join(here, "sources.json"), "utf8"));
const [src = "build-bg/src", out = "build-bg"] = process.argv.slice(2);
mkdirSync(out, { recursive: true });

const FILTER = {
  light: "saturate(0.75) contrast(1.06) brightness(1.02)",
  // Đảo mực: nét trắng ngà trên nền đen ấm — như tranh đêm; sepia để ấm, hạ sáng để không chói.
  dark: "grayscale(1) invert(1) sepia(0.4) brightness(0.62) contrast(1.15)",
};
const SIZES = { lg: [1920, 1080], sm: [1080, 1920] };

const b = await chromium.launch();
for (const [id, it] of Object.entries(items)) {
  for (const [size, [W, H]] of Object.entries(SIZES)) {
    for (const mode of ["light", "dark"]) {
      const crop = it.crop[size] ?? it.crop.lg;
      const p = await b.newPage({ viewport: { width: W, height: H } });
      const url = "data:image/jpeg;base64," + readFileSync(resolve(src, it.file)).toString("base64");
      await p.setContent(`<body style="margin:0;overflow:hidden;background:#000"><div id="f" style="width:${W}px;height:${H}px;position:relative;overflow:hidden;filter:${FILTER[mode]}"><img id="i" src="${url}" style="position:absolute;max-width:none"></div></body>`);
      await p.evaluate(async ([cx, cy, cw, ch, W, H]) => {
        const i = document.getElementById("i");
        await i.decode();
        const s = Math.max(W / (cw * i.naturalWidth), H / (ch * i.naturalHeight));
        i.style.width = i.naturalWidth * s + "px";
        i.style.left = -(cx * i.naturalWidth * s) - (cw * i.naturalWidth * s - W) / 2 + "px";
        i.style.top = -(cy * i.naturalHeight * s) - (ch * i.naturalHeight * s - H) / 2 + "px";
      }, [...crop, W, H]);
      await p.screenshot({ path: join(out, `${id}-${mode}-${size}.png`) });
      await p.close();
    }
  }
}
await b.close();
console.log("ok");
