// Gộp server thành MỘT file Node (dist/server.mjs). Plugin nhỏ đổi specifier kiểu Deno
// `npm:pkg@x.y.z` (có trong bản vendor dùng chung với edge function) thành `pkg` thường.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { build } from "esbuild";

const denoNpm = {
  name: "deno-npm",
  setup(b) {
    b.onResolve({ filter: /^npm:/ }, (a) => ({
      path: a.path.replace(/^npm:/, "").replace(/@\d[\w.-]*$/, ""),
      external: false,
      namespace: "deno-npm-redirect",
      pluginData: { resolveDir: a.resolveDir },
    }));
    b.onLoad({ filter: /.*/, namespace: "deno-npm-redirect" }, (a) => ({
      contents: `export * from ${JSON.stringify(a.path)};`,
      resolveDir: process.cwd(),
      loader: "js",
    }));
  },
};

/**
 * Gộp code dựng PDF của FE (`@/…` → src/…) vào server. Hai module của FE KHÔNG chạy được ngoài Vite nên thay bằng bản
 * rút gọn: `@/lib/supabase` (đọc import.meta.env, tạo client mặc định) và `@/lib/queries/honor` (macro i18n Lingui).
 */
const SRC = path.resolve("src");
const SHIM = {
  "lib/supabase": path.resolve("mcp-server/src/shims/supabase.ts"),
  "lib/queries/honor": path.resolve("mcp-server/src/shims/honor.ts"),
};
const feAlias = {
  name: "fe-alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, async (a) => {
      const rest = a.path.slice(2);
      if (SHIM[rest]) return { path: SHIM[rest] };
      return b.resolve(path.join(SRC, rest), { kind: a.kind, resolveDir: a.resolveDir });
    });
  },
};

/** Băm mã ảnh hưởng nội dung/bố cục sổ PDF → khoá cache file sổ tự đổi khi mã đổi. */
const hashFiles = (dir, exts) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? hashFiles(path.join(dir, e.name), exts) : exts.some((x) => e.name.endsWith(x)) ? [path.join(dir, e.name)] : []))
    .sort();
const layoutFiles = [...hashFiles("src/lib/pdf", [".ts", ".tsx"]), "src/lib/queries/clan-book.ts", "mcp-server/src/book.tsx", ...hashFiles("mcp-server/src/shims", [".ts"])];
const layoutHash = createHash("sha256");
for (const f of layoutFiles) layoutHash.update(f).update(fs.readFileSync(f));

await build({
  entryPoints: ["mcp-server/src/server.ts"],
  outfile: "mcp-server/dist/server.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  minify: false,
  // sharp (native) và bộ dựng PDF (react-pdf + react) không gộp vào bundle; image runtime cài riêng (xem Dockerfile.mcp).
  external: ["sharp", "@react-pdf/renderer", "@react-pdf/layout", "@react-pdf/render", "@react-pdf/pdfkit", "react", "react/jsx-runtime"],
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  define: { __PDF_LAYOUT_HASH__: JSON.stringify(layoutHash.digest("hex").slice(0, 16)) },
  plugins: [feAlias, denoNpm],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
console.log("ok → mcp-server/dist/server.mjs");
