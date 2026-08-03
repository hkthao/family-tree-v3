import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
}

type Resolver = (ok: boolean) => void;

const Ctx = createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null);

interface Pending {
  opts: ConfirmOptions;
  resolve: Resolver;
}

/**
 * Provider for an in-app confirm dialog that matches the seal-red /
 * paper brand instead of the native browser dialog. Render once near
 * the root of the React tree (App.tsx wraps Routes with this).
 *
 * Usage:
 *   const confirm = useConfirm();
 *   const ok = await confirm({ title: "Xoá ảnh?", destructive: true });
 *   if (ok) deletePhoto();
 */
export function ConfirmDialogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [pending, setPending] = useState<Pending | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ opts, resolve });
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    setPending((p) => {
      p?.resolve(ok);
      return null;
    });
  }, []);

  // ESC huỷ · Enter đồng ý · Tab bị giữ trong hộp thoại (focus-trap) ·
  // trả focus về phần tử đang focus trước đó khi đóng (a11y).
  useEffect(() => {
    if (!pending) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(false);
        return;
      }
      if (e.key === "Enter") {
        close(true);
        return;
      }
      if (e.key === "Tab") {
        const root = dialogRef.current;
        if (!root) return;
        const f = root.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (f.length === 0) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      prevFocus?.focus?.();
    };
  }, [pending, close]);

  return (
    <Ctx.Provider value={confirm}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 animate-in fade-in"
          onClick={() => close(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            ref={dialogRef}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-lg border bg-card shadow-lg overflow-hidden"
          >
            <div className="px-5 pt-5 pb-2">
              <h2 className="text-lg font-semibold text-foreground">
                {pending.opts.title}
              </h2>
              {pending.opts.description && (
                <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">
                  {pending.opts.description}
                </p>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-muted/30 border-t">
              <Button
                size="sm"
                variant="outline"
                onClick={() => close(false)}
              >
                {pending.opts.cancelLabel ?? "Huỷ"}
              </Button>
              <Button
                size="sm"
                data-testid="confirm-dialog-confirm"
                variant={pending.opts.destructive ? "destructive" : "default"}
                onClick={() => close(true)}
                autoFocus
              >
                {pending.opts.confirmLabel ?? "Đồng ý"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Ctx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useConfirm() must be called inside ConfirmDialogProvider");
  }
  return ctx;
}
