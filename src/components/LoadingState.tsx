import { cn } from "@/lib/utils";

interface LoadingProps {
  /** Nhãn cạnh spinner. Mặc định "Đang tải…". */
  label?: string;
  /** Căn giữa toàn màn hình (min-h-dvh) — dùng cho loading cả trang. */
  fullscreen?: boolean;
  className?: string;
}

/**
 * Trạng thái tải dùng chung — thay cho các đoạn "Đang tải…" thô rải rác,
 * để nhịp chờ nhất quán khắp app. Cùng họ với [[EmptyState]] / [[ErrorState]].
 */
export function LoadingState({
  label = "Đang tải…",
  fullscreen,
  className,
}: LoadingProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-center gap-3 text-muted-foreground",
        fullscreen ? "min-h-dvh" : "py-10",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="h-5 w-5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary"
      />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/**
 * Khối skeleton nhấp nháy — dùng làm placeholder cho nội dung đang tải
 * (dòng chữ, thẻ, ảnh). Truyền kích thước qua className.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-muted/60", className)}
    />
  );
}
