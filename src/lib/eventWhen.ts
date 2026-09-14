import { formatDateOnly } from "@/lib/formatDate";

/**
 * Câu trả lời cho "sự kiện này vào ngày nào" — DÙNG CHUNG mọi nơi.
 *
 * Trước đây mỗi chỗ tự ghép một kiểu: danh sách sự kiện in thẳng
 * `2026-09-20`, hộp chi tiết cũng vậy, và cái chuỗi đó còn chảy luôn lên
 * thiệp chia sẻ. Người Việt đọc ngày là 20/09/2026; `2026-09-20` là định
 * dạng của máy, in cho người đọc là lỗi trình bày.
 *
 * Gom về một hàm vì ngày sự kiện xuất hiện ở ít nhất bốn chỗ (danh sách,
 * hộp chi tiết, thiệp, lịch) — mỗi chỗ tự ghép thì sớm muộn lại lệch.
 */
export interface EventWhen {
  date_solar: string | null;
  lunar_day?: number | null;
  lunar_month?: number | null;
  lunar_is_leap?: boolean | null;
  is_yearly?: boolean | null;
}

export interface EventWhenOptions {
  /** "ÂL" cho chỗ chật, "Âm lịch" cho chỗ rộng. */
  lunarLabel?: "ÂL" | "Âm lịch";
  /** Ghi thêm "· hằng năm" khi sự kiện lặp lại. */
  withYearly?: boolean;
}

export function eventWhenText(
  event: EventWhen,
  opts: EventWhenOptions = {},
): string {
  const lunarLabel = opts.lunarLabel ?? "ÂL";
  let when: string;
  if (event.date_solar) {
    when = `${formatDateOnly(event.date_solar) ?? event.date_solar} (dương lịch)`;
  } else if (event.lunar_month) {
    when = `Ngày ${event.lunar_day} tháng ${event.lunar_month}${
      event.lunar_is_leap ? " nhuận" : ""
    } (${lunarLabel})`;
  } else {
    when = "—";
  }
  return opts.withYearly && event.is_yearly ? `${when} · hằng năm` : when;
}
