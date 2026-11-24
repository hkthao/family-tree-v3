import { published } from "../../lib";
import { sectionsOf, unaccent } from "../../data";

/** Văn bản không dấu của từng bài, chỉ tải khi người dùng gõ tìm (tránh nặng mục lục). */
export async function GET() {
  const all = await published();
  const out: Record<string, string> = {};
  for (const a of all) {
    const text = sectionsOf(a).map((s) => `${s.heading} ${s.body.replace(/<[^>]+>/g, " ")}`).join(" ");
    out[a.id] = unaccent(`${a.data.title} ${a.data.aliases.join(" ")} ${a.data.description} ${a.data.tags.join(" ")} ${text}`).replace(/\s+/g, " ");
  }
  return new Response(JSON.stringify(out), { headers: { "Content-Type": "application/json" } });
}
