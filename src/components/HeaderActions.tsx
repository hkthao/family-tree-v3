import { useEffect, useRef, useState } from "react";

import { GlobalSearch } from "@/components/GlobalSearch";
import { IconMoon, IconMore, IconSearch, IconSun } from "@/components/icons";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeQuickToggle, useThemeToggle } from "@/components/ThemeQuickToggle";
import { useMediaQuery } from "@/hooks/useMediaQuery";

/**
 * Cụm nút bên phải thanh đầu app.
 *  - Màn rộng (≥sm): ba nút riêng — Tìm kiếm, Thông báo, Sáng/Tối.
 *  - Điện thoại: chỉ giữ MỘT nút Thông báo (cần thấy dấu chấm đỏ) + menu ba chấm dọc chứa
 *    phần còn lại, như các app điện thoại.
 */
export function HeaderActions() {
  const wide = useMediaQuery("(min-width: 640px)");
  if (wide) {
    return (
      <div className="flex items-center gap-1">
        <GlobalSearch />
        <NotificationBell />
        <ThemeQuickToggle />
      </div>
    );
  }
  return <MobileActions />;
}

function MobileActions() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { dark, label, toggle } = useThemeToggle();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const item =
    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted";

  return (
    <div className="flex items-center gap-1">
      <NotificationBell />
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Tuỳ chọn"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title="Tuỳ chọn"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <IconMore className="h-5 w-5" />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border bg-card p-1 shadow-lg"
          >
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                setMenuOpen(false);
                setSearchOpen(true);
              }}
            >
              <IconSearch className="h-4 w-4 text-muted-foreground" />
              Tìm kiếm
            </button>
            <button
              type="button"
              role="menuitem"
              className={item}
              onClick={() => {
                toggle();
                setMenuOpen(false);
              }}
            >
              {dark ? (
                <IconSun className="h-4 w-4 text-muted-foreground" />
              ) : (
                <IconMoon className="h-4 w-4 text-muted-foreground" />
              )}
              {label.replace("Chuyển sang giao diện", "Giao diện")}
            </button>
          </div>
        )}
      </div>
      {/* Ô tìm kiếm điều khiển từ menu; không vẽ thêm nút kính lúp. */}
      <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} hideTrigger />
    </div>
  );
}
