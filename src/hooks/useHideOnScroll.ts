import { useEffect, useState } from "react";

/**
 * Ẩn khi cuộn XUỐNG, hiện lại khi cuộn LÊN (như nút nổi của các app điện thoại) — để nút không che nội dung đang
 * đọc. Gần đầu trang (< `topOffset`) luôn hiện. Bỏ qua dao động nhỏ (`threshold` px) và cú nảy đàn hồi của iOS ở
 * cuối trang. `disabled` (vd nhóm nút đang mở) thì luôn hiện.
 */
export function useHideOnScroll({
  threshold = 8,
  topOffset = 80,
  disabled = false,
}: { threshold?: number; topOffset?: number; disabled?: boolean } = {}) {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    if (disabled) {
      setHidden(false);
      return;
    }
    let last = window.scrollY;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        // Nảy đàn hồi (iOS) đẩy scrollY ra ngoài [0, max] — không tính là đổi hướng.
        if (y < 0 || y > max) return;
        if (y < topOffset) setHidden(false);
        else if (y - last > threshold) setHidden(true);
        else if (last - y > threshold) setHidden(false);
        else return; // dao động nhỏ: giữ mốc cũ để cộng dồn
        last = y;
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [threshold, topOffset, disabled]);
  return hidden;
}
