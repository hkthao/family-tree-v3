import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, NavLink, useLocation, useParams } from "react-router-dom";


import { useAiEnabled } from "@/hooks/useAiEnabled";
import { AppLogo } from "@/components/AppLogo";
import { AppVersion } from "@/components/AppVersion";
import {
  IconChevronDown,
  IconFacebook,
  IconGlobe,
  IconLogOut,
} from "@/components/icons";
import { CheckUpdateButton } from "@/components/CheckUpdateButton";
import { FeedbackButton } from "@/components/FeedbackButton";
import {
  buildSections,
  isItemActive,
  sectionBadge,
  useCollapsedSections,
} from "@/lib/navModel";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ShareAppQrButton } from "@/components/ShareAppQrButton";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signOutAndClearCache } from "@/lib/auth-actions";
import { getClanDetail } from "@/lib/queries/clan-detail";
import { queryKeys } from "@/lib/queries/keys";
import { countPendingContributions } from "@/lib/queries/contributions";
import { countPendingPersonLinks } from "@/lib/queries/person-links";
import { getMyProfile } from "@/lib/queries/profile";
import { countClanTodo } from "@/lib/queries/todo";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * Mobile-first slide-in drawer (think Android nav drawer) that surfaces
 * every page the current user has access to. Items are filtered by:
 *   - whether we're inside a specific clan (clan-scoped items only render
 *     when the URL is /clans/:clanId/*),
 *   - the caller's role in that clan (admin / editor / viewer),
 *   - profiles.is_platform_admin for the global /admin entry.
 *
 * The drawer is self-contained: it reads route + user state itself, so
 * any layout can just render it with open/onClose and a hamburger button.
 */
export function AppDrawer({ open, onClose }: Props) {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const { clanId } = useParams<{ clanId?: string }>();

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const { data: clan } = useQuery({
    queryKey: queryKeys.clan(clanId ?? "", userId),
    queryFn: () => getClanDetail(clanId!, userId),
    enabled: !!userId && !!clanId,
  });
  // Pending contributions count — drives the drawer badge. RLS only
  // returns rows the user can SELECT, so for viewers this is always 0.
  const canSeeContribs =
    !!clan &&
    (clan.isPlatformAdmin ||
      clan.myRole === "admin" ||
      clan.myRole === "editor");
  const { data: pendingContribCount } = useQuery({
    queryKey: queryKeys.pendingContributionsCount(clanId ?? "", userId),
    queryFn: () => countPendingContributions(clanId!),
    enabled: !!userId && !!clanId && canSeeContribs,
    // Cheap COUNT — refetch fairly often so the badge feels live
    // when admin lands on the drawer.
    staleTime: 30_000,
  });
  // Pending in-law links on either side of this clan. Admin-only —
  // viewers can't see person_links rows anyway, but skipping the
  // probe saves a request.
  const canSeeInlaws =
    !!clan && (clan.isPlatformAdmin || clan.myRole === "admin");
  const { data: pendingInlawCount } = useQuery({
    queryKey: queryKeys.pendingPersonLinksCount(clanId ?? "", userId),
    queryFn: () => countPendingPersonLinks(clanId!),
    enabled: !!userId && !!clanId && canSeeInlaws,
    staleTime: 30_000,
  });
  // Todo count — every clan member can see it. RPC gates on
  // is_clan_member so platform admin gets it too.
  const canSeeTodo = !!clan && (clan.isPlatformAdmin || clan.myRole !== null);
  const { data: todoCount } = useQuery({
    queryKey: queryKeys.clanTodoCount(clanId ?? "", userId),
    queryFn: () => countClanTodo(clanId!),
    enabled: !!userId && !!clanId && canSeeTodo,
    staleTime: 60_000,
  });

  // On mobile, lock body scroll while the drawer is open so the page
  // doesn't scroll out from under the user on iOS. On desktop (≥lg) the
  // drawer is part of the layout and never modal, so skip the lock.
  useEffect(() => {
    if (!open) return;
    if (typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches) {
      return;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // ESC đóng drawer (modal trên mobile) — bàn phím ngang tầm với chạm nền.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Close when the user navigates somewhere via a drawer link. We can't
  // attach this in items themselves cleanly because NavLink also re-renders
  // on its own location change — easier to just close from a parent click
  // handler.
  function pick(): void {
    onClose();
  }

  const location = useLocation();
  const aiEnabled = useAiEnabled();
  const isAdminArea =
    location.pathname === "/admin" || location.pathname.startsWith("/admin/");
  const sections = buildSections(
    clanId,
    clan ?? null,
    profile ?? null,
    pendingContribCount ?? 0,
    pendingInlawCount ?? 0,
    todoCount ?? 0,
    aiEnabled,
    isAdminArea,
  );

  const { isOpen, toggle } = useCollapsedSections(location.pathname);

  return (
    <>
      {/* Backdrop — mobile only */}
      <div
        className={cn(
          "fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer — modal slide-in on mobile, persistent sidebar on lg+. */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Điều hướng"
        className={cn(
          "fixed top-0 left-0 bottom-0 z-40 w-72 max-w-[85vw]",
          "bg-background border-r shadow-lg lg:shadow-none",
          "flex flex-col",
          "transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full",
          // ≥lg: always visible, no transform regardless of `open`.
          "lg:translate-x-0",
        )}
      >
        {/* Header — matches AppHeader's min-h-[64px] + text-2xl so both
            align pixel-perfect across the seam between sidebar and main. */}
        <header className="border-b px-4 flex items-center justify-between h-[64px]">
          <Link
            to="/clans"
            onClick={pick}
            className="clan-name text-2xl font-semibold text-primary inline-flex items-center gap-2"
          >
            <AppLogo size={28} className="rounded" />
            Dòng Họ Việt
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-muted lg:hidden"
            aria-label="Đóng menu"
          >
            <span className="text-lg" aria-hidden="true">✕</span>
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section) => {
            const open = isOpen(section);
            return (
              <div key={section.id} className="py-1">
                {section.collapsible === false ? (
                  <h2 className="px-4 pb-1 pt-1 text-xs uppercase tracking-wider text-muted-foreground">
                    {section.label}
                  </h2>
                ) : (
                  <button
                    type="button"
                    onClick={() => toggle(section)}
                    aria-expanded={open}
                    // 44px: nhóm gập được là thứ người dùng bấm thật,
                    // không phải nhãn trang trí như tiêu đề nhóm cố định.
                    className="flex min-h-[44px] w-full items-center gap-2 px-4 text-xs uppercase tracking-wider text-muted-foreground hover:text-foreground"
                  >
                    <IconChevronDown
                      className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        open ? "" : "-rotate-90",
                      )}
                    />
                    <span className="flex-1 text-left">{section.label}</span>
                    {!open && sectionBadge(section) !== undefined && (
                      // Nhóm đang gập mà bên trong có việc chờ thì phải
                      // hiện ra ngoài — badge giấu trong nhóm gập là badge
                      // vô dụng.
                      <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                        {sectionBadge(section)}
                      </span>
                    )}
                  </button>
                )}
                {open && (
                  <ul>
                    {section.items.map((item) => (
                      <li key={item.to}>
                        {item.kind === "feedback" ? (
                          <FeedbackButton
                            className="flex w-full items-center gap-3 border-l-4 border-transparent py-2.5 pl-3 pr-4 text-left text-sm text-foreground hover:bg-muted/50"
                            label={item.label}
                            icon={item.icon}
                          />
                        ) : (
                          <NavLink
                            to={item.to}
                            end={item.end ?? false}
                            onClick={pick}
                            className={({ isActive }) =>
                              cn(
                                "flex items-center gap-3 px-4 py-2.5 text-sm",
                                isItemActive(item.to, location, isActive)
                                  ? "bg-primary/10 text-primary border-l-4 border-primary pl-3"
                                  : "text-foreground hover:bg-muted/50 border-l-4 border-transparent pl-3",
                              )
                            }
                          >
                            <span className="inline-flex items-center justify-center shrink-0">
                              {item.icon}
                            </span>
                            <span className="flex-1">{item.label}</span>
                            {item.badge !== undefined && (
                              <span className="ml-auto inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-semibold text-primary-foreground">
                                {item.badge}
                              </span>
                            )}
                          </NavLink>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer — user identity + logout in a single row to keep the
            nav body roomy. Logout is icon-only with a tooltip; the row
            itself is the visible "I'm signed in as X" cue. */}
        <footer className="border-t p-3 space-y-3">
          {/* All four utility actions share one row so the drawer
              footer doesn't waste vertical space — buttons are
              `flex-1 min-w-0` and labels short-form ("QR" not "Chia
              sẻ QR") so 3-4 fit on the 288-wide drawer without
              clipping. InstallAppButton self-hides when not
              installable, so on most desktop browsers this is just
              QR / Cập nhật. Góp ý ĐÃ CHUYỂN LÊN MENU — ở đây nó lẫn giữa
              mấy nút tiện ích, chỉ ai đi tìm mới thấy. */}
          <div className="flex gap-2">
            <InstallAppButton />
            <ShareAppQrButton />
            <CheckUpdateButton compact />
          </div>
          {profile ? (
            <div className="flex items-center gap-3">
              <Link
                to="/account"
                onClick={onClose}
                className="flex items-center gap-3 min-w-0 flex-1 rounded-md -m-1 p-1 hover:bg-muted/60"
                title="Xem tài khoản"
              >
                <div
                  className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0"
                  aria-hidden="true"
                >
                  {initialOf(profile.display_name ?? user?.email ?? "?")}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {profile.display_name ?? user?.email ?? "—"}
                    {profile.is_platform_admin && (
                      <span
                        className="ml-1.5 text-accent text-[10px] uppercase tracking-wide font-semibold"
                        title="Platform admin"
                      >
                        ★
                      </span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
              </Link>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void signOutAndClearCache();
                }}
                className="h-11 w-11 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Đăng xuất"
                title="Đăng xuất"
              >
                <LogoutIcon />
              </button>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                onClose();
                void signOutAndClearCache();
              }}
            >
              <IconLogOut className="h-4 w-4 mr-1.5" />
              Đăng xuất
            </Button>
          )}
          {/* Website + liên hệ hỗ trợ — meta links cuối sidebar */}
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <a
              href="https://donghoviet.thaohk.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-primary"
            >
              <IconGlobe className="h-3.5 w-3.5" />
              Website
            </a>
            <span aria-hidden="true">·</span>
            <a
              href="https://www.facebook.com/donghoviet2026"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-primary"
            >
              <IconFacebook className="h-3.5 w-3.5" />
              Fanpage
            </a>
          </div>
          <AppVersion className="text-center" />
        </footer>
      </aside>
    </>
  );
}

function initialOf(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  // For an email, take the first letter of the local part.
  const head = trimmed.includes("@") ? trimmed.split("@")[0] : trimmed;
  // Last word's first letter is conventional for Vietnamese full names.
  const parts = head.split(/\s+/).filter(Boolean);
  const tail = parts[parts.length - 1] ?? head;
  return tail.charAt(0).toUpperCase();
}

function LogoutIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}



