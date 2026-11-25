import { t } from "@lingui/core/macro";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { IconArrowLeft, IconMapPin } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { usePageTitle } from "@/hooks/usePageTitle";
import { HERITAGE_CATEGORY_LABEL, videoEmbedUrl } from "@/lib/queries/heritage";
import { fetchSiteHeritageItem, SitePartError } from "@/lib/queries/site-parts";
import { sitePagePath } from "@/lib/siteSections";

import { useSite } from "./siteContext";

/** Một mục di sản: nội dung (chữ thường, tự tách đoạn), ảnh, ghi âm, video, người liên quan. Không toạ độ / địa chỉ. */
export default function SiteHeritageItem() {
  const { itemId = "" } = useParams<{ itemId: string }>();
  const { base, access } = useSite();
  const { data: h, isLoading, error } = useQuery({
    queryKey: ["site", access.token ?? access.clanId, "heritage_item", itemId],
    queryFn: () => fetchSiteHeritageItem(access, itemId),
    retry: false,
  });
  usePageTitle(h?.title ?? null, h?.summary ?? null);

  if (isLoading) return <p className="py-16 text-center text-muted-foreground">{t`Đang tải…`}</p>;
  if (error || !h) {
    const gone = error instanceof SitePartError && error.status === 404;
    return (
      <div className="container max-w-2xl py-16 text-center">
        <p className="mb-4 text-muted-foreground">{gone ? t`Mục di sản này không còn.` : ((error as Error | null)?.message ?? t`Không tải được mục di sản.`)}</p>
        <Button asChild size="sm" variant="outline" className="px-3 text-sm">
          <Link to={sitePagePath(base, "heritage")}>
            <IconArrowLeft className="mr-1.5 h-4 w-4" />
            {t`Về Di sản`}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <article className="container max-w-3xl py-8 md:py-10">
      <Link to={sitePagePath(base, "heritage")} className="mb-2 inline-flex min-h-11 items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <IconArrowLeft className="h-4 w-4" />
        {t`Di sản`}
      </Link>
      <div className="text-xs font-semibold uppercase tracking-wider text-accent">
        {HERITAGE_CATEGORY_LABEL[h.category as keyof typeof HERITAGE_CATEGORY_LABEL] ?? h.category}
      </div>
      <h1 className="clan-name mb-3 mt-2 break-words text-3xl font-bold leading-tight md:text-4xl">{h.title}</h1>
      <div className="mb-6 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
        {h.built_year && <span>{t`Năm ${h.built_year}`}</span>}
        {h.location_name && (
          <span className="inline-flex items-center gap-1">
            <IconMapPin className="h-4 w-4" />
            {h.location_name}
          </span>
        )}
      </div>
      {h.summary && <p className="mb-5 break-words text-justify text-lg text-muted-foreground">{h.summary}</p>}
      {h.photo_urls[0] && <img src={h.photo_urls[0]} alt="" className="mb-6 max-h-[28rem] w-full rounded-2xl object-cover" />}
      {h.body && <div className="whitespace-pre-line break-words text-justify text-[17px] leading-8">{h.body}</div>}

      {h.photo_urls.length > 1 && (
        <section className="mt-8">
          <h2 className="clan-name mb-3 text-xl font-bold">{t`Hình ảnh`}</h2>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {h.photo_urls.slice(1).map((u, i) => (
              <img key={i} src={u} alt="" loading="lazy" className="aspect-square w-full rounded-lg bg-muted object-cover" />
            ))}
          </div>
        </section>
      )}
      {h.audios.length > 0 && (
        <section className="mt-8">
          <h2 className="clan-name mb-3 text-xl font-bold">{t`Ghi âm kể chuyện`}</h2>
          <div className="space-y-2">
            {h.audios.map((a, i) => (
              <audio key={i} controls preload="none" src={a.url} className="w-full" />
            ))}
          </div>
        </section>
      )}
      {h.videos.length > 0 && (
        <section className="mt-8">
          <h2 className="clan-name mb-3 text-xl font-bold">{t`Video`}</h2>
          <div className="space-y-3">
            {h.videos.map((v, i) => {
              const embed = videoEmbedUrl(v.url);
              return embed ? (
                <iframe key={i} src={embed} title={t`Video`} loading="lazy" allowFullScreen className="aspect-video w-full rounded-lg border" />
              ) : (
                <video key={i} controls preload="none" src={v.url} className="w-full rounded-lg border" />
              );
            })}
          </div>
        </section>
      )}
      {h.people.length > 0 && (
        <section className="mt-8">
          <h2 className="clan-name mb-3 text-xl font-bold">{t`Người liên quan`}</h2>
          <ul className="divide-y rounded-2xl border bg-card">
            {h.people.map((p, i) => (
              <li key={i} className="px-4 py-3">
                <div className="font-medium">{p.full_name}</div>
                {p.role_note && <div className="text-sm text-muted-foreground">{p.role_note}</div>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
