import { t } from "@lingui/core/macro";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { AppLogo } from "@/components/AppLogo";
import { IconChevronDown, IconPlus, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { track } from "@/lib/analytics";
import { ScrollTopButton } from "@/components/site/ScrollTopButton";
import { ThemeQuickToggle } from "@/components/ThemeQuickToggle";
import { cn } from "@/lib/utils";
import {
  buildSiteMenu,
  sitePagePath,
  type SiteMenuEntry,
  type SitePageKey,
} from "@/lib/siteSections";
import { usePageTitle } from "@/hooks/usePageTitle";

import { SiteSearch } from "./SiteSearch";

import { useSite } from "./siteContext";

function pageLabel(p: SitePageKey): string {
  switch (p) {
    case "home":
      return t`Trang chủ`;
    case "board":
      return t`Bảng tin`;
    case "tree":
      return t`Cây gia phả`;
    case "events":
      return t`Sự kiện & giỗ`;
    case "heritage":
      return t`Di sản & tư liệu`;
    case "graves":
      return t`Mộ phần & tro cốt`;
    case "honor":
      return t`Bảng vàng công đức`;
    case "contribute":
      return t`Cùng góp`;
    case "person":
      return t`Hồ sơ`;
    case "card":
      return t`Thiệp`;
  }
}

/** Dòng menu: gạch chân (rộng đúng bằng chữ) cho mục đang xem, như tab. */
function NavUnderline({ active, children }: { active: boolean; children: ReactNode }) {
  // Gạch chân vẽ bằng ::after (mảnh 2px, cách chữ ~10px) nên không làm chữ lệch khỏi tâm hàng.
  return (
    <span
      className={cn(
        "relative inline-block after:absolute after:inset-x-0 after:-bottom-[10px] after:h-0.5 after:rounded-full",
        active ? "text-foreground after:bg-primary" : "text-muted-foreground group-hover:text-foreground",
      )}
    >
      {children}
    </span>
  );
}

function useIsActive() {
  const { base } = useSite();
  const { pathname } = useLocation();
  return (page: SitePageKey): boolean => {
    const href = sitePagePath(base, page);
    return page === "home" ? pathname === href || pathname === `${href}/` : pathname === href || pathname.startsWith(`${href}/`);
  };
}

function GroupMenu({ entry }: { entry: Extract<SiteMenuEntry, { kind: "group" }> }) {
  const { base } = useSite();
  const isActive = useIsActive();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const activeInGroup = entry.pages.some(isActive);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="group inline-flex min-h-12 items-center gap-1 px-3.5 text-base font-medium"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <NavUnderline active={activeInGroup}>{t`Di sản`}</NavUnderline>
        <IconChevronDown className="h-4 w-4 text-muted-foreground" />
      </button>
      {open && (
        <div role="menu" className="absolute left-[-2px] top-[calc(100%+0.8rem)] z-40 min-w-60 rounded-xl border bg-card py-1.5 shadow-lg">
          {entry.pages.map((p) => (
            <Link
              key={p}
              role="menuitem"
              to={sitePagePath(base, p)}
              className={cn(
                "flex min-h-11 items-center px-4 text-base hover:bg-muted",
                isActive(p) && "bg-primary/10 font-semibold",
              )}
            >
              {pageLabel(p)}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** Khung chung: header + menu (máy tính: tab gạch chân; điện thoại: nút ba gạch) + footer + nút lên đầu trang. */
export function ClanSiteLayout({ children }: { children: ReactNode }) {
  const { base, data, sections, canContribute, focus } = useSite();
  const menu: SiteMenuEntry[] = focus ? [{ kind: "page", page: focus }] : buildSiteMenu(sections, { canContribute });
  const routeActive = useIsActive();
  // Link tập trung chỉ có một mục nên luôn là mục đang xem (địa chỉ có thể là gốc /khoe/:token, không có đoạn con).
  const isActive = focus ? (p: SitePageKey) => p === focus : routeActive;
  const { pathname } = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => setMobileOpen(false), [pathname]);
  const name = data.clan_name ?? t`Dòng họ`;
  usePageTitle(data.clan_name ? t`Gia phả ${data.clan_name}` : null);

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b bg-background print-hide">
        <div className="container max-w-6xl">
          <div className="flex min-h-16 items-center gap-x-6">
            <Link to={base} className="clan-name flex min-w-0 max-w-[min(20rem,60vw)] shrink items-center gap-2.5 text-lg font-bold" title={name}>
              <AppLogo size={28} className="shrink-0 rounded" />
              <span className="truncate">{name}</span>
            </Link>

            <nav aria-label={t`Menu dòng họ`} className="hidden flex-1 flex-wrap items-center lg:flex">
              {menu.map((e) =>
                e.kind === "group" ? (
                  <GroupMenu key="group" entry={e} />
                ) : (
                  <Link
                    key={e.page}
                    to={sitePagePath(base, e.page)}
                    className="group inline-flex min-h-12 items-center px-3.5 text-base font-medium"
                    aria-current={isActive(e.page) ? "page" : undefined}
                  >
                    <NavUnderline active={isActive(e.page)}>{pageLabel(e.page)}</NavUnderline>
                  </Link>
                ),
              )}
            </nav>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              {!focus && <SiteSearch pageLabel={pageLabel} />}
              <ThemeQuickToggle />
              <button
                type="button"
                className="inline-flex h-11 w-11 items-center justify-center rounded-lg border bg-card lg:hidden"
                aria-label={mobileOpen ? t`Đóng menu` : t`Mở menu`}
                aria-expanded={mobileOpen}
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? (
                  <IconX className="h-5 w-5" />
                ) : (
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {mobileOpen && (
            <nav aria-label={t`Menu dòng họ`} className="flex w-full flex-col border-t py-2 lg:hidden">
              {menu.flatMap((e) =>
                e.kind === "group"
                  ? [
                      <div key="g-head" className="px-3 pb-0.5 pt-3 text-xs font-semibold uppercase tracking-wider text-accent">
                        {t`Di sản`}
                      </div>,
                      ...e.pages.map((p) => (
                        <MobileLink key={p} to={sitePagePath(base, p)} active={isActive(p)} sub>
                          {pageLabel(p)}
                        </MobileLink>
                      )),
                    ]
                  : [
                      <MobileLink key={e.page} to={sitePagePath(base, e.page)} active={isActive(e.page)}>
                        {pageLabel(e.page)}
                      </MobileLink>,
                    ],
              )}
            </nav>
          )}
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <ScrollTopButton />
      <SiteFooter name={name} />
    </div>
  );
}

function MobileLink({ to, active, sub, children }: { to: string; active: boolean; sub?: boolean; children: ReactNode }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-12 items-center border-l-4 pr-3 text-base",
        sub ? "pl-7 text-[15px]" : "pl-3",
        active ? "border-primary bg-primary/10 font-semibold" : "border-transparent text-muted-foreground",
      )}
    >
      {children}
    </Link>
  );
}

function SiteFooter({ name }: { name: string }) {
  const { base, sections, canContribute, access, focus } = useSite();
  const menu = focus ? [] : buildSiteMenu(sections, { canContribute });
  const pages = menu.flatMap((e) => (e.kind === "group" ? e.pages : [e.page])).filter((p) => p !== "home");
  const explore = pages.filter((p) => p !== "contribute");
  return (
    <footer className="border-t bg-background print-hide">
      <div className="container grid max-w-6xl grid-cols-1 gap-x-12 gap-y-8 py-10 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Link to={base} className="clan-name inline-flex max-w-full items-center gap-2.5 text-lg font-bold">
            <AppLogo size={28} className="shrink-0 rounded" />
            <span className="break-words">{name}</span>
          </Link>
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">{t`Gia phả, bảng tin và những câu chuyện của dòng họ — để con cháu ở xa vẫn biết đường về.`}</p>
          <Button asChild size="sm" variant="outline" className="mt-4 px-3 text-sm">
            <Link to="/signup" onClick={() => track("share_cta_click", { mode: access.token ? "token" : "public_clan" })}>
              <IconPlus className="mr-1.5 h-4 w-4" />
              {t`Tạo gia phả cho họ bạn`}
            </Link>
          </Button>
        </div>
        <nav aria-label={t`Khám phá`} className="min-w-0">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-accent">{t`Khám phá`}</div>
          <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
            {explore.map((p) => (
              <Link key={p} to={sitePagePath(base, p)} className="flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground">
                {pageLabel(p)}
              </Link>
            ))}
          </div>
        </nav>
        <nav aria-label={t`Tham gia`} className="flex min-w-0 flex-col">
          <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-accent">{t`Tham gia`}</div>
          {canContribute && !focus && (
            <Link to={sitePagePath(base, "contribute")} className="flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground">
              {t`Cùng đóng góp`}
            </Link>
          )}
          <Link to="/login" className="flex min-h-9 items-center text-sm text-muted-foreground hover:text-foreground">
            {t`Đăng nhập`}
          </Link>
        </nav>
      </div>
      <div className="container flex max-w-6xl flex-wrap justify-between gap-x-6 gap-y-2 border-t py-4 pb-7 text-xs text-muted-foreground">
        <span className="min-w-0 break-words">© {new Date().getFullYear()} {name}</span>
        <span>{t`Làm bằng Dòng Họ Việt`}</span>
      </div>
    </footer>
  );
}
