import { describe, expect, it } from "vitest";

import {
  absoluteUrl,
  titleFromDescription,
  toEpisode,
} from "../../../supabase/functions/sync-podcast/parse";

/**
 * Đổi video Facebook → tập podcast.
 *
 * Dữ liệu trong test này là DỮ LIỆU THẬT, lấy từ Graph API của Trang
 * ByteCast Tech ngày 14/09/2026 — không phải mẫu tự nghĩ ra. Chính nhờ gọi
 * thật mới biết ba điều mà tài liệu Meta không nói:
 *   1. reel nằm trong `/{page-id}/videos` (còn `/video_reels` chỉ để đăng),
 *   2. không có trường `title` — chỉ có `description` dài cả đoạn,
 *   3. `permalink_url` là đường dẫn TƯƠNG ĐỐI.
 */

const REAL = {
  id: "1356331553352275",
  description:
    "Nếu bạn biến mất hôm nay...\nTheo bạn, điều gì sẽ còn lại?\nKý ức? \nMột bức ảnh? \nHay chỉ là sự im lặng?\nĐôi khi điều đáng sợ nhất không phải là cái chết.\n\n#bytecast #triethoc #tamlyhoc #loneliness",
  created_time: "2026-09-01T12:01:56+0000",
  permalink_url: "/reel/1356331553352275/",
  picture: "https://scontent.fsgn5-2.fna.fbcdn.net/v/t15.5256-10/792404228.jpg",
  length: 940.778,
};

describe("titleFromDescription", () => {
  it("lấy dòng đầu làm tiêu đề", () => {
    // Reel không có trường tiêu đề. Dòng đầu của mô tả gần như luôn là
    // câu hỏi mở — đúng thứ cần hiện trên danh sách.
    expect(titleFromDescription(REAL.description, REAL.created_time)).toBe(
      "Nếu bạn biến mất hôm nay...",
    );
  });

  it("bỏ qua dòng chỉ toàn hashtag", () => {
    expect(
      titleFromDescription("#bytecast #triethoc\nCâu chuyện thật", "2026-09-01T00:00:00+0000"),
    ).toBe("Câu chuyện thật");
  });

  it("mô tả trống thì lùi về ngày đăng, không trả tiêu đề rỗng", () => {
    expect(titleFromDescription("", "2026-09-13T12:40:03+0000")).toBe(
      "Tập ngày 13/09/2026",
    );
    expect(titleFromDescription(null, "2026-09-13T12:40:03+0000")).toBe(
      "Tập ngày 13/09/2026",
    );
  });

  it("dòng đầu quá dài thì cắt theo TỪ, không cắt giữa chữ", () => {
    // Cắt giữa chữ tiếng Việt ra nghĩa khác hẳn: "không" → "khô".
    const long = `Có bao giờ bạn nghĩ ${"rất dài ".repeat(30)}kết thúc`;
    const out = titleFromDescription(long, "2026-09-01T00:00:00+0000");
    expect(out.length).toBeLessThanOrEqual(121);
    expect(out.endsWith("…")).toBe(true);
    // Chỗ cắt phải rơi đúng vào ranh giới từ: phần giữ lại là đầu câu gốc,
    // và ký tự ngay sau đó trong câu gốc là dấu cách.
    const kept = out.slice(0, -1);
    expect(long.startsWith(kept)).toBe(true);
    expect(long[kept.length]).toBe(" ");
  });
});

describe("absoluteUrl", () => {
  it("nối đủ tên miền cho đường dẫn tương đối", () => {
    // Graph API trả "/reel/123/" — nhét thẳng vào thẻ nhúng là link hỏng.
    expect(absoluteUrl("/reel/123/", "123")).toBe(
      "https://www.facebook.com/reel/123/",
    );
  });

  it("giữ nguyên link đã đầy đủ", () => {
    expect(absoluteUrl("https://www.facebook.com/reel/9/", "9")).toBe(
      "https://www.facebook.com/reel/9/",
    );
  });

  it("thiếu permalink thì dựng từ id, đừng trả link rỗng", () => {
    expect(absoluteUrl(undefined, "555")).toBe("https://www.facebook.com/555");
  });
});

describe("toEpisode — bản ghi thật", () => {
  it("khớp đủ các trường cần cho trang podcast", () => {
    expect(toEpisode(REAL)).toEqual({
      fb_video_id: "1356331553352275",
      title: "Nếu bạn biến mất hôm nay...",
      description: REAL.description,
      permalink_url: "https://www.facebook.com/reel/1356331553352275/",
      thumbnail_url: REAL.picture,
      duration_seconds: 940.778,
      published_at: "2026-09-01T12:01:56+0000",
    });
  });

  it("thiếu ảnh bìa / độ dài thì vẫn dựng được bản ghi", () => {
    // Ảnh bìa của Facebook là URL có hạn dùng; thiếu nó thì trang vẫn
    // phải chạy, chỉ mất cái hình.
    const ep = toEpisode({ id: "1", created_time: "2026-01-02T00:00:00+0000" });
    expect(ep.thumbnail_url).toBeNull();
    expect(ep.duration_seconds).toBeNull();
    expect(ep.title).toBe("Tập ngày 02/01/2026");
  });
});
