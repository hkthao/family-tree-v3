import type { ReactNode } from "react";

/**
 * Một dòng "nhãn: giá trị" của các trang/ngăn kéo XEM chi tiết. Ưu tiên điện thoại: nhãn nhỏ nằm trên, giá trị nằm dưới
 * chiếm cả bề ngang (không bị cột nhãn bóp chữ); từ màn hình sm trở lên mới chia hai cột. Giá trị trống thì không hiện.
 */
export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  if (value === null || value === undefined || value === "" || value === false) return null;
  return (
    <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}
