import type { ReactNode } from "react";

import { PageHelpVideo } from "@/components/PageHelpVideo";

/**
 * Header chuẩn cho mọi page — pattern khớp Today.tsx:
 *   [Icon h-7] Title (clan-name serif)
 *              Description (text-sm muted)
 *              ? Xem hướng dẫn M:SS  (auto via PageHelpVideo)
 *
 * Bên phải (sm+) optionally chứa action buttons. Mobile: actions
 * xuống dòng dưới title.
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
    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
      <header className="flex items-start gap-3 flex-1 min-w-0">
        <span
          className="text-primary shrink-0 mt-0.5"
          aria-hidden="true"
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="clan-name text-xl sm:text-2xl font-semibold leading-tight">
            {title}
          </h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-0.5">
              {description}
            </p>
          )}
          <div className="mt-1">
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
