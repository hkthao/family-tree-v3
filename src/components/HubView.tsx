import { useState } from "react";
import { Link } from "react-router-dom";

import { IconSearch, IconX } from "@/components/icons";
import { NewBadge } from "@/components/NewBadge";
import {
  filterHubGroups,
  useHubGroups,
  type HubGroup,
  type HubTile,
} from "@/hooks/useHubGroups";
import { track } from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { t } from "@lingui/core/macro";

/** Khoá gửi đi đo: bỏ phần `/clans/<id>/` để KHÔNG kèm mã dòng họ. */
const tileName = (key: string) => key.replace(/^\/clans\/[^/]+\//, "");

/** Mục đang mở: đúng đường dẫn, hoặc là trang con của nó (trừ khi có mục dài hơn khớp hơn). */
function isActivePath(to: string, pathname: string, all: string[]): boolean {
  if (pathname === to) return true;
  if (!pathname.startsWith(`${to}/`)) return false;
  return !all.some(
    (s) => s !== to && s.length > to.length && pathname.startsWith(s),
  );
}

/** CHIỀU CAO CỐ ĐỊNH: mọi ô bằng nhau dù nhãn/mô tả dài ngắn khác nhau (nhãn và mô tả cắt ở 2 dòng). */
const TILE =
  "flex h-full w-full flex-col rounded-xl border bg-card text-left transition-colors hover:border-primary/40 hover:bg-muted/50";
/** Kích thước ô: trang rộng rãi; ngăn kéo gọn hơn để vừa 3 cột. */
const TILE_SIZE = {
  page: "min-h-[160px] gap-2 p-3 sm:min-h-[152px] sm:p-4",
  panel: "min-h-[132px] gap-1.5 p-2.5",
} as const;

function TileBody({ tile }: { tile: HubTile }) {
  return (
    <>
      <span className="relative inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary [&_svg]:h-6 [&_svg]:w-6">
        {tile.icon}
        {tile.badge !== undefined && (
          <span className="absolute -right-2 -top-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold text-primary-foreground">
            {tile.badge}
          </span>
        )}
      </span>
      <span className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        <span className="line-clamp-2 pb-0.5 font-medium leading-snug">
          {tile.label}
        </span>
        {tile.isNew && <NewBadge />}
      </span>
      {tile.hint && (
        <span className="line-clamp-2 pb-0.5 text-xs leading-[1.45] text-muted-foreground">
          {tile.hint}
        </span>
      )}
    </>
  );
}

/**
 * Giao diện hub "Tất cả tính năng" — MỘT chỗ duy nhất vẽ ô lọc + các nhóm + lưới ô. Dùng cho trang hub
 * (`ClanMenu`, variant "page") và ngăn kéo "Tính năng" ở thanh đầu trang (`FeaturesButton`, variant
 * "panel"). Mục nào hiện, badge, quyền: lấy từ `useHubGroups` (nguồn: `navModel`). Muốn đổi cách vẽ ô:
 * sửa ở đây. Muốn thêm một tính năng: chỉ thêm vào `navModel` — cả hai nơi tự có.
 *
 * - `extraGroups`: nhóm riêng của nơi dùng (trang hub thêm nhóm Hệ thống).
 * - `onSelect`: có thì bấm ô gọi hàm này thay vì điều hướng thẳng (ngăn kéo cần THAY history entry).
 * - `activePath`: đường dẫn trang đang mở → tô sáng ô tương ứng.
 */
export function HubView({
  variant,
  extraGroups = [],
  onSelect,
  activePath,
}: {
  variant: "page" | "panel";
  extraGroups?: HubGroup[];
  onSelect?: (tile: HubTile) => void;
  activePath?: string;
}) {
  const hubGroups = useHubGroups();
  const [q, setQ] = useState("");
  const groups = filterHubGroups([...hubGroups, ...extraGroups], q);
  const panel = variant === "panel";
  const allTo = groups.flatMap((g) =>
    g.tiles.map((x) => x.to).filter((x): x is string => !!x),
  );

  const click = (tile: HubTile) => {
    track("hub_tile_click", { key: tileName(tile.key) });
    if (tile.onClick) tile.onClick();
    else onSelect?.(tile);
  };

  return (
    <div className={cn(panel ? "space-y-4 pb-8" : "space-y-5")}>
      <label className="relative block">
        <span className="sr-only">{t`Tìm tính năng`}</span>
        <IconSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t`Tìm tính năng…`}
          className="h-11 w-full rounded-lg border bg-card pl-9 pr-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label={t`Xoá từ khoá`}
            className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted"
          >
            <IconX className="h-4 w-4" />
          </button>
        )}
      </label>

      {groups.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          {t`Không có mục nào khớp.`}
        </p>
      )}

      {groups.map((g) => (
        <section key={g.id} className="space-y-3">
          <div>
            <h2
              className={cn("font-semibold", panel ? "text-base" : "text-lg")}
            >
              {g.label}
            </h2>
            {g.hint && (
              <p className="text-sm text-muted-foreground">{g.hint}</p>
            )}
          </div>
          {/* Trang: 2 cột ở điện thoại (ô vẫn đủ to để nhắm), 3–4 ở màn rộng. Ngăn kéo: 3 cột, ô gọn hơn, để thấy được nhiều tính năng. */}
          <ul
            className={cn(
              "grid gap-3",
              panel
                ? "grid-cols-3 gap-2"
                : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4",
            )}
          >
            {g.tiles.map((tile) => {
              const active =
                !!activePath &&
                !!tile.to &&
                isActivePath(tile.to, activePath, allTo);
              const cls = cn(
                TILE,
                TILE_SIZE[variant],
                active && "border-primary bg-primary/10",
              );
              return (
                <li key={tile.key}>
                  {tile.to && !onSelect ? (
                    <Link
                      to={tile.to}
                      className={cls}
                      aria-current={active ? "page" : undefined}
                      onClick={() => click(tile)}
                    >
                      <TileBody tile={tile} />
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className={cls}
                      aria-current={active ? "page" : undefined}
                      onClick={() => click(tile)}
                    >
                      <TileBody tile={tile} />
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
