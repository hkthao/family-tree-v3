import { createContext, useContext } from "react";
import { useOutletContext } from "react-router-dom";

import type { ClanDetail } from "@/lib/queries/clan-detail";

export interface ClanOutletContext {
  clan: ClanDetail;
}

/**
 * Cấp dòng họ cho nội dung nằm NGOÀI <Outlet> của ClanLayout (ngăn kéo —
 * PanelHost — render ở layout nên useOutletContext không có giá trị).
 */
export const ClanContextProvider = createContext<ClanOutletContext | null>(null);

/**
 * Type-safe access to the current clan from inside nested routes under
 * /clans/:clanId/*. ClanLayout supplies it via <Outlet context={...} />;
 * ngăn kéo thì qua ClanContextProvider (ưu tiên khi có).
 */
export function useClanContext(): ClanOutletContext {
  const fromProvider = useContext(ClanContextProvider);
  const fromOutlet = useOutletContext<ClanOutletContext | undefined>();
  const ctx = fromProvider ?? fromOutlet;
  if (!ctx) throw new Error("useClanContext cần nằm trong ClanLayout (Outlet hoặc PanelHost)");
  return ctx;
}

/**
 * Effective role for UI gating. Platform admin is treated as clan admin
 * everywhere — they see + edit + manage every clan even when they're not
 * an explicit clan_members row. The underlying RLS helpers already grant
 * the access; this just keeps the UI in sync.
 */
export function effectiveRole(
  clan: Pick<ClanDetail, "myRole" | "isPlatformAdmin">,
): "admin" | "editor" | "viewer" | null {
  if (clan.isPlatformAdmin) return "admin";
  return clan.myRole;
}

export function canEditClan(
  clan: Pick<ClanDetail, "myRole" | "isPlatformAdmin">,
): boolean {
  const r = effectiveRole(clan);
  return r === "admin" || r === "editor";
}

export function isClanAdmin(
  clan: Pick<ClanDetail, "myRole" | "isPlatformAdmin">,
): boolean {
  return effectiveRole(clan) === "admin";
}
