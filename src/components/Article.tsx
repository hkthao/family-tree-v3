import type { ReactNode } from "react";

/**
 * Khuôn "bài báo" cho các trang/ngăn kéo XEM chi tiết có nội dung để đọc (Di sản, Mộ phần, Sổ tay): không bọc thẻ,
 * chữ serif to, giãn dòng thoáng, tiêu đề mục là chữ chứ không phải đầu thẻ. Thứ tự đọc như báo: chuyên mục → tít →
 * sapo → dòng thông tin → ảnh lớn → thân bài → khung "Thông tin" → ảnh/tư liệu. Xem docs/design-language.md.
 */
export function Article({ children }: { children: ReactNode }) {
  return (
    <article className="font-serif text-card-foreground">{children}</article>
  );
}

/** Đầu bài: chuyên mục (chữ hoa nhỏ), tít, sapo, dòng thông tin (các mục cách nhau bởi dấu chấm giữa). */
export function ArticleHeader({
  kicker,
  title,
  deck,
  meta,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  deck?: ReactNode;
  meta?: ReactNode[];
}) {
  const metaItems = (meta ?? []).filter(
    (m) => m !== null && m !== undefined && m !== false && m !== "",
  );
  return (
    <header className="border-b pb-4">
      {kicker && (
        <p className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-primary">
          {kicker}
        </p>
      )}
      <h1 className="clan-name mt-1.5 text-[1.75rem] font-semibold leading-tight sm:text-4xl">
        {title}
      </h1>
      {deck && (
        <p className="mt-3 text-lg leading-relaxed text-card-foreground/85 sm:text-xl">
          {deck}
        </p>
      )}
      {metaItems.length > 0 && (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-sans text-sm text-muted-foreground">
          {metaItems.map((m, i) => (
            <span key={i} className="inline-flex items-center gap-2">
              {i > 0 && <span aria-hidden>·</span>}
              {m}
            </span>
          ))}
        </p>
      )}
    </header>
  );
}

/** Ảnh lớn đầu bài (hoặc ảnh minh hoạ trong bài) kèm chú thích; bấm để phóng to khi có `onOpen`. */
export function ArticleFigure({
  src,
  alt,
  caption,
  onOpen,
  openLabel,
}: {
  src: string;
  alt: string;
  caption?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
}) {
  const img = (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      className="max-h-96 w-full rounded-lg object-cover"
    />
  );
  return (
    <figure className="mt-5">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={openLabel}
          className="block w-full cursor-zoom-in"
        >
          {img}
        </button>
      ) : (
        img
      )}
      {caption && (
        <figcaption className="mt-1.5 font-sans text-sm italic text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}

/** Một mục của bài: tít mục serif + nội dung. `id` để mục lục cuộn tới. */
export function ArticleSection({
  id,
  title,
  aside,
  children,
}: {
  id?: string;
  title?: ReactNode;
  /** Chữ nhỏ cạnh tít mục (vd. số lượng). */
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="mt-7 scroll-mt-4">
      {title && (
        <h2 className="clan-name flex items-baseline gap-2 text-2xl font-semibold leading-snug text-primary">
          {title}
          {aside && (
            <span className="font-sans text-sm font-normal text-muted-foreground">
              {aside}
            </span>
          )}
        </h2>
      )}
      <div className={title ? "mt-2" : undefined}>{children}</div>
    </section>
  );
}

/** Đoạn văn thân bài: chữ 17px, giãn dòng 2rem, giữ xuống dòng của người nhập. */
export function ArticleProse({ children }: { children: ReactNode }) {
  return (
    <p className="whitespace-pre-wrap break-words text-[17px] leading-8 [overflow-wrap:anywhere] sm:text-lg">
      {children}
    </p>
  );
}

/** Khung "Thông tin" bên lề bài (như hộp dữ kiện của báo): vạch màu bên trái, nhãn nhỏ trên, giá trị dưới. */
export function ArticleFactBox({
  title,
  rows,
  footer,
}: {
  title: ReactNode;
  rows: { label: string; value: ReactNode }[];
  footer?: ReactNode;
}) {
  const shown = rows.filter(
    (r) => r.value !== null && r.value !== undefined && r.value !== "",
  );
  if (shown.length === 0 && !footer) return null;
  return (
    <aside className="mt-7 rounded-r-lg border-l-4 border-accent bg-muted/40 px-4 py-3 font-sans">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        {title}
      </p>
      {shown.length > 0 && (
        <dl className="mt-2 grid grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2">
          {shown.map((r) => (
            <div key={r.label} className="min-w-0">
              <dt className="text-xs text-muted-foreground">{r.label}</dt>
              <dd className="break-words text-base">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {footer && <div className="mt-3">{footer}</div>}
    </aside>
  );
}

/** Mục lục ngắn đầu bài ("Trong bài này") — chỉ dùng khi bài có từ 3 mục trở lên. */
export function ArticleToc({
  label,
  items,
}: {
  label: string;
  items: { id: string; title: string }[];
}) {
  return (
    <nav className="mt-5 border-y py-3 font-sans text-sm">
      <p className="font-semibold uppercase tracking-[0.14em] text-xs text-muted-foreground">
        {label}
      </p>
      <ol className="mt-1.5 list-decimal space-y-1 pl-5">
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className="text-left text-primary hover:underline"
              onClick={() =>
                document
                  .getElementById(it.id)
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              {it.title}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** Danh sách người (liên quan / an nghỉ) kiểu dòng chữ có gạch phân cách — không viền thẻ. */
export function ArticleList({ children }: { children: ReactNode }) {
  return <ul className="divide-y border-y font-sans">{children}</ul>;
}

/** Chân bài: nguồn, ghi chú, ngày cập nhật — chữ nhỏ, có gạch trên. */
export function ArticleFooter({ children }: { children: ReactNode }) {
  return (
    <footer className="mt-8 space-y-1.5 border-t pt-4 font-sans text-sm text-muted-foreground">
      {children}
    </footer>
  );
}
