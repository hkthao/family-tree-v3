import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { isClanAdmin } from "@/hooks/useClanContext";
import {
  createClanPost,
  type ClanPostType,
} from "@/lib/queries/clan_posts";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import { queryKeys } from "@/lib/queries/keys";

const TYPE_OPTIONS: Array<{ value: ClanPostType; label: string }> = [
  { value: "news", label: "Tin" },
  { value: "event", label: "Sự kiện" },
  { value: "birth", label: "Sinh" },
  { value: "death", label: "Cáo phó" },
  { value: "notice", label: "Thông báo" },
];

/**
 * Composer cho bảng tin. Member thường gửi → `pending` (chờ duyệt);
 * admin gửi → `published` luôn. UI khác biệt để người dùng biết.
 */
export function ClanPostComposer({ clan }: { clan: ClanDetail }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const admin = isClanAdmin(clan);

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<ClanPostType>("news");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [eventDate, setEventDate] = useState("");

  const reset = () => {
    setType("news");
    setTitle("");
    setBody("");
    setEventDate("");
  };

  const createM = useMutation({
    mutationFn: () =>
      createClanPost({
        clanId: clan.id,
        authorId: user!.id,
        type,
        title: title.trim() || null,
        body: body.trim(),
        eventDate: eventDate || null,
        // KEY: non-admin BUỘC 'pending' (RLS chặn nếu sai).
        status: admin ? "published" : "pending",
      }),
    onSuccess: () => {
      toast.success(
        admin ? "Đã đăng bài" : "Đã gửi — chờ admin duyệt",
        {
          description: title.trim() || body.slice(0, 60),
        },
      );
      reset();
      setOpen(false);
      qc.invalidateQueries({ queryKey: queryKeys.clanPosts(clan.id) });
      qc.invalidateQueries({
        queryKey: queryKeys.clanPostsPending(clan.id),
      });
    },
    onError: (e) =>
      toast.error("Không gửi được", { description: (e as Error).message }),
  });

  if (!user) return null;

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} size="sm">
        + Đăng bài mới
      </Button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (body.trim()) createM.mutate();
      }}
      className="rounded-lg border bg-card p-4 space-y-4"
    >
      <h3 className="font-semibold">Đăng bài mới</h3>

      {!admin && (
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
          rows={5}
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
          disabled={!body.trim() || createM.isPending}
        >
          {createM.isPending
            ? "Đang gửi…"
            : admin
              ? "Đăng"
              : "Gửi duyệt"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset();
            setOpen(false);
          }}
        >
          Huỷ
        </Button>
      </div>
    </form>
  );
}
