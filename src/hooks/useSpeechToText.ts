import { useCallback, useEffect, useRef, useState } from "react";

import {
  getSpeechRecognition,
  MAX_LISTEN_SEC,
  mergeTranscript,
  speechErrorMessage,
  type SpeechRecognitionLike,
  type SpeechRecognitionResultEvent,
} from "@/lib/speech";

/**
 * Nghe giọng nói tiếng Việt và trả ra chữ, dùng Web Speech API.
 *
 * Ba chỗ đã xử lý, đều là chỗ mọi bản dựng ngây thơ vỡ:
 *
 * 1. **Trình duyệt tự dừng khi im lặng vài giây.** Ở chế độ "bật rồi để
 *    đó" mà dừng ngang thì người dùng đang nghĩ câu hỏi bỗng thấy máy tắt
 *    — nên `onend` sẽ tự bật lại chừng nào còn cờ `wantOn`. Có đếm số lần
 *    bật lại liên tiếp để không quay vòng vô hạn khi micro hỏng thật.
 * 2. **`stop()` và `abort()` khác nhau.** `stop` còn bắn nốt kết quả cuối
 *    (giữ được câu vừa nói), `abort` vứt luôn — đúng cho thao tác huỷ.
 * 3. **Tự tắt sau MAX_LISTEN_SEC.** Người già hay quên tắt; để máy nghe
 *    mãi vừa tốn pin vừa đáng ngại về riêng tư.
 *
 * Hook KHÔNG tự gửi câu hỏi đi — nó chỉ trả chữ. Quyết định gửi hay để
 * người dùng đọc lại rồi bấm gửi là việc của nút mic (xem MicButton).
 */

export interface SpeechToText {
  /** Trình duyệt có Web Speech không. Không có thì nút mic phải ẩn hẳn. */
  supported: boolean;
  listening: boolean;
  /** Chữ nghe được tới lúc này (đã chốt + đang đoán dở). */
  transcript: string;
  /** Số giây đã nghe — để hiện đồng hồ. */
  seconds: number;
  error: string | null;
  start: () => void;
  /** Dừng êm, giữ lại chữ vừa nghe. */
  stop: () => void;
  /** Vứt luôn, không giữ chữ. */
  cancel: () => void;
  clearError: () => void;
}

const MAX_RESTARTS = 3;

export function useSpeechToText(lang = "vi-VN"): SpeechToText {
  const [supported] = useState(() => getSpeechRecognition() !== null);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const committedRef = useRef("");
  // Người dùng CÒN muốn nghe hay không — khác với "engine đang chạy hay
  // không". Hai thứ này lệch nhau chính là lúc cần bật lại.
  const wantOnRef = useRef(false);
  const restartsRef = useRef(0);

  const teardown = useCallback(() => {
    const rec = recRef.current;
    if (!rec) return;
    rec.onresult = null;
    rec.onerror = null;
    rec.onend = null;
    recRef.current = null;
  }, []);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor || recRef.current) return;

    committedRef.current = "";
    restartsRef.current = 0;
    wantOnRef.current = true;
    setTranscript("");
    setSeconds(0);
    setError(null);

    const rec = new Ctor();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: SpeechRecognitionResultEvent) => {
      // Chỉ duyệt từ resultIndex: các kết quả trước đó đã chốt rồi, duyệt
      // lại là nhân đôi câu.
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const alt = e.results[i][0];
        if (!alt) continue;
        if (e.results[i].isFinal) {
          committedRef.current = mergeTranscript(
            committedRef.current,
            alt.transcript,
          );
        } else {
          interim = mergeTranscript(interim, alt.transcript);
        }
      }
      restartsRef.current = 0; // nghe được chữ = engine vẫn khoẻ
      setTranscript(mergeTranscript(committedRef.current, interim));
    };

    rec.onerror = (e: { error: string }) => {
      const msg = speechErrorMessage(e.error);
      if (msg) {
        setError(msg);
        wantOnRef.current = false; // lỗi thật thì đừng bật lại
      }
    };

    rec.onend = () => {
      // Im lặng vài giây là Chrome tự kết thúc. Còn muốn nghe thì bật lại.
      if (wantOnRef.current && restartsRef.current < MAX_RESTARTS) {
        restartsRef.current += 1;
        try {
          rec.start();
          return;
        } catch {
          /* bật lại không được thì coi như dừng hẳn */
        }
      }
      wantOnRef.current = false;
      teardown();
      setListening(false);
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch {
      // Gọi start() hai lần liên tiếp là ném lỗi — coi như chưa bật.
      setError(speechErrorMessage("unknown"));
    }
  }, [lang, teardown]);

  const stop = useCallback(() => {
    wantOnRef.current = false;
    recRef.current?.stop();
    setListening(false);
  }, []);

  const cancel = useCallback(() => {
    wantOnRef.current = false;
    recRef.current?.abort();
    committedRef.current = "";
    setTranscript("");
    setListening(false);
  }, []);

  // Đồng hồ + trần thời lượng.
  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        if (next >= MAX_LISTEN_SEC) stop();
        return next;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [listening, stop]);

  // Rời trang giữa chừng mà không tắt thì micro còn sáng đèn.
  useEffect(() => {
    return () => {
      wantOnRef.current = false;
      recRef.current?.abort();
      teardown();
    };
  }, [teardown]);

  return {
    supported,
    listening,
    transcript,
    seconds,
    error,
    start,
    stop,
    cancel,
    clearError: () => setError(null),
  };
}
