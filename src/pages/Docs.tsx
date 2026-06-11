import { useState } from "react";
import { Link, NavLink, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { IconSearch } from "@/components/icons";
import { unaccent } from "@/lib/unaccent";

import {
  DOCS_BY_SLUG,
  DOCS_ORDERED,
  DOCS_SECTIONS,
  type DocArticle,
} from "./docs/registry";

/**
 * In-app documentation. Two modes driven by the URL:
 *
 *   /docs              → index (welcome + topic list)
 *   /docs/:slug        → single article (sidebar pinned at lg+)
 *
 * Content lives in `src/pages/docs/articles/*.tsx` as plain function
 * components — see `prose.tsx` for the typography primitives. Adding
 * a new article = create the component, export it, register the slug
 * + title in `registry.tsx`.
 */
export default function Docs() {
  const { slug } = useParams<{ slug?: string }>();
  const article = slug ? DOCS_BY_SLUG[slug] : null;

  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-4xl py-6 px-4 space-y-6">
        {article ? (
          <ArticleView article={article} />
        ) : (
          <Index />
        )}
      </main>
    </div>
  );
}

// ─── Index page ──────────────────────────────────────────────────────

function Index() {
  const [query, setQuery] = useState("");
  const needle = unaccent(query.trim());

  const filtered = needle
    ? DOCS_SECTIONS.map((s) => ({
        ...s,
        articles: s.articles.filter(
          (a) =>
            unaccent(a.title).includes(needle) ||
            unaccent(a.summary).includes(needle),
        ),
      })).filter((s) => s.articles.length > 0)
    : DOCS_SECTIONS;

  return (
    <div className="space-y-6">
      <h1 className="clan-name text-3xl font-semibold">Hướng dẫn sử dụng</h1>
      <p className="text-muted-foreground">
        Tra cứu nhanh cách dùng app. Chọn chủ đề bên dưới, hoặc tìm theo từ
        khoá (gõ không dấu cũng được).
      </p>

      <div className="relative">
        <IconSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm theo từ khoá…"
          className="w-full h-12 pl-10 pr-3 rounded-md border border-input bg-background text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {filtered.length === 0 && (
        <p className="text-muted-foreground italic">
          Không có bài nào khớp "{query}". Thử từ khoá ngắn hơn.
        </p>
      )}

      {filtered.map((section) => (
        <section key={section.label} className="space-y-2">
          <h2 className="text-lg font-semibold pt-2">{section.label}</h2>
          <ul className="space-y-1.5">
            {section.articles.map((a) => (
              <li key={a.slug}>
                <Link
                  to={`/docs/${a.slug}`}
                  className="block rounded-md border bg-card px-4 py-3 hover:border-primary transition-colors"
                >
                  <p className="font-medium">{a.title}</p>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {a.summary}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ─── Single-article view ─────────────────────────────────────────────

function ArticleView({ article }: { article: DocArticle }) {
  const idx = DOCS_ORDERED.findIndex((a) => a.slug === article.slug);
  const prev = idx > 0 ? DOCS_ORDERED[idx - 1] : null;
  const next =
    idx >= 0 && idx < DOCS_ORDERED.length - 1 ? DOCS_ORDERED[idx + 1] : null;

  return (
    <div className="lg:grid lg:grid-cols-[220px_1fr] lg:gap-8">
      {/* Sidebar — pinned at lg+, hidden on mobile (the BackLink + the
          breadcrumb at the top serve the role). */}
      <aside className="hidden lg:block">
        <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto">
          <SidebarNav currentSlug={article.slug} />
        </div>
      </aside>

      <div className="space-y-4">
        <Breadcrumb
          items={[
            { label: "Hướng dẫn", to: "/docs" },
            { label: article.title },
          ]}
        />

        <header className="space-y-1">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">
            {sectionLabelOf(article.slug)}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold">
            {article.title}
          </h1>
        </header>

        <article className="max-w-2xl">
          <article.Body />
        </article>

        {(prev || next) && (
          <nav className="grid grid-cols-2 gap-3 pt-8 border-t mt-8">
            {prev ? (
              <Link
                to={`/docs/${prev.slug}`}
                className="rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors"
              >
                <p className="text-xs text-muted-foreground">← Trước</p>
                <p className="text-sm font-medium truncate">{prev.title}</p>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to={`/docs/${next.slug}`}
                className="rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors text-right"
              >
                <p className="text-xs text-muted-foreground">Tiếp →</p>
                <p className="text-sm font-medium truncate">{next.title}</p>
              </Link>
            ) : (
              <span />
            )}
          </nav>
        )}
      </div>
    </div>
  );
}

function SidebarNav({ currentSlug }: { currentSlug: string }) {
  return (
    <nav aria-label="Mục lục">
      <Link
        to="/docs"
        className="block text-sm font-semibold mb-3 hover:underline"
      >
        ← Mục lục
      </Link>
      {DOCS_SECTIONS.map((section) => (
        <div key={section.label} className="mb-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1.5 px-2">
            {section.label}
          </p>
          <ul>
            {section.articles.map((a) => (
              <li key={a.slug}>
                <NavLink
                  to={`/docs/${a.slug}`}
                  className={({ isActive }) =>
                    `block rounded px-2 py-1.5 text-sm border-l-2 -ml-px ${
                      isActive || a.slug === currentSlug
                        ? "border-primary text-primary bg-primary/5 font-medium"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
                    }`
                  }
                >
                  {a.title}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

function sectionLabelOf(slug: string): string {
  for (const s of DOCS_SECTIONS) {
    if (s.articles.some((a) => a.slug === slug)) return s.label;
  }
  return "";
}
