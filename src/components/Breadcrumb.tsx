import { Link } from "react-router-dom";

import { IconChevronUp } from "@/components/icons";

/**
 * Breadcrumb trail cho các trang sâu — thay thế <BackLink> đơn lẻ vì
 * BackLink chỉ "lùi 1 nấc", còn breadcrumb hiện rõ user đang ở đâu
 * trong hierarchy + cho jump trực tiếp tới mức nào.
 *
 * Rules:
 *  - Mỗi item có `label` (text). Items có `to` là Link clickable,
 *    item cuối (không có `to`) là trang hiện tại — bold, không link.
 *  - Separator: chevron `›` (đơn giản, dễ đọc cho người Việt).
 *  - Truncate item dài quá (Vd. tên bài viết) với `max-w-[160px]` +
 *    `truncate` để không tràn dòng.
 *  - Trên mobile (< sm) chỉ hiện 2 mức cuối + arrow back ở đầu — tiết
 *    kiệm chỗ. Desktop hiện đầy đủ.
 *
 * Usage:
 *   <Breadcrumb items={[
 *     { label: "Dòng họ", to: "/clans" },
 *     { label: clan.name, to: `/clans/${id}` },
 *     { label: "Bảng tin", to: `/clans/${id}/board` },
 *     { label: post.title },
 *   ]} />
 */
export interface BreadcrumbItem {
  label: string;
  to?: string;
}

export function Breadcrumb({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null;

  const current = items[items.length - 1];
  // Mobile: show only the parent (item just before current) as "back".
  const parent = items.length >= 2 ? items[items.length - 2] : null;

  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      {/* Mobile: just "← parent" link */}
      <div className="sm:hidden">
        {parent?.to ? (
          <Link
            to={parent.to}
            className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
          >
            <IconChevronUp className="h-4 w-4 -rotate-90" aria-hidden="true" />
            {parent.label}
          </Link>
        ) : (
          <span className="text-muted-foreground">{current.label}</span>
        )}
      </div>

      {/* Desktop: full crumb trail */}
      <ol className="hidden sm:flex items-center flex-wrap gap-1 text-muted-foreground">
        {items.map((item, idx) => {
          const isLast = idx === items.length - 1;
          return (
            <li
              key={`${item.label}-${idx}`}
              className="inline-flex items-center gap-1 min-w-0"
            >
              {idx > 0 && (
                <span
                  className="text-muted-foreground/60 mx-0.5"
                  aria-hidden="true"
                >
                  ›
                </span>
              )}
              {isLast || !item.to ? (
                <span
                  className="font-medium text-foreground truncate max-w-[260px]"
                  aria-current={isLast ? "page" : undefined}
                  title={item.label}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.to}
                  className="hover:text-foreground hover:underline underline-offset-2 truncate max-w-[200px]"
                  title={item.label}
                >
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
