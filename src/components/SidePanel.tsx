import { useCallback, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { useConfirm } from "@/components/ConfirmDialog";
import { IconX } from "@/components/icons";
import { InSidePanelContext } from "@/components/panel/context";

/** Các SidePanel đang mở (cái cuối là trên cùng) — Esc chỉ đóng cái trên cùng. */
const openStack: string[] = [];

export interface SidePanelProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  /** "md" 32rem (form ngắn) · "lg" 40rem (form dài / nhiều cột). Mobile luôn full-width. */
  size?: "md" | "lg";
  /** Thân không padding / không tự cuộn — nội dung (vd. chat) tự quản bố cục. */
  bare?: boolean;
  /** Mặc định true: hỏi trước khi bỏ dữ liệu đã gõ. Tắt cho nội dung không phải form (chat). */
  guard?: boolean;
  children: ReactNode;
}

/**
 * Ngăn kéo bên phải để nhập liệu / xem chi tiết mà không rời trang. Mobile:
 * full màn hình; desktop: cột 32–40rem, nền mờ phía sau, menu trái vẫn nhìn thấy.
 *
 * Bảo vệ dữ liệu: nếu người dùng đã gõ vào ô nào trong thân panel, đóng bằng
 * X / nền mờ / Esc sẽ hỏi xác nhận. Form tự đóng sau khi lưu thành công (gọi
 * thẳng `onClose` của cha) thì KHÔNG bị hỏi. Gửi form (submit) xoá cờ "đã sửa",
 * nên "Lưu & thêm nữa" không bị hỏi oan.
 */
export function SidePanel({
  open,
  title,
  subtitle,
  onClose,
  size = "md",
  bare = false,
  guard = true,
  children,
}: SidePanelProps) {
  const confirm = useConfirm();
  const id = useId();
  const dirty = useRef(false);
  const panelRef = useRef<HTMLElement>(null);

  const requestClose = useCallback(async () => {
    if (guard && dirty.current) {
      const ok = await confirm({
        title: "Bỏ thay đổi chưa lưu?",
        description: "Những gì bạn vừa nhập sẽ mất.",
        confirmLabel: "Bỏ thay đổi",
        cancelLabel: "Tiếp tục nhập",
        destructive: true,
      });
      if (!ok) return;
    }
    onClose();
  }, [confirm, onClose, guard]);

  useEffect(() => {
    if (!open) return;
    dirty.current = false;
    const prevFocus = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();
    openStack.push(id);
    const onKey = (e: KeyboardEvent) => {
      // Hộp thoại xác nhận đang mở (nằm ngoài panel) tự xử lý Esc của nó;
      // nhiều panel lồng nhau thì chỉ cái trên cùng đóng.
      if (
        e.key === "Escape" &&
        openStack[openStack.length - 1] === id &&
        !document.querySelector("[data-confirm-dialog]")
      ) {
        void requestClose();
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      const i = openStack.lastIndexOf(id);
      if (i >= 0) openStack.splice(i, 1);
      // Còn panel khác bên dưới thì giữ khoá cuộn của nó.
      if (openStack.length === 0) document.body.style.overflow = "";
      prevFocus?.focus?.();
    };
  }, [open, requestClose, id]);

  if (!open) return null;

  // Portal ra <body>: panel lồng trong panel (vd. thêm quan hệ trong Chi tiết người)
  // không bị `transform` của panel cha làm lệch `position: fixed`.
  return createPortal(
    <div className="print-hide fixed inset-0 z-50 flex justify-end bg-black/40 animate-in fade-in">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Đóng"
        onClick={() => void requestClose()}
        className="absolute inset-0 cursor-default"
      />
      <aside
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex h-full min-h-0 w-full flex-col border-l bg-background shadow-xl outline-none animate-in slide-in-from-right duration-200 sm:w-[32rem] ${
          size === "lg" ? "lg:w-[40rem]" : ""
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        <header className="flex shrink-0 items-start gap-3 border-b px-4 pb-3 pt-4 sm:px-5">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={() => void requestClose()}
            aria-label="Đóng"
            className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <IconX className="h-5 w-5" />
          </button>
        </header>
        {/* min-h-0 + flex-1: để thân cuộn được trong cột flex. Không padding đáy
            vì form có thanh hành động dính đáy tự mang padding. */}
        <div
          className={
            bare
              ? "flex min-h-0 flex-1 flex-col"
              : "min-h-0 flex-1 overflow-y-auto px-4 pt-4 [scrollbar-gutter:stable] sm:px-5"
          }
          onInput={() => {
            dirty.current = true;
          }}
          onChange={() => {
            dirty.current = true;
          }}
          onSubmit={() => {
            dirty.current = false;
          }}
        >
          {bare ? (
            children
          ) : (
            // Cột flex cao tối thiểu bằng thân panel: gốc của form + <form> giãn hết
            // chiều cao để thanh nút (mt-auto) luôn nằm sát đáy ngăn kéo.
            <InSidePanelContext.Provider value>
              <div className="flex min-h-full flex-col [&>*]:flex [&>*]:flex-1 [&>*]:flex-col [&_form]:flex [&_form]:flex-1 [&_form]:flex-col">
                {children}
              </div>
            </InSidePanelContext.Provider>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
