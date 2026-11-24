#!/usr/bin/env node
/**
 * Sinh các trang hướng dẫn tĩnh cho landing (donghoviet.thaohk.com) từ scripts/landing-guides/data.mjs:
 *   landing/huong-dan.html, landing/huong-dan/<slug>.html, landing/sitemap.xml, landing/llms.txt.
 *
 * Trang là HTML thuần (không cần JS để đọc) — bot AI thường không chạy JavaScript. Giao diện tái dùng khối <style> của
 * landing/index.html lúc sinh, nên đổi giao diện landing thì chạy lại script là các bài theo kịp.
 * Chạy: `node scripts/build-landing-guides.mjs`
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { guides, hub, SITE, APP } from "./landing-guides/data.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const L = join(root, "landing");
const index = readFileSync(join(L, "index.html"), "utf8");
const css = index.match(/<style>([\s\S]*?)<\/style>/)[1];
const themeScript = index.match(/<script>\s*\(function \(\) \{\s*try \{\s*var v = localStorage[\s\S]*?<\/script>/)[0];
const sprite = index.match(/<svg width="0" height="0"[\s\S]*?<\/svg>/)[0];
const umami = index.match(/<script defer src="https:\/\/analytics[\s\S]*?<\/script>/)[0];

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
const strip = (s) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
const utm = (c) => `${APP}/signup?utm_source=landing&utm_medium=guide&utm_campaign=${c}`;

const extraCss = `
.article { max-width: 760px; margin: 0 auto; padding: 2.6rem 1.4rem 1rem; }
.crumbs { font-size: .85rem; color: hsl(var(--muted-fg)); margin-bottom: 1rem; }
.crumbs a { text-decoration: underline; text-underline-offset: 3px; }
.article h1 { font-size: clamp(1.7rem, 4.6vw, 2.4rem); margin-bottom: .8rem; }
.article .meta { font-size: .85rem; color: hsl(var(--muted-fg)); margin-bottom: 1.4rem; }
.article .lead { font-size: 1.1rem; padding: 1.1rem 1.2rem; background: hsl(var(--bg2)); border-left: 4px solid hsl(var(--primary)); border-radius: .6rem; margin-bottom: 1.8rem; }
.article h2 { font-size: 1.4rem; margin: 2.2rem 0 .7rem; }
.article p, .article li, .article dd { margin-bottom: .75rem; }
.article ul, .article ol { padding-left: 1.4rem; margin-bottom: 1rem; }
.article dt { font-weight: 700; margin-top: .9rem; }
.article dd { margin-left: 0; color: hsl(var(--muted-fg)); }
.article a:not(.btn) { color: hsl(var(--primary)); text-decoration: underline; text-underline-offset: 3px; }
.article table { width: 100%; border-collapse: collapse; margin: .6rem 0 1.2rem; font-size: .95rem; }
.article th, .article td { text-align: left; padding: .6rem .7rem; border: 1px solid hsl(var(--border)); vertical-align: top; }
.article th { background: hsl(var(--bg2)); }
.article .faq { padding: 0; }
.article .cta-box { margin: 2.4rem 0 1rem; padding: 1.4rem; border: 1.5px solid hsl(var(--border)); border-radius: 1rem; background: hsl(var(--card)); }
.article .cta-box h2 { margin-top: 0; }
.article .cta-row { display: flex; flex-wrap: wrap; gap: .7rem; margin-top: 1rem; }
.article .related a { display: block; padding: .6rem 0; border-bottom: 1px solid hsl(var(--border)); }
.cards { display: grid; gap: 1rem; margin-top: 1.4rem; }
@media (min-width: 700px) { .cards { grid-template-columns: 1fr 1fr; } }
.cards a { display: block; padding: 1.1rem 1.2rem; border: 1.5px solid hsl(var(--border)); border-radius: 1rem; background: hsl(var(--card)); text-decoration: none !important; color: inherit !important; }
.cards a:hover { background: hsl(var(--muted)); }
.cards b { display: block; font-family: "Noto Serif", serif; font-size: 1.1rem; margin-bottom: .3rem; }
.cards span { font-size: .92rem; color: hsl(var(--muted-fg)); }
`;

function shell({ path, title, description, ld, body }) {
  const url = `${SITE}${path}`;
  return `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="theme-color" content="#7A2230" />
    <link rel="icon" type="image/svg+xml" href="/assets/app-icon.svg" />
    <link rel="apple-touch-icon" sizes="180x180" href="/assets/app-icon-180.png" />
    ${umami}
    <title>${esc(title)} | Dòng Họ Việt</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:type" content="article" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="Dòng Họ Việt" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${SITE}/assets/og-banner.png" />
    <meta property="og:locale" content="vi_VN" />
    <meta name="twitter:card" content="summary_large_image" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Noto+Serif:wght@400;500;600;700&display=swap" rel="stylesheet" />
    ${themeScript}
    <style>${css}${extraCss}</style>
    <script type="application/ld+json">
${JSON.stringify(ld, null, 2)}
    </script>
  </head>
  <body>
    ${sprite}
    <header>
      <div class="wrap nav">
        <a class="brand" href="/"><img src="/assets/app-icon.svg" alt="Dòng Họ Việt" /><span>Dòng Họ Việt</span></a>
        <nav class="nav-links">
          <a href="/#cach-dung">Cách dùng</a>
          <a href="/#tinh-nang">Tính năng</a>
          <a href="/#an-toan">An toàn</a>
          <a href="/#cau-hoi">Hỏi đáp</a>
          <a class="active" href="/blog.html">Blog</a>
        </nav>
        <div class="nav-actions">
          <a class="btn btn-primary" data-cta="guide-nav" href="${utm("guide_nav")}"><svg class="ico"><use href="#i-tree"/></svg>Tạo gia phả</a>
        </div>
      </div>
    </header>
    <main>
${body}
    </main>
    <footer>
      <div class="wrap">
        <div class="foot-bottom">© Dòng Họ Việt · <a href="/">Giới thiệu</a> · <a href="/huong-dan.html">Kiến thức gia phả</a> · <a href="mailto:support@thaohk.com">support@thaohk.com</a> · <a href="${APP}/chinh-sach-rieng-tu">Chính sách riêng tư</a></div>
      </div>
    </footer>
  </body>
</html>
`;
}

const org = { "@type": "Organization", name: "Dòng Họ Việt", url: `${SITE}/`, logo: `${SITE}/assets/app-icon-180.png` };

function guidePage(g) {
  const path = `/huong-dan/${g.slug}.html`;
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: g.title,
        description: g.description,
        inLanguage: "vi",
        datePublished: "2026-11-15",
        dateModified: g.updated,
        mainEntityOfPage: `${SITE}${path}`,
        image: `${SITE}/assets/og-banner.png`,
        author: org,
        publisher: org,
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Dòng Họ Việt", item: `${SITE}/` },
          { "@type": "ListItem", position: 2, name: "Kiến thức gia phả", item: `${SITE}/huong-dan.html` },
          { "@type": "ListItem", position: 3, name: g.short, item: `${SITE}${path}` },
        ],
      },
      {
        "@type": "FAQPage",
        mainEntity: g.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
    ],
  };
  const secs = g.sections.map((s) => `<h2>${s.h2}</h2>\n${s.html}`).join("\n");
  const faq = g.faq.map((f, i) => `<details${i === 0 ? " open" : ""}><summary>${esc(f.q)}<svg class="ico"><use href="#i-plus"/></svg></summary><div class="ans">${esc(f.a)}</div></details>`).join("\n");
  const rel = g.related.map((s) => guides.find((x) => x.slug === s)).filter(Boolean).map((x) => `<a href="/huong-dan/${x.slug}.html">${esc(x.short)}</a>`).join("\n");
  const body = `<article class="article">
<nav class="crumbs" aria-label="Đường dẫn"><a href="/">Dòng Họ Việt</a> › <a href="/huong-dan.html">Kiến thức gia phả</a> › ${esc(g.short)}</nav>
<h1>${esc(g.title)}</h1>
<p class="meta">Cập nhật ${g.updated.split("-").reverse().join("/")} · khoảng ${g.minutes} phút đọc · Dòng Họ Việt</p>
<p class="lead">${g.lead}</p>
${secs}
<h2>Câu hỏi thường gặp</h2>
<div class="faq">
${faq}
</div>
<div class="cta-box">
<h2>Lập gia phả cho dòng họ của bạn</h2>
<p>Dòng Họ Việt là phần mềm gia phả tiếng Việt: cây nhiều đời, ngày giỗ âm lịch có nhắc, xưng hô họ hàng, xuất sổ gia phả PDF. Bắt đầu miễn phí.</p>
<div class="cta-row">
<a class="btn btn-primary" data-cta="guide-${g.slug}" href="${utm("guide_" + g.slug)}"><svg class="ico"><use href="#i-tree"/></svg>Tạo gia phả miễn phí</a>
<a class="btn btn-ghost" data-cta="guide-demo-${g.slug}" href="${APP}/xem/demo?utm_source=landing&utm_medium=guide&utm_campaign=guide_${g.slug}"><svg class="ico"><use href="#i-eye"/></svg>Xem thử gia phả mẫu</a>
</div>
</div>
<h2>Bài liên quan</h2>
<div class="related">
${rel}
</div>
</article>`;
  return shell({ path, title: g.title, description: g.description, ld, body });
}

function hubPage() {
  const ld = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", name: hub.title, description: hub.description, inLanguage: "vi", url: `${SITE}/huong-dan.html`, dateModified: hub.updated, publisher: org },
      { "@type": "BreadcrumbList", itemListElement: [
        { "@type": "ListItem", position: 1, name: "Dòng Họ Việt", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Kiến thức gia phả", item: `${SITE}/huong-dan.html` } ] },
      { "@type": "ItemList", itemListElement: guides.map((g, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE}/huong-dan/${g.slug}.html`, name: g.title })) },
    ],
  };
  const cards = guides.map((g) => `<a href="/huong-dan/${g.slug}.html"><b>${esc(g.title)}</b><span>${esc(strip(g.lead).slice(0, 170))}…</span></a>`).join("\n");
  const body = `<section class="article">
<nav class="crumbs" aria-label="Đường dẫn"><a href="/">Dòng Họ Việt</a> › Kiến thức gia phả</nav>
<h1>${esc(hub.title)}</h1>
<p class="lead">${esc(hub.lead)}</p>
<div class="cards">
${cards}
</div>
<div class="cta-box">
<h2>Bắt đầu lập gia phả</h2>
<p>Dòng Họ Việt giúp cả họ cùng dựng cây gia phả và nhớ ngày giỗ âm lịch. Miễn phí để bắt đầu.</p>
<div class="cta-row">
<a class="btn btn-primary" data-cta="guide-hub" href="${utm("guide_hub")}"><svg class="ico"><use href="#i-tree"/></svg>Tạo gia phả miễn phí</a>
<a class="btn btn-ghost" data-cta="guide-hub-demo" href="${APP}/xem/demo?utm_source=landing&utm_medium=guide&utm_campaign=guide_hub"><svg class="ico"><use href="#i-eye"/></svg>Xem thử gia phả mẫu</a>
</div>
</div>
</section>`;
  return shell({ path: "/huong-dan.html", title: hub.title, description: hub.description, ld, body });
}

mkdirSync(join(L, "huong-dan"), { recursive: true });
writeFileSync(join(L, "huong-dan.html"), hubPage());
for (const g of guides) writeFileSync(join(L, "huong-dan", `${g.slug}.html`), guidePage(g));

const u = (loc, d, p) => `  <url>\n    <loc>${SITE}${loc}</loc>\n    <lastmod>${d}</lastmod>\n    <priority>${p}</priority>\n  </url>`;
writeFileSync(join(L, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[u("/", hub.updated, "1.0"), u("/huong-dan.html", hub.updated, "0.8"), ...guides.map((g) => u(`/huong-dan/${g.slug}.html`, g.updated, "0.7"))].join("\n")}\n</urlset>\n`);

const llms = `# Dòng Họ Việt

> Phần mềm gia phả bằng tiếng Việt cho dòng họ Việt Nam: cả họ cùng dựng cây gia phả nhiều đời, ghi ngày giỗ âm lịch và được nhắc, lưu giọng kể và di sản của ông bà, xuất sổ gia phả PDF. Bắt đầu miễn phí; chạy trên web, Android, iOS.

## Ứng dụng
- [Xem thử gia phả mẫu, không cần đăng nhập](${APP}/xem/demo)
- [Tạo gia phả miễn phí](${APP}/signup)
- [Hướng dẫn sử dụng app](${APP}/docs)

## Kiến thức gia phả
${guides.map((g) => `- [${g.title}](${SITE}/huong-dan/${g.slug}.html): ${g.description}`).join("\n")}

## Khác
- [Giới thiệu và hỏi đáp](${SITE}/)
- [Sổ tay Văn hoá: phong tục, nghi lễ, tín ngưỡng](${APP}/so-tay)
- Liên hệ: support@thaohk.com
`;
writeFileSync(join(L, "llms.txt"), llms);
console.log(`[landing-guides] ${guides.length} bài + hub + sitemap + llms.txt`);
