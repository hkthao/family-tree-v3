// Gộp server thành MỘT file Node (dist/server.mjs). Plugin nhỏ đổi specifier kiểu Deno
// `npm:pkg@x.y.z` (có trong bản vendor dùng chung với edge function) thành `pkg` thường.
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

await build({
  entryPoints: ["mcp-server/src/server.ts"],
  outfile: "mcp-server/dist/server.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  sourcemap: true,
  minify: false,
  plugins: [denoNpm],
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
});
console.log("ok → mcp-server/dist/server.mjs");
