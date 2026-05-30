import { useOutletContext } from "react-router-dom";

import type { ClanDetail } from "@/lib/queries/clan-detail";

export interface ClanOutletContext {
  clan: ClanDetail;
}

/**
 * Type-safe access to the current clan from inside nested routes under
 * /clans/:clanId/*. ClanLayout supplies it via <Outlet context={...} />.
 */
export function useClanContext(): ClanOutletContext {
  return useOutletContext<ClanOutletContext>();
}
