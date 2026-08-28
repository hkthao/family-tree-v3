import { Link } from "react-router-dom";

import type { CreditQuota } from "@/lib/queries/credits";

/**
 * "Còn 7/10 lượt" ở đầu khung chat.
 *
 * Với thứ đụng tới hạn mức thì **thà hiện thừa còn hơn để người ta phát
 * hiện sau** — hỏi ba câu rồi mới biết mình chỉ có mười lượt là cảm giác
 * bị gài. Nên số này hiện thường trực, không phải bấm vào đâu mới thấy.
 *
 * Ba trạng thái, đổi màu dần: bình thường → sắp hết (≤3) → hết. Không
 * dùng chữ đỏ cho "sắp hết" vì đó chưa phải lỗi của ai cả.
 *
 * `quota` null nghĩa là máy chủ chưa bật hạn mức (migration self-host áp
 * tay, có thể chậm hơn bản deploy) — lúc đó KHÔNG hiện gì, hiện "còn 0
 * lượt" mới là nói sai.
 */
export function QuotaBadge({
  quota,
  className = "",
}: {
  quota: CreditQuota | null;
  className?: string;
}) {
  if (!quota) return null;

  const { balance, freeThisMonth } = quota;
  // Mẫu số là số lượt free của tháng; mua thêm thì số dư vượt mẫu số nên
  // bỏ mẫu số đi cho khỏi khó hiểu ("15/10 lượt" đọc như lỗi).
  const text =
    balance > freeThisMonth || freeThisMonth <= 0
      ? `Còn ${balance} lượt`
      : `Còn ${balance}/${freeThisMonth} lượt`;

  const tone =
    balance <= 0
      ? "text-destructive"
      : balance <= 3
        ? "text-amber-600 dark:text-amber-500"
        : "text-muted-foreground";

  // Bấm được, dẫn sang sổ chi tiết: người dùng thấy con số là hỏi ngay
  // "sao lại còn bấy nhiêu" — phải có chỗ trả lời, không để họ tự đoán.
  return (
    <Link
      to="/account/luot-dung"
      className={`shrink-0 tabular-nums underline-offset-2 hover:underline ${tone} ${className}`}
      title={`Đã dùng ${quota.usedThisMonth} lượt trong tháng này — xem chi tiết`}
    >
      {text}
    </Link>
  );
}
