import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

/**
 * Tiểu sử có cấu trúc: dòng "## Tiêu đề" là một mục, dòng "- …" là một ý trong
 * danh sách, còn lại là đoạn văn. Tiểu sử thường (không có "##") hiện như văn
 * bản cũ, nên người dùng nhập tay không bị đổi cách hiển thị.
 */
type Block =
  | { kind: "h"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "p"; text: string };

export function parseBio(src: string): Block[] {
  const out: Block[] = [];
  for (const line of src.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    const h = /^##\s+(.+)$/.exec(t);
    const li = /^[-•]\s+(.+)$/.exec(t);
    const last = out[out.length - 1];
    if (h) out.push({ kind: "h", text: h[1] });
    else if (li) {
      if (last?.kind === "ul") last.items.push(li[1]);
      else out.push({ kind: "ul", items: [li[1]] });
    } else if (last?.kind === "p") last.text += "\n" + t;
    else out.push({ kind: "p", text: t });
  }
  // Mục không có nội dung (tiêu đề đứng liền tiêu đề khác hoặc cuối bài) thì ẩn.
  return out.filter((b, i) => b.kind !== "h" || (out[i + 1] && out[i + 1].kind !== "h"));
}

export function BioText({ text, className }: { text: string; className?: string }) {
  if (!/^##\s/m.test(text)) {
    return <p className={`whitespace-pre-wrap ${className ?? ""}`}>{text}</p>;
  }
  const blocks = parseBio(text);
  const nodes: ReactNode[] = blocks.map((b, i) => {
    if (b.kind === "h")
      return (
        <h4 key={i} className="mt-4 first:mt-0 text-sm font-semibold text-foreground">
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
    const limit = BIO_COLLAPSED_REM * parseFloat(getComputedStyle(document.documentElement).fontSize);
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
          {open ? "Thu gọn" : "Xem thêm"}
        </button>
      )}
    </div>
  );
}
