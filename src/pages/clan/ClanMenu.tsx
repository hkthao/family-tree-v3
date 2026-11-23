import { t } from "@lingui/core/macro";
import { useState } from "react";

import { GlobalSearch } from "@/components/GlobalSearch";
import {
  IconGlobe,
  IconGrid,
  IconMoon,
  IconSearch,
  IconSun,
} from "@/components/icons";
import { HubView } from "@/components/HubView";
import { PageHeader } from "@/components/PageHeader";
import { useThemeToggle } from "@/components/ThemeQuickToggle";
import type { HubGroup } from "@/hooks/useHubGroups";
import { usePageTitle } from "@/hooks/usePageTitle";
import { LOCALES, currentLocale } from "@/lib/i18n";
import { useChangeLocale } from "@/lib/i18n/useLocale";

/**
 * "Tất cả tính năng" — trang hub, thiết kế GIỐNG trang Quản trị nền tảng (AdminHub). Toàn bộ phần vẽ
 * (ô lọc, nhóm, lưới ô) nằm ở `HubView` và dùng chung với ngăn kéo "Tính năng" ở thanh đầu trang;
 * danh sách mục lấy từ `navModel` qua `useHubGroups`. Ở đây chỉ còn tiêu đề trang và nhóm "Hệ thống"
 * (tìm kiếm, ngôn ngữ, sáng/tối — đổi một chạm, không rời trang) thêm vào cuối.
 */
export default function ClanMenu() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { dark, toggle: toggleTheme } = useThemeToggle();
  const changeLocale = useChangeLocale();
  usePageTitle(t`Tất cả tính năng`);

  const system: HubGroup = {
    id: "system",
    label: t`Hệ thống`,
    hint: t`Tìm kiếm, ngôn ngữ, giao diện sáng/tối.`,
    tiles: [
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
    ],
  };

  return (
    <div className="space-y-5">
      <PageHeader
        icon={<IconGrid className="h-7 w-7" />}
        title={t`Tất cả tính năng`}
        description={t`Chọn một mục để mở.`}
      />

      <HubView variant="page" extraGroups={[system]} />

      {/* Ô tìm kiếm toàn cục điều khiển từ ô "Tìm kiếm" ở trên; không vẽ thêm nút kính lúp. */}
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        hideTrigger
      />
    </div>
  );
}
