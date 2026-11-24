import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";

import {
  Article,
  ArticleActionBar,
  ArticleFactBox,
  ArticleFigure,
  ArticleFooter,
  ArticleHeader,
  ArticleHtml,
  ArticleList,
  ArticleSection,
} from "@/components/Article";
import { CustomsShell } from "@/components/CustomsShell";
import { DrawerViewActions } from "@/components/ui/form-actions";
import { PanelLink } from "@/components/panel/PanelLink";
import {
  IconArrowLeft,
  IconBook,
  IconHelp,
  IconLogIn,
  IconShare2,
  IconStar,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePageTitle } from "@/hooks/usePageTitle";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_MANDATORY_LABEL,
  CUSTOM_ORIGIN_LABEL,
  CUSTOM_SCOPE_LABEL,
  getCustomEntriesByIds,
  getCustomEntry,
  listBookmarkedIds,
  setBookmark,
} from "@/lib/queries/customs";

import { t } from "@lingui/core/macro";
/** Hiện trong ngăn kéo XEM (bấm bài ở danh sách Sổ tay / Hôm nay): lấy id từ đây, bỏ khung trang và nút quay lại,
 *  thanh nút là DrawerViewActions. Route /so-tay/:id và /xem/so-tay/:id vẫn giữ cho link chia sẻ. */
export interface EmbeddedCustom {
  id: string;
  onClose: () => void;
}

export default function CustomsDetail({
  embedded,
}: { embedded?: EmbeddedCustom } = {}) {
  const params = useParams<{ entryId: string }>();
  const entryId = embedded?.id ?? params.entryId;
  // Trong ngăn kéo: không bọc khung trang (đã nằm trong trang đang mở) nhưng vẫn là MỘT khối gốc — ngăn kéo biến mỗi
  // con trực tiếp thành cột flex, nhiều con rời thì thanh nút đáy bị xếp dọc.
  const Shell = embedded ? EmbeddedRoot : CustomsShell;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();

  const { data: entry, isLoading } = useQuery({
    queryKey: ["custom-entry", entryId],
    queryFn: () => getCustomEntry(entryId!),
    enabled: !!entryId,
  });

  // Bài Sổ tay là tài sản SEO thật của app (khách vào từ tìm kiếm) —
  // đặt tiêu đề + mô tả theo đúng nội dung bài.
  usePageTitle(
    embedded ? null : (entry?.title ?? null),
    embedded ? null : (entry?.short_description ?? null),
  );

  const { data: bookmarks } = useQuery({
    queryKey: ["custom-bookmarks", userId],
    queryFn: () => listBookmarkedIds(),
    enabled: !!userId,
  });
  const bookmarked = !!entryId && !!bookmarks?.has(entryId);

  const { data: related } = useQuery({
    queryKey: ["custom-related", entry?.related_ids ?? []],
    queryFn: () => getCustomEntriesByIds(entry!.related_ids ?? []),
    enabled: !!entry && (entry.related_ids?.length ?? 0) > 0,
  });

  const bookmarkM = useMutation({
    mutationFn: () => setBookmark(entryId!, !bookmarked),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["custom-bookmarks", userId] }),
  });

  // Chia sẻ lên mạng xã hội: Web Share API (mobile) → fallback chép link.
  async function shareEntry() {
    // Luôn chia sẻ link CÔNG KHAI (không cần đăng nhập) để mở được ngoài Zalo/Facebook.
    const url = entry
      ? (entry.page_url ?? `${window.location.origin}/xem/so-tay/${entry.id}`)
      : window.location.href;
    const title = entry?.title ?? t`Sổ tay Văn hoá`;
    const text = entry?.short_description ?? title;
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
    } catch {
      return; // user huỷ hộp chia sẻ — không báo lỗi
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t`Đã chép liên kết — dán vào Zalo/Facebook để chia sẻ`);
    } catch {
      toast.error(t`Không chia sẻ được`, { description: url });
    }
  }

  if (isLoading) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t`Đang tải…`}</p>
      </Shell>
    );
  }
  if (!entry) {
    return (
      <Shell>
        <p className="text-muted-foreground">{t`Không tìm thấy bài.`}</p>
        <Button asChild variant="outline" className="mt-3">
          {user ? (
            <Link to="/so-tay">
              <IconArrowLeft className="h-4 w-4 mr-1.5" />
              {t`Về Sổ tay`}
            </Link>
          ) : (
            <Link to="/login">
              <IconLogIn className="h-4 w-4 mr-1.5" />
              {t`Đăng nhập`}
            </Link>
          )}
        </Button>
      </Shell>
    );
  }

  const actionButtons = (
    <>
      <Button variant="outline" onClick={shareEntry}>
        <IconShare2 className="mr-1.5 h-4 w-4 shrink-0" />
        {t`Chia sẻ`}
      </Button>
      {user && (
        <Button
          variant="outline"
          onClick={() => bookmarkM.mutate()}
          disabled={bookmarkM.isPending}
          title={bookmarked ? t`Bỏ lưu` : t`Lưu bài`}
        >
          <IconStar
            className={`h-4 w-4 shrink-0 ${bookmarked ? "fill-current text-accent" : ""}`}
          />
          {bookmarked ? t`Đã lưu` : t`Lưu`}
        </Button>
      )}
    </>
  );

  const metaLine = [
    entry.regions.length > 0 ? entry.regions.join(", ") : null,
    (entry.origins?.length ?? 0) > 0
      ? t`Nguồn gốc: ${(entry.origins ?? []).map((o) => CUSTOM_ORIGIN_LABEL[o]).join(", ")}`
      : null,
    entry.scope ? t`Phạm vi: ${CUSTOM_SCOPE_LABEL[entry.scope]}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <Shell>
      {/* Thanh trên: chỉ còn liên kết quay lại — nút thao tác ở thanh dính đáy (ArticleActionBar). */}
      {!embedded && (
        <div className="flex items-center gap-3">
          {user ? (
            <Link to="/so-tay" className="text-sm text-primary hover:underline">
              {t`← Sổ tay Văn hoá`}
            </Link>
          ) : (
            <Link to="/login" className="text-sm text-primary hover:underline">
              {t`Đăng nhập để xem thêm →`}
            </Link>
          )}
        </div>
      )}

      {/* Dạng bài báo (khuôn chung components/Article): không bọc thẻ, chuyên mục → tít → sapo → dòng thông tin →
          ảnh lớn → các mục. Hiển thị đầy đủ nội dung (không gập/mở) — không bắt bấm để xem. */}
      <Article>
        <ArticleHeader
          kicker={CUSTOM_CATEGORY_LABEL[entry.category]}
          title={entry.title}
          deck={entry.short_description}
          meta={[
            entry.aliases.length > 0
              ? t`Còn gọi: ${entry.aliases.join(", ")}`
              : null,
            entry.mandatory_level
              ? CUSTOM_MANDATORY_LABEL[entry.mandatory_level]
              : null,
            entry.reliability != null ? (
              <span title={t`Độ tin cậy`} className="text-accent">
                {"★".repeat(entry.reliability)}
              </span>
            ) : null,
            metaLine || null,
          ]}
        />

        {entry.cover_image_url && (
          <ArticleFigure src={entry.cover_image_url} alt={entry.title} />
        )}

        {(entry.timing || entry.applicable_to) && (
          <ArticleFactBox
            title={t`Tóm lược`}
            rows={[
              { label: t`Thời điểm`, value: entry.timing },
              { label: t`Áp dụng`, value: entry.applicable_to },
            ]}
          />
        )}

        {/* Các đoạn nội dung — hiện đầy đủ, chữ to, giãn dòng thoáng */}
        {entry.sections.map((s, i) => (
          <ArticleSection key={i} title={s.heading || t`Giới thiệu`}>
            <ArticleHtml html={s.body} />
          </ArticleSection>
        ))}

        {/* FAQ */}
        {entry.faq.length > 0 && (
          <ArticleSection title={t`Câu hỏi thường gặp`}>
            <dl className="space-y-3">
              {entry.faq.map((f, i) => (
                <div key={i}>
                  <dt className="text-lg font-semibold">{f.q}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-justify text-[17px] leading-8 [overflow-wrap:anywhere]">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </ArticleSection>
        )}

        {/* Bài liên quan */}
        {related && related.length > 0 && (
          <ArticleSection title={t`Bài liên quan`}>
            <ArticleList>
              {related.map((r) => (
                <li key={r.id}>
                  {user ? (
                    <PanelLink
                      to={`/so-tay/${r.id}`}
                      panel="custom-view"
                      panelParams={{ pid: r.id }}
                      className="block py-2.5 font-serif text-[17px] text-primary hover:underline"
                    >
                      {r.title}
                    </PanelLink>
                  ) : (
                    <Link
                      to={`/xem/so-tay/${r.id}`}
                      className="block py-2.5 font-serif text-[17px] text-primary hover:underline"
                    >
                      {r.title}
                    </Link>
                  )}
                </li>
              ))}
            </ArticleList>
          </ArticleSection>
        )}

        <ArticleFooter>
          {entry.sources.length > 0 && (
            <div className="flex items-start gap-2">
              <IconBook className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0 break-words [overflow-wrap:anywhere]">
                <b>{t`Nguồn:`}</b>
                <ul className="mt-1 list-disc space-y-0.5 pl-5">
                  {entry.sources.map((src, i) => (
                    <li key={i}>
                      {src.url ? (
                        <a href={src.url} target="_blank" rel="noopener noreferrer nofollow" className="text-primary underline">
                          {src.name}
                        </a>
                      ) : (
                        src.name
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <p className="flex items-start gap-2">
            <IconHelp className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t`Nội dung tham khảo; phong tục có thể khác nhau theo vùng/gia đình.`}</span>
          </p>
        </ArticleFooter>
      </Article>

      {/* Nút thao tác của bài: thanh dính đáy, phá huỷ → phụ → chính (Sửa ngoài cùng phải). */}
      {embedded ? (
        <DrawerViewActions>{actionButtons}</DrawerViewActions>
      ) : (
        <ArticleActionBar safeArea>{actionButtons}</ArticleActionBar>
      )}
    </Shell>
  );
}

function EmbeddedRoot({ children }: { children: ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}
