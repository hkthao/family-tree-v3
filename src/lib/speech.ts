/**
 * Nhận dạng giọng nói tiếng Việt cho trợ lý — phần logic thuần.
 *
 * Vì sao tách riêng khỏi hook: cử chỉ nút mic (bấm-giữ hay bấm-một-lần,
 * vuốt lên để huỷ) là chỗ dễ sai nhất và cũng là chỗ dễ test nhất. Để
 * trong component thì chỉ kiểm được bằng tay trên máy thật.
 *
 * Chọn Web Speech API chứ không phải Whisper cho bước đầu: **miễn phí**,
 * chạy ngay trên máy, không upload — xem docs/plan-ai-tro-ly.md §GĐ 2.
 * Nhược điểm là iOS Safari không có; ở đó nút mic tự ẩn, người dùng vẫn
 * gõ được như cũ (Whisper dự phòng để GĐ sau, còn chờ quyết tự host hay
 * gọi OpenAI).
 */

/** Bấm rồi thả nhanh hơn ngần này = có ý "bật rồi để đó", không phải giữ. */
export const TAP_MS = 400;
/** Vuốt LÊN quá ngần này px = huỷ, như Zalo. */
export const CANCEL_DY = 60;
/** Tự dừng sau ngần này giây — quên tắt thì máy không nghe mãi. */
export const MAX_LISTEN_SEC = 60;

export type ReleaseAction = "cancel" | "lock" | "send";

/**
 * Thả tay ra thì làm gì.
 *
 * `dy` là **độ dịch dọc** của ngón tay so với lúc bấm xuống (âm = đi lên).
 *
 * Thứ tự kiểm rất quan trọng: **huỷ phải xét trước** thời gian giữ. Vuốt
 * lên rồi thả cái rụp vẫn phải là huỷ, chứ không được thành "bật rồi để
 * đó" — người dùng đã ra dấu bỏ, mà máy lại tiếp tục nghe thì đúng nghĩa
 * phản tác dụng.
 */
export function decideRelease(heldMs: number, dy: number): ReleaseAction {
  if (dy <= -CANCEL_DY) return "cancel";
  if (heldMs < TAP_MS) return "lock";
  return "send";
}

/**
 * Ghép phần đã chốt với phần đang đoán dở thành câu để hiện lên ô nhập.
 *
 * Web Speech bắn liên tục hai loại kết quả: `isFinal` (đã chốt, không đổi
 * nữa) và tạm (còn sửa tới sửa lui). Hiện cả hai để người nói thấy chữ
 * chạy ra ngay — im lặng vài giây là các cụ tưởng máy hỏng.
 */
export function mergeTranscript(committed: string, interim: string): string {
  return [committed.trim(), interim.trim()].filter(Boolean).join(" ");
}

/** `95` → `"1:35"`. Đồng hồ đếm lên khi đang ghi, để biết máy còn nghe. */
export function formatListenTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Mã lỗi của Web Speech → câu tiếng Việt nói được cho người dùng.
 *
 * `no-speech` KHÔNG phải lỗi để báo đỏ: nó chỉ có nghĩa là chưa nghe thấy
 * gì. Báo lỗi ở đây làm người ta tưởng máy hỏng trong khi họ chỉ chưa nói.
 */
export function speechErrorMessage(code: string): string | null {
  switch (code) {
    case "no-speech":
    case "aborted":
      return null;
    case "not-allowed":
    case "service-not-allowed":
      return "Trình duyệt chưa cho phép dùng micro. Bật lại trong cài đặt trang rồi thử lần nữa.";
    case "audio-capture":
      return "Không tìm thấy micro. Kiểm tra micro của máy giúp nhé.";
    case "network":
      return "Mạng đang yếu nên chưa nghe được. Thử lại giúp nhé.";
    default:
      return "Chưa nghe được. Bạn thử nói lại, hoặc gõ câu hỏi cũng được.";
  }
}

/** Kiểu tối thiểu của Web Speech — TS DOM chưa khai báo sẵn. */
export interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}

export interface SpeechRecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<
    ArrayLike<{ transcript: string }> & { isFinal: boolean }
  >;
}

type Ctor = new () => SpeechRecognitionLike;

/**
 * Lấy hàm dựng Web Speech nếu trình duyệt có.
 *
 * Chrome/Edge/Android dùng tiền tố `webkit`; đọc cả hai tên để không phải
 * sửa lại khi bản chuẩn phổ biến hơn.
 */
export function getSpeechRecognition(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: Ctor;
    webkitSpeechRecognition?: Ctor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export const isSpeechSupported = (): boolean => getSpeechRecognition() !== null;
