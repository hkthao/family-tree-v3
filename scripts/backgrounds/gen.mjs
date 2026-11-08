// Sinh tranh thuỷ mặc procedural → SVG (sáng + tối). Dùng: node gen.mjs <outDir> [id...]
// Cùng seed ⇒ cùng bố cục; bản tối chỉ khác bảng màu. Xem docs/plan-tranh-thuy-mac.md.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const themes = JSON.parse(readFileSync(join(here, "themes.json"), "utf8"));

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PALETTE = {
  light: {
    paper: "#E8E1CF", paperShade: "#D9D0B8", ink: "40,34,30", mist: "240,235,220",
    seal: "#8E2A2A", mistAlpha: 0.78, fogBase: "240,235,220",
  },
  dark: {
    paper: "#17130F", paperShade: "#201B15", ink: "6,5,4", mist: "205,198,184",
    seal: "#B24242", mistAlpha: 0.07, fogBase: "205,198,184",
  },
};

// Đường núi: tổng nhiều tần số, biên độ nhấn về hai lề (giữa tranh thưa để thẻ đè lên).
function ridge(r, W, base, amp, rough, edgeBias) {
  const pts = [];
  const N = 90;
  const ph = [r() * 6.28, r() * 6.28, r() * 6.28, r() * 6.28];
  for (let i = 0; i <= N; i++) {
    const u = i / N, x = -W * 0.1 + u * W * 1.2;
    const side = Math.min(1, Math.abs(u - 0.5) * 2); // 0 giữa → 1 lề
    const bias = 1 - edgeBias + edgeBias * Math.pow(side, 1.4);
    const n =
      Math.sin(u * 5.1 + ph[0]) * 0.5 + Math.sin(u * 11.7 + ph[1]) * 0.28 +
      Math.sin(u * 27.3 + ph[2]) * 0.13 * rough + (r() - 0.5) * 0.1 * rough;
    pts.push([x, base - amp * bias * (0.55 + n)]);
  }
  return pts;
}
const path = (pts, W, H) =>
  `M${-W * 0.1} ${H * 1.1} L${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L")} L${pts.at(-1)[0]} ${H * 1.1} Z`;

function build(id, cfg, mode, W, H) {
  const P = PALETTE[mode], r = rng(cfg.seed);
  const L = cfg.layers, defs = [], body = [];
  const portrait = H > W;
  defs.push(`
  <filter id="paper" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9 0.7" numOctaves="3" seed="${cfg.seed}" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.3  0 0 0 0 0.22  0 0 0 ${mode === "light" ? 0.16 : 0.09} 0"/>
  </filter>
  <filter id="wash" filterUnits="userSpaceOnUse" x="${-W * 0.2}" y="${-H * 0.2}" width="${W * 1.4}" height="${H * 1.4}">
    <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="4" seed="${cfg.seed + 3}" result="t"/>
    <feDisplacementMap in="SourceGraphic" in2="t" scale="${W * 0.03}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${W * 0.0022}"/>
  </filter>
  <filter id="soft" x="-30%" y="-150%" width="160%" height="400%"><feGaussianBlur stdDeviation="${W * 0.012}"/></filter>
  <radialGradient id="vig" cx="50%" cy="45%" r="75%">
    <stop offset="60%" stop-color="${P.paper}" stop-opacity="0"/>
    <stop offset="100%" stop-color="${P.paperShade}" stop-opacity="${mode === "light" ? 0.9 : 0.8}"/>
  </radialGradient>`);
  body.push(`<rect width="${W}" height="${H}" fill="${P.paper}"/>`);
  body.push(`<rect width="${W}" height="${H}" filter="url(#paper)"/>`);

  for (let i = 0; i < L; i++) {
    const t = i / (L - 1);                       // 0 xa → 1 gần
    const base = H * (0.42 + 0.5 * t) + r() * H * 0.02;
    const amp = H * (0.2 + 0.2 * t);
    const pts = ridge(r, W, base, amp, 0.6 + t, portrait ? 0.35 : 0.7);
    const a = mode === "light" ? 0.10 + 0.62 * t : 0.05 + 0.55 * t;
    const col = mode === "light" ? P.ink : t < 0.55 ? P.mist : P.ink;
    const aa = mode === "light" ? a : t < 0.55 ? 0.04 + 0.16 * t : 0.25 + 0.6 * (t - 0.55);
    const gid = `g${i}`;
    defs.push(`<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="rgb(${col})" stop-opacity="${aa.toFixed(3)}"/>
      <stop offset="0.75" stop-color="rgb(${col})" stop-opacity="${(aa * 0.35).toFixed(3)}"/>
      <stop offset="1" stop-color="rgb(${col})" stop-opacity="0"/></linearGradient>`);
    body.push(`<path d="${path(pts, W, H)}" fill="url(#${gid})" filter="url(#wash)"/>`);
    // sương giữa các lớp
    const fy = base + amp * 0.05;
    body.push(`<rect x="${-W * 0.1}" y="${fy}" width="${W * 1.2}" height="${H * 0.16}" fill="rgb(${P.fogBase})" opacity="${(P.mistAlpha * (0.35 + 0.4 * (1 - t))).toFixed(2)}" filter="url(#soft)"/>`);
  }
  // vầng sáng/trăng mờ
  const mx = W * (0.22 + r() * 0.12), my = H * 0.2;
  body.push(`<circle cx="${mx}" cy="${my}" r="${H * 0.07}" fill="rgb(${P.fogBase})" opacity="${mode === "light" ? 0.7 : 0.18}" filter="url(#soft)"/>`);
  body.push(`<rect width="${W}" height="${H}" fill="url(#vig)"/>`);
  // ấn son
  const sx = W - W * 0.07, sy = H - H * 0.12, ss = Math.min(W, H) * 0.035;
  body.push(`<g opacity="0.85"><rect x="${sx}" y="${sy}" width="${ss}" height="${ss * 1.25}" rx="${ss * 0.08}" fill="${P.seal}"/>
    <rect x="${sx + ss * 0.2}" y="${sy + ss * 0.22}" width="${ss * 0.6}" height="${ss * 0.8}" fill="none" stroke="${P.paper}" stroke-width="${ss * 0.06}" opacity="0.7"/></g>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join("")}</defs>${body.join("")}</svg>`;
}

const [out = "build-bg", ...only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const [id, cfg] of Object.entries(themes)) {
  if (only.length && !only.includes(id)) continue;
  for (const mode of ["light", "dark"]) {
    writeFileSync(join(out, `${id}-${mode}-lg.svg`), build(id, cfg, mode, 1920, 1080));
    writeFileSync(join(out, `${id}-${mode}-sm.svg`), build(id, cfg, mode, 1080, 1920));
  }
}
console.log("ok", out);
