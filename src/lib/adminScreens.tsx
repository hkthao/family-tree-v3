import type { ReactNode } from "react";

import {
  IconBell,
  IconBuildings,
  IconMail,
  IconScroll,
  IconSettings,
  IconShield,
  IconSparkles,
  IconUsers,
} from "@/components/icons";

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

export const ADMIN_AREA_LABEL: Record<AdminArea, string> = {
  report: "Báo cáo & theo dõi",
  settings: "Cài đặt & nội dung",
};

export const ADMIN_AREA_HINT: Record<AdminArea, string> = {
  report: "Mở ra xem, hầu như chỉ đọc.",
  settings: "Đụng vào vài lần rồi thôi — và đụng nhầm thì hỏng thật.",
};

const ic = "h-6 w-6";

export const ADMIN_SCREENS: AdminScreen[] = [
  {
    slug: "he-thong",
    label: "Hệ thống",
    description: "Sức khoẻ database, cron, thông báo gửi hỏng.",
    icon: <IconShield className={ic} />,
    area: "report",
    legacyTab: "health",
  },
  {
    slug: "nguoi-dung",
    label: "Người dùng",
    description: "Tìm người, xem dòng họ của họ, chỉnh giới hạn.",
    icon: <IconUsers className={ic} />,
    area: "report",
    legacyTab: "users",
  },
  {
    slug: "dong-ho",
    label: "Dòng họ",
    description: "Giới hạn người, tài khoản và lượt trợ lý theo dòng họ.",
    icon: <IconBuildings className={ic} />,
    area: "report",
    legacyTab: "clans",
  },
  {
    slug: "gop-y",
    label: "Góp ý",
    description: "Góp ý và báo lỗi người dùng gửi lên.",
    icon: <IconMail className={ic} />,
    area: "report",
    legacyTab: "feedback",
  },
  {
    slug: "tro-ly-ai",
    label: "Trợ lý AI",
    description: "Lượt hỏi, chi phí, độ trễ, hạn mức đang dùng.",
    icon: <IconSparkles className={ic} />,
    area: "report",
    legacyTab: "ai_usage",
  },
  {
    slug: "cau-hinh",
    label: "Cấu hình nền tảng",
    description: "Linh vật, dòng họ demo.",
    icon: <IconSettings className={ic} />,
    area: "settings",
    legacyTab: "config",
  },
  {
    slug: "cau-hinh-ai",
    label: "Cấu hình trợ lý AI",
    description: "Bật/tắt, chọn model, khoá API, hạn mức và trần chi phí.",
    icon: <IconSparkles className={ic} />,
    area: "settings",
    legacyTab: "ai",
  },
  {
    slug: "thong-bao",
    label: "Thông báo",
    description: "Viết thông báo hiện cho toàn bộ người dùng.",
    icon: <IconBell className={ic} />,
    area: "settings",
    legacyTab: "announcements",
  },
  {
    slug: "nhap-gia-pha",
    label: "Nhập gia phả",
    description: "Nhập dữ liệu từ nguồn ngoài vào một dòng họ.",
    icon: <IconScroll className={ic} />,
    area: "settings",
    legacyTab: "giapha",
  },
];

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
