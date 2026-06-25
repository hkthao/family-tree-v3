import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Ghi âm "kể chuyện di sản" cho người lớn tuổi, TỐI ƯU DUNG LƯỢNG.
 *
 * Nén ngay trên trình duyệt bằng MediaRecorder + Opus mono ~24 kbps —
 * chuẩn cho giọng nói: ~3 KB/giây, 5 phút ≈ 0.9 MB. Không transcode phía
 * server (đỡ CPU/đĩa VPS). Giới hạn thời lượng để chặn file phình to.
 */

export const HERITAGE_AUDIO_MAX_SEC = 300; // 5 phút / đoạn
const AUDIO_BITRATE = 24_000; // 24 kbps mono — đủ rõ cho giọng nói

/** Chọn MIME được trình duyệt hỗ trợ + đuôi file tương ứng. */
export function pickAudioMime(): { mimeType: string; ext: string } {
  const candidates: { mimeType: string; ext: string }[] = [
    { mimeType: "audio/webm;codecs=opus", ext: "webm" },
    { mimeType: "audio/webm", ext: "webm" },
    { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
    { mimeType: "audio/mp4", ext: "m4a" }, // Safari / iOS
  ];
  const MR = typeof MediaRecorder !== "undefined" ? MediaRecorder : null;
  for (const c of candidates) {
    if (MR && MR.isTypeSupported(c.mimeType)) return c;
  }
  return { mimeType: "", ext: "webm" }; // để trình duyệt tự chọn
}

export function isAudioRecordingSupported(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined"
  );
}

export interface RecordedAudio {
  blob: Blob;
  ext: string;
  durationSec: number;
  url: string; // object URL để nghe thử
}

export type RecorderState = "idle" | "recording" | "recorded" | "denied" | "error";

export function useAudioRecorder(maxSeconds = HERITAGE_AUDIO_MAX_SEC) {
  const [state, setState] = useState<RecorderState>("idle");
  const [seconds, setSeconds] = useState(0);
  const [result, setResult] = useState<RecordedAudio | null>(null);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedAtRef = useRef<number>(0);
  const extRef = useRef<string>("webm");

  const cleanupStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(async () => {
    setError(null);
    if (!isAudioRecordingSupported()) {
      setState("error");
      setError("Thiết bị không hỗ trợ ghi âm.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const { mimeType, ext } = pickAudioMime();
      extRef.current = ext;
      const rec = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: AUDIO_BITRATE,
      });
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        const type = rec.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type });
        const durationSec = Math.max(
          1,
          Math.round((performance.now() - startedAtRef.current) / 1000),
        );
        const url = URL.createObjectURL(blob);
        setResult({ blob, ext: extRef.current, durationSec, url });
        setState("recorded");
        cleanupStream();
      };
      recorderRef.current = rec;
      startedAtRef.current = performance.now();
      setSeconds(0);
      rec.start();
      setState("recording");
      timerRef.current = setInterval(() => {
        const s = Math.round((performance.now() - startedAtRef.current) / 1000);
        setSeconds(s);
        if (s >= maxSeconds && rec.state === "recording") rec.stop();
      }, 250);
    } catch (e) {
      cleanupStream();
      const name = (e as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setError("Bạn chưa cho phép dùng micro. Hãy bật quyền micro rồi thử lại.");
      } else {
        setState("error");
        setError("Không ghi âm được. Vui lòng thử lại.");
      }
    }
  }, [cleanupStream, maxSeconds]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const reset = useCallback(() => {
    if (result?.url) URL.revokeObjectURL(result.url);
    setResult(null);
    setSeconds(0);
    setState("idle");
    setError(null);
  }, [result]);

  // dọn dẹp khi unmount
  useEffect(() => {
    return () => {
      cleanupStream();
      if (result?.url) URL.revokeObjectURL(result.url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { state, seconds, maxSeconds, result, error, start, stop, reset };
}
