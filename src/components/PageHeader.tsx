import type { ReactNode } from "react";

import { PageHelpVideo } from "@/components/PageHelpVideo";

/**
 * Header chuẩn cho mọi page — pattern khớp Today.tsx:
 *   [Icon] Title (clan-name serif) — Description (text-sm muted)
 *           ? Xem hướng dẫn M:SS  (auto via PageHelpVideo)
 *
 * Bên phải (sm+) optionally chứa action buttons. Mobile: actions
 * xuống dòng dưới title.
 *
 * Icon size bị override về h-5 w-5 (sm: h-6 w-6) để mọi page nhất
 * quán, không phụ thuộc kích thước className caller truyền vào.
 */
export function PageHeader({
  icon,
  title,
  description,
  actions,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2">
      <header className="flex items-start gap-2 flex-1 min-w-0">
        <span
          className="text-primary shrink-0 mt-1 [&>svg]:h-5 [&>svg]:w-5 sm:[&>svg]:h-6 sm:[&>svg]:w-6"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="clan-name text-lg sm:text-xl font-semibold leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground leading-snug mt-0.5">
              {description}
            </p>
          )}
          <div className="mt-0.5">
            <PageHelpVideo size="text" />
          </div>
        </div>
      </header>
      {actions && (
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 sm:ml-auto flex-wrap justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
