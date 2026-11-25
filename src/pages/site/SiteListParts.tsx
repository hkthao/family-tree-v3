import { t } from "@lingui/core/macro";
import type { ReactNode } from "react";

import { IconArrowLeft, IconArrowRight } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Tiêu đề + mô tả đầu trang danh sách. */
export function SitePageHead({ title, intro }: { title: string; intro?: string }) {
  return (
    <>
      <h1 className="clan-name text-3xl font-bold md:text-4xl">{title}</h1>
      {intro && <p className="mb-6 mt-2 max-w-2xl text-muted-foreground">{intro}</p>}
    </>
  );
}

/** Hàng chip lọc (giá trị "" = Tất cả). */
export function FilterChips({ value, options, onChange, label }: { value: string; options: { value: string; label: string }[]; onChange: (v: string) => void; label: string }) {
  return (
    <div className="mb-7 flex flex-wrap gap-2" role="tablist" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value || "all"}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("min-h-11 rounded-full border px-4 text-sm font-medium", value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function SitePager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label={t`Phân trang`} className="mt-8 flex items-center justify-center gap-2">
      <Button size="icon-sm" variant="outline" aria-label={t`Trang trước`} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        <IconArrowLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-16 text-center tabular-nums text-muted-foreground">
        {page} / {pages}
      </span>
      <Button size="icon-sm" variant="outline" aria-label={t`Trang sau`} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        <IconArrowRight className="h-4 w-4" />
      </Button>
    </nav>
  );
}

/** Trạng thái tải / lỗi / rỗng của một danh sách; trả children khi có dữ liệu. */
export function ListState({ loading, error, empty, emptyText, children }: { loading: boolean; error: Error | null; empty: boolean; emptyText: string; children: ReactNode }) {
  if (loading) return <p className="py-12 text-center text-muted-foreground">{t`Đang tải…`}</p>;
  if (error) return <p className="py-12 text-center text-destructive">{error.message}</p>;
  if (empty) return <p className="py-12 text-center text-muted-foreground">{emptyText}</p>;
  return <>{children}</>;
}
