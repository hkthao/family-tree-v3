import { useQuery } from "@tanstack/react-query";
import { lazy, Suspense, useEffect, useMemo } from "react";
import { Navigate, Route, Routes, useLocation, useParams } from "react-router-dom";

import { track } from "@/lib/analytics";
import { fetchPublicClanView, fetchShareView } from "@/lib/queries/share-view";
import { focusPageOf, isPageVisible, isShellScope, resolveSiteFlag, SITE_PAGE_PATH, type SitePageKey } from "@/lib/siteSections";

import { ClanSiteLayout } from "./ClanSiteLayout";
import { SiteProvider, type SiteCtx } from "./siteContext";

const Share = lazy(() => import("@/pages/Share"));
const SiteHome = lazy(() => import("./SiteHome"));
const SiteBoard = lazy(() => import("./SiteBoard"));
const SitePost = lazy(() => import("./SitePost"));
const SitePerson = lazy(() => import("./SitePerson"));
const SiteTree = lazy(() => import("./SiteTree"));
const SiteEvents = lazy(() => import("./SiteEvents"));
const SiteHeritage = lazy(() => import("./SiteHeritage"));
const SiteHeritageItem = lazy(() => import("./SiteHeritageItem"));
const SiteGraves = lazy(() => import("./SiteGraves"));
const SiteHonor = lazy(() => import("./SiteHonor"));
const SiteContribute = lazy(() => import("./SiteContribute"));
const FocusPage = lazy(() => import("./FocusPage"));

const FLAG_KEY = "family-tree:clan-site";

function useSiteFlag(): boolean {
  const { search } = useLocation();
  return useMemo(() => {
    let stored: string | null = null;
    try {
      stored = sessionStorage.getItem(FLAG_KEY);
    } catch {
      /* private mode */
    }
    return resolveSiteFlag(search, stored, import.meta.env.VITE_CLAN_SITE);
  }, [search]);
}

/**
 * Cửa vào `/share/:token/*` và `/xem/clans/:clanId/*`. Trang dòng họ (website nhiều trang) chỉ cho scope tree_view / contribute
 * và đang bật cờ (`?site=1` / VITE_CLAN_SITE=1); còn lại chuyển nguyên cho màn Share cũ.
 */
export default function ClanSiteRoot() {
  const { token, clanId } = useParams<{ token?: string; clanId?: string }>();
  const { search } = useLocation();
  const enabled = useSiteFlag();
  useEffect(() => {
    const q = new URLSearchParams(search).get("site");
    if (q === "1" || q === "0") {
      try {
        sessionStorage.setItem(FLAG_KEY, q);
      } catch {
        /* private mode */
      }
    }
  }, [search]);

  // Cùng khoá truy vấn với màn Share → không gọi hai lần.
  const { data, isLoading } = useQuery({
    queryKey: ["share-view", token ?? `clan:${clanId}`],
    queryFn: () => (token ? fetchShareView(token) : fetchPublicClanView(clanId!)),
    enabled: enabled && (!!token || !!clanId),
    retry: false,
  });

  // Đo lượt xem như màn Share cũ (phễu tăng trưởng): trang công khai vs link chia sẻ.
  const scope = data?.scope;
  useEffect(() => {
    if (!scope) return;
    if (!token) track("public_clan_viewed");
    else track("share_viewed", { scope });
  }, [scope, token]);

  const fallback = (
    <Suspense fallback={null}>
      <Share />
    </Suspense>
  );
  if (!enabled) return fallback;
  if (isLoading) return <p className="p-8 text-center text-muted-foreground">…</p>;
  if (!data || !isShellScope(data.scope)) return fallback;
  const focus = focusPageOf(data.scope);

  const sections = data.site_sections ?? [];
  const canContribute = !!token && !!data.community?.can_contribute;
  const ctx: SiteCtx = {
    base: token ? `/share/${token}` : `/xem/clans/${clanId}`,
    access: token ? { token } : { clanId },
    data,
    sections,
    canContribute,
    focus: focus ?? undefined,
  };
  const guard = (page: SitePageKey, el: JSX.Element) =>
    isPageVisible(page, sections, { canContribute }) ? el : <Navigate to={ctx.base} replace />;

  if (focus) {
    return (
      <SiteProvider value={ctx}>
        <ClanSiteLayout>
          <Suspense fallback={<p className="p-8 text-center text-muted-foreground">…</p>}>
            <FocusPage data={data} token={token} base={ctx.base} />
          </Suspense>
        </ClanSiteLayout>
      </SiteProvider>
    );
  }

  return (
    <SiteProvider value={ctx}>
      <ClanSiteLayout>
        <Suspense fallback={<p className="p-8 text-center text-muted-foreground">…</p>}>
          <Routes>
            <Route index element={<InviteRedirect base={ctx.base} search={search} home={<SiteHome />} />} />
            <Route path={SITE_PAGE_PATH.board} element={guard("board", <SiteBoard />)} />
            <Route path={`${SITE_PAGE_PATH.board}/:postId`} element={guard("board", <SitePost />)} />
            <Route path={SITE_PAGE_PATH.events} element={guard("events", <SiteEvents />)} />
            <Route path={SITE_PAGE_PATH.heritage} element={guard("heritage", <SiteHeritage />)} />
            <Route path={`${SITE_PAGE_PATH.heritage}/:itemId`} element={guard("heritage", <SiteHeritageItem />)} />
            <Route path={SITE_PAGE_PATH.graves} element={guard("graves", <SiteGraves />)} />
            <Route path={SITE_PAGE_PATH.honor} element={guard("honor", <SiteHonor />)} />
            <Route path={SITE_PAGE_PATH.tree} element={guard("tree", <SiteTree />)} />
            <Route path={`${SITE_PAGE_PATH.person}/:personId`} element={<SitePerson />} />
            <Route path={SITE_PAGE_PATH.contribute} element={guard("contribute", <SiteContribute />)} />
            <Route path="*" element={<Navigate to={ctx.base} replace />} />
          </Routes>
        </Suspense>
      </ClanSiteLayout>
    </SiteProvider>
  );
}

/**
 * Link mời góp cũ (`/share/:token?tab=gop|hoi&p=…&q=…`) mở thẳng khu Cùng góp; mọi thứ khác là trang chủ.
 */
function InviteRedirect({ base, search, home }: { base: string; search: string; home: JSX.Element }) {
  const sp = new URLSearchParams(search);
  const tab = sp.get("tab");
  if (tab === "gop" || tab === "hoi" || sp.get("q")) {
    const next = new URLSearchParams(search);
    next.delete("site");
    const qs = next.toString();
    return <Navigate to={`${base}/${SITE_PAGE_PATH.contribute}${qs ? `?${qs}` : ""}`} replace />;
  }
  return home;
}
