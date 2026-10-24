import { IconBook, IconChevronDown } from "@/components/icons";
import { getClanDetail } from "@/lib/queries/clan-detail";
import type { ClanSummary } from "@/lib/queries/clans";
import { buildSections, type DrawerItem } from "@/lib/navModel";

import { useAsync } from "../useAsync";

/**
 * Tab "Thêm" — các mục còn lại của menu trái trên web.
 *
 * Danh sách lấy THẲNG từ `buildSections` của web, nên mục nào hiện là do
 * cùng một luật: vai trò trong họ, họ công khai cho xem gì, tính năng nào
 * họ đã tắt. Thêm trang mới vào menu web là tab này tự có theo.
 *
 * Bỏ hẳn quyền admin hệ thống: menu dựng như một thành viên bình thường
 * với vai trò thật trong họ (không có "Quản trị nền tảng", không được coi
 * là quản trị mọi họ). Nhóm "Chung" của web (Thông báo, Trợ giúp, Sổ tay…)
 * không thuộc dòng họ nên không đưa vào đây.
 *
 * Nhóm "Quản trị dòng họ" (Thành viên, Liên kết thông gia, Cài đặt dòng họ)
 * cũng KHÔNG có ở đây: đó là các màn phân quyền và bảo mật của họ (ai vào
 * được, vai trò, công khai gì), chủ dự án chốt chỉ làm trên web.
 *
 * Mục nào đã có màn hình trong Mini App thì mở màn đó; chưa có thì hiện
 * "Sắp có" thay vì mời sang trang web (tiêu chí duyệt của Zalo).
 */
export type MoreTarget = "overview" | "tree" | "people" | "events" | "export" | "todo";

/** Đuôi đường dẫn web → màn hình tương ứng trong Mini App. */
const ROUTES: Record<string, MoreTarget> = {
  "": "overview",
  "/today": "overview",
  "/tree": "tree",
  "/people": "people",
  "/events": "events",
  "/todo": "todo",
};
/** Các mục đã có ở thanh tab dưới — không nhắc lại trong "Thêm". */
const IN_TABBAR = new Set(["", "/tree", "/people", "/events"]);

export function MoreScreen({
  clan,
  userId,
  open,
  canExport,
}: {
  clan: ClanSummary;
  userId: string;
  open: (t: MoreTarget) => void;
  canExport: boolean;
}) {
  const q = useAsync(() => getClanDetail(clan.id, userId), [clan.id, userId]);

  if (q.loading) return <div className="page"><div className="sk" style={{ height: 320 }} /></div>;
  if (q.error || !q.data) {
    return (
      <div className="center">
        <p className="error">{q.error ?? "Không đọc được thông tin dòng họ."}</p>
        <button type="button" className="btn ghost" onClick={q.reload}>Thử lại</button>
      </div>
    );
  }

  const prefix = `/clans/${clan.id}`;
  const sections = buildSections(
    clan.id,
    { ...q.data, isPlatformAdmin: false },
    null,
    0,
    0,
    0,
    // Trợ lý AI chưa có trong Mini App; để nó hiện "Sắp có" như các mục khác.
    true,
  )
    .filter((s) => s.id !== "global" && s.id !== "clan-admin")
    .map((s) => {
      const items: DrawerItem[] = s.items.filter((i) => !IN_TABBAR.has(i.to.slice(prefix.length)));
      // Xuất sổ ở web nằm trong "Công cụ"; ở đây là màn riêng nên ghi rõ tên.
      if (s.id === "clan-work" && canExport) {
        items.unshift({ to: "#export", label: "Xuất sổ gia phả PDF", icon: <IconBook /> });
      }
      return { ...s, items };
    })
    .filter((s) => s.items.length > 0);

  const target = (item: DrawerItem): MoreTarget | null =>
    item.to === "#export" ? "export" : ROUTES[item.to.slice(prefix.length)] ?? null;

  return (
    <div className="page">
      {sections.map((s) => (
        <div key={s.id}>
          <h3 className="grouptitle">{s.label}</h3>
          <div className="card group">
            {s.items.map((item) => {
              const t = target(item);
              return (
                <div key={item.to} className="grow">
                  <button
                    type="button"
                    className="growhead moreitem"
                    disabled={!t}
                    onClick={() => t && open(t)}
                  >
                    <span className="moreicon">{item.icon}</span>
                    <span>{item.label}</span>
                    {t ? (
                      <span className="chev closed" style={{ margin: "0 0 0 auto", width: 24, height: 24 }}><IconChevronDown /></span>
                    ) : (
                      <span className="soon">Sắp có</span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
