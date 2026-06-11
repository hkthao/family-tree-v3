import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { IconCheck, IconX } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin } from "@/hooks/useClanContext";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import {
  createClanPost,
  updateClanPost,
  type ClanPost,
  type ClanPostType,
} from "@/lib/queries/clan_posts";
import { queryKeys } from "@/lib/queries/keys";

const TYPE_OPTIONS: Array<{ value: ClanPostType; label: string }> = [
  { value: "news", label: "Tin" },
  { value: "event", label: "Sự kiện" },
  { value: "birth", label: "Sinh" },
  { value: "death", label: "Cáo phó" },
  { value: "notice", label: "Thông báo" },
];

/**
 * Form chung cho cả "Đăng bài mới" và "Sửa bài". Khi `post` truyền
 * vào → edit mode, không thì create.
 *
 * Khi non-admin tạo bài mới → ép status='pending' (RLS chặn nếu sai).
 * Khi edit, status không thay đổi qua form này — trigger guard 32.3.t2
 * chặn non-admin đổi status; admin moderate qua RPC riêng.
 */
export function BoardPostForm({
  clan,
  post,
  onDone,
  onCancel,
}: {
  clan: ClanDetail;
  /** Có giá trị → edit; null/undef → create. */
  post?: ClanPost | null;
  /** Sau khi save thành công — Page điều hướng. */
  onDone: (postId: string) => void;
  onCancel: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const admin = isClanAdmin(clan);
  const isEdit = !!post;

  const [type, setType] = useState<ClanPostType>(post?.type ?? "news");
  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [eventDate, setEventDate] = useState(post?.event_date ?? "");

  const saveM = useMutation({
    mutationFn: async (): Promise<string> => {
      if (isEdit && post) {
        await updateClanPost(post.id, {
          type,
          title: title.trim() || null,
          body: body.trim(),
          event_date: eventDate || null,
        });
        return post.id;
      }
      if (!user) throw new Error("Not authenticated");
      const created = await createClanPost({
        clanId: clan.id,
        authorId: user.id,
        type,
        title: title.trim() || null,
        body: body.trim(),
        eventDate: eventDate || null,
        // KEY: non-admin BUỘC 'pending' (RLS chặn nếu sai).
        status: admin ? "published" : "pending",
      });
      return created.id;
    },
    onSuccess: (postId) => {
      toast.success(
        isEdit
          ? "Đã lưu bài"
          : admin
            ? "Đã đăng bài"
            : "Đã gửi — chờ admin duyệt",
        { description: title.trim() || body.slice(0, 60) },
      );
      qc.invalidateQueries({ queryKey: queryKeys.clanPosts(clan.id) });
      qc.invalidateQueries({ queryKey: queryKeys.clanPostsPending(clan.id) });
      if (isEdit) {
        qc.invalidateQueries({ queryKey: queryKeys.clanPost(postId) });
      }
      onDone(postId);
    },
    onError: (e) =>
      toast.error("Không lưu được", { description: (e as Error).message }),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) saveM.mutate();
      }}
      className="rounded-lg border bg-card p-4 space-y-4"
    >
      <h3 className="font-semibold">
        {isEdit ? "Sửa bài" : "Đăng bài mới"}
      </h3>

      {!admin && !isEdit && (
        <Alert>
          <AlertDescription>
            Bài sẽ chuyển vào hàng chờ duyệt. Admin của dòng họ sẽ kiểm tra
            và quyết định đăng hay không.
          </AlertDescription>
        </Alert>
      )}

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Loại bài</legend>
        <div className="flex flex-wrap gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.value}
              className={`flex items-center gap-2 rounded-md border px-3 py-1.5 cursor-pointer text-sm ${
                type === opt.value
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/40"
              }`}
            >
              <input
                type="radio"
                name="post-type"
                checked={type === opt.value}
                onChange={() => setType(opt.value)}
                className="h-4 w-4 accent-primary"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor="post-title">Tiêu đề (tuỳ chọn)</Label>
        <Input
          id="post-title"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Vd: Họp họ rằm tháng Bảy"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="post-body" required>
          Nội dung
        </Label>
        <textarea
          id="post-body"
          required
          maxLength={20000}
          rows={6}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Viết tin cho cả họ đọc…"
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {(type === "event" || type === "notice") && (
        <div className="space-y-2">
          <Label htmlFor="post-event-date">Ngày diễn ra (tuỳ chọn)</Label>
          <Input
            id="post-event-date"
            type="date"
            value={eventDate}
            onChange={(e) => setEventDate(e.target.value)}
          />
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <Button
          type="submit"
          variant="outline"
          disabled={!body.trim() || saveM.isPending}
        >
          <IconCheck className="h-4 w-4 mr-1.5" />
          {saveM.isPending
            ? "Đang lưu…"
            : isEdit
              ? "Cập nhật"
              : admin
                ? "Đăng"
                : "Gửi duyệt"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          <IconX className="h-4 w-4 mr-1.5" />
          Huỷ
        </Button>
      </div>
    </form>
  );
}
