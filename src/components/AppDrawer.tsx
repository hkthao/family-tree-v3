import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, NavLink, useParams } from "react-router-dom";

import { AppLogo } from "@/components/AppLogo";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { signOutAndClearCache } from "@/lib/auth-actions";
import { getClanDetail, type ClanDetail } from "@/lib/queries/clan-detail";
import { queryKeys } from "@/lib/queries/keys";
import { getMyProfile, type MyProfile } from "@/lib/queries/profile";
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

  // Close when the user navigates somewhere via a drawer link. We can't
  // attach this in items themselves cleanly because NavLink also re-renders
  // on its own location change — easier to just close from a parent click
  // handler.
  function pick(): void {
    onClose();
  }

  const sections = buildSections(clanId, clan ?? null, profile ?? null);

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
            Gia phả
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted lg:hidden"
            aria-label="Đóng menu"
          >
            <span className="text-lg" aria-hidden="true">✕</span>
          </button>
        </header>

        <nav className="flex-1 overflow-y-auto py-2">
          {sections.map((section) => (
            <div key={section.label} className="py-2">
              <h2 className="px-4 pb-1 text-[11px] uppercase tracking-wider text-muted-foreground">
                {section.label}
              </h2>
              <ul>
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      onClick={pick}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 px-4 py-2.5 text-sm",
                          isActive
                            ? "bg-primary/10 text-primary border-l-4 border-primary pl-3"
                            : "text-foreground hover:bg-muted/50 border-l-4 border-transparent pl-3",
                        )
                      }
                    >
                      <span className="text-lg" aria-hidden="true">
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer — user identity + logout in a single row to keep the
            nav body roomy. Logout is icon-only with a tooltip; the row
            itself is the visible "I'm signed in as X" cue. */}
        <footer className="border-t p-3">
          {profile ? (
            <div className="flex items-center gap-3">
              <div
                className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium shrink-0"
                aria-hidden="true"
              >
                {initialOf(profile.display_name ?? user?.email ?? "?")}
              </div>
              <div className="flex-1 min-w-0">
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
              <button
                type="button"
                onClick={() => {
                  onClose();
                  void signOutAndClearCache();
                }}
                className="h-9 w-9 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
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
              Đăng xuất
            </Button>
          )}
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

// ---------------------------------------------------------------------------

interface DrawerItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
}
interface DrawerSection {
  label: string;
  items: DrawerItem[];
}

/**
 * Compute the visible item set for the current viewer + clan context.
 * Centralised so we have a single place to change when a new clan page
 * lands. Permission helpers mirror useClanContext — platform admin
 * counts as clan admin everywhere.
 */
function buildSections(
  clanId: string | undefined,
  clan: ClanDetail | null,
  profile: MyProfile | null,
): DrawerSection[] {
  const sections: DrawerSection[] = [];

  // -- Global section ------------------------------------------------------
  const global: DrawerItem[] = [
    {
      to: "/clans",
      label: profile?.is_platform_admin ? "Tất cả dòng họ" : "Dòng họ của tôi",
      icon: "🏘",
      end: true,
    },
    { to: "/clans/new", label: "Tạo dòng họ mới", icon: "✚" },
    { to: "/account", label: "Tài khoản", icon: "👤" },
  ];
  if (profile?.is_platform_admin) {
    global.push({ to: "/admin", label: "Quản trị nền tảng", icon: "🛡" });
  }
  sections.push({ label: "Chung", items: global });

  // -- Clan-scoped section -------------------------------------------------
  if (clanId && clan) {
    const isAdmin = clan.isPlatformAdmin || clan.myRole === "admin";
    const canEdit =
      clan.isPlatformAdmin ||
      clan.myRole === "admin" ||
      clan.myRole === "editor";
    const isMember = clan.isPlatformAdmin || clan.myRole !== null;

    const items: DrawerItem[] = [
      { to: `/clans/${clanId}`, label: "Tổng quan", icon: "🏠", end: true },
      { to: `/clans/${clanId}/people`, label: "Danh bạ", icon: "📋" },
      { to: `/clans/${clanId}/tree`, label: "Cây gia phả", icon: "🌳" },
      { to: `/clans/${clanId}/events`, label: "Sự kiện", icon: "🗓" },
    ];
    if (canEdit) {
      items.push({
        to: `/clans/${clanId}/import`,
        label: "Nhập từ Excel",
        icon: "📥",
      });
      items.push({
        to: `/clans/${clanId}/merge`,
        label: "Gộp người trùng",
        icon: "🔗",
      });
    }
    if (isMember) {
      items.push({
        to: `/clans/${clanId}/audit`,
        label: "Nhật ký",
        icon: "📜",
      });
    }
    if (isAdmin) {
      items.push({
        to: `/clans/${clanId}/members`,
        label: "Thành viên",
        icon: "👥",
      });
      items.push({
        to: `/clans/${clanId}/settings`,
        label: "Cài đặt dòng họ",
        icon: "⚙️",
      });
    }

    sections.push({ label: clan.name, items });
  }

  return sections;
}
