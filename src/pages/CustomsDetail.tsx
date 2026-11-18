import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import {
  Article,
  ArticleFactBox,
  ArticleFigure,
  ArticleFooter,
  ArticleHeader,
  ArticleList,
  ArticleProse,
  ArticleSection,
} from "@/components/Article";
import { CustomsShell } from "@/components/CustomsShell";
import { PanelLink } from "@/components/panel/PanelLink";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconArrowLeft,
  IconBook,
  IconCheck,
  IconHelp,
  IconLogIn,
  IconPencil,
  IconShare2,
  IconTrash,
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
  deleteCustomEntry,
  getCustomEntriesByIds,
  getCustomEntry,
  listBookmarkedIds,
  setBookmark,
  updateCustomEntry,
} from "@/lib/queries/customs";
import { getMyProfile } from "@/lib/queries/profile";
import { queryKeys } from "@/lib/queries/keys";

import { t } from "@lingui/core/macro";
export default function CustomsDetail() {
  const { entryId } = useParams<{ entryId: string }>();
  const isNew = entryId === "new"; // phòng khớp nhầm route
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();

  const { data: profile } = useQuery({
    queryKey: queryKeys.myProfile(userId),
    queryFn: () => getMyProfile(userId),
    enabled: !!userId,
  });
  const isAdmin = !!profile?.is_platform_admin;

  const { data: entry, isLoading } = useQuery({
    queryKey: ["custom-entry", entryId],
    queryFn: () => getCustomEntry(entryId!),
    enabled: !!entryId && !isNew,
  });

  // Bài Sổ tay là tài sản SEO thật của app (khách vào từ tìm kiếm) —
  // đặt tiêu đề + mô tả theo đúng nội dung bài.
  usePageTitle(entry?.title ?? null, entry?.short_description ?? null);

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

  const deleteM = useMutation({
    mutationFn: () => deleteCustomEntry(entryId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customs"] });
      toast.success(t`Đã xoá bài`);
      navigate("/so-tay");
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  // Duyệt nhanh: chuyển thẳng sang "Công khai" mà không cần mở form.
  const approveM = useMutation({
    mutationFn: () => updateCustomEntry(entryId!, { status: "published" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customs"] });
      qc.invalidateQueries({ queryKey: ["custom-entry", entryId] });
      toast.success(t`Đã duyệt — bài đã công khai`);
    },
    onError: (e) =>
      toast.error(t`Không duyệt được`, { description: (e as Error).message }),
  });

  // Chia sẻ lên mạng xã hội: Web Share API (mobile) → fallback chép link.
  async function shareEntry() {
    // Luôn chia sẻ link CÔNG KHAI (không cần đăng nhập) để mở được ngoài Zalo/Facebook.
    const url = entry
      ? `${window.location.origin}/xem/so-tay/${entry.id}`
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

  if (isNew) return <Navigate to="/so-tay/new" replace />;

  if (isLoading) {
    return (
      <CustomsShell>
        <p className="text-muted-foreground">{t`Đang tải…`}</p>
      </CustomsShell>
    );
  }
  if (!entry) {
    return (
      <CustomsShell>
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
      </CustomsShell>
    );
  }

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
    <CustomsShell>
      {/* Thanh trên: quay lại + hành động (ngoài "trang giấy") */}
      <div className="flex items-center justify-between gap-3">
        {user ? (
          <Link to="/so-tay" className="text-sm text-primary hover:underline">
            {t`← Sổ tay Văn hoá`}
          </Link>
        ) : (
          <Link to="/login" className="text-sm text-primary hover:underline">
            {t`Đăng nhập để xem thêm →`}
          </Link>
        )}
        <div className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={shareEntry}
            title={t`Chia sẻ`}
          >
            <IconShare2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">{t`Chia sẻ`}</span>
          </Button>
          {/* icon-audit: ok — ★/☆ chính là icon, và trạng thái đọc được ngay từ hình */}
          {user && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => bookmarkM.mutate()}
              disabled={bookmarkM.isPending}
              title={bookmarked ? t`Bỏ lưu` : t`Lưu bài`}
            >
              <span aria-hidden>{bookmarked ? "★" : "☆"}</span>
              <span className="hidden sm:inline sm:ml-1">
                {bookmarked ? t`Đã lưu` : t`Lưu`}
              </span>
            </Button>
          )}
          {isAdmin && entry.status !== "published" && (
            <Button
              size="sm"
              onClick={() => approveM.mutate()}
              disabled={approveM.isPending}
              title={t`Duyệt & công khai`}
            >
              <IconCheck className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">{t`Duyệt`}</span>
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" asChild title={t`Sửa`}>
                <PanelLink
                  to={`/so-tay/${entry.id}/edit`}
                  panel="custom-edit"
                  panelParams={{ pid: entry.id }}
                >
                  <IconPencil className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">{t`Sửa`}</span>
                </PanelLink>
              </Button>
              <Button
                size="sm"
                variant="destructive-outline"
                title={t`Xoá`}
                onClick={async () => {
                  const ok = await confirm({
                    title: t`Xoá bài này?`,
                    confirmLabel: t`Xoá`,
                    destructive: true,
                  });
                  if (ok) deleteM.mutate();
                }}
              >
                <IconTrash className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">{t`Xoá`}</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Dạng bài báo (khuôn chung components/Article): không bọc thẻ, chuyên mục → tít → sapo → dòng thông tin →
          ảnh lớn → các mục. Hiển thị đầy đủ nội dung (không gập/mở) — không bắt bấm để xem. */}
      <Article>
        {entry.status !== "published" && (
          <p className="mb-2 font-sans text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            Bản {entry.status === "draft" ? t`nháp` : t`chờ duyệt`}
          </p>
        )}
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
          <ArticleSection key={i} title={s.heading || t`Phần ${i + 1}`}>
            {s.image_url && (
              <figure className="mb-3">
                <img
                  src={s.image_url}
                  alt={s.image_caption || s.heading || ""}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="max-h-72 w-full rounded-lg object-cover"
                />
                {s.image_caption && (
                  <figcaption className="mt-1.5 font-sans text-sm italic text-muted-foreground">
                    {s.image_caption}
                  </figcaption>
                )}
              </figure>
            )}
            <ArticleProse>{s.body}</ArticleProse>
          </ArticleSection>
        ))}

        {/* FAQ */}
        {entry.faq.length > 0 && (
          <ArticleSection title={t`Câu hỏi thường gặp`}>
            <dl className="space-y-3">
              {entry.faq.map((f, i) => (
                <div key={i}>
                  <dt className="text-lg font-semibold">{f.q}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words text-[17px] leading-8 [overflow-wrap:anywhere]">
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
                  <Link
                    to={user ? `/so-tay/${r.id}` : `/xem/so-tay/${r.id}`}
                    className="block py-2.5 font-serif text-[17px] text-primary hover:underline"
                  >
                    {r.title}
                  </Link>
                </li>
              ))}
            </ArticleList>
          </ArticleSection>
        )}

        <ArticleFooter>
          {entry.sources && (
            <p className="flex items-start gap-2">
              <IconBook className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                <b>{t`Nguồn:`}</b> {entry.sources}
              </span>
            </p>
          )}
          <p className="flex items-start gap-2">
            <IconHelp className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t`Nội dung tham khảo; phong tục có thể khác nhau theo vùng/gia đình.`}</span>
          </p>
        </ArticleFooter>
      </Article>
    </CustomsShell>
  );
}
