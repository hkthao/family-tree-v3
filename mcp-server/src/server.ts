import "./env.ts";

import { createServer } from "node:http";

import { handleHttp } from "./handler.ts";

/**
 * Vỏ HTTP mỏng bọc handler kiểu fetch (Request → Response). Handler không biết gì về Node.
 *
 *   POST /mcp      JSON-RPC MCP
 *   GET  /healthz  để docker healthcheck / nginx
 */

const PORT = Number(process.env.PORT ?? 3333);
const MAX_BODY = 256 * 1024;

const server = createServer(async (nreq, nres) => {
  try {
    const url = new URL(nreq.url ?? "/", "http://mcp.local");
    if (url.pathname === "/healthz") {
      nres.writeHead(200, { "Content-Type": "text/plain" }).end("ok");
      return;
    }
    if (url.pathname !== "/mcp" && url.pathname !== "/mcp/") {
      nres.writeHead(404, { "Content-Type": "application/json" }).end('{"error":"Không có đường dẫn này. Dùng POST /mcp."}');
      return;
    }

    const chunks: Buffer[] = [];
    let size = 0;
    for await (const c of nreq) {
      size += (c as Buffer).length;
      if (size > MAX_BODY) {
        nres.writeHead(413, { "Content-Type": "application/json" }).end('{"error":"Nội dung quá lớn."}');
        return;
      }
      chunks.push(c as Buffer);
    }

    const headers = new Headers();
    for (const [k, v] of Object.entries(nreq.headers)) {
      if (typeof v === "string") headers.set(k, v);
      else if (Array.isArray(v)) headers.set(k, v.join(", "));
    }
    const method = nreq.method ?? "GET";
    const req = new Request(url, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" || method === "OPTIONS" ? undefined : Buffer.concat(chunks),
    });

    const res = await handleHttp(req);
    const out: Record<string, string> = {};
    res.headers.forEach((v, k) => (out[k] = v));
    nres.writeHead(res.status, out).end(Buffer.from(await res.arrayBuffer()));
  } catch (e) {
    console.error("[mcp-server]", e);
    if (!nres.headersSent) nres.writeHead(500, { "Content-Type": "application/json" });
    nres.end('{"error":"Lỗi máy chủ."}');
  }
});

server.listen(PORT, () => console.log(`[mcp-server] lắng nghe :${PORT}`));
for (const sig of ["SIGTERM", "SIGINT"] as const) process.on(sig, () => server.close(() => process.exit(0)));
