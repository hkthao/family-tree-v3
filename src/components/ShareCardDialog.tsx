import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconDownload, IconSend, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/Toast";
import {
  imageUrlToDataUrl,
  makeQrDataUrl,
  nodeToPngBlob,
  sharePngBlob,
} from "@/lib/cards/exportCard";
import {
  CARD_TEMPLATES,
  templatesByGenre,
} from "@/lib/cards/registry";
import {
  CARD_DIMENSIONS,
  CARD_GENRE_LABEL,
  type CardData,
  type CardFormat,
  type CardGenre,
} from "@/lib/cards/types";

export interface ShareCardDialogProps {
  open: boolean;
  onClose: () => void;
  clanName: string;
  /** URL công khai để nhúng QR (quét về xem di sản / gia phả). */
  shareUrl: string;
  initialTitle: string;
  initialExcerpt: string;
  /** Các ảnh (signed URL) để chọn làm ảnh thiệp. */
  photoUrls?: string[];
  dateText?: string | null;
  /** "12 đời · 348 người" cho thể loại mời tham gia. */
  statText?: string | null;
  defaultGenre?: CardGenre;
}

const GENRES = Object.keys(CARD_GENRE_LABEL) as CardGenre[];
const PREVIEW_W = 300;

export function ShareCardDialog(props: ShareCardDialogProps) {
  const { open } = props;
  const toast = useToast();

  const [genre, setGenre] = useState<CardGenre>(props.defaultGenre ?? "story");
  const [templateId, setTemplateId] = useState<string>("");
  const [format, setFormat] = useState<CardFormat>("square");
  const [title, setTitle] = useState(props.initialTitle);
  const [excerpt, setExcerpt] = useState(props.initialExcerpt);
  const [photoIdx, setPhotoIdx] = useState<number>(props.photoUrls?.length ? 0 : -1);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const exportRef = useRef<HTMLDivElement>(null);

  // Reset nội dung khi mở dialog mới.
  useEffect(() => {
    if (!open) return;
    setGenre(props.defaultGenre ?? "story");
    setTitle(props.initialTitle);
    setExcerpt(props.initialExcerpt);
    setPhotoIdx(props.photoUrls?.length ? 0 : -1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Chọn mẫu đầu tiên của thể loại khi đổi thể loại.
  useEffect(() => {
    const list = templatesByGenre(genre);
    setTemplateId((cur) => (list.some((t) => t.id === cur) ? cur : list[0]?.id ?? ""));
  }, [genre]);

  // QR theo shareUrl.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    makeQrDataUrl(props.shareUrl).then((d) => alive && setQrDataUrl(d));
    return () => { alive = false; };
  }, [open, props.shareUrl]);

  // Ảnh đã chọn → data URL (tránh taint khi xuất).
  const photoUrl = photoIdx >= 0 ? props.photoUrls?.[photoIdx] ?? null : null;
  useEffect(() => {
    if (!open) return;
    let alive = true;
    if (!photoUrl) { setPhotoDataUrl(null); return; }
    imageUrlToDataUrl(photoUrl).then((d) => alive && setPhotoDataUrl(d));
    return () => { alive = false; };
  }, [open, photoUrl]);

  // ESC + khoá cuộn nền.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && props.onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, props]);

  const data: CardData = useMemo(
    () => ({
      clanName: props.clanName,
      title: title.trim() || props.initialTitle,
      excerpt: excerpt.trim(),
      photoDataUrl,
      qrDataUrl,
      dateText: props.dateText ?? null,
      statText: props.statText ?? null,
    }),
    [props.clanName, props.initialTitle, props.dateText, props.statText, title, excerpt, photoDataUrl, qrDataUrl],
  );

  const tpl = CARD_TEMPLATES.find((t) => t.id === templateId) ?? CARD_TEMPLATES[0];
  const dim = CARD_DIMENSIONS[format];
  const previewScale = PREVIEW_W / dim.w;

  if (!open) return null;

  async function exportPng(): Promise<Blob | null> {
    const node = exportRef.current;
    if (!node) return null;
    // chờ 1 nhịp để ảnh/QR vẽ xong
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return nodeToPngBlob(node, dim.w, dim.h);
  }

  async function onShare() {
    setBusy(true);
    try {
      const blob = await exportPng();
      if (!blob) throw new Error("Chưa tạo được ảnh.");
      const res = await sharePngBlob(blob, `thiep-${tpl.id}.png`, `${data.title} — ${data.clanName}`);
      if (res === "downloaded") toast.success("Đã tải ảnh — mở Zalo/Facebook để đăng.");
      else if (res === "shared") toast.success("Đã mở chia sẻ");
    } catch (e) {
      toast.error("Không tạo được thiệp", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-3 bg-black/50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl my-4 rounded-lg border bg-card shadow-lg"
      >
        <header className="border-b px-5 py-3 flex items-center justify-between">
          <h2 className="font-semibold">Tạo thiệp chia sẻ</h2>
          <button type="button" onClick={props.onClose} aria-label="Đóng"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
            <IconX className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 grid gap-5 md:grid-cols-[300px_1fr]">
          {/* Preview */}
          <div className="space-y-3">
            <div className="mx-auto rounded-md overflow-hidden border shadow-sm"
              style={{ width: PREVIEW_W, height: dim.h * previewScale }}>
              <div style={{ width: dim.w, height: dim.h, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                {tpl.render({ data, format })}
              </div>
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={onShare} disabled={busy}>
                <IconSend className="h-4 w-4 mr-1.5" />
                {busy ? "Đang tạo…" : "Chia sẻ"}
              </Button>
              <Button variant="outline" disabled={busy} aria-label="Tải ảnh"
                onClick={async () => {
                  setBusy(true);
                  try {
                    const blob = await exportPng();
                    if (blob) {
                      const { downloadBlob } = await import("@/lib/cards/exportCard");
                      downloadBlob(blob, `thiep-${tpl.id}.png`);
                      toast.success("Đã tải ảnh thiệp");
                    }
                  } catch (e) {
                    toast.error("Không tải được", { description: (e as Error).message });
                  } finally { setBusy(false); }
                }}>
                <IconDownload className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground text-center">
              Trên điện thoại bấm "Chia sẻ" để đăng thẳng lên Zalo / Facebook.
            </p>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Định dạng */}
            <div className="flex gap-2">
              {(["square", "vertical"] as CardFormat[]).map((f) => (
                <button key={f} type="button" onClick={() => setFormat(f)}
                  className={`rounded-full border px-4 py-1.5 text-sm ${format === f ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"}`}>
                  {f === "square" ? "Vuông (đăng tường)" : "Dọc (story)"}
                </button>
              ))}
            </div>

            {/* Thể loại */}
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button key={g} type="button" onClick={() => setGenre(g)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${genre === g ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"}`}>
                  {CARD_GENRE_LABEL[g]}
                </button>
              ))}
            </div>

            {/* Mẫu trong thể loại */}
            <div className="grid grid-cols-3 gap-2">
              {templatesByGenre(genre).map((t) => {
                const s = 88 / dim.w;
                const active = t.id === templateId;
                return (
                  <button key={t.id} type="button" onClick={() => setTemplateId(t.id)}
                    className={`rounded-md border p-1 text-left ${active ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}>
                    <div className="mx-auto overflow-hidden rounded bg-muted" style={{ width: 88, height: dim.h * s }}>
                      <div style={{ width: dim.w, height: dim.h, transform: `scale(${s})`, transformOrigin: "top left", pointerEvents: "none" }}>
                        {t.render({ data, format })}
                      </div>
                    </div>
                    <span className="block mt-1 text-[11px] leading-tight text-muted-foreground">{t.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Sửa chữ */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tiêu đề</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" maxLength={120} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Lời trích / mô tả</label>
              <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" maxLength={400} />
            </div>

            {/* Chọn ảnh */}
            {props.photoUrls && props.photoUrls.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Ảnh trên thiệp</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => setPhotoIdx(-1)}
                    className={`h-14 w-14 rounded-md border grid place-items-center text-xs ${photoIdx === -1 ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}>
                    Không
                  </button>
                  {props.photoUrls.map((u, i) => (
                    <button key={u} type="button" onClick={() => setPhotoIdx(i)}
                      className={`h-14 w-14 overflow-hidden rounded-md border ${photoIdx === i ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}>
                      <img src={u} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Node ẩn full-size để xuất PNG đúng cỡ */}
      <div style={{ position: "fixed", left: -100000, top: 0, pointerEvents: "none" }} aria-hidden="true">
        <div ref={exportRef}>{tpl.render({ data, format })}</div>
      </div>
    </div>,
    document.body,
  );
}
