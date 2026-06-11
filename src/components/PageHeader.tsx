import type { ReactNode } from "react";

import { PageHelpVideo } from "@/components/PageHelpVideo";

/**
 * Header chuẩn cho mọi page — pattern khớp Today.tsx:
 *   [Icon] Title (clan-name serif) — Description (text-sm muted)
 *           ? Xem hướng dẫn M:SS  (auto via PageHelpVideo)
 *
 * Bên phải optionally chứa action buttons — mặc định cùng hàng với
 * title (tiết kiệm chiều dọc). Page có nhiều/long actions thì truyền
 * `actionsBelow` để xuống hàng riêng.
 *
 * Icon size bị override về h-5 w-5 (sm: h-6 w-6) để mọi page nhất
 * quán, không phụ thuộc kích thước className caller truyền vào.
 */
export function PageHeader({
  icon,
  title,
  description,
  actions,
  actionsBelow = false,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** Khi true, actions render dưới title (1 hàng riêng) thay vì inline. */
  actionsBelow?: boolean;
}) {
  const header = (
    <header className="flex items-start gap-2 flex-1 min-w-0">
      <span
        className="text-primary shrink-0 mt-0.5 [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0">
        <h1 className="clan-name text-lg sm:text-xl font-semibold leading-tight">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground leading-snug">
            {description}
          </p>
        )}
        <PageHelpVideo size="text" />
      </div>
    </header>
  );

  // [&:not(:first-child)]:!mt-2 — khi PageHeader đứng sau Breadcrumb,
  // override mt-3/mt-6 do parent space-y-* gây ra, ép gap = 8px.
  // Đứng đầu (không Breadcrumb) thì selector ko match.
  if (actionsBelow && actions) {
    return (
      <div className="space-y-2 [&:not(:first-child)]:!mt-2">
        {header}
        <div className="flex items-center justify-end gap-1.5 sm:gap-2 flex-wrap">
          {actions}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-row items-start gap-2 [&:not(:first-child)]:!mt-2">
      {header}
      {actions && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 sm:ml-auto flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
