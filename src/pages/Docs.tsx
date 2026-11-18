import { useState } from "react";
import { Link, NavLink, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { Breadcrumb } from "@/components/Breadcrumb";
import { CollapsibleFilters } from "@/components/CollapsibleFilters";
import { FeedRow } from "@/components/FeedRow";
import { IconBook, IconScroll } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { SearchInput } from "@/components/SearchInput";
import {
  SegmentedButton,
  SegmentedControl,
} from "@/components/ui/segmented-control";
import { unaccent } from "@/lib/unaccent";

import {
  DOCS_BY_SLUG,
  DOCS_ORDERED,
  DOCS_SECTIONS,
  type DocArticle,
} from "./docs/registry";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
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
      <main className="container max-w-4xl py-6 px-4 space-y-3">
        {article ? <ArticleView article={article} /> : <Index />}
      </main>
    </div>
  );
}

// ─── Index page ──────────────────────────────────────────────────────

function Index() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
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
    <div className="space-y-4">
      <PageHeader
        icon={<IconBook className="h-7 w-7" />}
        title={t`Trợ giúp`}
        description={t`Tra cứu nhanh cách dùng app. Chọn chủ đề bên dưới, hoặc tìm theo từ khoá (gõ không dấu cũng được).`}
      />

      {/* Ô tìm + icon Tuỳ chọn (Bài viết / Video) — kiểu chung các màn danh sách. */}
      <CollapsibleFilters
        title={t`Tuỳ chọn trợ giúp`}
        search={(toggle) => (
          <SearchInput
            label={t`Tìm trợ giúp`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t`Tìm theo từ khoá…`}
            rightSlot={toggle}
          />
        )}
      >
        <section className="flex flex-col gap-2">
          <p className="text-base font-medium">{t`Loại hướng dẫn`}</p>
          <SegmentedControl ariaLabel={t`Loại hướng dẫn`} className="flex">
            <SegmentedButton active onClick={() => {}} className="flex-1">
              {t`Bài viết`}
            </SegmentedButton>
            <SegmentedButton
              active={false}
              onClick={() => navigate("/huong-dan-video")}
              className="flex-1"
            >
              Video
            </SegmentedButton>
          </SegmentedControl>
        </section>
      </CollapsibleFilters>

      {filtered.length === 0 && (
        <p className="text-muted-foreground italic">
          <Trans>Không có bài nào khớp "{query}". Thử từ khoá ngắn hơn.</Trans>
        </p>
      )}

      {filtered.map((section) => (
        <section key={section.label} className="space-y-2">
          <h2 className="text-lg font-semibold pt-2">{section.label}</h2>
          <ul className="divide-y overflow-hidden rounded-xl border bg-card shadow-sm">
            {section.articles.map((a) => (
              <FeedRow
                key={a.slug}
                icon={IconScroll}
                iconClass="text-primary"
                title={a.title}
                body={a.summary}
                previewMax={2}
                to={`/docs/${a.slug}`}
              />
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
            { label: t`Hướng dẫn`, to: "/docs" },
            { label: article.title },
          ]}
        />

        <PageHeader
          icon={<IconScroll className="h-7 w-7" />}
          title={article.title}
          description={sectionLabelOf(article.slug)}
        />

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
                <p className="text-xs text-muted-foreground">{t`← Trước`}</p>
                <p className="text-sm font-medium line-clamp-2">{prev.title}</p>
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link
                to={`/docs/${next.slug}`}
                className="rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors text-right"
              >
                <p className="text-xs text-muted-foreground">{t`Tiếp →`}</p>
                <p className="text-sm font-medium line-clamp-2">{next.title}</p>
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
    <nav aria-label={t`Mục lục`}>
      <Link
        to="/docs"
        className="block text-sm font-semibold mb-3 hover:underline"
      >
        {t`← Mục lục`}
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
