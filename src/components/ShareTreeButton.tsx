import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { useToast } from "@/components/Toast";
import { IconCheck, IconCopy, IconLink, IconShare2 } from "@/components/icons";
import { SidePanel } from "@/components/SidePanel";
import { Button } from "@/components/ui/button";
import { getOrCreateTreeShareLink } from "@/lib/queries/share-links";

import { t } from "@lingui/core/macro";
interface Props {
  clanId: string;
  clanName: string;
  /** Render variant — desktop shows full label, mobile compact. */
  compact?: boolean;
}

/**
 * "Chia sẻ cây" button for the Tree page. Lazily fetches/creates a
 * 90-day tree share link, opens a modal with copy + share-to-X
 * targets. The native Web Share API (when available) is the primary
 * action on mobile because it routes to whatever app the user has
 * installed (Zalo, Messenger, Facebook, SMS, email, …). Explicit
 * platform buttons are kept as a fallback for desktop / older
 * browsers where navigator.share() is missing.
 */
export function ShareTreeButton({ clanId, clanName, compact }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const linkM = useMutation({
    mutationFn: () => getOrCreateTreeShareLink(clanId),
    onError: (e) =>
      toast.error(t`Không tạo được link chia sẻ`, {
        description: (e as Error).message,
      }),
  });

  function openShare() {
    setOpen(true);
    if (!linkM.data && !linkM.isPending) linkM.mutate();
  }

  const token = linkM.data?.token;
  const shareUrl = token ? `${window.location.origin}/share/${token}` : "";
  const shareTitle = t`Gia phả ${clanName}`;
  const shareText = t`Xem gia phả họ ${clanName} (link chỉ-đọc):`;
  const expiresAt = linkM.data?.expires_at
    ? new Date(linkM.data.expires_at)
    : null;

  // Native Web Share is the simplest on mobile — opens the system
  // share sheet (Zalo / Messenger / Mail / SMS / …). Only render the
  // explicit per-platform buttons when not supported (older Safari,
  // most desktops).
  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function copyLink() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
      toast.success(t`Đã chép link`);
    } catch (e) {
      toast.error(t`Không chép được`, { description: (e as Error).message });
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    try {
      await navigator.share({
        title: shareTitle,
        text: shareText,
        url: shareUrl,
      });
    } catch {
      // User cancelled — silent.
    }
  }

  function openShareTarget(url: string) {
    window.open(url, "_blank", "noopener,noreferrer,width=720,height=640");
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 px-2.5 sm:px-3"
        onClick={openShare}
        aria-label={t`Chia sẻ cây`}
        title={t`Tạo link chia sẻ và gửi qua Zalo / Facebook / Email…`}
      >
        <IconLink className="h-4 w-4 sm:mr-1.5" />
        {!compact && <span className="hidden sm:inline">{t`Chia sẻ`}</span>}
      </Button>

      {open && renderShare()}
    </>
  );

  // Gọi như hàm (không phải <Component/>) để mỗi lần state đổi (đã chép…) panel không bị dựng lại.
  function renderShare() {
    const encoded = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    return (
      <SidePanel
        open
        title={t`Chia sẻ cây gia phả`}
        subtitle={t`Người nhận xem được cây chỉ-đọc, không cần đăng nhập.`}
        onClose={() => setOpen(false)}
        guard={false}
      >
        <div className="space-y-4">
          {linkM.isPending && !linkM.data && (
            <p className="text-muted-foreground">{t`Đang tạo link…`}</p>
          )}

          {shareUrl && (
            <>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={shareUrl}
                  onFocus={(e) => e.currentTarget.select()}
                  className="flex-1 min-w-0 h-10 rounded-md border border-input bg-muted/30 px-3 text-sm font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-10 shrink-0"
                  onClick={copyLink}
                >
                  {copied ? (
                    <>
                      <IconCheck className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">{t`Đã chép`}</span>
                    </>
                  ) : (
                    <>
                      <IconCopy className="h-4 w-4 sm:mr-1.5" />
                      <span className="hidden sm:inline">{t`Chép`}</span>
                    </>
                  )}
                </Button>
              </div>

              {hasNativeShare && (
                <Button type="button" className="w-full" onClick={nativeShare}>
                  <IconShare2 className="h-4 w-4 mr-1.5" />
                  {t`Chia sẻ qua ứng dụng…`}
                </Button>
              )}

              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  {t`Hoặc gửi trực tiếp tới:`}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <ShareTargetButton
                    label="Zalo"
                    onClick={() =>
                      openShareTarget(
                        `https://zalo.me/share/link?url=${encoded}`,
                      )
                    }
                  />
                  <ShareTargetButton
                    label="Facebook"
                    onClick={() =>
                      openShareTarget(
                        `https://www.facebook.com/sharer/sharer.php?u=${encoded}`,
                      )
                    }
                  />
                  <ShareTargetButton
                    label="Messenger"
                    onClick={() =>
                      openShareTarget(
                        `https://www.facebook.com/dialog/send?app_id=140586622674265&link=${encoded}&redirect_uri=${encoded}`,
                      )
                    }
                  />
                  <ShareTargetButton
                    label="Email"
                    onClick={() => {
                      window.location.href = `mailto:?subject=${encodeURIComponent(
                        shareTitle,
                      )}&body=${encodedText}%0A%0A${encoded}`;
                    }}
                  />
                </div>
              </div>

              {expiresAt && (
                <p className="text-xs text-muted-foreground">
                  Link hết hạn ngày {expiresAt.toLocaleDateString("vi-VN")}.
                  {t`Quản lý / thu hồi sớm trong`}{" "}
                  <a href={`/clans/${clanId}/settings`} className="underline">
                    {t`Cài đặt`}
                  </a>
                  .
                </p>
              )}
            </>
          )}

          {linkM.error && (
            <p className="text-sm text-destructive">
              {(linkM.error as Error).message}
            </p>
          )}
        </div>
      </SidePanel>
    );
  }
}

function ShareTargetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-10 rounded-md border border-input bg-background hover:bg-muted text-sm font-medium"
    >
      {label}
    </button>
  );
}
