import { describe, expect, it } from "vitest";

import { eventWhenText } from "@/lib/eventWhen";
import { formatDateOnly } from "@/lib/formatDate";

/**
 * Ngày hiện cho NGƯỜI đọc, không phải cho máy.
 *
 * `2026-09-20` là định dạng máy dùng để lưu; in nguyên si ra màn hình là
 * lỗi trình bày — và nó từng chảy thẳng lên thiệp chia sẻ gửi cho cả
 * dòng họ.
 */

describe("formatDateOnly", () => {
  it("đổi ngày lịch sang kiểu người Việt đọc", () => {
    expect(formatDateOnly("2026-09-20")).toBe("20/09/2026");
  });

  it("KHÔNG lùi ngày ở múi giờ âm", () => {
    // `new Date("2026-09-20")` là nửa đêm UTC → ở Mỹ hoá ra 19/09. Ngày
    // giỗ lùi một ngày là sai kiểu không ai tha thứ, nên hàm này cắt
    // chuỗi chứ không đụng tới Date.
    const tz = process.env.TZ;
    process.env.TZ = "America/New_York";
    expect(formatDateOnly("2026-09-20")).toBe("20/09/2026");
    process.env.TZ = tz;
  });

  it("bỏ phần giờ nếu lỡ có", () => {
    expect(formatDateOnly("2026-09-20T10:00:00Z")).toBe("20/09/2026");
  });

  it("dữ liệu rác thì trả null để UI ẩn dòng, không in 'Invalid Date'", () => {
    expect(formatDateOnly("")).toBeNull();
    expect(formatDateOnly(null)).toBeNull();
    expect(formatDateOnly("hôm qua")).toBeNull();
    expect(formatDateOnly("2026-13-40")).toBeNull();
  });
});

describe("eventWhenText", () => {
  const solar = { date_solar: "2026-09-20", is_yearly: false };
  const lunar = {
    date_solar: null,
    lunar_day: 3,
    lunar_month: 3,
    lunar_is_leap: false,
    is_yearly: true,
  };

  it("ngày dương hiện theo dd/mm/yyyy", () => {
    expect(eventWhenText(solar)).toBe("20/09/2026 (dương lịch)");
  });

  it("ngày âm đọc bằng lời, không phải con số máy", () => {
    expect(eventWhenText(lunar)).toBe("Ngày 3 tháng 3 (ÂL)");
    expect(eventWhenText(lunar, { lunarLabel: "Âm lịch" })).toBe(
      "Ngày 3 tháng 3 (Âm lịch)",
    );
  });

  it("tháng nhuận phải nói rõ — giỗ lệch một tháng là chuyện lớn", () => {
    expect(eventWhenText({ ...lunar, lunar_is_leap: true })).toBe(
      "Ngày 3 tháng 3 nhuận (ÂL)",
    );
  });

  it('thêm "hằng năm" khi được hỏi, và chỉ khi sự kiện lặp', () => {
    expect(eventWhenText(lunar, { withYearly: true })).toBe(
      "Ngày 3 tháng 3 (ÂL) · hằng năm",
    );
    expect(eventWhenText(solar, { withYearly: true })).toBe(
      "20/09/2026 (dương lịch)",
    );
  });

  it("không có ngày nào thì trả gạch ngang, không trả chuỗi rỗng", () => {
    expect(eventWhenText({ date_solar: null })).toBe("—");
  });
});
