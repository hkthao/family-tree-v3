import { useCallback, useEffect, useRef, useState } from "react";

import { useSpeechToText } from "@/hooks/useSpeechToText";
import { track } from "@/lib/analytics";
import { CANCEL_DY, decideRelease } from "@/lib/speech";

/**
 * Cử chỉ nút mic — bấm-giữ-để-nói **và** bấm-một-lần-bật.
 *
 * Vì sao phải có cả hai: giữ nút suốt 30 giây rất mỏi, tay người già lại
 * hay run nên dễ nhả hụt giữa câu. Nhưng bấm-giữ vẫn là cách nhanh nhất
 * cho câu ngắn. Một nút, hai cách dùng, phân biệt bằng thời gian giữ:
 *
 *   bấm rồi thả nhanh (< TAP_MS)  → "bật rồi để đó", bấm lần nữa mới dừng
 *   giữ lâu rồi thả               → gửi luôn câu vừa nói
 *   vuốt lên rồi thả              → huỷ, không gửi gì (như Zalo)
 *
 * Sau khi dừng, chữ đi đâu tuỳ cách dùng:
 *  - **giữ rồi thả**: gửi thẳng — người dùng đã ra dấu dứt khoát.
 *  - **bật rồi để đó**: đổ vào ô nhập cho đọc lại rồi tự bấm gửi. Kiểu này
 *    thường dùng cho câu dài, mà càng dài thì nhận dạng càng dễ sai.
 */

/**
 * Chờ chừng này ms sau khi dừng rồi mới gửi: `stop()` còn bắn nốt mẩu
 * cuối cùng, gửi ngay là mất chữ cuối. Không thấy được bằng mắt.
 */
const SETTLE_MS = 400;

export type MicMode = "idle" | "holding" | "locked";

export interface VoiceInput {
  supported: boolean;
  listening: boolean;
  mode: MicMode;
  transcript: string;
  seconds: number;
  error: string | null;
  /** Ngón tay đang ở vùng huỷ — để nút đổi màu cảnh báo. */
  nearCancel: boolean;
  clearError: () => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: (e: React.PointerEvent) => void;
  onPointerCancel: () => void;
}

const buzz = (ms: number) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* iOS không có, không sao */
  }
};

export function useVoiceInput({
  onSend,
  onDraft,
  disabled = false,
}: {
  /** Gửi thẳng câu vừa nói (kiểu giữ-rồi-thả). */
  onSend: (text: string) => void;
  /** Đổ vào ô nhập để đọc lại (kiểu bật-rồi-để-đó). */
  onDraft: (text: string) => void;
  disabled?: boolean;
}): VoiceInput {
  const speech = useSpeechToText();
  const [mode, setMode] = useState<MicMode>("idle");
  const [nearCancel, setNearCancel] = useState(false);

  const startYRef = useRef(0);
  const startedAtRef = useRef(0);
  // Chữ mới nhất, đọc được từ trong setTimeout — state đóng băng ở
  // closure cũ nên không dùng thẳng được.
  const textRef = useRef("");
  useEffect(() => {
    textRef.current = speech.transcript;
  }, [speech.transcript]);

  // Engine tự tắt (im lặng quá lâu, hoặc chạm trần MAX_LISTEN_SEC) trong
  // lúc đang ở chế độ "bật rồi để đó" → phải trả nút về idle, nếu không
  // nút hiện "đang nghe" mà máy đã ngừng nghe từ đời nào.
  useEffect(() => {
    if (!speech.listening && mode === "locked") {
      setMode("idle");
      if (textRef.current.trim()) onDraft(textRef.current.trim());
    }
  }, [speech.listening, mode, onDraft]);

  const finish = useCallback(
    (send: boolean) => {
      speech.stop();
      buzz(10);
      setMode("idle");
      setNearCancel(false);
      setTimeout(() => {
        const text = textRef.current.trim();
        if (!text) return;
        track("ai_voice_used");
        if (send) onSend(text);
        else onDraft(text);
      }, SETTLE_MS);
    },
    [onDraft, onSend, speech],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled || !speech.supported) return;
      // Đang ở chế độ bật-rồi-để-đó: chạm lần nữa là dừng, không phải bắt
      // đầu lượt mới.
      if (mode === "locked") {
        finish(false);
        return;
      }
      e.preventDefault();
      // Bắt con trỏ: ngón tay trượt ra ngoài nút vẫn nhận được move/up,
      // nếu không thì vuốt-lên-để-huỷ mất tiêu ngay khi rời khỏi nút.
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      startYRef.current = e.clientY;
      startedAtRef.current = Date.now();
      setNearCancel(false);
      setMode("holding");
      speech.start();
      buzz(10);
    },
    [disabled, finish, mode, speech],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== "holding") return;
      setNearCancel(e.clientY - startYRef.current <= -CANCEL_DY);
    },
    [mode],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (mode !== "holding") return;
      const dy = e.clientY - startYRef.current;
      const held = Date.now() - startedAtRef.current;
      const action = decideRelease(held, dy);
      if (action === "cancel") {
        speech.cancel();
        setMode("idle");
        setNearCancel(false);
        buzz(20);
        return;
      }
      if (action === "lock") {
        // Vẫn nghe tiếp; nút đổi sang trạng thái "đang nghe, bấm để dừng".
        setMode("locked");
        setNearCancel(false);
        return;
      }
      finish(true);
    },
    [finish, mode, speech],
  );

  const onPointerCancel = useCallback(() => {
    if (mode !== "holding") return;
    speech.cancel();
    setMode("idle");
    setNearCancel(false);
  }, [mode, speech]);

  return {
    supported: speech.supported,
    listening: speech.listening,
    mode,
    transcript: speech.transcript,
    seconds: speech.seconds,
    error: speech.error,
    nearCancel,
    clearError: speech.clearError,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
  };
}
