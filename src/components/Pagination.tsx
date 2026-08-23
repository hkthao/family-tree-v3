import {
  IconArrowLeft,
  IconArrowRight,
  IconList,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

/**
 * Component phân trang chuẩn cho toàn app — style lấy từ `/people`
 * làm canonical. Cấu trúc:
 *
 *   X–Y / total {unit}              [N/trang ▾]  ← Trước  P/TP  Sau →
 *   (đang tải… nếu isFetching)
 *
 * Chú ý:
 *  - `total`, `pageSize` là bắt buộc để render khoảng "X–Y / total".
 *  - `unit` (vd. "người", "bài", "video") là suffix tuỳ chọn.
 *  - `pageSizeOptions` hiển thị <select> đổi số/trang. Nếu không
 *    truyền → ẩn select.
 *  - Buttons luôn hiển thị (disabled khi không đi tiếp được) để vị
 *    trí UI không bị thay đổi giữa các trang.
 */
export function Pagination({
  page,
  totalPages,
  total,
  pageSize,
  unit,
  isFetching = false,
  onPageChange,
  pageSizeOptions,
  onPageSizeChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Suffix sau số tổng, vd. "người" → "100 người". */
  unit?: string;
  isFetching?: boolean;
  onPageChange: (p: number) => void;
  pageSizeOptions?: ReadonlyArray<number>;
  onPageSizeChange?: (size: number) => void;
}) {
  const totalLabel =
    total > 0
      ? `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} / ${total}${unit ? ` ${unit}` : ""}`
      : "—";

  return (
    <div className="flex items-center justify-between flex-wrap gap-3 text-sm">
      <div className="text-muted-foreground">
        {totalLabel}
        {isFetching && <span className="ml-2 italic">đang tải…</span>}
      </div>

      {/* flex-wrap: ở màn 360px, ô "N/trang" cộng hai nút Trước/Sau
          rộng hơn khung — không cho xuống dòng thì nút Trước bị đẩy
          khuất khỏi mép trái, bấm không tới. */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {pageSizeOptions && onPageSizeChange && (
          <label className="text-muted-foreground">
            <span className="sr-only">Số dòng mỗi trang</span>
            <Select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              icon={<IconList />}
              className="ml-1 h-10 w-auto"
            >
              {pageSizeOptions.map((n) => (
                <option key={n} value={n}>
                  {n}/trang
                </option>
              ))}
            </Select>
          </label>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Trang trước"
        >
          <IconArrowLeft className="h-4 w-4 mr-1" />
          Trước
        </Button>
        <span className="px-2 tabular-nums">
          {page}/{totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Trang sau"
        >
          Sau
          <IconArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
