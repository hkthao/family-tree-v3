// Gộp book-worker thành MỘT file Node (book-worker/dist/worker.mjs). Cùng cách gộp với mcp-server/build.mjs:
// `@/…` → src/…, hai module FE không chạy được ngoài Vite được thay bằng bản rút gọn (shims của mcp-server).
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

const hashFiles = (dir, exts) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((e) => (e.isDirectory() ? hashFiles(path.join(dir, e.name), exts) : exts.some((x) => e.name.endsWith(x)) ? [path.join(dir, e.name)] : []))
    .sort();
const layoutHash = createHash("sha256");
for (const f of [...hashFiles("src/lib/pdf", [".ts", ".tsx"]), "src/lib/queries/clan-book.ts", "book-worker/src/main.tsx"]) layoutHash.update(f).update(fs.readFileSync(f));

await build({
  entryPoints: ["book-worker/src/main.tsx"],
  outfile: "book-worker/dist/worker.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  external: ["sharp", "@react-pdf/renderer", "@react-pdf/layout", "@react-pdf/render", "@react-pdf/pdfkit", "react", "react/jsx-runtime"],
  jsx: "automatic",
  loader: { ".ts": "ts", ".tsx": "tsx" },
  define: { __PDF_LAYOUT_HASH__: JSON.stringify(layoutHash.digest("hex").slice(0, 16)) },
  plugins: [feAlias, denoNpm],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
console.log("ok → book-worker/dist/worker.mjs");
