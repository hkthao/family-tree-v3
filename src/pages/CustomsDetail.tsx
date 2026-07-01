import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "@/components/AppHeader";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconChevronDown,
  IconChevronUp,
  IconPencil,
  IconTrash,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  CUSTOM_CATEGORY_LABEL,
  CUSTOM_MANDATORY_LABEL,
  CUSTOM_ORIGIN_LABEL,
  CUSTOM_SCOPE_LABEL,
  deleteCustomEntry,
  getCustomEntry,
  listBookmarkedIds,
  setBookmark,
} from "@/lib/queries/customs";
import { getMyProfile } from "@/lib/queries/profile";
import { queryKeys } from "@/lib/queries/keys";

export default function CustomsDetail() {
  const { entryId } = useParams<{ entryId: string }>();
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
    enabled: !!entryId,
  });

  const { data: bookmarks } = useQuery({
    queryKey: ["custom-bookmarks", userId],
    queryFn: () => listBookmarkedIds(),
    enabled: !!userId,
  });
  const bookmarked = !!entryId && !!bookmarks?.has(entryId);

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

  // Đoạn nội dung đang mở (accordion); mặc định mở hết cho bài ngắn.
  const [openSecs, setOpenSecs] = useState<Set<number>>(() => new Set([0]));

  if (isLoading) {
    return (
      <Shell>
        <p className="text-muted-foreground">Đang tải…</p>
      </Shell>
    );
  }
  if (!entry) {
    return (
      <Shell>
        <p className="text-muted-foreground">Không tìm thấy bài.</p>
        <Button asChild variant="outline" className="mt-3">
          <Link to="/so-tay">← Về Sổ tay</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to="/so-tay" className="text-sm text-primary hover:underline">
            ← Sổ tay Văn hoá
          </Link>
          <h1 className="clan-name text-2xl font-semibold mt-1">{entry.title}</h1>
          {entry.aliases.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Còn gọi: {entry.aliases.join(", ")}
            </p>
          )}
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Button
            size="sm"
            variant="outline"
            onClick={() => bookmarkM.mutate()}
            disabled={bookmarkM.isPending}
            title={bookmarked ? "Bỏ lưu" : "Lưu bài"}
          >
            {bookmarked ? "★ Đã lưu" : "☆ Lưu"}
          </Button>
          {isAdmin && (
            <>
              <Button size="sm" variant="outline" asChild>
                <Link to={`/so-tay/${entry.id}/edit`}>
                  <IconPencil className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-destructive"
                onClick={async () => {
                  const ok = await confirm({
                    title: "Xoá bài này?",
                    confirmLabel: "Xoá",
                    destructive: true,
                  });
                  if (ok) deleteM.mutate();
                }}
              >
                <IconTrash className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        <Badge className="bg-accent/15 text-accent border-accent/30">
          {CUSTOM_CATEGORY_LABEL[entry.category]}
        </Badge>
        {entry.regions.map((r) => (
          <Badge key={r} className="bg-muted text-muted-foreground border-border">
            {r}
          </Badge>
        ))}
        {entry.mandatory_level && (
          <Badge
            className={
              entry.mandatory_level === "bat_buoc"
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-muted text-muted-foreground border-border"
            }
          >
            {CUSTOM_MANDATORY_LABEL[entry.mandatory_level]}
          </Badge>
        )}
        {entry.origin && (
          <Badge className="bg-muted text-muted-foreground border-border">
            {CUSTOM_ORIGIN_LABEL[entry.origin]}
          </Badge>
        )}
        {entry.scope && (
          <Badge className="bg-muted text-muted-foreground border-border">
            Phạm vi: {CUSTOM_SCOPE_LABEL[entry.scope]}
          </Badge>
        )}
        {entry.reliability != null && (
          <Badge
            className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
            title="Độ tin cậy"
          >
            {"★".repeat(entry.reliability)}
          </Badge>
        )}
      </div>

      {entry.cover_image_url && (
        <img
          src={entry.cover_image_url}
          alt={entry.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="w-full max-h-72 object-cover rounded-lg border"
        />
      )}

      {entry.short_description && (
        <p className="text-base font-medium">{entry.short_description}</p>
      )}
      {entry.timing && (
        <p className="text-sm text-muted-foreground">🗓 Thời điểm: {entry.timing}</p>
      )}
      {entry.applicable_to && (
        <p className="text-sm text-muted-foreground">👥 Áp dụng: {entry.applicable_to}</p>
      )}

      {/* Nội dung nhiều đoạn — accordion */}
      {entry.sections.length > 0 && (
        <div className="space-y-2">
          {entry.sections.map((s, i) => {
            const open = openSecs.has(i);
            return (
              <div key={i} className="rounded-md border">
                <button
                  type="button"
                  onClick={() =>
                    setOpenSecs((prev) => {
                      const n = new Set(prev);
                      if (n.has(i)) n.delete(i);
                      else n.add(i);
                      return n;
                    })
                  }
                  className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left font-medium"
                >
                  <span>{s.heading || `Phần ${i + 1}`}</span>
                  {open ? (
                    <IconChevronUp className="h-4 w-4 shrink-0" />
                  ) : (
                    <IconChevronDown className="h-4 w-4 shrink-0" />
                  )}
                </button>
                {open && (
                  <p className="whitespace-pre-wrap px-3 pb-3 text-base leading-relaxed">
                    {s.body}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* FAQ */}
      {entry.faq.length > 0 && (
        <div className="rounded-lg border bg-card p-4">
          <h2 className="mb-2 font-semibold">Câu hỏi thường gặp</h2>
          <dl className="space-y-2">
            {entry.faq.map((f, i) => (
              <div key={i}>
                <dt className="font-medium text-sm">{f.q}</dt>
                <dd className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {f.a}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {entry.sources && (
        <p className="text-xs text-muted-foreground">📚 Nguồn: {entry.sources}</p>
      )}
      <p className="text-xs text-muted-foreground pt-1">
        ⚠️ Nội dung tham khảo; phong tục có thể khác nhau theo vùng/gia đình.
      </p>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-background lg:pl-72">
      <AppHeader />
      <main className="container max-w-3xl py-6 px-4 space-y-3">{children}</main>
    </div>
  );
}

function Badge({
  className,
  children,
  title,
}: {
  className: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${className}`}
    >
      {children}
    </span>
  );
}
