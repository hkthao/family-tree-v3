import { formatDate, formatDateTime, formatRelative } from "@/lib/formatDate";

/**
 * Dòng "Tạo {ngày tuyệt đối} • Cập nhật {tương đối}" dùng chung cho mọi
 * danh sách (dòng họ, danh bạ, mộ phần, di sản…).
 *
 * - "Tạo" hiển thị mốc cố định dd/mm/yyyy.
 * - "Cập nhật" hiển thị tương đối ("2 ngày trước") cho thân thiện.
 * - Rê chuột (title) hiện ngày + giờ đầy đủ.
 * - Tự ẩn khi không có ngày hợp lệ (vd: dữ liệu đọc qua view công khai
 *   không phơi metadata thời gian).
 */
export function RecordDates({
  createdAt,
  updatedAt,
  className,
}: {
  createdAt?: string | null;
  updatedAt?: string | null;
  className?: string;
}) {
  const created = formatDate(createdAt);
  const updated = formatRelative(updatedAt);
  if (!created && !updated) return null;
  const createdFull = formatDateTime(createdAt);
  const updatedFull = formatDateTime(updatedAt);
  return (
    <p
      className={className}
      title={[
        createdFull && `Tạo ${createdFull}`,
        updatedFull && `Cập nhật ${updatedFull}`,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      {[created && `Tạo ${created}`, updated && `Cập nhật ${updated}`]
        .filter(Boolean)
        .join(" • ")}
    </p>
  );
}
