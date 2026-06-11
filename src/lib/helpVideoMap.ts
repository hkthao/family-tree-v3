/**
 * Mapping route → video tutorial ID cho contextual help.
 *
 * Pattern khớp `pathname` từ react-router. Nếu match nhiều, lấy
 * pattern dài nhất (specific hơn).
 *
 * Match qua regex thay vì exact để bắt được /clans/:id/board mà
 * không cần biết clan id.
 */
import { VIDEO_BY_ID } from "@/lib/videoTutorials";

interface Route {
  match: RegExp;
  videoId: string;
}

const ROUTES: Route[] = [
  // Order matters — specific trước, generic sau.
  { match: /^\/clans\/[^/]+\/people\/new$/, videoId: "them-thuy-to" },
  { match: /^\/clans\/[^/]+\/people\/[^/]+\/add-spouse/, videoId: "them-vo-chong-va-con" },
  { match: /^\/clans\/[^/]+\/people\/[^/]+\/add-child/, videoId: "them-vo-chong-va-con" },
  { match: /^\/clans\/[^/]+\/people\/[^/]+\/edit/, videoId: "sua-va-khoi-phuc" },
  { match: /^\/clans\/[^/]+\/import$/, videoId: "import-excel" },
  { match: /^\/clans\/[^/]+\/tree/, videoId: "xem-cay" },
  { match: /^\/clans\/[^/]+\/kinship/, videoId: "xung-ho" },
  { match: /^\/clans\/[^/]+\/my-lineage/, videoId: "duong-truc-he" },
  { match: /^\/clans\/[^/]+\/today/, videoId: "hom-nay" },
  { match: /^\/clans\/[^/]+\/todo/, videoId: "viec-can-lam" },
  { match: /^\/clans\/[^/]+\/merge/, videoId: "gop-trung" },
  { match: /^\/clans\/[^/]+\/contributions/, videoId: "dong-gop" },
  { match: /^\/clans\/[^/]+\/qr-export/, videoId: "qr-ca-nhan" },
  { match: /^\/clans\/[^/]+\/inlaws/, videoId: "thong-gia" },
  { match: /^\/clans\/[^/]+\/members/, videoId: "vai-tro" },
  { match: /^\/clans\/[^/]+\/audit/, videoId: "sua-va-khoi-phuc" },
  { match: /^\/clans\/[^/]+\/events/, videoId: "web-push" },
  { match: /^\/clans\/[^/]+\/board/, videoId: "dong-gop" },
  { match: /^\/clans\/new$/, videoId: "tao-dong-ho" },
  { match: /^\/login/, videoId: "dang-nhap" },
];

export function videoIdForRoute(pathname: string): string | null {
  for (const r of ROUTES) {
    if (r.match.test(pathname) && VIDEO_BY_ID[r.videoId]) return r.videoId;
  }
  return null;
}
