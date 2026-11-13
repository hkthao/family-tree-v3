import type { ReactNode } from "react";

import {
  IconBell,
  IconBuildings,
  IconMail,
  IconMapPin,
  IconMicrophone,
  IconScroll,
  IconSettings,
  IconShield,
  IconSparkles,
  IconUsers,
} from "@/components/icons";
import { msg } from "@lingui/core/macro";
import { lazyMessages } from "@/lib/i18n/lazy";

/**
 * SỔ ĐĂNG KÝ các màn quản trị — một nguồn sự thật duy nhất.
 *
 * Ba nơi cùng đọc từ đây: lưới ở trang /admin, nhóm trong menu trái, và
 * bảng route. Trước kia mỗi nơi tự khai một danh sách, nên thêm một màn
 * là sửa ba chỗ — và quên một chỗ thì màn hình đó thành "có mà không ai
 * tìm ra".
 *
 * MỖI MÀN MỘT TRANG, không phải tab. Tab bắt người dùng nhớ mình đang ở
 * tab nào của trang nào; URL riêng thì chia sẻ được, Back chạy đúng, và
 * mỗi màn có tiêu đề riêng.
 */

export type AdminArea = "report" | "settings";

export interface AdminScreen {
  /** Đoạn cuối của đường dẫn: /admin/<slug>. Tiếng Việt không dấu. */
  slug: string;
  label: string;
  /** Một dòng nói màn này để làm gì — hiện dưới nhãn trong lưới. */
  description: string;
  icon: ReactNode;
  area: AdminArea;
  /** Khoá tab cũ (?tab=…) để chuyển hướng link đã lỡ chia sẻ. */
  legacyTab: string;
}

export const ADMIN_AREA_LABEL: Record<AdminArea, string> = lazyMessages({
  report: msg`Báo cáo & theo dõi`,
  settings: msg`Cài đặt & nội dung`,
}) as Record<AdminArea, string>;

export const ADMIN_AREA_HINT: Record<AdminArea, string> = lazyMessages({
  report: msg`Mở ra xem, hầu như chỉ đọc.`,
  settings: msg`Đụng vào vài lần rồi thôi — và đụng nhầm thì hỏng thật.`,
}) as Record<AdminArea, string>;

const ic = "h-6 w-6";

export const ADMIN_SCREENS: AdminScreen[] = lazyMessages([
  {
    slug: "he-thong",
    label: msg`Hệ thống`,
    description: msg`Sức khoẻ database, cron, thông báo gửi hỏng.`,
    icon: <IconShield className={ic} />,
    area: "report",
    legacyTab: "health",
  },
  {
    slug: "nguoi-dung",
    label: msg`Người dùng`,
    description: msg`Tìm người, xem dòng họ của họ, chỉnh giới hạn.`,
    icon: <IconUsers className={ic} />,
    area: "report",
    legacyTab: "users",
  },
  {
    slug: "dong-ho",
    label: msg`Dòng họ`,
    description: msg`Giới hạn người, tài khoản và lượt trợ lý theo dòng họ.`,
    icon: <IconBuildings className={ic} />,
    area: "report",
    legacyTab: "clans",
  },
  {
    slug: "gop-y",
    label: msg`Góp ý`,
    description: msg`Góp ý và báo lỗi người dùng gửi lên.`,
    icon: <IconMail className={ic} />,
    area: "report",
    legacyTab: "feedback",
  },
  {
    slug: "tro-ly-ai",
    label: msg`Trợ lý AI`,
    description: msg`Lượt hỏi, chi phí, độ trễ, hạn mức đang dùng.`,
    icon: <IconSparkles className={ic} />,
    area: "report",
    legacyTab: "ai_usage",
  },
  {
    slug: "cau-hinh",
    label: msg`Cấu hình nền tảng`,
    description: msg`Linh vật, dòng họ demo.`,
    icon: <IconSettings className={ic} />,
    area: "settings",
    legacyTab: "config",
  },
  {
    slug: "cau-hinh-ai",
    label: msg`Cấu hình trợ lý AI`,
    description: msg`Bật/tắt, chọn model, khoá API, hạn mức và trần chi phí.`,
    icon: <IconSparkles className={ic} />,
    area: "settings",
    legacyTab: "ai",
  },
  {
    slug: "podcast",
    label: "Podcast",
    description: msg`Các tập kéo từ Facebook: ẩn/hiện, sửa tiêu đề, đồng bộ.`,
    icon: <IconMicrophone className={ic} />,
    area: "settings",
    legacyTab: "podcast",
  },
  {
    slug: "thong-bao",
    label: msg`Thông báo`,
    description: msg`Viết thông báo hiện cho toàn bộ người dùng.`,
    icon: <IconBell className={ic} />,
    area: "settings",
    legacyTab: "announcements",
  },
  {
    slug: "danh-muc-dia-gioi",
    label: msg`Danh mục địa giới`,
    description: msg`Tỉnh/thành và xã/phường dùng cho ô chọn địa chỉ.`,
    icon: <IconMapPin className={ic} />,
    area: "settings",
    legacyTab: "divisions",
  },
  {
    slug: "nhap-gia-pha",
    label: msg`Nhập gia phả`,
    description: msg`Nhập dữ liệu từ nguồn ngoài vào một dòng họ.`,
    icon: <IconScroll className={ic} />,
    area: "settings",
    legacyTab: "giapha",
  },
]) as unknown as AdminScreen[];

export const adminPath = (slug: string) => `/admin/${slug}`;

export function screensByArea(area: AdminArea): AdminScreen[] {
  return ADMIN_SCREENS.filter((s) => s.area === area);
}

/**
 * Link cũ dạng `/admin?tab=users` → đường dẫn mới.
 *
 * Giữ lại vì link kiểu đó đã được dán vào chat và bookmark ("xem giúp
 * anh cái này"). Trả null khi không nhận ra để nơi gọi tự quyết.
 */
export function pathForLegacyTab(tab: string | null): string | null {
  if (!tab) return null;
  const found = ADMIN_SCREENS.find((s) => s.legacyTab === tab);
  return found ? adminPath(found.slug) : null;
}
