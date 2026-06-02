import { useEffect, useState } from "react";

import { useConfirm } from "@/components/ConfirmDialog";
import { IconPhoneDownload } from "@/components/icons";

/**
 * BeforeInstallPromptEvent isn't in lib.dom.d.ts yet — it's a
 * Chrome-only extension. Type just what we use.
 */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  // iOS Safari uses navigator.standalone instead of the modern media query.
  const navAny = navigator as Navigator & { standalone?: boolean };
  return !!navAny.standalone;
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

/**
 * "Add to Home Screen" button.
 *
 * Browsers split into two camps:
 *   - Chrome / Edge / Android: fire `beforeinstallprompt`. We capture
 *     it, surface the button, and call event.prompt() when clicked.
 *     `appinstalled` fires after success — we hide the button.
 *   - iOS Safari: no event. Apple requires the user to use Share →
 *     Thêm vào Màn hình Chính. We detect iOS and pop a static
 *     instruction sheet on click.
 *
 * Hidden when the app is already running in standalone mode (the
 * user already installed it) or when the browser supports neither
 * path (e.g. desktop Safari).
 */
export function InstallAppButton() {
  const [event, setEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const confirm = useConfirm();

  useEffect(() => {
    const onPrompt = (e: Event) => {
      // Prevent Chrome from showing its own mini-bar so we can
      // surface the action where the user expects it.
      e.preventDefault();
      setEvent(e as InstallPromptEvent);
    };
    const onInstalled = () => {
      setEvent(null);
      setInstalled(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  // Hide once installed.
  if (installed) return null;

  // iOS path: no event will ever fire, but if the user IS on iOS
  // Safari we still want to show the affordance with instructions.
  const ios = isIOS();
  if (!event && !ios) return null;

  const click = async () => {
    if (event) {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice.outcome === "accepted") {
        setEvent(null);
        setInstalled(true);
      }
      return;
    }
    // iOS Safari — show the manual recipe.
    await confirm({
      title: "Thêm Gia phả vào màn hình chính",
      description:
        'Bấm nút Chia sẻ ở thanh dưới Safari (biểu tượng ☐ có mũi tên lên), kéo xuống chọn "Thêm vào Màn hình Chính". App sẽ mở như ứng dụng riêng, không có thanh URL.',
      confirmLabel: "Đã hiểu",
    });
  };

  return (
    <button
      type="button"
      onClick={click}
      title="Cài app lên màn hình chính"
      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md border border-input bg-background hover:bg-muted px-2 h-10 text-sm"
    >
      <IconPhoneDownload className="h-4 w-4 shrink-0" />
      Cài app
    </button>
  );
}
