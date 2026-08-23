import { useEffect, useState } from "react";

/**
 * Chiều cao khả kiến THẬT của viewport, có tính bàn phím ảo.
 *
 * Vì sao cần: `100dvh` chỉ co giãn theo thanh URL, **không** phản ứng
 * khi bàn phím iOS bật lên. Dùng `dvh` cho khung chat sẽ dẫn tới lỗi
 * kinh điển — ô nhập nằm dưới bàn phím, người dùng gõ mà không thấy
 * mình gõ gì.
 *
 * Phải nghe cả `resize` LẪN `scroll`: iOS bắn `scroll` trên
 * visualViewport khi bàn phím trượt lên, không phải `resize`.
 *
 * Trả về:
 *  - `height`  — chiều cao khả kiến (px), đã trừ bàn phím.
 *  - `offsetTop` — phần bị đẩy lên khi iOS cuộn layout viewport.
 *  - `keyboardOpen` — suy ra từ độ hụt so với `innerHeight`.
 *
 * Trình duyệt không có `visualViewport` (rất cũ) thì rơi về
 * `innerHeight`, tức hành vi như trước — không vỡ, chỉ kém chính xác.
 */

export interface VisualViewport {
  height: number;
  offsetTop: number;
  keyboardOpen: boolean;
}

/** Hụt hơn ngần này px so với innerHeight thì coi như bàn phím đang mở. */
const KEYBOARD_THRESHOLD = 120;

function read(): VisualViewport {
  if (typeof window === "undefined") {
    return { height: 0, offsetTop: 0, keyboardOpen: false };
  }
  const vv = window.visualViewport;
  if (!vv) {
    return { height: window.innerHeight, offsetTop: 0, keyboardOpen: false };
  }
  return {
    height: vv.height,
    offsetTop: vv.offsetTop,
    keyboardOpen: window.innerHeight - vv.height > KEYBOARD_THRESHOLD,
  };
}

export function useVisualViewport(): VisualViewport {
  const [state, setState] = useState<VisualViewport>(read);

  useEffect(() => {
    const vv = window.visualViewport;
    // rAF gộp burst sự kiện lúc bàn phím trượt — iOS bắn rất dày.
    let frame = 0;
    const onChange = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => setState(read()));
    };

    if (vv) {
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
    }
    window.addEventListener("orientationchange", onChange);

    return () => {
      cancelAnimationFrame(frame);
      if (vv) {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
      }
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return state;
}
