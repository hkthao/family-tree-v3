import type { ReactNode } from "react";

import * as Community from "./articles/community";
import * as Faq from "./articles/faq";
import * as Persons from "./articles/persons";
import * as Start from "./articles/start";

export interface DocArticle {
  slug: string;
  title: string;
  /** One-line summary shown under the title on the index page. */
  summary: string;
  Body: () => ReactNode;
}

export interface DocSection {
  label: string;
  articles: DocArticle[];
}

/**
 * The full table of contents.
 *
 * Each article is a plain function component (no lazy loading at this
 * scale — total prose is well under 100KB). Slugs are URL-safe
 * Vietnamese-free strings; titles stay in Vietnamese for the UI.
 */
export const DOCS_SECTIONS: DocSection[] = [
  {
    label: "Bắt đầu",
    articles: [
      {
        slug: "tong-quan",
        title: "App này dùng để làm gì",
        summary:
          "Giới thiệu nhanh — ai dùng, làm được gì, có gì khác sổ giấy.",
        Body: Start.Overview,
      },
      {
        slug: "dang-nhap",
        title: "Đăng nhập & đăng ký",
        summary: "Magic link qua email + QR sang điện thoại.",
        Body: Start.Login,
      },
      {
        slug: "tao-dong-ho",
        title: "Tạo dòng họ đầu tiên",
        summary: "3 bước để có dòng họ rỗng, sẵn sàng thêm Thuỷ tổ.",
        Body: Start.FirstClan,
      },
      {
        slug: "vai-tro",
        title: "Vai trò trong dòng họ",
        summary: "Admin / Editor / Viewer — ai làm được gì.",
        Body: Start.Roles,
      },
    ],
  },
  {
    label: "Quản lý người",
    articles: [
      {
        slug: "them-sua-xoa",
        title: "Thêm, sửa, xoá người",
        summary: "Form thêm người + khôi phục mềm từ Nhật ký.",
        Body: Persons.Crud,
      },
      {
        slug: "ten-tieng-viet",
        title: "Tên tiếng Việt: Tên tự / Tên húy / Tên thụy",
        summary: "Giải thích 3 loại tên và khi nào dùng.",
        Body: Persons.VnNames,
      },
      {
        slug: "lich-am-duong",
        title: "Ngày sinh & ngày mất theo dương lịch + âm lịch",
        summary: "App tự quy đổi và hiển thị Can Chi cho ngày giỗ.",
        Body: Persons.Dates,
      },
      {
        slug: "thuy-to-doi",
        title: "Thuỷ tổ và Đời tự tính",
        summary: "Vì sao đời tự nhảy khi đổi quan hệ cha-con.",
        Body: Persons.RootAndGeneration,
      },
      {
        slug: "quan-he",
        title: "Thêm vợ/chồng, thêm con",
        summary: "Cách app nối quan hệ qua Family Unit.",
        Body: Persons.Relationships,
      },
      {
        slug: "gop-trung",
        title: "Gộp người trùng",
        summary: "Khi 2 dòng dữ liệu cùng một người — gộp lại còn một.",
        Body: Persons.Merge,
      },
    ],
  },
  {
    label: "Lịch & cộng đồng",
    articles: [
      {
        slug: "hom-nay",
        title: "Hôm nay & nhắc giỗ",
        summary:
          "Trang Hôm nay tóm tắt giỗ + sinh nhật 30 ngày tới + nhắc qua email.",
        Body: Community.Today,
      },
      {
        slug: "qr-ca-nhan",
        title: "QR cá nhân",
        summary: "Mã QR riêng cho từng người — in lên bia, sổ, danh thiếp.",
        Body: Community.PersonalQr,
      },
      {
        slug: "duong-truc-he",
        title: 'Đường trực hệ "từ tôi về thuỷ tổ"',
        summary: "Vẽ chuỗi tổ tiên từ bạn lên thuỷ tổ, đổi bên nội / bên ngoại.",
        Body: Community.Lineage,
      },
      {
        slug: "dong-gop",
        title: "Đóng góp có duyệt",
        summary:
          "Người trong họ đề xuất sửa, admin xem & quyết định. Email tự động.",
        Body: Community.Contributions,
      },
      {
        slug: "lien-ket-thong-gia",
        title: "Liên kết thông gia giữa các dòng họ",
        summary:
          "Nối dâu/rể với cùng người đó ở dòng họ bên kia. Cần admin 2 bên đồng ý.",
        Body: Community.Inlaws,
      },
    ],
  },
  {
    label: "Câu hỏi thường gặp",
    articles: [
      {
        slug: "faq-dang-nhap-sync",
        title: "Đăng nhập & dữ liệu cũ",
        summary: "Không nhận email, sync chậm, refresh.",
        Body: Faq.AuthAndSync,
      },
      {
        slug: "faq-khoi-phuc-chuyen",
        title: "Khôi phục & chuyển quyền",
        summary: "Lỡ xoá người, chuyển dòng họ cho người khác.",
        Body: Faq.RecoverAndTransfer,
      },
    ],
  },
];

/** Flat lookup by slug. Built once at module load. */
export const DOCS_BY_SLUG: Record<string, DocArticle> = Object.fromEntries(
  DOCS_SECTIONS.flatMap((s) => s.articles.map((a) => [a.slug, a])),
);

/** Ordered list for prev/next navigation. */
export const DOCS_ORDERED: DocArticle[] = DOCS_SECTIONS.flatMap(
  (s) => s.articles,
);
