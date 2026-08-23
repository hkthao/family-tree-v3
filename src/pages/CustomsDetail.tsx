import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";

import { CustomsShell } from "@/components/CustomsShell";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconBook,
  IconCalendar,
  IconCheck,
  IconHelp,
  IconPencil,
  IconShare2,
  IconTrash,
  IconUsers,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["custom-bookmarks", userId] }),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteCustomEntry(entryId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customs"] });
      toast.success("Đã xoá bài");
      navigate("/so-tay");
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  // Duyệt nhanh: chuyển thẳng sang "Công khai" mà không cần mở form.
  const approveM = useMutation({
    mutationFn: () => updateCustomEntry(entryId!, { status: "published" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customs"] });
      qc.invalidateQueries({ queryKey: ["custom-entry", entryId] });
      toast.success("Đã duyệt — bài đã công khai");
    },
    onError: (e) => toast.error("Không duyệt được", { description: (e as Error).message }),
  });

  // Chia sẻ lên mạng xã hội: Web Share API (mobile) → fallback chép link.
  async function shareEntry() {
    // Luôn chia sẻ link CÔNG KHAI (không cần đăng nhập) để mở được ngoài Zalo/Facebook.
    const url = entry
      ? `${window.location.origin}/xem/so-tay/${entry.id}`
      : window.location.href;
    const title = entry?.title ?? "Sổ tay Văn hoá";
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
      toast.success("Đã chép liên kết — dán vào Zalo/Facebook để chia sẻ");
    } catch {
      toast.error("Không chia sẻ được", { description: url });
    }
  }

  if (isNew) return <Navigate to="/so-tay/new" replace />;

  if (isLoading) {
    return (
      <CustomsShell>
        <p className="text-muted-foreground">Đang tải…</p>
      </CustomsShell>
    );
  }
  if (!entry) {
    return (
      <CustomsShell>
        <p className="text-muted-foreground">Không tìm thấy bài.</p>
        <Button asChild variant="outline" className="mt-3">
          {user ? <Link to="/so-tay">← Về Sổ tay</Link> : <Link to="/login">Đăng nhập</Link>}
        </Button>
      </CustomsShell>
    );
  }

  const metaLine = [
    entry.regions.length > 0 ? entry.regions.join(", ") : null,
    (entry.origins?.length ?? 0) > 0
      ? `Nguồn gốc: ${(entry.origins ?? []).map((o) => CUSTOM_ORIGIN_LABEL[o]).join(", ")}`
      : null,
    entry.scope ? `Phạm vi: ${CUSTOM_SCOPE_LABEL[entry.scope]}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");

  return (
    <CustomsShell>
      {/* Thanh trên: quay lại + hành động (ngoài "trang giấy") */}
      <div className="flex items-center justify-between gap-3">
        {user ? (
          <Link to="/so-tay" className="text-sm text-primary hover:underline">
            ← Sổ tay Văn hoá
          </Link>
        ) : (
          <Link to="/login" className="text-sm text-primary hover:underline">
            Đăng nhập để xem thêm →
          </Link>
        )}
        <div className="flex shrink-0 gap-1.5">
          <Button size="sm" variant="outline" onClick={shareEntry} title="Chia sẻ">
            <IconShare2 className="h-4 w-4 sm:mr-1" />
            <span className="hidden sm:inline">Chia sẻ</span>
          </Button>
          {user && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => bookmarkM.mutate()}
              disabled={bookmarkM.isPending}
              title={bookmarked ? "Bỏ lưu" : "Lưu bài"}
            >
              <span aria-hidden>{bookmarked ? "★" : "☆"}</span>
              <span className="hidden sm:inline sm:ml-1">
                {bookmarked ? "Đã lưu" : "Lưu"}
              </span>
            </Button>
          )}
          {isAdmin && entry.status !== "published" && (
            <Button
              size="sm"
              onClick={() => approveM.mutate()}
              disabled={approveM.isPending}
              title="Duyệt & công khai"
            >
              <IconCheck className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Duyệt</span>
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" asChild title="Sửa">
                <Link to={`/so-tay/${entry.id}/edit`}>
                  <IconPencil className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Sửa</span>
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                title="Xoá"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Xoá bài này?",
                    confirmLabel: "Xoá",
                    destructive: true,
                  });
                  if (ok) deleteM.mutate();
                }}
              >
                <IconTrash className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Xoá</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* "Trang sách": chữ serif to, dễ đọc cho người lớn tuổi. Dùng token theme
          (bg-card / text-*) nên tự hợp sáng-tối; theme này vốn là tông giấy ấm.
          Hiển thị đầy đủ nội dung (không gập/mở) — không bắt bấm để xem. */}
      <article className="rounded-2xl border shadow-sm px-5 py-7 sm:px-10 sm:py-10 font-serif bg-card text-card-foreground">
        {entry.status !== "published" && (
          <p className="mb-3 text-center text-xs text-accent">
            — Bản {entry.status === "draft" ? "nháp" : "chờ duyệt"} —
          </p>
        )}

        <h1 className="clan-name text-center text-3xl sm:text-4xl font-semibold leading-tight text-primary">
          {entry.title}
        </h1>
        {entry.aliases.length > 0 && (
          <p className="mt-1 text-center text-base italic text-muted-foreground">
            Còn gọi: {entry.aliases.join(", ")}
          </p>
        )}

        {/* Nhãn nhỏ giữa trang */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="text-primary">{CUSTOM_CATEGORY_LABEL[entry.category]}</span>
          {entry.mandatory_level && <span>· {CUSTOM_MANDATORY_LABEL[entry.mandatory_level]}</span>}
          {entry.reliability != null && (
            <span title="Độ tin cậy" className="text-accent">· {"★".repeat(entry.reliability)}</span>
          )}
        </div>
        {metaLine && (
          <p className="mt-1 text-center text-sm text-muted-foreground">{metaLine}</p>
        )}

        <div className="mx-auto my-5 flex items-center justify-center gap-3 text-accent">
          <span className="bg-border" style={{ height: 1, width: 60 }} />
          <span className="text-sm">❧</span>
          <span className="bg-border" style={{ height: 1, width: 60 }} />
        </div>

        {entry.cover_image_url && (
          <img
            src={entry.cover_image_url}
            alt={entry.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="mx-auto mb-6 w-full max-h-80 rounded-lg object-cover"
          />
        )}

        {entry.short_description && (
          <p className="text-lg sm:text-xl leading-relaxed text-card-foreground">
            {entry.short_description}
          </p>
        )}

        {(entry.timing || entry.applicable_to) && (
          <div className="mt-4 space-y-1.5 text-base text-muted-foreground">
            {entry.timing && (
              <p className="flex items-center gap-2">
                <IconCalendar className="h-4 w-4 shrink-0 text-accent" />
                <span><b>Thời điểm:</b> {entry.timing}</span>
              </p>
            )}
            {entry.applicable_to && (
              <p className="flex items-center gap-2">
                <IconUsers className="h-4 w-4 shrink-0 text-accent" />
                <span><b>Áp dụng:</b> {entry.applicable_to}</span>
              </p>
            )}
          </div>
        )}

        {/* Các đoạn nội dung — hiện đầy đủ, chữ to, giãn dòng thoáng */}
        {entry.sections.map((s, i) => (
          <section key={i} className="mt-7">
            <h2 className="clan-name text-2xl font-semibold text-primary">
              {s.heading || `Phần ${i + 1}`}
            </h2>
            {s.image_url && (
              <figure className="mt-3">
                <img
                  src={s.image_url}
                  alt={s.image_caption || s.heading || ""}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="w-full max-h-72 rounded-lg object-cover"
                />
                {s.image_caption && (
                  <figcaption className="mt-1 text-center text-sm italic text-muted-foreground">
                    {s.image_caption}
                  </figcaption>
                )}
              </figure>
            )}
            <p className="mt-2 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[17px] sm:text-lg leading-8 text-card-foreground">
              {s.body}
            </p>
          </section>
        ))}

        {/* FAQ */}
        {entry.faq.length > 0 && (
          <section className="mt-8">
            <h2 className="clan-name text-2xl font-semibold text-primary">
              Câu hỏi thường gặp
            </h2>
            <dl className="mt-2 space-y-3">
              {entry.faq.map((f, i) => (
                <div key={i}>
                  <dt className="text-lg font-semibold text-card-foreground">{f.q}</dt>
                  <dd className="mt-0.5 whitespace-pre-wrap break-words [overflow-wrap:anywhere] text-[17px] leading-8 text-card-foreground">
                    {f.a}
                  </dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        {/* Bài liên quan */}
        {related && related.length > 0 && (
          <section className="mt-8">
            <h2 className="clan-name text-2xl font-semibold text-primary">
              Bài liên quan
            </h2>
            <ul className="mt-2 space-y-1.5">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    to={user ? `/so-tay/${r.id}` : `/xem/so-tay/${r.id}`}
                    className="text-[17px] underline decoration-dotted underline-offset-4 text-primary"
                  >
                    → {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-8 border-t pt-4 text-sm text-muted-foreground">
          {entry.sources && (
            <p className="flex items-start gap-2">
              <IconBook className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="min-w-0 break-words [overflow-wrap:anywhere]">
                <b>Nguồn:</b> {entry.sources}
              </span>
            </p>
          )}
          <p className="mt-1.5 flex items-start gap-2">
            <IconHelp className="mt-0.5 h-4 w-4 shrink-0" />
            <span>Nội dung tham khảo; phong tục có thể khác nhau theo vùng/gia đình.</span>
          </p>
        </div>
      </article>
    </CustomsShell>
  );
}

