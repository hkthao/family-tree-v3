import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState } from "react";

import { FeaturesButton } from "@/components/FeaturesButton";
import { GlobalSearch } from "@/components/GlobalSearch";
import {
  IconGlobe,
  IconMoon,
  IconMore,
  IconPhoneDownload,
  IconQrCode,
  IconRefresh,
  IconSearch,
  IconSun,
} from "@/components/icons";
import { useInstallApp } from "@/components/InstallAppButton";
import { QrCodeModal } from "@/components/QrCodeModal";
import { LanguageButton } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import {
  ThemeQuickToggle,
  useThemeToggle,
} from "@/components/ThemeQuickToggle";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { LOCALES, currentLocale } from "@/lib/i18n";
import { useChangeLocale } from "@/lib/i18n/useLocale";
import { forceRefreshAll } from "@/lib/queryClient";

/**
 * Cụm nút bên phải thanh đầu app.
 *  - Màn rộng (≥sm): các nút riêng — Tính năng, Tìm kiếm, Thông báo, Ngôn ngữ, Sáng/Tối.
 *  - Điện thoại: giữ nút Tính năng + nút Thông báo (cần thấy dấu chấm đỏ) + menu ba chấm dọc chứa
 *    phần còn lại, như các app điện thoại.
 */
export function HeaderActions() {
  const wide = useMediaQuery("(min-width: 640px)");
  const [qrOpen, setQrOpen] = useState(false);
  // Gắn ở đây (luôn mounted) chứ không trong menu: sự kiện beforeinstallprompt chỉ phát một lần lúc tải trang.
  const install = useInstallApp();
  const url = typeof window === "undefined" ? "" : window.location.origin;
  return (
    <>
      {wide ? (
        <div className="flex items-center gap-1">
          <FeaturesButton />
          <GlobalSearch />
          <NotificationBell />
          <LanguageButton />
          <ThemeQuickToggle />
          {/* Tiện ích ít dùng (QR mở app, tải lại dữ liệu) luôn nằm trong menu ba chấm, kể cả trên máy tính, để thanh đầu không chật. */}
          <MoreMenu onQr={() => setQrOpen(true)} install={install} />
        </div>
      ) : (
        <MobileActions onQr={() => setQrOpen(true)} install={install} />
      )}
      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={url}
        title={t`Mở Dòng Họ Việt trên điện thoại`}
        description={t`Mở camera điện thoại, hướng vào mã QR để mở app.`}
      />
    </>
  );
}

const ITEM =
  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm hover:bg-muted";

/** Hai mục tiện ích dùng chung cho menu ba chấm (điện thoại + máy tính). */
type InstallApi = ReturnType<typeof useInstallApp>;

function UtilityItems({
  onQr,
  install,
  close,
}: {
  onQr: () => void;
  install: InstallApi;
  close: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <>
      {install.canInstall && (
        <button
          type="button"
          role="menuitem"
          className={ITEM}
          onClick={() => {
            close();
            void install.install();
          }}
        >
          <IconPhoneDownload className="h-4 w-4 text-muted-foreground" />
          {t`Cài app lên màn hình`}
        </button>
      )}
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        onClick={() => {
          close();
          onQr();
        }}
      >
        <IconQrCode className="h-4 w-4 text-muted-foreground" />
        {t`Mã QR mở app`}
      </button>
      <button
        type="button"
        role="menuitem"
        className={ITEM}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await forceRefreshAll();
          } catch {
            setBusy(false);
          }
        }}
      >
        <IconRefresh
          className={`h-4 w-4 text-muted-foreground ${busy ? "animate-spin" : ""}`}
        />
        {busy ? t`Đang tải lại…` : t`Tải lại dữ liệu`}
      </button>
    </>
  );
}

/** Menu ba chấm cho màn rộng: chỉ chứa tiện ích (các nút chính vẫn nằm ngoài thanh). */
function MoreMenu({
  onQr,
  install,
}: {
  onQr: () => void;
  install: InstallApi;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);
  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label={t`Tuỳ chọn`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={t`Tuỳ chọn`}
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <IconMore className="h-5 w-5" />
      </button>
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border bg-card p-1 shadow-lg"
        >
          <UtilityItems
            onQr={onQr}
            install={install}
            close={() => setMenuOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

function MobileActions({
  onQr,
  install,
}: {
  onQr: () => void;
  install: InstallApi;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { dark, toggle } = useThemeToggle();
  const changeLocale = useChangeLocale();

  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) =>
      e.key === "Escape" && setMenuOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const item = ITEM;

  return (
    <div className="flex items-center gap-1">
      <FeaturesButton />
      <NotificationBell />
      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={t`Tuỳ chọn`}
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          title={t`Tuỳ chọn`}
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
              {t`Tìm kiếm`}
            </button>
            {LOCALES.filter((l) => l.id !== currentLocale()).map((l) => (
              <button
                key={l.id}
                type="button"
                role="menuitem"
                className={item}
                onClick={() => {
                  setMenuOpen(false);
                  void changeLocale(l.id);
                }}
              >
                <IconGlobe className="h-4 w-4 text-muted-foreground" />
                {l.label}
              </button>
            ))}
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
              {dark ? t`Giao diện sáng` : t`Giao diện tối`}
            </button>
            <UtilityItems
              onQr={onQr}
              install={install}
              close={() => setMenuOpen(false)}
            />
          </div>
        )}
      </div>
      {/* Ô tìm kiếm điều khiển từ menu; không vẽ thêm nút kính lúp. */}
      <GlobalSearch
        open={searchOpen}
        onOpenChange={setSearchOpen}
        hideTrigger
      />
    </div>
  );
}
