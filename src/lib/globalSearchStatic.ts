import { DOCS_SECTIONS } from "@/pages/docs/registry";
import { unaccent } from "@/lib/unaccent";

/** Mục tìm kiếm cố định (không nằm trong DB): hướng dẫn, chính sách, trang tiện ích, menu. */
export interface StaticEntry {
  group: "guide" | "policy" | "page" | "menu";
  title: string;
  subtitle?: string;
  to: string;
  /** Từ khoá phụ để dễ tìm (không hiển thị). */
  keywords?: string;
}

export const STATIC_GROUP_LABEL: Record<StaticEntry["group"], string> = {
  menu: "Trang trong app",
  guide: "Hướng dẫn sử dụng",
  policy: "Quy định & quyền riêng tư",
  page: "Khác",
};

const PRIVACY = "/chinh-sach-rieng-tu";
const TERMS = "/dieu-khoan-su-dung";

const policySection = (page: string, pageLabel: string, title: string, keywords = ""): StaticEntry => ({
  group: "policy",
  title,
  subtitle: pageLabel,
  to: page,
  keywords,
});

/** Mục lục các trang quy định (tiêu đề từng mục của trang). */
export const POLICY_ENTRIES: StaticEntry[] = [
  { group: "policy", title: "Chính sách riêng tư", subtitle: "Dữ liệu của bạn được dùng và bảo vệ thế nào", to: PRIVACY, keywords: "quyen rieng tu bao mat du lieu ca nhan privacy" },
  policySection(PRIVACY, "Chính sách riêng tư", "Gia phả là của dòng họ bạn", "so huu du lieu quyen so huu"),
  policySection(PRIVACY, "Chính sách riêng tư", "Chúng tôi lưu những gì", "thu thap du lieu thong tin luu tru"),
  policySection(PRIVACY, "Chính sách riêng tư", "Đăng nhập bằng Zalo", "zalo dang nhap"),
  policySection(PRIVACY, "Chính sách riêng tư", "Trợ lý AI — dữ liệu đi ra ngoài chỗ này", "ai tro ly gui du lieu ben thu ba"),
  policySection(PRIVACY, "Chính sách riêng tư", "Giữ trong bao lâu", "thoi gian luu xoa du lieu"),
  policySection(PRIVACY, "Chính sách riêng tư", "Đo lường sử dụng", "analytics cookie theo doi"),
  policySection(PRIVACY, "Chính sách riêng tư", "Email", "thong bao email"),
  policySection(PRIVACY, "Chính sách riêng tư", "Quyền của bạn", "xoa tai khoan truy cap sua xoa du lieu"),
  policySection(PRIVACY, "Chính sách riêng tư", "Khi chính sách này đổi", "thay doi chinh sach"),
  { group: "policy", title: "Điều khoản sử dụng", subtitle: "Quy định khi dùng dịch vụ", to: TERMS, keywords: "quy dinh dieu khoan terms" },
  policySection(TERMS, "Điều khoản sử dụng", "Dịch vụ"),
  policySection(TERMS, "Điều khoản sử dụng", "Tài khoản"),
  policySection(TERMS, "Điều khoản sử dụng", "Dữ liệu gia phả và quyền trong dòng họ", "quyen admin editor viewer phan quyen"),
  policySection(TERMS, "Điều khoản sử dụng", "Dữ liệu nhận từ Zalo", "zalo du lieu"),
  policySection(TERMS, "Điều khoản sử dụng", "Quyền trong Zalo — dùng vào việc gì", "zalo quyen"),
  policySection(TERMS, "Điều khoản sử dụng", "Rút lại sự đồng ý", "dong y thu hoi"),
  policySection(TERMS, "Điều khoản sử dụng", "Những điều không được làm", "cam vi pham"),
  policySection(TERMS, "Điều khoản sử dụng", "Trách nhiệm"),
  policySection(TERMS, "Điều khoản sử dụng", "Liên hệ và thay đổi"),
];

/** Trang tiện ích ngoài menu dòng họ. */
export const PAGE_ENTRIES: StaticEntry[] = [
  { group: "page", title: "Liên hệ", subtitle: "Gửi góp ý, hỏi đáp với quản trị", to: "/lien-he", keywords: "lien he ho tro gop y" },
  { group: "page", title: "Nhật ký thay đổi", subtitle: "Các tính năng mới của app", to: "/changelog", keywords: "changelog cap nhat phien ban tinh nang moi" },
  { group: "page", title: "Thông báo", subtitle: "Thông báo từ hệ thống", to: "/announcements", keywords: "thong bao" },
  { group: "page", title: "Sổ tay văn hoá", subtitle: "Phong tục, nghi lễ, tín ngưỡng", to: "/so-tay", keywords: "so tay phong tuc nghi le van hoa" },
];

/** Hướng dẫn sử dụng: lấy từ mục lục /docs. */
export function guideEntries(): StaticEntry[] {
  return DOCS_SECTIONS.flatMap((s) =>
    s.articles.map<StaticEntry>((a) => ({
      group: "guide",
      title: a.title,
      subtitle: a.summary,
      to: `/docs/${a.slug}`,
      keywords: s.label,
    })),
  );
}

/** Lọc theo tiêu đề / phụ đề / từ khoá, không phân biệt dấu. Tiêu đề khớp đầu câu xếp trước. */
export function filterEntries(entries: StaticEntry[], query: string, limit = 6): StaticEntry[] {
  const needle = unaccent(query.trim());
  if (needle.length < 2) return [];
  const scored: { e: StaticEntry; s: number }[] = [];
  for (const e of entries) {
    const title = unaccent(e.title);
    let s = -1;
    if (title.startsWith(needle)) s = 0;
    else if (title.includes(needle)) s = 1;
    else if (unaccent(`${e.subtitle ?? ""} ${e.keywords ?? ""}`).includes(needle)) s = 2;
    if (s >= 0) scored.push({ e, s });
  }
  return scored.sort((a, b) => a.s - b.s).slice(0, limit).map((x) => x.e);
}
