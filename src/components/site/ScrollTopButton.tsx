import { t } from "@lingui/core/macro";
import { useEffect, useState } from "react";

import { IconChevronUp } from "@/components/icons";

/** Nút tròn "lên đầu trang": hiện sau khi cuộn xuống một đoạn. */
export function ScrollTopButton() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label={t`Lên đầu trang`}
      title={t`Lên đầu trang`}
      className="fixed bottom-4 right-4 z-40 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg hover:opacity-90 print-hide"
    >
      <IconChevronUp className="h-5 w-5" />
    </button>
  );
}
