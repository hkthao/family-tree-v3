import { useEffect, type ReactNode } from "react";

import { IconX } from "@/components/icons";
import { ActionArea, Button } from "@/components/ui/button";

/**
 * Ngăn kéo bên phải chứa bộ lọc / tuỳ chọn của một màn hình. Mở bằng icon phễu
 * (xem CollapsibleFilters), nên danh sách/cây phía sau không bị các ô chọn
 * chiếm chỗ. Esc, bấm nền mờ hoặc "Xong" để đóng; `onReset` (nếu có) thêm nút
 * "Đặt lại".
 */
export function FilterDrawer({
  open,
  onClose,
  title = "Bộ lọc & tuỳ chọn",
  onReset,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  onReset?: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`print-hide fixed inset-0 z-50 ${open ? "" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        tabIndex={-1}
        aria-label="Đóng"
        onClick={onClose}
        className={`absolute inset-0 bg-black/40 transition-opacity ${open ? "opacity-100" : "opacity-0"}`}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`absolute right-0 top-0 flex h-full w-[min(22rem,90vw)] flex-col border-l bg-background shadow-xl transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <header className="flex items-center justify-between gap-2 border-b px-4 h-14 shrink-0">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-muted"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>
        <ActionArea>
          <div className="flex-1 space-y-3 overflow-y-auto p-4">{open ? children : null}</div>
        <footer className="flex gap-2 border-t p-3 shrink-0">
          {onReset && (
            <Button type="button" variant="outline" className="flex-1" onClick={onReset}>
              Đặt lại
            </Button>
          )}
          <Button type="button" className="flex-1" onClick={onClose}>
            Xong
          </Button>
        </footer>
        </ActionArea>
      </aside>
    </div>
  );
}
