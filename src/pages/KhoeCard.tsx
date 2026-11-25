import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  IconClock,
  IconCopy,
  IconDownload,
  IconHome,
  IconPlus,
  IconRefresh,
  IconShare2,
  IconTree,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { getPublicCardUrl } from "@/lib/cards/publishCard";
import { ClanSiteLayout } from "@/pages/site/ClanSiteLayout";
import { SiteProvider, type SiteCtx } from "@/pages/site/siteContext";
import type { ShareViewPayload } from "@/lib/queries/share-view";
import { fetchKhoe, SitePartError } from "@/lib/queries/site-parts";
import { supabase } from "@/lib/supabase";

/**
 * Ảnh thiệp. Thiệp không có ảnh (hoặc ảnh không tải được / đã bị dọn) thì vẽ MẪU MẶC ĐỊNH từ chữ của thiệp thay vì hiện ảnh vỡ —
 * trang luôn có một tấm thiệp đẹp, không bao giờ hiện lỗi.
 */
function CardImage({
  src,
  title,
  subtitle,
  clanName,
}: {
  src: string;
  title: string;
  subtitle: string | null;
  clanName: string;
}) {
  const [broken, setBroken] = useState(false);
  if (src && !broken) {
    return (
      <img
        src={src}
        alt={title}
        onError={() => setBroken(true)}
        className="max-h-[70vh] w-full rounded-2xl border object-contain shadow-lg"
      />
    );
  }
  return (
    <div
      role="img"
      aria-label={title}
      data-testid="khoe-default-card"
      className="relative flex aspect-square w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#d4a045] bg-[radial-gradient(circle_at_30%_20%,#8b3a3a,#4a1a1a_70%)] p-[8%] text-center text-[#f6efdc] shadow-lg"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-3.5 rounded-xl border border-[#d4a045]/60"
      />
      {clanName && (
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4a045]">
          {clanName}
        </div>
      )}
      <div className="clan-name line-clamp-4 break-words text-3xl font-bold leading-tight">
        {title}
      </div>
      {subtitle && (
        <div className="line-clamp-3 break-words text-[15px] opacity-90">
          {subtitle}
        </div>
      )}
    </div>
  );
}

/** Số ngày còn lại (làm tròn lên) tới `expires`; <= 0 là đã hết hạn. */
export function daysLeft(expires: string, now = Date.now()): number {
  return Math.ceil((new Date(expires).getTime() - now) / 86_400_000);
}

/**
 * `/khoe/:token` — trang công khai hiển thị ĐÚNG tấm thiệp "khoe" đã chia sẻ (docs/plan-thiep-khoe-design.md, T1–T3):
 * ảnh thiệp lớn, tải / chia sẻ / sao chép link, "còn N ngày", và lối vào dòng họ. Chỉ khi dòng họ CÔNG KHAI (RLS cho
 * khách đọc được hàng `clans`) mới hiện nút "Xem cây gia phả" — dòng họ riêng tư không lộ gì ngoài thiệp.
 * Không lộ quan hệ / giới tính. Hết hạn / đã gỡ / sai link: cùng một thẻ, không nêu lý do.
 */
export default function KhoeCard() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();

  const q = useQuery({
    queryKey: ["khoe-card", token],
    queryFn: async () => {
      try {
        return await fetchKhoe(token!);
      } catch (e) {
        if (e instanceof SitePartError && e.status === 404) return null; // hết hạn / đã gỡ / sai link: cùng một thẻ
        throw e;
      }
    },
    enabled: !!token,
    staleTime: 60_000,
    retry: false,
  });
  const card = q.data?.card;
  const clanId = q.data?.clan_id;
  const found = !!q.data;
  // Đếm một lượt xem mỗi phiên trình duyệt cho mỗi thiệp (trình quét OG không chạy JS nên không bị tính).
  useEffect(() => {
    if (!found || !token) return;
    const key = `khoe-viewed:${token}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* không có sessionStorage: vẫn đếm, chấp nhận trùng */
    }
    void supabase.rpc("khoe_register_view", { p_token: token });
  }, [found, token]);

  const clanName = q.data?.clan_name ?? "";
  const publicTree = !!q.data?.public_tree;
  const imageUrl = card ? getPublicCardUrl(card.image_path) : "";
  const left = card ? daysLeft(card.expires_at) : 0;
  const canNativeShare =
    typeof navigator !== "undefined" && "share" in navigator;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast.success(t`Đã sao chép liên kết.`);
    } catch {
      toast.error(t`Không sao chép được liên kết.`);
    }
  };

  const ctx: SiteCtx = {
    base: `/khoe/${token}`,
    access: { clanId: clanId ?? "" },
    // Khung trang dòng họ chỉ cần tên họ; thiệp không có cây / mục nào khác.
    data: {
      clan_id: clanId ?? "",
      clan_name: clanName || "Dòng Họ Việt",
    } as unknown as ShareViewPayload,
    sections: [],
    canContribute: false,
    focus: "card",
  };

  return (
    <SiteProvider value={ctx}>
      <ClanSiteLayout>
        <div className="container max-w-4xl py-8">
          {q.isLoading && (
            <p className="text-center text-muted-foreground">{t`Đang tải…`}</p>
          )}

          {q.isError && (
            <div className="mx-auto max-w-md rounded-2xl border bg-card px-7 py-9 text-center">
              <p className="mb-4 text-muted-foreground">{t`Chưa tải được thiệp. Hãy thử lại sau ít phút.`}</p>
              <Button
                size="sm"
                variant="outline"
                className="px-3 text-sm"
                onClick={() => void q.refetch()}
              >
                <IconRefresh className="mr-1.5 h-4 w-4" />
              {t`Thử lại`}
              </Button>
            </div>
          )}

          {!q.isLoading && !q.isError && !card && (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border bg-card px-7 py-9 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-accent text-accent">
                <IconClock className="h-6 w-6" />
              </span>
              <h1 className="clan-name text-2xl font-semibold">{t`Liên kết không còn hiệu lực`}</h1>
              <p className="text-muted-foreground">{t`Thiệp này đã hết hạn hoặc đã được người chia sẻ gỡ xuống. Hãy nhờ người gửi chia sẻ lại cho bạn.`}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-2.5">
                <Button asChild size="sm" className="px-3 text-sm">
                  <Link to="/">
                    <IconHome className="mr-1.5 h-4 w-4" />
                    {t`Về trang chủ`}
                  </Link>
                </Button>
                <Button
                  asChild
                  size="sm"
                  variant="outline"
                  className="px-3 text-sm"
                >
                  <Link to="/signup">
                    <IconPlus className="mr-1.5 h-4 w-4" />
                    {t`Tạo gia phả cho họ bạn`}
                  </Link>
                </Button>
              </div>
            </div>
          )}

          {card && (
            <div className="flex flex-col gap-8">
              <div className="flex flex-wrap items-center justify-center gap-8">
                <div className="flex min-w-0 flex-[0_1_460px] justify-center">
                  <CardImage
                    src={imageUrl}
                    title={card.title}
                    subtitle={card.subtitle}
                    clanName={clanName}
                  />
                </div>
                <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
                  {clanName && (
                    <div className="text-xs font-semibold uppercase tracking-wider text-accent">{t`Thiệp chia sẻ từ ${clanName}`}</div>
                  )}
                  <h1 className="clan-name break-words text-3xl font-bold leading-tight [overflow-wrap:anywhere]">
                    {card.title}
                  </h1>
                  {card.subtitle && (
                    <p className="break-words text-muted-foreground">
                      {card.subtitle}
                    </p>
                  )}
                  <div className="grid grid-cols-2 gap-2.5 sm:flex sm:flex-wrap">
                    <Button asChild size="sm" className="px-3 text-sm">
                      <a
                        href={imageUrl}
                        download={`thiep-${token}.png`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <IconDownload className="mr-1.5 h-4 w-4" />
                        {t`Tải ảnh`}
                      </a>
                    </Button>
                    {canNativeShare && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="px-3 text-sm"
                        onClick={() =>
                          void navigator
                            .share({
                              title: card!.title,
                              url: window.location.href,
                            })
                            .catch(() => {})
                        }
                      >
                        <IconShare2 className="mr-1.5 h-4 w-4" />
                        {t`Chia sẻ`}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="px-3 text-sm sm:col-auto"
                      onClick={() => void copy()}
                    >
                      <IconCopy className="mr-1.5 h-4 w-4" />
                      {t`Sao chép liên kết`}
                    </Button>
                    {publicTree && clanId && (
                      <Button
                        asChild
                        size="sm"
                        variant="outline"
                        className="px-3 text-sm"
                      >
                        <Link to={`/xem/clans/${clanId}`}>
                          <IconTree className="mr-1.5 h-4 w-4" />
                          {t`Xem cây gia phả`}
                        </Link>
                      </Button>
                    )}
                  </div>
                  <p className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconClock className="h-4 w-4 shrink-0" />
                    {left <= 1
                      ? t`Liên kết hết hạn trong hôm nay`
                      : t`Liên kết còn ${left} ngày`}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </ClanSiteLayout>
    </SiteProvider>
  );
}
