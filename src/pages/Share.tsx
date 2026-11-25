import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

import {
  IconCalendar,
  IconGrid,
  IconHelp,
  IconHome,
  IconTree,
  IconBook,
  IconLogIn,
  IconSend,
  IconPlus,
  IconShield,
  IconX,
} from "@/components/icons";
import { usePageTitle } from "@/hooks/usePageTitle";
import { track } from "@/lib/analytics";
import {
  clanHasSources,
  getHistoricalPersonExtras,
} from "@/lib/queries/historical";

import { LanguageButton } from "@/components/LanguageSwitcher";
import { ThemeQuickToggle } from "@/components/ThemeQuickToggle";
import { HistoricalPersonSections } from "@/components/HistoricalPersonSections";
import { SharedPersonCard } from "@/components/SharedPersonCard";
import { ShareOverview } from "@/components/share/ShareOverview";
import { ShareTree } from "@/components/share/ShareTree";
import {
  CommunitySharePanel,
  CommunityStatsLine,
} from "@/components/community/CommunitySharePanel";
import { SharedRestingPlaceCard } from "@/components/SharedRestingPlaceCard";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { UpcomingEventList } from "@/components/UpcomingEventList";
import { shareUpcoming } from "@/lib/shareUpcoming";
import {
  fetchPublicClanView,
  fetchShareView,
  type ShareViewPayload,
} from "@/lib/queries/share-view";
import { SharedHeritageCard } from "@/components/SharedHeritageCard";
import { HERITAGE_CATEGORY_LABEL } from "@/lib/queries/heritage";

import "family-chart/styles/family-chart.css";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
/**
 * /share/:token — read-only family tree for anonymous viewers. Calls the
 * Edge Function, which has already masked living persons' sensitive data.
 * Filters: search-to-focal + vertical/horizontal orientation.
 */
export default function Share() {
  // Hai nguồn: /share/:token (link chia sẻ) HOẶC /xem/clans/:clanId (xem trước
  // công khai dòng họ, không cần đăng nhập). clanId → luôn là cây (tree_view).
  const { token, clanId } = useParams<{ token?: string; clanId?: string }>();
  const publicClan = !token && !!clanId;
  // Người đang làm tâm cây (do ShareTree báo lên) + trạng thái toàn màn hình — Share chỉ cần đọc.
  const [focal, setFocal] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  // Lưu ý quyền riêng tư: người xem đóng được, nhớ theo thiết bị.
  const NOTICE_KEY = "family-tree:share-notice-dismissed";
  const [noticeOpen, setNoticeOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(NOTICE_KEY) !== "1";
    } catch {
      return true;
    }
  });
  const dismissNotice = () => {
    setNoticeOpen(false);
    try {
      localStorage.setItem(NOTICE_KEY, "1");
    } catch {
      /* private mode — ignore */
    }
  };
  // Thanh mời góp + thanh "Tạo gia phả miễn phí": người xem tắt được (đỡ chiếm chỗ), nhớ theo thiết bị.
  const useDismiss = (key: string) => {
    const [open, setOpen] = useState<boolean>(() => {
      try {
        return localStorage.getItem(key) !== "1";
      } catch {
        return true;
      }
    });
    const close = () => {
      setOpen(false);
      try {
        localStorage.setItem(key, "1");
      } catch {
        /* private mode — ignore */
      }
    };
    return [open, close] as const;
  };
  const [gopBannerOpen, dismissGopBanner] = useDismiss("family-tree:share-gop-banner-dismissed");
  const [ctaOpen, dismissCta] = useDismiss("family-tree:share-cta-dismissed");
  // Trang xem thử công khai chia TAB: Cây | Sự kiện & giỗ | Di sản. Giữ cây
  // luôn mounted (ẩn bằng CSS) để khỏi dựng lại chart; refit khi quay lại.
  // Link mời góp mở thẳng tab "Cùng góp" (?tab=gop, ?p=<người được kể>).
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<
    "overview" | "tree" | "events" | "heritage" | "details" | "gop" | "hoi"
  >(() =>
    searchParams.get("q") || searchParams.get("tab") === "hoi"
      ? "hoi"
      : searchParams.get("tab") === "gop"
        ? "gop"
        : searchParams.get("tab") === "tree" || !token
          ? "tree"
          : // Link chia sẻ mở vào "Tổng quan" (các card); cây gia phả là một card mở toàn khung.
            "overview",
  );
  const invitedPersonId = searchParams.get("p");
  // Dòng họ có nguồn sử liệu (gia phả lịch sử) → thêm tab "Chi tiết" cho người
  // đang chọn: tiểu sử, trị vì, nguồn — khách chưa đăng nhập cũng đọc được.
  const { data: hasSources } = useQuery({
    queryKey: ["clan-has-sources", clanId],
    queryFn: () => clanHasSources(clanId!),
    enabled: publicClan && !!clanId,
    staleTime: 10 * 60 * 1000,
  });

  const { data, isLoading, error } = useQuery({
    queryKey: ["share-view", token ?? `clan:${clanId}`],
    queryFn: () =>
      publicClan ? fetchPublicClanView(clanId!) : fetchShareView(token!),
    enabled: !!token || !!clanId,
    retry: false,
  });
  // Link chia sẻ (token) nhận ký ức của khách → banner mời góp + tab "Cùng góp".
  const canGop = !!token && !!data?.community?.can_contribute && data.persons.length > 0;

  // Tiêu đề thật theo tên dòng họ — trang /xem/clans/:id là trang công
  // khai được Google index, tiêu đề chung chung thì không xếp hạng được.
  usePageTitle(
    data?.clan_name ? t`Gia phả ${data.clan_name}` : null,
    data?.clan_name
      ? t`Cây gia phả ${data.clan_name}: các đời, ngày giỗ và thông tin thành viên.`
      : null,
  );

  // Đo lượt xem: trang công khai (khách chưa đăng nhập) vs link chia sẻ.
  useEffect(() => {
    if (!data) return;
    if (publicClan) track("public_clan_viewed");
    else track("share_viewed", { scope: data.scope });
  }, [data, publicClan]);


  // QR tại mộ — scope='resting_place' renders the grave card.
  if (data && data.scope === "resting_place" && data.resting_place) {
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b py-3 px-4 shrink-0">
          <h1 className="clan-name text-xl font-semibold text-center">
            {t`Mộ phần / tro cốt`}
          </h1>
          <p className="mt-1 text-center text-[11px] leading-snug text-muted-foreground sm:text-xs">
            {t`Đang xem qua liên kết chia sẻ.`}
          </p>
        </header>
        <main className="flex-1 min-h-0">
          <SharedRestingPlaceCard rp={data.resting_place} />
        </main>
      </div>
    );
  }

  // QR di sản — scope='heritage_item' renders the heritage card.
  if (data && data.scope === "heritage_item" && data.heritage_item) {
    const h = data.heritage_item;
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b py-3 px-4 shrink-0">
          <h1 className="clan-name text-xl font-semibold text-center">
            {t`Di sản & Văn hoá`}
          </h1>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {t`Đang xem qua liên kết chia sẻ.`}
          </p>
        </header>
        <main className="flex-1 min-h-0 overflow-y-auto">
          {/* Dạng bài báo — cùng khuôn với ngăn kéo xem di sản trong app (components/Article). */}
          <SharedHeritageCard h={h} />
        </main>
      </div>
    );
  }

  // Personal QR branch — bypass the family-chart and render a card.
  // The focal is whichever person matches data.root_person_id (always
  // set when scope='single_person').
  if (data && data.scope === "single_person") {
    const focalPerson = data.root_person_id
      ? data.persons.find((p) => p.id === data.root_person_id)
      : null;
    return (
      <div className="min-h-dvh bg-background flex flex-col">
        <header className="border-b py-3 px-4 shrink-0">
          <h1 className="clan-name text-xl font-semibold text-center">
            {t`Trang cá nhân`}
          </h1>
          <p className="text-xs text-center text-muted-foreground mt-1">
            {t`Đang xem qua liên kết chia sẻ.`}
          </p>
        </header>
        <main className="flex-1 min-h-0">
          {focalPerson ? (
            <SharedPersonCard
              focal={focalPerson}
              persons={data.persons}
              families={data.families}
              genOffset={data.generation_offset ?? 0}
              clanId={data.clan_id}
              shareToken={token}
              restingPlaces={data.resting_places}
            />
          ) : (
            <p className="p-8 text-center text-muted-foreground">
              {t`Không tìm thấy thông tin người này.`}
            </p>
          )}
          {focalPerson && token && data.community?.can_contribute && !focalPerson.is_living && (
            <CommunitySharePanel
              community={data.community}
              persons={data.persons}
              token={token}
              clanId={data.clan_id}
              clanName={data.clan_name ?? null}
              fixedPersonId={focalPerson.id}
            />
          )}
        </main>
      </div>
    );
  }

  // Danh sách tab (dùng cho cả thanh tab trên — máy tính — và thanh tab đáy — điện thoại).
  const tabItems: { key: string; label: string; short?: string; icon: React.ReactNode; active: boolean; onClick: () => void }[] = [];
  if ((publicClan || !!token) && data && data.persons.length > 0) {
    if (token) tabItems.push({ key: "overview", label: t`Tổng quan`, icon: <IconHome />, active: tab === "overview", onClick: () => setTab("overview") });
    tabItems.push({ key: "tree", label: t`Cây gia phả`, short: t`Cây`, icon: <IconTree />, active: tab === "tree", onClick: () => setTab("tree") });
    if (data.events?.length || data.persons.some((p) => !p.is_living && p.death_anniv_lunar_month && p.death_anniv_lunar_day))
      tabItems.push({ key: "events", label: t`Sự kiện & giỗ`, short: t`Giỗ`, icon: <IconCalendar />, active: tab === "events", onClick: () => setTab("events") });
    if (data.heritage?.length) tabItems.push({ key: "heritage", label: t`Di sản`, icon: <IconBook />, active: tab === "heritage", onClick: () => setTab("heritage") });
    if (hasSources) tabItems.push({ key: "details", label: t`Chi tiết & nguồn`, short: t`Chi tiết`, icon: <IconGrid />, active: tab === "details", onClick: () => setTab("details") });
    if (canGop) tabItems.push({ key: "gop", label: t`Cùng góp`, icon: <IconSend />, active: tab === "gop", onClick: () => setTab("gop") });
    if (canGop && (data.community?.questions?.length ?? 0) > 0)
      tabItems.push({ key: "hoi", label: t`Hỏi & trả lời`, short: t`Hỏi đáp`, icon: <IconHelp />, active: tab === "hoi", onClick: () => setTab("hoi") });
  }

  return (
    // Tab Cây: khung cố định cao bằng màn hình (cây tự kéo/phóng). Các tab khác (Tổng quan, Cùng góp…):
    // CẢ TRANG cuộn — thông báo, thanh mời góp, CTA cuối trang trôi theo nội dung, không chiếm chỗ cố
    // định (trên điện thoại chúng từng chiếm gần hết màn hình, nội dung chỉ còn một khe nhỏ).
    <div className={`${tab === "tree" ? "h-dvh" : "min-h-dvh"} bg-background flex flex-col`}>
      {/* Thanh đầu theo kiểu app: tên dòng họ ở giữa, nút sáng/tối bên phải (trang công khai
          không có thanh đầu của app). Hai đầu cân nhau để tên luôn nằm giữa. */}
      <header className="sticky top-0 z-30 shrink-0 border-b bg-background">
        <div className="container flex h-[64px] max-w-6xl items-center justify-between gap-3">
          <div className="w-10 shrink-0" aria-hidden="true" />
          <h1 className="clan-name min-w-0 flex-1 truncate text-center text-lg font-semibold sm:text-xl">
            {data?.clan_name ? t`Gia phả ${data.clan_name}` : t`Cây gia phả`}
          </h1>
          <div className="flex shrink-0 items-center print-hide">
            <LanguageButton />
            <ThemeQuickToggle />
          </div>
        </div>
      </header>

      {/* Lưu ý quyền riêng tư: đóng được bằng dấu X, nhớ lựa chọn trên thiết bị này. */}
      {noticeOpen && tab !== "tree" && (
        <div className="container max-w-6xl shrink-0 pt-2 print-hide">
          {/* Cùng kiểu thông báo của app (EnablePushPrompt): nền/viền nhạt màu chủ đạo, icon bên
              trái, đóng được bằng dấu X và nhớ lựa chọn trên thiết bị này. */}
          <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <IconShield className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">{t`Thông tin nhạy cảm đã được ẩn`}</p>
              <p className="text-muted-foreground">
                <Trans>
                  <Trans>
                    <Trans>
                      Ngày tháng, nơi chốn của người còn sống không hiển thị ở
                      bản xem này.
                    </Trans>
                  </Trans>
                </Trans>
              </p>
            </div>
            <button
              type="button"
              onClick={dismissNotice}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={t`Đóng thông báo`}
              title={t`Đóng`}
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {publicClan && (
        <div className="container flex max-w-6xl shrink-0 flex-wrap items-center justify-center gap-2 pt-2 print-hide">
          {/* Nút này dài, mà nút mặc định KHÔNG cho chữ xuống dòng — trên màn 390px nó rộng
              408px, tức thò hẳn ra ngoài mép và kéo cả trang trôi ngang. Cho phép xuống dòng. */}
          <Button
            asChild
            size="sm"
            className="h-auto max-w-full whitespace-normal py-2 text-center"
          >
            <Link to={`/login?next=${encodeURIComponent(`/clans/${clanId}`)}`}>
              <IconLogIn className="mr-1.5 h-4 w-4" />
              {t`Đăng nhập để xem đầy đủ & cùng vun đắp`}
            </Link>
          </Button>
        </div>
      )}

      {/* Mời góp (link chia sẻ / link mời góp): ai mở link cũng thấy họ đang cần mình kể gì. */}
      {canGop && gopBannerOpen && tab === "overview" && (
        <div className="container max-w-6xl shrink-0 pt-2 print-hide">
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
            <IconBook className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1 text-sm">
              <p className="font-medium">
                {data?.community?.recipient_label
                  ? t`${data.community.recipient_label} ơi, cả nhà nhờ bạn đóng góp chuyện ông bà, ảnh cũ`
                  : t`Cả nhà đang cùng đóng góp chuyện ông bà, ảnh cũ — bạn góp một chút nhé`}
              </p>
              <p className="text-xs text-muted-foreground">
                {data?.community && <CommunityStatsLine community={data.community} />}
              </p>
            </div>
            <Button size="sm" className="shrink-0 px-3 text-sm" onClick={() => setTab("gop")}>
              <IconSend className="mr-1.5 h-4 w-4" />
              {t`Cùng góp`}
            </Button>
            <button
              type="button"
              onClick={dismissGopBanner}
              className="shrink-0 self-start text-muted-foreground hover:text-foreground"
              aria-label={t`Đóng thông báo`}
              title={t`Đóng`}
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Thanh TAB: trang xem thử công khai (Cây | Sự kiện & giỗ | Di sản | Chi tiết) và link chia sẻ
          (Tổng quan | Cùng góp | Hỏi & trả lời). Máy tính: nút viên trên đầu; điện thoại: thanh tab ở ĐÁY
          như thanh tab của app (icon + nhãn). */}
      {tabItems.length > 1 && (
        <div className="hidden shrink-0 print-hide md:block">
          <div role="tablist" aria-label={t`Nội dung dòng họ`} className="container flex max-w-6xl gap-2 overflow-x-auto pt-3">
            {tabItems.map((it) => (
              <ShareTab key={it.key} active={it.active} onClick={it.onClick}>
                {it.label}
              </ShareTab>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 min-h-0 flex flex-col">
        {isLoading && (
          <p className="p-8 text-center text-muted-foreground">{t`Đang tải…`}</p>
        )}
        {error && (
          <div className="p-4 max-w-md mx-auto w-full space-y-3">
            <Alert variant="destructive">
              <AlertDescription>{(error as Error).message}</AlertDescription>
            </Alert>
            {publicClan && (
              <Button asChild className="w-full">
                <Link
                  to={`/login?next=${encodeURIComponent(`/clans/${clanId}`)}`}
                >
                  <IconLogIn className="h-4 w-4 mr-1.5" />
                  {t`Đăng nhập để xem dòng họ này`}
                </Link>
              </Button>
            )}
          </div>
        )}
        {data && data.persons.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            {t`Chưa có dữ liệu trong dòng họ.`}
          </p>
        )}
        {data && data.persons.length > 0 && (
          <>
            {/* CÂY — luôn mounted, ẩn bằng CSS khi ở tab khác (khỏi dựng lại chart). */}
            <ShareTree
              data={data}
              visible={tab === "tree"}
              onFocalChange={setFocal}
              onFullscreenChange={setIsFullscreen}
            />

            {/* TAB Sự kiện & giỗ / Di sản — chỉ trang xem thử công khai. */}
            {token && tab === "overview" && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <ShareOverview
                  persons={data.persons}
                  generationOffset={data.generation_offset ?? 0}
                  sections={data.sections ?? {}}
                  onOpenTree={() => setTab("tree")}
                />
              </div>
            )}
            {canGop && (tab === "gop" || tab === "hoi") && data.community && token && (
              <div className="flex-1 min-h-0 overflow-y-auto">
                <CommunitySharePanel
                  key={tab}
                  mode={tab === "hoi" ? "hoi" : "gop"}
                  community={data.community}
                  persons={data.persons}
                  token={token}
                  clanId={data.clan_id}
                  clanName={data.clan_name ?? null}
                  initialQuestionId={searchParams.get("q")}
                  initialPersonId={
                    invitedPersonId ??
                    (focal && data.persons.find((p) => p.id === focal && !p.is_living) ? focal : null)
                  }
                />
              </div>
            )}
            {publicClan && tab === "events" && <EventsGioPanel data={data} />}
            {publicClan && tab === "heritage" && <HeritagePanel data={data} />}
            {publicClan && tab === "details" && (
              <DetailsPanel
                data={data}
                focal={focal}
                onPersonClick={setFocal}
              />
            )}
          </>
        )}
      </main>

      {/* CTA chuyển đổi — hiện cho MỌI khách xem ẩn danh (cả /share/:token
          lẫn /xem/clans/:id). Đây là đầu phễu tăng trưởng: người xem cây họ
          người khác từ Facebook → mời tạo gia phả của chính họ. Ẩn khi toàn
          màn hình và khi in. */}
      {data && data.persons.length > 0 && !isFullscreen && ctaOpen && tab !== "tree" && (
        <div className="shrink-0 border-t bg-primary/5 px-4 py-3 print-hide">
          <div className="container mx-auto flex max-w-6xl flex-col items-center gap-2 text-center sm:flex-row sm:justify-between sm:text-left">
            <p className="text-sm">
              {data.clan_name ? (
                <>
                  Đây là gia phả <b>{data.clan_name}</b>.{" "}
                </>
              ) : (
                <>Bạn đang xem một gia phả trên Dòng Họ Việt. </>
              )}
              <span className="text-muted-foreground">
                {t`Tạo cây gia phả cho dòng họ bạn — miễn phí, chỉ vài phút.`}
              </span>
            </p>
            <div className="flex shrink-0 items-center gap-2">
            <Button asChild size="sm" className="shrink-0">
              <Link
                to="/signup"
                onClick={() =>
                  track("share_cta_click", {
                    mode: publicClan ? "public_clan" : "token",
                  })
                }
              >
                <IconPlus className="h-4 w-4 mr-1.5" />
                {t`Tạo gia phả miễn phí`}
              </Link>
            </Button>
            <button
              type="button"
              onClick={dismissCta}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label={t`Đóng thông báo`}
              title={t`Đóng`}
            >
              <IconX className="h-4 w-4" />
            </button>
            </div>
          </div>
        </div>
      )}
      {tabItems.length > 1 && !isFullscreen && (
        <>
          {/* Chừa chỗ cho thanh tab đáy (điện thoại). */}
          <div aria-hidden="true" className="h-[calc(57px+env(safe-area-inset-bottom))] shrink-0 md:hidden" />
          <nav
            role="tablist"
            aria-label={t`Nội dung dòng họ`}
            className="fixed bottom-0 left-0 right-0 z-30 border-t border-gold/30 bg-background pb-[env(safe-area-inset-bottom)] [transform:translateZ(0)] [backface-visibility:hidden] after:pointer-events-none after:absolute after:inset-x-0 after:top-full after:h-28 after:bg-background md:hidden print-hide"
          >
            <ul className="mx-auto flex max-w-xl">
              {tabItems.map((it) => (
                <li key={it.key} className="min-w-0 flex-1">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={it.active}
                    onClick={it.onClick}
                    className={`relative flex min-h-[56px] w-full flex-col items-center justify-center gap-1 py-2 text-xs ${
                      it.active ? "font-medium text-primary" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {it.active && <span aria-hidden="true" className="absolute top-0 h-[3px] w-8 rounded-full bg-primary" />}
                    <span className="inline-flex h-6 w-6 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">{it.icon}</span>
                    <span className="max-w-full truncate px-1">{it.short ?? it.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}
    </div>
  );
}

// ─── Xem thử công khai: tab Chi tiết & nguồn (dòng họ lịch sử) ──────

/** Người đang chọn trên cây (mặc định thuỷ tổ): thông tin, quan hệ, trị vì, nguồn. */
function DetailsPanel({
  data,
  focal,
  onPersonClick,
}: {
  data: ShareViewPayload;
  focal: string | null;
  onPersonClick: (personId: string) => void;
}) {
  const person =
    data.persons.find((p) => p.id === focal) ??
    data.persons.find((p) => p.is_root) ??
    data.persons[0];
  const { data: extras } = useQuery({
    queryKey: ["historical-person-extras", person?.id],
    queryFn: () => getHistoricalPersonExtras(person!.id),
    enabled: !!person,
  });
  if (!person) return null;
  const { lifespan_years: _lifespan, ...extraFields } = extras ?? {};
  return (
    <div className="overflow-y-auto">
      <SharedPersonCard
        focal={{ ...person, ...extraFields }}
        persons={data.persons}
        families={data.families}
        genOffset={data.generation_offset ?? 0}
        onPersonClick={(id) => {
          onPersonClick(id);
          window.scrollTo({ top: 0 });
        }}
        extra={
          <HistoricalPersonSections
            personId={person.id}
            bio={person.bio}
            birthDate={person.birth_date}
            deathDate={person.death_date}
            clanId={data.clan_id}
            onPersonClick={onPersonClick}
          />
        }
      />
    </div>
  );
}

// ─── Xem thử công khai: tab Sự kiện/giỗ + Di sản (chỉ đọc) ────────

/** Một nút tab trên trang xem thử. */
function ShareTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      // Cùng kiểu tab trong app (vd trang Việc cần làm): nút viên nhỏ, tab đang chọn nền màu chủ đạo.
      className={`inline-flex h-9 shrink-0 items-center whitespace-nowrap rounded-md border px-3 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-input bg-background hover:bg-muted/50"
      }`}
    >
      {children}
    </button>
  );
}

/** Nội dung tab "Sự kiện & giỗ" — cùng danh sách + cùng kiểu dòng với màn Sự kiện trong app. */
function EventsGioPanel({ data }: { data: ShareViewPayload }) {
  const upcoming = useMemo(() => shareUpcoming(data), [data]);
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="container max-w-6xl space-y-2 py-4">
        {upcoming.length === 0 ? (
          <p className="p-8 text-center text-muted-foreground">
            {t`Chưa có sự kiện hay ngày giỗ.`}
          </p>
        ) : (
          <UpcomingEventList events={upcoming} clanId="" readOnly />
        )}
      </div>
    </div>
  );
}

/** Nội dung tab "Di sản". */
function HeritagePanel({ data }: { data: ShareViewPayload }) {
  const heritage = data.heritage ?? [];
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="container max-w-6xl space-y-2 py-4">
        {heritage.length === 0 && (
          <p className="p-8 text-center text-muted-foreground">
            {t`Chưa có di sản.`}
          </p>
        )}
        {heritage.map((h) => (
          <div key={h.id} className="rounded-xl border bg-card shadow-sm p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              {HERITAGE_CATEGORY_LABEL[h.category]}
            </p>
            <p className="font-semibold text-primary">
              {h.title}
              {h.built_year ? ` · ${h.built_year}` : ""}
            </p>
            {h.summary && <p className="text-sm font-medium">{h.summary}</p>}
            {h.body && (
              <p className="whitespace-pre-line text-sm text-muted-foreground">
                {h.body}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
