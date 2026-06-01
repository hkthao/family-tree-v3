import { createContext, useCallback, useContext, useEffect, useState } from "react";

import {
  IconCheck,
  IconX,
} from "@/components/icons";

type ToastKind = "success" | "error" | "info";

interface ToastEntry {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
}

interface ToastOptions {
  description?: string;
  /** Custom auto-dismiss in ms. Defaults to 3500. Pass 0 to keep
   *  until the user closes. */
  durationMs?: number;
}

interface ToastApi {
  success: (title: string, opts?: ToastOptions) => void;
  error: (title: string, opts?: ToastOptions) => void;
  info: (title: string, opts?: ToastOptions) => void;
}

const Ctx = createContext<ToastApi | null>(null);

const DEFAULT_DURATION = 3500;

/**
 * Top-right toast stack. Provider lives at the App root; any
 * component can `const toast = useToast()` and call
 * `toast.success("Đã lưu")`. Toasts survive client-side navigation
 * because the provider is mounted above <Routes/>.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastEntry[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, title: string, opts?: ToastOptions) => {
      const id = Date.now() + Math.random();
      setToasts((prev) => [...prev, { id, kind, title, description: opts?.description }]);
      const duration = opts?.durationMs ?? DEFAULT_DURATION;
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
    },
    [dismiss],
  );

  const api: ToastApi = {
    success: (title, opts) => push("success", title, opts),
    error: (title, opts) => push("error", title, opts),
    info: (title, opts) => push("info", title, opts),
  };

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        className="fixed top-4 right-4 z-[60] flex flex-col gap-2 max-w-sm pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => (
          <ToastCard key={t.id} toast={t} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(Ctx);
  if (!ctx) {
    throw new Error("useToast() must be called inside ToastProvider");
  }
  return ctx;
}

// ─── Internal toast card ──────────────────────────────────────────

function ToastCard({
  toast,
  onClose,
}: {
  toast: ToastEntry;
  onClose: () => void;
}) {
  const [entering, setEntering] = useState(true);
  useEffect(() => {
    const r = requestAnimationFrame(() => setEntering(false));
    return () => cancelAnimationFrame(r);
  }, []);

  const palette = COLORS[toast.kind];

  return (
    <div
      className={`pointer-events-auto rounded-md border bg-card shadow-md px-3 py-2.5 flex items-start gap-2.5 transition-all duration-200 ${
        entering ? "opacity-0 translate-x-2" : "opacity-100 translate-x-0"
      }`}
      role="status"
    >
      <span
        className={`shrink-0 inline-flex items-center justify-center h-6 w-6 rounded-full ${palette.bg}`}
        aria-hidden="true"
      >
        <ToastIcon kind={toast.kind} className={`h-3.5 w-3.5 ${palette.fg}`} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium leading-tight">{toast.title}</p>
        {toast.description && (
          <p className="mt-0.5 text-xs text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Đóng"
        className="shrink-0 -mr-1 -mt-1 h-6 w-6 inline-flex items-center justify-center rounded text-muted-foreground hover:bg-muted"
      >
        <IconX className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

const COLORS: Record<ToastKind, { bg: string; fg: string }> = {
  success: { bg: "bg-accent/30", fg: "text-accent" },
  error: { bg: "bg-destructive/15", fg: "text-destructive" },
  info: { bg: "bg-primary/15", fg: "text-primary" },
};

function ToastIcon({
  kind,
  className,
}: {
  kind: ToastKind;
  className?: string;
}) {
  if (kind === "success") return <IconCheck className={className} />;
  // error + info share the X icon for now (info dots arguably nicer,
  // but the X with a different palette reads as a status icon fine).
  if (kind === "error") return <IconX className={className} />;
  return <IconCheck className={className} />;
}
