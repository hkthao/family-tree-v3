import { describe, expect, it } from "vitest";

import {
  CANCEL_DY,
  decideRelease,
  formatListenTime,
  mergeTranscript,
  speechErrorMessage,
  TAP_MS,
} from "@/lib/speech";

describe("decideRelease — cử chỉ nút mic", () => {
  it("giữ lâu rồi thả = gửi", () => {
    expect(decideRelease(TAP_MS + 1, 0)).toBe("send");
    expect(decideRelease(5000, 10)).toBe("send");
  });

  it("bấm rồi thả nhanh = bật rồi để đó", () => {
    expect(decideRelease(0, 0)).toBe("lock");
    expect(decideRelease(TAP_MS - 1, 0)).toBe("lock");
  });

  it("vuốt lên đủ xa = huỷ", () => {
    expect(decideRelease(5000, -CANCEL_DY)).toBe("cancel");
    expect(decideRelease(5000, -200)).toBe("cancel");
  });

  it("vuốt lên rồi thả NGAY vẫn là huỷ, không thành bật-rồi-để-đó", () => {
    // Ca này là lý do huỷ phải xét trước thời gian giữ: người dùng đã ra
    // dấu bỏ mà máy vẫn nghe tiếp thì đúng nghĩa phản tác dụng.
    expect(decideRelease(0, -100)).toBe("cancel");
  });

  it("vuốt xuống không huỷ — chỉ vuốt LÊN mới là ra dấu bỏ", () => {
    expect(decideRelease(5000, 200)).toBe("send");
  });

  it("nhích tay chưa tới ngưỡng thì vẫn gửi", () => {
    expect(decideRelease(5000, -(CANCEL_DY - 1))).toBe("send");
  });
});

describe("mergeTranscript", () => {
  it("ghép phần đã chốt với phần đang đoán dở", () => {
    expect(mergeTranscript("Giỗ ông nội", "năm nay")).toBe("Giỗ ông nội năm nay");
  });

  it("bỏ khoảng trắng thừa, không để lại dấu cách mồ côi", () => {
    expect(mergeTranscript("", "  Chào  ")).toBe("Chào");
    expect(mergeTranscript("Chào", "")).toBe("Chào");
    expect(mergeTranscript("", "")).toBe("");
  });
});

describe("formatListenTime", () => {
  it("đếm giây thành phút:giây", () => {
    expect(formatListenTime(0)).toBe("0:00");
    expect(formatListenTime(9)).toBe("0:09");
    expect(formatListenTime(95)).toBe("1:35");
  });

  it("không hiện số âm", () => {
    expect(formatListenTime(-3)).toBe("0:00");
  });
});

describe("speechErrorMessage", () => {
  it("chưa nghe thấy gì thì KHÔNG báo lỗi", () => {
    // Báo đỏ ở đây làm người dùng tưởng máy hỏng trong khi họ chưa nói.
    expect(speechErrorMessage("no-speech")).toBeNull();
    expect(speechErrorMessage("aborted")).toBeNull();
  });

  it("bị chặn quyền micro thì nói rõ cách sửa", () => {
    expect(speechErrorMessage("not-allowed")).toMatch(/cho phép/i);
    expect(speechErrorMessage("service-not-allowed")).toMatch(/cho phép/i);
  });

  it("mã lạ vẫn ra câu tiếng Việt, có đường lui là gõ tay", () => {
    expect(speechErrorMessage("gì-đó")).toMatch(/gõ/i);
  });
});
