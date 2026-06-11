/**
 * Registry video hướng dẫn sử dụng.
 *
 * Mỗi entry có 2 phiên bản: mobile (390×844) + desktop (1280×800).
 * Player tự pick theo viewport — xem `pickVideoUrl()`.
 *
 * Base URL configurable qua env `VITE_VIDEOS_BASE_URL`. Default:
 * `/static/videos` — phục vụ từ nginx VPS (xem
 * `scripts/upload-videos.sh`).
 */

export type VideoGroup = "start" | "person" | "community" | "faq";

export interface VideoTutorial {
  /** Slug ngắn dùng làm key tra cứu. */
  id: string;
  /** Tên thư mục video — vd "01-tao-dong-ho". */
  spec: string;
  title: string;
  /** Mô tả ngắn 1 dòng — hiện ở hub + tooltip. */
  description: string;
  /** Duration giây — hiện cạnh title ("1:23"). */
  duration: number;
  group: VideoGroup;
}

export const VIDEO_GROUPS: Record<VideoGroup, string> = {
  start: "Bắt đầu",
  person: "Quản lý người",
  community: "Lịch & cộng đồng",
  faq: "Khác",
};

export const VIDEO_TUTORIALS: VideoTutorial[] = [
  {
    id: "tao-dong-ho",
    spec: "01-tao-dong-ho",
    title: "Tạo dòng họ đầu tiên",
    description: "3 bước để có dòng họ rỗng, sẵn sàng thêm Thuỷ tổ.",
    duration: 49,
    group: "start",
  },
  {
    id: "them-thuy-to",
    spec: "02-them-thuy-to",
    title: "Thêm Thuỷ tổ",
    description: "Thêm người đầu tiên — đời 1 của dòng họ.",
    duration: 58,
    group: "start",
  },
  {
    id: "them-vo-chong-va-con",
    spec: "03-them-vo-chong-va-con",
    title: "Thêm vợ/chồng + con",
    description: "Nối quan hệ Family Unit, xây đời 2.",
    duration: 73,
    group: "person",
  },
  {
    id: "xem-cay",
    spec: "04-xem-cay",
    title: "Xem cây gia phả",
    description: "Zoom, pan, đặt người trung tâm.",
    duration: 49,
    group: "person",
  },
  {
    id: "sua-va-khoi-phuc",
    spec: "05-sua-va-khoi-phuc",
    title: "Sửa, xoá và khôi phục người",
    description: "Soft-delete: lỡ xoá vẫn khôi phục được.",
    duration: 73,
    group: "person",
  },
  {
    id: "ngay-am-duong",
    spec: "06-ngay-am-duong",
    title: "Ngày sinh/mất âm-dương + Can Chi",
    description: "Nhập theo lịch nào cũng được; app tự quy đổi.",
    duration: 60,
    group: "person",
  },
  {
    id: "ten-tieng-viet",
    spec: "07-ten-tieng-viet",
    title: "Tên tự, tên húy, tên thụy",
    description: "3 loại tên tiếng Việt cổ — khi nào dùng cái nào.",
    duration: 47,
    group: "person",
  },
  {
    id: "xung-ho",
    spec: "08-xung-ho",
    title: "Tra cứu xưng hô",
    description: "Chọn 2 người, app tính cách xưng hô.",
    duration: 36,
    group: "community",
  },
  {
    id: "duong-truc-he",
    spec: "09-duong-truc-he",
    title: "Đường trực hệ",
    description: 'Vẽ chuỗi "từ tôi về thuỷ tổ" theo bên nội/ngoại.',
    duration: 30,
    group: "community",
  },
  {
    id: "hom-nay",
    spec: "10-hom-nay",
    title: "Hôm nay & nhắc giỗ",
    description: "Trang Hôm nay tóm tắt giỗ và sinh nhật.",
    duration: 24,
    group: "community",
  },
  {
    id: "viec-can-lam",
    spec: "11-viec-can-lam",
    title: "Việc cần làm (gap board)",
    description: "App tự dò ai thiếu năm sinh, cha mẹ, ảnh…",
    duration: 24,
    group: "community",
  },
  {
    id: "gop-trung",
    spec: "12-gop-trung",
    title: "Gộp người trùng",
    description: "Khi 2 dòng cùng 1 người — gộp lại còn một.",
    duration: 49,
    group: "person",
  },
  {
    id: "dang-nhap",
    spec: "13-dang-nhap",
    title: "Đăng nhập (magic link + QR)",
    description: "2 cách đăng nhập — email và QR sang điện thoại.",
    duration: 44,
    group: "start",
  },
  {
    id: "vai-tro",
    spec: "14-vai-tro",
    title: "Vai trò thành viên",
    description: "Admin / Editor / Viewer — ai làm được gì.",
    duration: 39,
    group: "start",
  },
  {
    id: "dong-gop",
    spec: "15-dong-gop",
    title: "Đóng góp có duyệt",
    description: "Editor đề xuất sửa, admin duyệt.",
    duration: 22,
    group: "community",
  },
  {
    id: "qr-ca-nhan",
    spec: "16-qr-ca-nhan",
    title: "QR cá nhân",
    description: "Mã riêng cho từng người — in lên bia, sổ.",
    duration: 27,
    group: "community",
  },
  {
    id: "thong-gia",
    spec: "17-thong-gia",
    title: "Liên kết thông gia",
    description: "Nối dâu/rể với cùng người ở dòng họ bên kia.",
    duration: 23,
    group: "community",
  },
  {
    id: "import-excel",
    spec: "18-import-excel",
    title: "Nhập từ Excel",
    description: "Import gia phả lớn từ .xlsx / .csv.",
    duration: 29,
    group: "start",
  },
  {
    id: "web-push",
    spec: "19-web-push",
    title: "Thông báo đẩy (Web Push)",
    description: "Nhận nhắc giỗ trên điện thoại kể cả khi app đóng.",
    duration: 25,
    group: "community",
  },
];

export const VIDEO_BY_ID: Record<string, VideoTutorial> = Object.fromEntries(
  VIDEO_TUTORIALS.map((v) => [v.id, v]),
);

const BASE_URL = (
  (import.meta.env.VITE_VIDEOS_BASE_URL as string | undefined) ??
  "/static/videos"
).replace(/\/$/, "");

export type Viewport = "mobile" | "desktop";

export function getVideoUrl(spec: string, viewport: Viewport): string {
  return `${BASE_URL}/${spec}-${viewport}.mp4`;
}

export function getPosterUrl(spec: string, viewport: Viewport): string {
  return `${BASE_URL}/${spec}-${viewport}.jpg`;
}

/**
 * Format duration thành "M:SS" — vd 73 → "1:13".
 */
export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Pick viewport theo width hiện tại — < 1024 → mobile. Render-only,
 * không tự reactive; component dùng useEffect/useMediaQuery để re-pick
 * khi resize.
 */
export function pickViewport(): Viewport {
  if (typeof window === "undefined") return "desktop";
  return window.innerWidth < 1024 ? "mobile" : "desktop";
}
