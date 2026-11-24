import { published } from "../../lib";
import { metaOf, sectionsOf } from "../../data";

export async function getStaticPaths() {
  const all = await published();
  return all.filter((a) => !["index", "fulltext"].includes(a.id)).map((entry) => ({ params: { slug: entry.id }, props: { entry, all } }));
}

/** Một bài đầy đủ cho app: thân bài đã là HTML (marked), app làm sạch thêm bằng DOMPurify khi hiển thị. */
export async function GET({ props }: { props: { entry: Awaited<ReturnType<typeof published>>[number]; all: Awaited<ReturnType<typeof published>> } }) {
  const { entry, all } = props;
  const g = entry.data;
  const body = {
    ...metaOf(entry),
    applicable_to: g.applicable_to ?? null,
    short_title: g.short ?? null,
    sections: sectionsOf(entry),
    faq: g.faq,
    sources: g.sources,
    related_ids: g.related.filter((s) => all.some((x) => x.id === s)),
  };
  return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
}
