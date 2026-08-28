/// <reference types="@testing-library/jest-dom" />
/**
 * @vitest-environment jsdom
 *
 * `toBeInTheDocument` được nạp ở src/test/setup.ts; dòng reference phía trên
 * chỉ để tsc thấy kiểu — tsconfig.test.json không khai báo types sẵn.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChatComposer } from "@/components/ai/ChatComposer";

/**
 * Nút nào hiện lúc nào — chỗ này từng sai một lần: đang nghe mà ô nhập đã có
 * chữ thì nút mic bị nút gửi thế chỗ, tức người dùng bật nghe rồi không còn
 * nút nào để bấm dừng.
 */

class FakeRecognition {
  lang = "";
  continuous = false;
  interimResults = false;
  onresult: unknown = null;
  onerror: unknown = null;
  onend: unknown = null;
  start() {}
  stop() {}
  abort() {}
}

const props = {
  draft: "",
  onDraftChange: () => {},
  onSend: () => {},
  pending: false,
  showSuggestions: false,
};

describe("ChatComposer — mic và nút gửi", () => {
  beforeEach(() => {
    (window as unknown as { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition =
      FakeRecognition;
    // jsdom chưa có API bắt con trỏ.
    Element.prototype.setPointerCapture = vi.fn();
  });

  afterEach(() => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
  });

  it("ô nhập trống thì hiện mic, không hiện nút gửi", () => {
    render(<ChatComposer {...props} />);
    expect(screen.getByLabelText("Bấm giữ để nói")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gửi")).not.toBeInTheDocument();
  });

  it("có chữ rồi thì mic nhường chỗ cho nút gửi", () => {
    render(<ChatComposer {...props} draft="giỗ ông nội" />);
    expect(screen.getByLabelText("Gửi")).toBeInTheDocument();
    expect(screen.queryByLabelText("Bấm giữ để nói")).not.toBeInTheDocument();
  });

  it("đang nghe thì vẫn còn nút mic để bấm dừng, dù ô nhập đã có chữ", () => {
    // Đúng luồng thật: bật nghe lúc ô nhập còn trống, chữ đổ vào dần trong
    // lúc đang nghe.
    const { rerender } = render(<ChatComposer {...props} />);
    fireEvent.pointerDown(screen.getByLabelText("Bấm giữ để nói"), {
      clientY: 500,
    });
    rerender(<ChatComposer {...props} draft="giỗ ông nội" />);

    expect(screen.getByLabelText("Dừng nói")).toBeInTheDocument();
    expect(screen.queryByLabelText("Gửi")).not.toBeInTheDocument();
  });

  it("trình duyệt không nhận dạng được giọng nói thì mic ẩn hẳn", () => {
    delete (window as unknown as { webkitSpeechRecognition?: unknown })
      .webkitSpeechRecognition;
    render(<ChatComposer {...props} />);
    expect(screen.queryByLabelText("Bấm giữ để nói")).not.toBeInTheDocument();
    // Vẫn còn nút gửi (đang tắt) để người dùng gõ tay như cũ.
    expect(screen.getByLabelText("Gửi")).toBeInTheDocument();
  });
});
