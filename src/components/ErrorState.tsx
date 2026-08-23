import { Button } from "@/components/ui/button";
import { IconRefresh } from "@/components/icons";

/**
 * Chuyển thông báo lỗi kỹ thuật (thường tiếng Anh từ Supabase/mạng)
 * thành câu tiếng Việt dễ hiểu cho người dùng cuối. Không nuốt lỗi gốc —
 * nơi gọi vẫn nên log nếu cần chẩn đoán.
 */
export function friendlyError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  const m = raw.toLowerCase();
  if (!raw) return "Đã có lỗi xảy ra. Vui lòng thử lại.";
  if (
    m.includes("failed to fetch") ||
    m.includes("networkerror") ||
    m.includes("network request failed") ||
    m.includes("load failed")
  )
    return "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
  if (
    m.includes("jwt") ||
    m.includes("expired") ||
    m.includes("not authenticated") ||
    m.includes("invalid claim")
  )
    return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (
    m.includes("permission") ||
    m.includes("rls") ||
    m.includes("row-level security") ||
    m.includes("not allowed") ||
    m.includes("forbidden") ||
    m.includes("403")
  )
    return "Bạn không có quyền thực hiện thao tác này.";
  if (
    m.includes("not found") ||
    m.includes("404") ||
    m.includes("does not exist")
  )
    return "Không tìm thấy dữ liệu — có thể đã bị xoá hoặc đổi liên kết.";
  if (
    m.includes("duplicate") ||
    m.includes("unique") ||
    m.includes("already exists")
  )
    return "Dữ liệu đã tồn tại (trùng lặp).";
  if (m.includes("timeout") || m.includes("timed out"))
    return "Máy chủ phản hồi chậm. Vui lòng thử lại.";
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

interface Props {
  error?: unknown;
  /** Tiêu đề — mặc định "Không tải được dữ liệu". */
  title?: string;
  /** Nếu truyền, hiện nút "Thử lại". */
  onRetry?: () => void;
  className?: string;
}

/**
 * Thẻ lỗi thân thiện dùng chung — thay cho việc render thẳng
 * `(error as Error).message` (chuỗi kỹ thuật/tiếng Anh) ra cho người
 * dùng cuối. Đồng bộ hình thức với [[EmptyState]].
 */
export function ErrorState({
  error,
  title = "Không tải được dữ liệu",
  onRetry,
  className,
}: Props) {
  return (
    <div
      role="alert"
      className={`rounded-lg border bg-card text-center py-10 px-6 space-y-4 ${className ?? ""}`}
    >
      <div className="space-y-1.5">
        <h3 className="clan-name text-xl font-semibold text-destructive">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          {friendlyError(error)}
        </p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <IconRefresh className="h-4 w-4 mr-1.5" />
          Thử lại
        </Button>
      )}
    </div>
  );
}
