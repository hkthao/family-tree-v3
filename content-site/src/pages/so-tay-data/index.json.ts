import { published } from "../../lib";
import { metaOf } from "../../data";

/** Mục lục cho app (không kèm thân bài). Tải một lần, lọc/tìm ở client. */
export async function GET() {
  const all = await published();
  return new Response(JSON.stringify({ version: 1, items: all.map(metaOf) }), { headers: { "Content-Type": "application/json" } });
}
