import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import {
  IconBell,
} from "@/components/icons";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePushSubscription } from "@/hooks/usePushSubscription";
import { queryKeys } from "@/lib/queries/keys";
import { updateMyNotifyViaPush } from "@/lib/queries/push";

const DISMISS_KEY = "push-prompt-dismissed-v1";

/**
 * Lời mời BẬT THÔNG BÁO — banner gọn trên Trang chủ. Đây là "công tắc" mở khoá
 * mọi nhắc nhở (giỗ theo quan hệ, sinh nhật, sự kiện, mùng 1/rằm) vốn đang im
 * lặng vì chưa ai bật push. Một chạm: xin quyền → đăng ký push → bật cờ DB.
 * Ẩn được (nhớ localStorage); người dùng vẫn bật/tắt lại ở trang Tài khoản.
 */
export function EnablePushPrompt() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const push = usePushSubscription();
  const toast = useToast();
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const setPref = useMutation({
    mutationFn: (next: boolean) => updateMyNotifyViaPush(userId, next),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: queryKeys.myProfile(userId) }),
  });

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  async function enable() {
    await push.enable();
    if (push.error) {
      toast.error("Không bật được thông báo", { description: push.error });
      return;
    }
    setPref.mutate(true);
    toast.success("Đã bật thông báo — bạn sẽ nhận nhắc giỗ, sinh nhật, sự kiện.");
  }

  if (dismissed) return null;

  // iOS Safari ngoài chế độ cài-vào-màn-hình: không đăng ký push được → hướng dẫn.
  if (push.state === "ios-not-standalone") {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
        <IconBell className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-medium">Bật thông báo trên iPhone/iPad</p>
          <p className="text-muted-foreground">
            Bấm nút Chia sẻ trong Safari → "Thêm vào Màn hình chính", rồi mở app
            từ biểu tượng để bật nhắc giỗ, sinh nhật.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Ẩn"
        >
          ✕
        </button>
      </div>
    );
  }

  // Chỉ mời khi có thể đăng ký nhưng CHƯA bật.
  if (push.state !== "default") return null;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <IconBell className="h-5 w-5 shrink-0 text-primary" />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">Bật thông báo để không bỏ lỡ</p>
        <p className="text-muted-foreground">
          Nhận nhắc <b>giỗ</b>, <b>sinh nhật</b> và sự kiện dòng họ ngay trên máy.
        </p>
      </div>
      <Button size="sm" onClick={enable} disabled={setPref.isPending}>
        <IconBell className="h-4 w-4 mr-1.5" />
            Bật ngay
      </Button>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 text-muted-foreground hover:text-foreground"
        aria-label="Ẩn"
      >
        ✕
      </button>
    </div>
  );
}
