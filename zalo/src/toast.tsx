import { useEffect, useState } from "react";

/**
 * Thông báo kết quả nổi trên cùng, tự tắt sau 1,5 giây — đúng kiểu "phản
 * hồi về kết quả dạng Modal" trong hướng dẫn thiết kế của Zalo Mini App:
 * việc quan trọng làm xong (lưu, thêm, xoá) phải báo cho người dùng biết,
 * không lặng lẽ quay về màn hình trước.
 *
 * Tự vẽ chứ không gọi showToast của Zalo để chạy được cả trên giả lập máy
 * tính lúc lập trình, và để lỗi với thành công dùng chung một chỗ hiện.
 */
type Toast = { id: number; text: string; kind: "ok" | "error" };

let push: ((t: Toast) => void) | null = null;
let seq = 0;

export function toast(text: string, kind: "ok" | "error" = "ok"): void {
  push?.({ id: ++seq, text, kind });
}

/** Lỗi hiện lâu hơn một chút: người dùng cần kịp đọc mới biết phải làm gì. */
const LIFE = { ok: 1500, error: 3500 };

export function ToastHost() {
  const [current, setCurrent] = useState<Toast | null>(null);
  useEffect(() => {
    push = setCurrent;
    return () => {
      push = null;
    };
  }, []);
  useEffect(() => {
    if (!current) return;
    const h = setTimeout(() => setCurrent(null), LIFE[current.kind]);
    return () => clearTimeout(h);
  }, [current]);

  if (!current) return null;
  return (
    <div className="toasthost" role="status" aria-live="polite">
      <div key={current.id} className={`toast ${current.kind}`}>{current.text}</div>
    </div>
  );
}
