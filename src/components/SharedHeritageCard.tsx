import { t } from "@lingui/core/macro";

import { Article, ArticleFactBox, ArticleFigure, ArticleHeader, ArticleList, ArticleProse, ArticleSection } from "@/components/Article";
import { HERITAGE_CATEGORY_LABEL, videoEmbedUrl } from "@/lib/queries/heritage";
import type { ShareViewPayload } from "@/lib/queries/share-view";

/** Trang một mục di sản dạng bài báo — dùng cho link QR di sản (màn Share cũ và trang dòng họ). */
export function SharedHeritageCard({ h }: { h: NonNullable<ShareViewPayload["heritage_item"]> }) {
  const dir = h.latitude != null && h.longitude != null ? `https://www.google.com/maps?q=${h.latitude},${h.longitude}` : null;
  return (
    <div className="mx-auto max-w-2xl p-4 pb-[calc(1.5rem_+_env(safe-area-inset-bottom))]">
              <Article>
                <ArticleHeader
                  kicker={HERITAGE_CATEGORY_LABEL[h.category]}
                  title={h.title}
                  deck={h.summary}
                />
  
                {h.photo_urls[0] && (
                  <ArticleFigure src={h.photo_urls[0]} alt={h.title} />
                )}
  
                {h.body && (
                  <ArticleSection>
                    <ArticleProse>{h.body}</ArticleProse>
                  </ArticleSection>
                )}
  
                <ArticleFactBox
                  title={t`Thông tin`}
                  rows={[
                    { label: t`Ở đâu`, value: h.location_name },
                    { label: t`Địa chỉ`, value: h.address },
                    {
                      label: t`Lập / xây năm`,
                      value: h.built_year ? String(h.built_year) : null,
                    },
                  ]}
                  footer={
                    dir && (
                      <a
                        href={dir}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {t`Chỉ đường →`}
                      </a>
                    )
                  }
                />
  
                {h.people.length > 0 && (
                  <ArticleSection
                    title={t`Người liên quan`}
                    aside={h.people.length}
                  >
                    <ArticleList>
                      {h.people.map((p, i) => (
                        <li key={i} className="py-2.5">
                          <p className="font-medium">{p.full_name}</p>
                          {p.role_note && (
                            <p className="text-sm text-muted-foreground">
                              {p.role_note}
                            </p>
                          )}
                        </li>
                      ))}
                    </ArticleList>
                  </ArticleSection>
                )}
  
                {h.photo_urls.length > 1 && (
                  <ArticleSection title={t`Hình ảnh`} aside={h.photo_urls.length}>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {h.photo_urls.map((u, i) => (
                        <img
                          key={i}
                          src={u}
                          alt=""
                          loading="lazy"
                          className="aspect-square w-full rounded-md bg-muted object-cover"
                        />
                      ))}
                    </div>
                  </ArticleSection>
                )}
  
                {h.audios.length > 0 && (
                  <ArticleSection title={t`Ghi âm kể chuyện`}>
                    <div className="space-y-2">
                      {h.audios.map((a, i) => (
                        <audio
                          key={i}
                          controls
                          preload="none"
                          src={a.url}
                          className="w-full"
                        />
                      ))}
                    </div>
                  </ArticleSection>
                )}
  
                {h.videos.length > 0 && (
                  <ArticleSection title="Video">
                    <div className="space-y-3">
                      {h.videos.map((v, i) => {
                        const embed = videoEmbedUrl(v.url);
                        return embed ? (
                          <iframe
                            key={i}
                            src={embed}
                            title={t`Video di sản`}
                            className="aspect-video w-full rounded-lg border"
                            allow="encrypted-media; picture-in-picture; fullscreen"
                            allowFullScreen
                            referrerPolicy="strict-origin-when-cross-origin"
                          />
                        ) : (
                          <video
                            key={i}
                            controls
                            preload="none"
                            src={v.url}
                            className="w-full rounded-lg border"
                          />
                        );
                      })}
                    </div>
                  </ArticleSection>
                )}
              </Article>
            </div>
  );
}
