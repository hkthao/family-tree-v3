import { IconMicrophone, IconX } from "@/components/icons";
import type { VoiceInput } from "@/hooks/useVoiceInput";
import { formatListenTime } from "@/lib/speech";

/**
 * Nút mic + dải trạng thái lúc đang nghe.
 *
 * Nút to và tròn vì đây là **hành động chính** của khung chat trên điện
 * thoại, không phải một icon nhỏ nép bên ô nhập: rào cản thật của người
 * lớn tuổi là gõ tiếng Việt có dấu, nói thì ai cũng nói được.
 *
 * `touch-action: none` là bắt buộc — thiếu nó thì giữ nút rồi nhích tay
 * một chút là trình duyệt hiểu thành cuộn trang, ngón tay rời nút và câu
 * đang nói bị cắt ngang.
 *
 * Cử chỉ (giữ / bấm-một-lần / vuốt lên huỷ) nằm ở useVoiceInput.
 */

export function MicButton({
  voice,
  size = "lg",
  disabled,
}: {
  voice: VoiceInput;
  /** `lg` — khung toàn màn hình. `sm` — khung nổi trên máy tính. */
  size?: "lg" | "sm";
  disabled?: boolean;
}) {
  const big = size === "lg";
  const listening = voice.mode !== "idle";
  const label = listening ? "Dừng nói" : "Bấm giữ để nói";

  return (
    <button
      type="button"
      onPointerDown={voice.onPointerDown}
      onPointerMove={voice.onPointerMove}
      onPointerUp={voice.onPointerUp}
      onPointerCancel={voice.onPointerCancel}
      // Chặn menu giữ-lâu của Android, nó cướp mất thao tác bấm-giữ.
      onContextMenu={(e) => e.preventDefault()}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={listening}
      style={{ touchAction: "none" }}
      className={`flex shrink-0 select-none items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
        big ? "h-16 w-16" : "h-12 w-12"
      } ${
        voice.nearCancel
          ? "bg-destructive text-destructive-foreground"
          : listening
            ? "animate-pulse bg-primary text-primary-foreground"
            : "border bg-card text-foreground hover:bg-secondary"
      }`}
    >
      {voice.nearCancel ? (
        <IconX className={big ? "h-7 w-7" : "h-5 w-5"} />
      ) : (
        <IconMicrophone className={big ? "h-7 w-7" : "h-5 w-5"} />
      )}
    </button>
  );
}

/**
 * Dải thay chỗ ô nhập trong lúc đang nghe: đồng hồ, chữ chạy ra dần và
 * câu nhắc cách huỷ.
 *
 * Hiện chữ ngay khi máy nghe được là phần quan trọng nhất — im lặng vài
 * giây thì người dùng tưởng máy hỏng và bấm loạn lên.
 */
export function ListeningBar({ voice }: { voice: VoiceInput }) {
  const hint =
    voice.mode === "locked"
      ? "Bấm mic lần nữa để dừng"
      : voice.nearCancel
        ? "Thả ra để huỷ"
        : "Thả để gửi · Vuốt lên để huỷ";

  return (
    <div
      aria-live="polite"
      className="flex min-h-[48px] flex-1 flex-col justify-center rounded-2xl border border-primary/40 bg-primary/5 px-4 py-2"
    >
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-destructive" />
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {formatListenTime(voice.seconds)}
        </span>
        <span className="truncate text-base">
          {voice.transcript || "Đang nghe…"}
        </span>
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
