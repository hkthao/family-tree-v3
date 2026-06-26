import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { IconDownload, IconLink, IconShare2, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/Toast";
import {
  imageUrlToDataUrl,
  makeQrDataUrl,
  nodeToPngBlob,
  sharePngBlob,
} from "@/lib/cards/exportCard";
import { makeShareToken, publishKhoeCard } from "@/lib/cards/publishCard";
import {
  CARD_TEMPLATES,
  templatesByGenre,
} from "@/lib/cards/registry";
import { CARD_FONTS, DEFAULT_CARD_FONT, ensureCardFontsLoaded } from "@/lib/cards/fonts";
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
  /**
   * Bật chế độ "khoe": khi chia sẻ/tải/chép link sẽ LƯU ảnh thiệp vào
   * storage + tạo link công khai /khoe/:token (hạn ≤ 3 tháng). QR trên
   * thiệp trỏ về trang đó (đúng tấm thiệp, không phải danh thiếp).
   */
  publish?: {
    clanId: string;
    personId?: string | null;
    /** Dòng phụ hiển thị trên trang khoe, vd "Đời thứ 4 · Họ Bùi". */
    subtitle?: string | null;
  };
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
  const [titleFont, setTitleFont] = useState<string>(DEFAULT_CARD_FONT);
  const [busy, setBusy] = useState(false);
  // Chế độ khoe: token cố định 1 lần/mở dialog (để QR khớp ảnh lưu) +
  // hạn link do user chọn (≤ 90 ngày = 3 tháng).
  const publish = props.publish;
  const [token] = useState(() => makeShareToken());
  const [ttlDays, setTtlDays] = useState(90);
  const khoeUrl = publish ? `${window.location.origin}/khoe/${token}` : "";
  const effectiveShareUrl = publish ? khoeUrl : props.shareUrl;

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

  // QR theo URL hiệu lực (khoe → /khoe/:token; còn lại → shareUrl).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    makeQrDataUrl(effectiveShareUrl).then((d) => alive && setQrDataUrl(d));
    return () => { alive = false; };
  }, [open, effectiveShareUrl]);

  // Nạp font web (Google) khi mở dialog để xem trước + xuất ảnh đúng.
  useEffect(() => {
    if (open) ensureCardFontsLoaded();
  }, [open]);

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
      titleFont,
    }),
    [props.clanName, props.initialTitle, props.dateText, props.statText, title, excerpt, photoDataUrl, qrDataUrl, titleFont],
  );

  const tpl = CARD_TEMPLATES.find((t) => t.id === templateId) ?? CARD_TEMPLATES[0];
  const dim = CARD_DIMENSIONS[format];
  const previewScale = PREVIEW_W / dim.w;

  if (!open) return null;

  async function exportPng(): Promise<Blob | null> {
    const node = exportRef.current;
    if (!node) return null;
    await ensureCardFontsLoaded(); // font sẵn sàng → ảnh đúng kiểu chữ
    // chờ 1 nhịp để ảnh/QR/chữ vẽ xong
    await new Promise((r) => requestAnimationFrame(() => r(null)));
    return nodeToPngBlob(node, dim.w, dim.h);
  }

  // Khoe: lưu ảnh thiệp + tạo/cập nhật link công khai trước khi chia sẻ
  // (để QR trên ảnh — trỏ /khoe/:token — quét được ngay). No-op nếu
  // không ở chế độ publish.
  async function ensurePublished(blob: Blob) {
    if (!publish) return;
    await publishKhoeCard({
      token,
      clanId: publish.clanId,
      personId: publish.personId ?? null,
      blob,
      title: data.title,
      subtitle: publish.subtitle ?? props.dateText ?? null,
      ttlDays,
    });
  }

  async function onShare() {
    setBusy(true);
    try {
      const blob = await exportPng();
      if (!blob) throw new Error("Chưa tạo được ảnh.");
      await ensurePublished(blob);
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
      className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/50"
      role="dialog"
      aria-modal="true"
      onClick={props.onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl rounded-lg border bg-card shadow-lg flex flex-col max-h-[92vh]"
      >
        <header className="border-b px-5 py-3 flex items-center justify-between shrink-0">
          <h2 className="font-semibold">Tạo thiệp chia sẻ</h2>
          <button type="button" onClick={props.onClose} aria-label="Đóng"
            className="h-8 w-8 inline-flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground">
            <IconX className="h-4 w-4" />
          </button>
        </header>

        <div className="p-5 grid gap-5 lg:grid-cols-[280px_1fr] overflow-y-auto">
          {/* Preview */}
          <div className="space-y-3 self-start lg:sticky lg:top-0">
            <div className="mx-auto rounded-md overflow-hidden border shadow-sm"
              style={{ width: PREVIEW_W, height: dim.h * previewScale }}>
              <div style={{ width: dim.w, height: dim.h, transform: `scale(${previewScale})`, transformOrigin: "top left" }}>
                {tpl.render({ data, format })}
              </div>
            </div>
            {/* Khoe: chọn hạn link công khai (tối đa 3 tháng). */}
            {publish && (
              <div className="space-y-1.5">
                <span className="text-sm font-medium">Link khoe có hạn</span>
                <div className="flex gap-2">
                  {[
                    { d: 7, label: "1 tuần" },
                    { d: 30, label: "1 tháng" },
                    { d: 90, label: "3 tháng" },
                  ].map((o) => (
                    <button
                      key={o.d}
                      type="button"
                      onClick={() => setTtlDays(o.d)}
                      className={`flex-1 rounded-full border px-2 py-1.5 text-sm ${
                        ttlDays === o.d
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card hover:border-primary"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  Quét mã QR trên thiệp sẽ mở trang khoe này. Hết hạn link tự xoá.
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="w-full" onClick={onShare} disabled={busy}>
                <IconShare2 className="h-4 w-4 mr-1.5 shrink-0" />
                {busy ? "Đang tạo…" : "Chia sẻ"}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const blob = await exportPng();
                    if (blob) {
                      await ensurePublished(blob);
                      const { downloadBlob } = await import("@/lib/cards/exportCard");
                      downloadBlob(blob, `thiep-${tpl.id}.png`);
                      toast.success("Đã tải ảnh thiệp");
                    }
                  } catch (e) {
                    toast.error("Không tải được", { description: (e as Error).message });
                  } finally { setBusy(false); }
                }}
              >
                <IconDownload className="h-4 w-4 mr-1.5" />
                Tải ảnh
              </Button>
            </div>

            {/* Hướng dẫn đăng ẢNH thiệp. Facebook web không cho gắn ảnh
                qua nút chia sẻ link → trên máy tính phải tải ảnh rồi đăng
                như ảnh thường. */}
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">Điện thoại:</span>{" "}
                bấm <span className="font-medium">Chia sẻ</span> để gửi thẳng
                tấm thiệp (ảnh) sang Zalo/Facebook.
              </p>
              <p>
                <span className="font-medium text-foreground">Máy tính:</span>{" "}
                bấm <span className="font-medium">Tải ảnh</span> rồi đăng lên
                Facebook như đăng ảnh thường (Facebook không cho gắn ảnh qua
                nút chia sẻ nhanh).
              </p>
            </div>

            {/* Chép link công khai để dán vào Zalo/Facebook. Ở chế độ
                khoe phải lưu ảnh trước (publish) để link /khoe mở được. */}
            {effectiveShareUrl && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {publish ? "Chép link khoe:" : "Gửi đường dẫn trang:"}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-9 p-0"
                  disabled={busy}
                  aria-label="Chép link"
                  title="Chép link để dán vào Zalo/Facebook"
                  onClick={async () => {
                    setBusy(true);
                    try {
                      if (publish) {
                        const blob = await exportPng();
                        if (blob) await ensurePublished(blob);
                      }
                      await navigator.clipboard.writeText(effectiveShareUrl);
                      toast.success("Đã chép link — dán vào Zalo/Facebook để chia sẻ.");
                    } catch (e) {
                      toast.error("Không chép được link", { description: (e as Error).message });
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  <IconLink className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="space-y-4 lg:pl-5 lg:border-l lg:border-divider">
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

            {/* Font chữ (đặc biệt: thư pháp) */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Kiểu chữ tiêu đề</label>
              <div className="flex flex-wrap gap-2">
                {CARD_FONTS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTitleFont(f.family)}
                    style={{ fontFamily: f.family }}
                    className={`rounded-md border px-3 py-1.5 text-base ${titleFont === f.family ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"}`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
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
