import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { friendlyError } from "@/components/ErrorState";
import {
  IconCalendar,
  IconCheck,
  IconCopy,
  IconLink,
} from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { PanelActionBar } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  calendarFeedUrl,
  calendarSubscribeLinks,
  createCalendarFeed,
  deleteCalendarFeed,
  getMyCalendarFeed,
} from "@/lib/queries/calendar-feeds";

import { t } from "@lingui/core/macro";
/**
 * Ngăn kéo "Đăng ký lịch": đưa ngày giỗ, sinh nhật, sự kiện vào Google/Apple
 * Calendar MỘT LẦN, sau đó lịch tự cập nhật. Khác nút "Xuất lịch" (tải file một
 * lần, phải nhập lại khi dữ liệu đổi).
 */
export function CalendarFeedPanel({
  clanId,
  userId,
  open,
  onClose,
}: {
  clanId: string;
  userId: string;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const toast = useToast();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const key = ["calendar-feed", clanId, userId];

  const { data: feed, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => getMyCalendarFeed(clanId, userId),
    enabled: open,
  });

  const create = useMutation({
    mutationFn: () => createCalendarFeed(clanId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(t`Đã tạo link lịch`);
    },
    onError: (e) =>
      toast.error(t`Không tạo được`, { description: friendlyError(e) }),
  });
  const revoke = useMutation({
    mutationFn: () => deleteCalendarFeed(clanId, userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: key });
      toast.success(t`Đã thu hồi link lịch`);
    },
    onError: (e) =>
      toast.error(t`Không thu hồi được`, { description: friendlyError(e) }),
  });

  const url = feed ? calendarFeedUrl(feed.token) : "";
  const links = url ? calendarSubscribeLinks(url) : null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* bỏ qua — người dùng chép tay từ ô */
    }
  }

  return (
    <SidePanel
      open={open}
      title={t`Đăng ký lịch tự cập nhật`}
      subtitle={t`Ngày giỗ, sinh nhật và sự kiện của dòng họ vào Google / Apple Calendar`}
      onClose={onClose}
      guard={false}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Dán link dưới đây vào ứng dụng lịch <strong>{t`một lần`}</strong>. Từ
          đó, khi dòng họ thêm người, sửa ngày giỗ hay tạo sự kiện mới, lịch của
          bạn tự cập nhật (làm mới mỗi vài giờ). Ngày giỗ đã được đổi từ âm lịch
          sang dương lịch.
        </p>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t`Đang tải…`}</p>
        ) : !feed ? (
          <Button
            size="sm"
            onClick={() => create.mutate()}
            disabled={create.isPending}
          >
            <IconCalendar className="h-4 w-4 mr-1.5" />
            {create.isPending ? t`Đang tạo…` : t`Tạo link đăng ký lịch`}
          </Button>
        ) : (
          <div className="space-y-4">
            <Input
              readOnly
              icon={<IconLink />}
              value={url}
              className="h-10 font-mono text-xs"
              onFocus={(e) => e.currentTarget.select()}
              action={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={copy}
                  aria-label={copied ? t`Đã chép` : t`Chép link`}
                  title={copied ? t`Đã chép` : t`Chép link`}
                  className="h-10 w-10"
                >
                  {copied ? (
                    <IconCheck className="h-4 w-4" />
                  ) : (
                    <IconCopy className="h-4 w-4" />
                  )}
                </Button>
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" variant="outline">
                <a href={links!.google} target="_blank" rel="noreferrer">
                  <IconCalendar className="h-4 w-4 mr-1.5" />
                  {t`Thêm vào Google Calendar`}
                </a>
              </Button>
              <Button asChild size="sm" variant="outline">
                <a href={links!.webcal}>
                  <IconCalendar className="h-4 w-4 mr-1.5" />
                  {t`Thêm vào Apple / Outlook`}
                </a>
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Link này là của riêng bạn — đừng chia sẻ. Ai có link xem được ngày
              giỗ, sinh nhật và sự kiện của dòng họ. Link tự hết tác dụng khi
              bạn rời dòng họ; nghi bị lộ thì bấm “Tạo link mới” để link cũ
              ngừng hoạt động.
              {feed.last_fetched_at
                ? t` Lịch được lấy gần nhất lúc ${new Date(feed.last_fetched_at).toLocaleString("vi-VN")}.`
                : ""}
            </p>
            <PanelActionBar>
              <Button
                size="sm"
                variant="destructive-outline"
                disabled={revoke.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: t`Thu hồi link lịch?`,
                    description: t`Lịch đã đăng ký sẽ ngừng cập nhật.`,
                    confirmLabel: t`Thu hồi`,
                    destructive: true,
                  });
                  if (ok) revoke.mutate();
                }}
              >
                {t`Thu hồi`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={create.isPending}
                onClick={async () => {
                  const ok = await confirm({
                    title: t`Tạo link mới?`,
                    description: t`Link cũ ngừng hoạt động; bạn cần đăng ký lại lịch bằng link mới.`,
                    confirmLabel: t`Tạo link mới`,
                  });
                  if (ok) create.mutate();
                }}
              >
                {t`Tạo link mới`}
              </Button>
            </PanelActionBar>
          </div>
        )}
      </div>
    </SidePanel>
  );
}
