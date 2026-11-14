import { t } from "@lingui/core/macro";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { GlobalSearch } from "@/components/GlobalSearch";
import {
  IconGlobe,
  IconGrid,
  IconMoon,
  IconSearch,
  IconSun,
  IconX,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useThemeToggle } from "@/components/ThemeQuickToggle";
import { useNavSections } from "@/hooks/useNavSections";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LOCALES, currentLocale } from "@/lib/i18n";
import { useChangeLocale } from "@/lib/i18n/useLocale";
import { unaccent } from "@/lib/unaccent";

/** Một ô của lưới: liên kết (`to`) hoặc hành động (`onClick`). Cùng kiểu với trang Quản trị nền tảng. */
interface Tile {
  key: string;
  label: string;
  hint?: string;
  icon: ReactNode;
  badge?: string | number;
  to?: string;
  onClick?: () => void;
}

interface Group {
  id: string;
  label: string;
  hint?: string;
  tiles: Tile[];
}

const TILE =
  "flex h-full min-h-[124px] w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-muted/50";

function TileBody({ tile }: { tile: Tile }) {
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
      <span className="font-medium leading-tight">{tile.label}</span>
      {tile.hint && (
        <span className="text-xs leading-snug text-muted-foreground">
          {tile.hint}
        </span>
      )}
    </>
  );
}

/**
 * "Tất cả tính năng" — trang hub của một dòng họ, thiết kế GIỐNG trang Quản trị nền tảng (AdminHub): tiêu đề
 * nhóm + mô tả nhóm, ô có icon, nhãn đậm và một câu mô tả mờ.
 *
 * Thứ tự: các mục LÕI của dòng họ lên đầu → Cộng đồng & Di sản → Tra cứu → Nhập & dọn dữ liệu → Công cụ & Quản trị → nhóm Chung (Thông báo,
 * Trợ giúp, Sổ tay…) → Hệ thống (Tìm kiếm, Ngôn ngữ, Giao diện sáng/tối) ở cuối. Nhóm Quản trị hệ thống chỉ ở menu
 * trái. Có ô lọc (gõ không dấu cũng được).
 *
 * Vì sao có trang này: menu trái trước đây dài ~25 mục, trên điện thoại phải cuộn dài mới thấy cuối; ở đây thấy hết
 * trong vài màn, và badge việc chờ của từng mục vẫn hiện.
 */
export default function ClanMenu() {
  const { sections } = useNavSections();
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const { dark, toggle: toggleTheme } = useThemeToggle();
  const changeLocale = useChangeLocale();
  usePageTitle(t`Tất cả tính năng`);

  const toTiles = (items: (typeof sections)[number]["items"]): Tile[] =>
    items.map((i) => ({
      key: i.to,
      label: i.label,
      hint: i.hint,
      icon: i.icon,
      badge: i.badge,
      to: i.to,
    }));
  const byId = (id: string) => sections.find((x) => x.id === id);
  const group = (id: string): Group | null => {
    const s = byId(id);
    return s
      ? { id: s.id, label: s.label, hint: s.hint, tiles: toTiles(s.items) }
      : null;
  };

  // Tính năng của HỆ THỐNG (không thuộc riêng dòng họ nào): đổi bằng một chạm, không rời trang.
  const system: Tile[] = [
    {
      key: "sys-search",
      label: t`Tìm kiếm`,
      hint: t`Người, mộ phần, di sản, hướng dẫn…`,
      icon: <IconSearch />,
      onClick: () => setSearchOpen(true),
    },
    ...LOCALES.filter((l) => l.id !== currentLocale()).map((l) => ({
      key: `sys-lang-${l.id}`,
      label: t`Ngôn ngữ`,
      hint: t`Chuyển sang ${l.label}`,
      icon: <IconGlobe />,
      onClick: () => void changeLocale(l.id),
    })),
    {
      key: "sys-theme",
      label: dark ? t`Giao diện sáng` : t`Giao diện tối`,
      hint: t`Đổi chế độ màu`,
      icon: dark ? <IconSun /> : <IconMoon />,
      onClick: toggleTheme,
    },
  ];

  const all: Group[] = [
    group("clan-core"),
    group("clan-community"),
    group("clan-tools-lookup"),
    group("clan-tools-data"),
    group("clan-work"),
    group("global"),
    {
      id: "system",
      label: t`Hệ thống`,
      hint: t`Tìm kiếm, ngôn ngữ, giao diện sáng/tối.`,
      tiles: system,
    },
  ].filter((g): g is Group => !!g && g.tiles.length > 0);

  const needle = unaccent(q.trim());
  const groups = all
    .map((g) => ({
      ...g,
      tiles: needle
        ? g.tiles.filter((x) => unaccent(x.label).includes(needle))
        : g.tiles,
    }))
    .filter((g) => g.tiles.length > 0);

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconGrid className="h-7 w-7" />}
        title={t`Tất cả tính năng`}
        description={t`Chọn một mục để mở.`}
      />

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
            <h2 className="text-lg font-semibold">{g.label}</h2>
            {g.hint && (
              <p className="text-sm text-muted-foreground">{g.hint}</p>
            )}
          </div>
          {/* Giống lưới trang Quản trị nền tảng: 2 cột ở điện thoại (ô vẫn đủ to để nhắm), 3–4 ở màn rộng. */}
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {g.tiles.map((tile) => (
              <li key={tile.key}>
                {tile.to ? (
                  <Link to={tile.to} className={TILE}>
                    <TileBody tile={tile} />
                  </Link>
                ) : (
                  <button type="button" onClick={tile.onClick} className={TILE}>
                    <TileBody tile={tile} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}

      {/* Ô tìm kiếm toàn cục điều khiển từ ô "Tìm kiếm" ở trên; không vẽ thêm nút kính lúp. */}
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        hideTrigger
      />
    </div>
  );
}
