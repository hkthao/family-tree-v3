import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { parseBio } from "@/lib/bio";

import { t } from "@lingui/core/macro";
export { bioToPlainText, parseBio } from "@/lib/bio";

export function BioText({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  if (!/^##\s/m.test(text)) {
    return <p className={`whitespace-pre-wrap ${className ?? ""}`}>{text}</p>;
  }
  const blocks = parseBio(text);
  const nodes: ReactNode[] = blocks.map((b, i) => {
    if (b.kind === "h")
      return (
        <h4
          key={i}
          className="mt-4 first:mt-0 text-sm font-semibold text-foreground"
        >
          {b.text}
        </h4>
      );
    if (b.kind === "ul")
      return (
        <ul key={i} className="mt-1 list-disc space-y-1.5 pl-5">
          {b.items.map((x, j) => (
            <li key={j}>{x}</li>
          ))}
        </ul>
      );
    return (
      <p key={i} className="mt-1 whitespace-pre-wrap">
        {b.text}
      </p>
    );
  });
  return <div className={className}>{nodes}</div>;
}

/** Chiều cao tối đa khi thu gọn (rem); tiểu sử ngắn hơn thì không hiện nút. */
const BIO_COLLAPSED_REM = 14;

/** Tiểu sử dài: mặc định thu gọn, bấm "Xem thêm" để đọc hết thay vì cuộn dài. */
export function CollapsibleBio({ text }: { text: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [overflows, setOverflows] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const limit =
      BIO_COLLAPSED_REM *
      parseFloat(getComputedStyle(document.documentElement).fontSize);
    setOverflows(el.scrollHeight > limit + 8);
  }, [text]);
  const clamped = overflows && !open;
  return (
    <div>
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={clamped ? { maxHeight: `${BIO_COLLAPSED_REM}rem` } : undefined}
      >
        <BioText text={text} />
        {clamped && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-card to-transparent"
          />
        )}
      </div>
      {overflows && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="mt-2 text-sm font-medium text-primary hover:underline"
        >
          {open ? t`Thu gọn` : t`Xem thêm`}
        </button>
      )}
    </div>
  );
}
