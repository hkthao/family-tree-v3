/**
 * @vitest-environment jsdom
 *
 * Khai báo bằng docblock chứ không trông vào `environmentMatchGlobs` trong
 * vitest.config.ts: Vitest 4 đã bỏ tuỳ chọn đó, glob ở đấy giờ không có tác
 * dụng nữa (chưa ai phát hiện vì repo chưa từng có test component).
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useVoiceInput } from "@/hooks/useVoiceInput";
import type {
  SpeechRecognitionLike,
  SpeechRecognitionResultEvent,
} from "@/lib/speech";

/**
 * Kiểm phần nối giữa cử chỉ nút mic và engine nhận dạng.
 *
 * `decideRelease` đã có test riêng ở speech.test.ts; ở đây kiểm thứ khác:
 * giữ-rồi-thả có GỬI thật không, bấm-một-lần có đổ vào ô nhập không, và
 * vuốt-lên có thật sự không gửi gì. Đó là chỗ hỏng thì người dùng mất câu
 * vừa nói — không thể chỉ trông vào TypeScript.
 */

class FakeRecognition implements SpeechRecognitionLike {
  static last: FakeRecognition | null = null;
  lang = "";
  continuous = false;
  interimResults = false;
  started = false;
  aborted = false;
  onresult: ((e: SpeechRecognitionResultEvent) => void) | null = null;
  onerror: ((e: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;

  constructor() {
    FakeRecognition.last = this;
  }
  start() {
    this.started = true;
  }
  stop() {
    this.started = false;
  }
  abort() {
    this.started = false;
    this.aborted = true;
  }
  /** Giả lập engine nghe được một mẩu. */
  say(text: string, isFinal = true) {
    this.onresult?.({
      resultIndex: 0,
      results: Object.assign([Object.assign([{ transcript: text }], { isFinal })], {
        length: 1,
      }) as unknown as SpeechRecognitionResultEvent["results"],
    });
  }
}

/** Sự kiện con trỏ tối thiểu mà hook cần. */
const pointer = (clientY: number) =>
  ({
    clientY,
    pointerId: 1,
    preventDefault: () => {},
    currentTarget: { setPointerCapture: () => {} },
  }) as unknown as React.PointerEvent;

describe("useVoiceInput", () => {
  let onSend: ReturnType<typeof vi.fn<(text: string) => void>>;
  let onDraft: ReturnType<typeof vi.fn<(text: string) => void>>;

  beforeEach(() => {
    vi.useFakeTimers();
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
      FakeRecognition;
    onSend = vi.fn<(text: string) => void>();
    onDraft = vi.fn<(text: string) => void>();
  });

  afterEach(() => {
    vi.useRealTimers();
    FakeRecognition.last = null;
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  });

  const setup = () =>
    renderHook(() => useVoiceInput({ onSend, onDraft }));

  it("giữ lâu rồi thả thì GỬI câu vừa nói", () => {
    const { result } = setup();
    act(() => result.current.onPointerDown(pointer(500)));
    expect(FakeRecognition.last?.started).toBe(true);
    expect(FakeRecognition.last?.lang).toBe("vi-VN");

    act(() => FakeRecognition.last!.say("Giỗ ông nội năm nay ngày mấy"));
    act(() => {
      vi.advanceTimersByTime(2000); // giữ đủ lâu để không thành "bật rồi để đó"
    });
    act(() => result.current.onPointerUp(pointer(500)));
    act(() => {
      vi.runAllTimers(); // chờ mẩu cuối lắng xuống
    });

    expect(onSend).toHaveBeenCalledWith("Giỗ ông nội năm nay ngày mấy");
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("bấm rồi thả nhanh thì nghe tiếp; bấm lần nữa mới dừng và ĐỔ VÀO Ô NHẬP", () => {
    const { result } = setup();
    act(() => result.current.onPointerDown(pointer(500)));
    act(() => result.current.onPointerUp(pointer(500))); // thả ngay = bật rồi để đó
    expect(result.current.mode).toBe("locked");
    expect(FakeRecognition.last?.started).toBe(true);

    act(() => FakeRecognition.last!.say("Nhà mình bao nhiêu người"));
    act(() => result.current.onPointerDown(pointer(500))); // chạm lần nữa = dừng
    act(() => {
      vi.runAllTimers();
    });

    // Câu dài dễ nhận dạng sai, nên cho đọc lại chứ không gửi thẳng.
    expect(onDraft).toHaveBeenCalledWith("Nhà mình bao nhiêu người");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("vuốt lên rồi thả thì HUỶ — không gửi, không đổ vào ô nhập", () => {
    const { result } = setup();
    act(() => result.current.onPointerDown(pointer(500)));
    act(() => FakeRecognition.last!.say("bỏ đi"));
    act(() => result.current.onPointerMove(pointer(400)));
    expect(result.current.nearCancel).toBe(true);

    act(() => result.current.onPointerUp(pointer(400)));
    act(() => {
      vi.runAllTimers();
    });

    expect(FakeRecognition.last?.aborted).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
    expect(onDraft).not.toHaveBeenCalled();
  });

  it("engine tự tắt lúc đang 'bật rồi để đó' thì nút trở về idle, chữ không mất", () => {
    const { result } = setup();
    act(() => result.current.onPointerDown(pointer(500)));
    act(() => result.current.onPointerUp(pointer(500)));
    act(() => FakeRecognition.last!.say("giỗ cụ tổ"));

    // Engine dừng hẳn sau khi đã hết lượt bật lại.
    const rec = FakeRecognition.last!;
    act(() => {
      rec.start = () => {
        throw new Error("hết lượt");
      };
      rec.onend?.();
    });

    expect(result.current.mode).toBe("idle");
    expect(onDraft).toHaveBeenCalledWith("giỗ cụ tổ");
  });

  it("trình duyệt không có Web Speech thì báo không hỗ trợ và bấm không làm gì", () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
    const { result } = setup();
    expect(result.current.supported).toBe(false);
    act(() => result.current.onPointerDown(pointer(500)));
    expect(result.current.mode).toBe("idle");
  });
});
