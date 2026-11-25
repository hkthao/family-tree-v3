import { useQuery } from "@tanstack/react-query";
import { InviteCardBody } from "@/components/community/InviteCardDialog";
import { getOrCreateGeneralInviteUrl } from "@/components/community/inviteLink";
import {
  CardStepFooter,
  CardStepper,
  type CardStep,
} from "@/components/cards/CardSteps";
import { KhoeOgImage } from "@/components/cards/KhoeOgImage";
import { SidePanel } from "@/components/SidePanel";
import { Callout } from "@/components/ui/callout";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  IconCamera,
  IconCopy,
  IconDownload,
  IconScroll,
  IconShare2,
  IconTag,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/Toast";
import {
  imageUrlToDataUrl,
  makeQrDataUrl,
  nodeToJpegBlob,
  nodeToPngBlob,
  sharePngBlob,
} from "@/lib/cards/exportCard";
import { makeShareToken, publishKhoeCard } from "@/lib/cards/publishCard";
import { CARD_TEMPLATES, templatesByGenre } from "@/lib/cards/registry";
import {
  CARD_FONTS,
  DEFAULT_CARD_FONT,
  ensureCardFontsLoaded,
} from "@/lib/cards/fonts";
import {
  CARD_DIMENSIONS,
  CARD_GENRE_LABEL,
  type CardData,
  type CardFormat,
  type CardGenre,
} from "@/lib/cards/types";
import { getSignedPhotoUrl } from "@/lib/photoUpload";
import { unaccent } from "@/lib/unaccent";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
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
  /**
   * Thành viên dòng họ để chọn lấy ảnh avatar làm nền thiệp. Khi có,
   * dialog hiện ô "Chọn thành viên" → tự nạp ảnh đã ký của người đó.
   */
  members?: Array<{
    id: string;
    full_name: string;
    photo_path?: string | null;
  }>;
  /** Có thì ngăn kéo thêm tab "Mời người thân góp" (thiệp mời góp dùng chung khung với thiệp khoe). */
  clanId?: string;
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
const PREVIEW_W = 340;
const THUMB_W = 84;
/** Viền + đệm nút (12) + đệm cột (16) + thanh cuộn dọc (~14). */
const COL_EXTRA = 42;

function ShareCardBody(props: ShareCardDialogProps) {
  const { open } = props;
  const toast = useToast();

  const [genre, setGenre] = useState<CardGenre>(props.defaultGenre ?? "story");
  const [templateId, setTemplateId] = useState<string>("");
  const [format, setFormat] = useState<CardFormat>("square");
  const [title, setTitle] = useState(props.initialTitle);
  // Dòng nhãn (kicker) — seed theo mẫu, user sửa được.
  const [kicker, setKicker] = useState("");
  const [excerpt, setExcerpt] = useState(props.initialExcerpt);
  const [photoIdx, setPhotoIdx] = useState<number>(
    props.photoUrls?.length ? 0 : -1,
  );
  // Thành viên đã chọn để lấy ảnh nền (ưu tiên hơn photoUrls).
  const [memberSearch, setMemberSearch] = useState("");
  const [pickedMemberId, setPickedMemberId] = useState<string | null>(null);
  const [pickedMemberUrl, setPickedMemberUrl] = useState<string | null>(null);
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [titleFont, setTitleFont] = useState<string>(DEFAULT_CARD_FONT);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<CardStep>(1);
  // Chế độ khoe: token cố định 1 lần/mở dialog (để QR khớp ảnh lưu) +
  // hạn link do user chọn (≤ 90 ngày = 3 tháng).
  const publish = props.publish;
  const [token] = useState(() => makeShareToken());
  const [ttlDays, setTtlDays] = useState(90);
  const khoeUrl = publish ? `${window.location.origin}/khoe/${token}` : "";
  const effectiveShareUrl = publish ? khoeUrl : props.shareUrl;

  const exportRef = useRef<HTMLDivElement>(null);
  const ogRef = useRef<HTMLDivElement>(null);

  // Reset nội dung khi mở dialog mới.
  useEffect(() => {
    if (!open) return;
    setGenre(props.defaultGenre ?? "story");
    setTitle(props.initialTitle);
    setExcerpt(props.initialExcerpt);
    setPhotoIdx(props.photoUrls?.length ? 0 : -1);
    setPickedMemberId(null);
    setMemberSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Chọn mẫu đầu tiên của thể loại khi đổi thể loại.
  useEffect(() => {
    const list = templatesByGenre(genre);
    setTemplateId((cur) =>
      list.some((t) => t.id === cur) ? cur : (list[0]?.id ?? ""),
    );
  }, [genre]);

  // Đổi mẫu → reset dòng nhãn về mặc định của mẫu (user sửa lại nếu muốn).
  useEffect(() => {
    const t = CARD_TEMPLATES.find((x) => x.id === templateId);
    if (t) setKicker(t.kicker);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateId]);

  // QR theo URL hiệu lực (khoe → /khoe/:token; còn lại → shareUrl).
  useEffect(() => {
    if (!open) return;
    let alive = true;
    makeQrDataUrl(effectiveShareUrl).then((d) => alive && setQrDataUrl(d));
    return () => {
      alive = false;
    };
  }, [open, effectiveShareUrl]);

  // Nạp font web (Google) khi mở dialog để xem trước + xuất ảnh đúng.
  useEffect(() => {
    if (open) ensureCardFontsLoaded();
  }, [open]);

  // Nạp ảnh đã ký của thành viên được chọn (ưu tiên làm ảnh nền thiệp).
  useEffect(() => {
    if (!pickedMemberId) {
      setPickedMemberUrl(null);
      return;
    }
    const m = props.members?.find((x) => x.id === pickedMemberId);
    if (!m?.photo_path) {
      setPickedMemberUrl(null);
      return;
    }
    let alive = true;
    getSignedPhotoUrl(m.photo_path).then((u) => alive && setPickedMemberUrl(u));
    return () => {
      alive = false;
    };
  }, [pickedMemberId, props.members]);

  // Ảnh đã chọn → data URL (tránh taint khi xuất). Ưu tiên ảnh thành viên.
  const photoUrl =
    pickedMemberUrl ??
    (photoIdx >= 0 ? (props.photoUrls?.[photoIdx] ?? null) : null);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    if (!photoUrl) {
      setPhotoDataUrl(null);
      return;
    }
    imageUrlToDataUrl(photoUrl).then((d) => alive && setPhotoDataUrl(d));
    return () => {
      alive = false;
    };
  }, [open, photoUrl]);

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
      kicker,
    }),
    [
      props.clanName,
      props.initialTitle,
      props.dateText,
      props.statText,
      title,
      excerpt,
      photoDataUrl,
      qrDataUrl,
      titleFont,
      kicker,
    ],
  );

  const tpl =
    CARD_TEMPLATES.find((t) => t.id === templateId) ?? CARD_TEMPLATES[0];
  const dim = CARD_DIMENSIONS[format];
  // Ảnh cố định ở đầu ngăn kéo: chặn theo chiều cao màn hình (khổ Story rất cao) để phần chỉnh bên dưới còn chỗ.
  const maxH =
    typeof window === "undefined"
      ? 340
      : Math.max(200, Math.min(360, window.innerHeight * 0.36));
  // Màn hẹp (điện thoại): cột mẫu nằm NGANG dưới ảnh; màn rộng: cột dọc bên phải ảnh (chừa chỗ cho cột).
  const narrow = typeof window !== "undefined" && window.innerWidth < 640;
  const widthCap =
    typeof window === "undefined"
      ? PREVIEW_W
      : narrow
        ? window.innerWidth - 56
        : Math.min(
            PREVIEW_W,
            Math.max(180, window.innerWidth * 0.4 - THUMB_W - COL_EXTRA),
          );
  const previewW = Math.min(widthCap, PREVIEW_W, (maxH * dim.w) / dim.h);
  const previewScale = previewW / dim.w;

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
    // Ảnh xem trước 1200×630 cho Zalo/Facebook: lỗi dựng thì bỏ qua, thiệp vẫn lưu (og-khoe dùng ảnh gốc).
    let ogBlob: Blob | null = null;
    try {
      if (ogRef.current)
        ogBlob = await nodeToJpegBlob(
          ogRef.current.firstElementChild as HTMLElement,
          1200,
          630,
        );
    } catch {
      ogBlob = null;
    }
    await publishKhoeCard({
      token,
      clanId: publish.clanId,
      personId: publish.personId ?? null,
      blob,
      ogBlob,
      title: data.title,
      subtitle: publish.subtitle ?? props.dateText ?? null,
      ttlDays,
    });
  }

  async function onShare() {
    setBusy(true);
    try {
      const blob = await exportPng();
      if (!blob) throw new Error(t`Chưa tạo được ảnh.`);
      await ensurePublished(blob);
      const res = await sharePngBlob(
        blob,
        `thiep-${tpl.id}.png`,
        `${data.title} — ${data.clanName}`,
      );
      if (res === "downloaded")
        toast.success(t`Đã tải ảnh — mở Zalo/Facebook để đăng.`);
      else if (res === "shared") toast.success(t`Đã mở chia sẻ`);
    } catch (e) {
      toast.error(t`Không tạo được thiệp`, {
        description: (e as Error).message,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Ảnh xem trước CỐ ĐỊNH ở trên: đổi gì cũng thấy ngay, không phải kéo lên kéo xuống. */}
        <div className="shrink-0 border-b px-4 py-3 sm:px-5">
          <div
            className={`flex gap-2 rounded-lg border bg-muted/40 p-2 sm:gap-3 sm:p-3 ${narrow ? "flex-col" : ""}`}
          >
            <div className="flex min-w-0 flex-1 justify-center">
              <div
                className="overflow-hidden rounded-md border shadow-sm"
                style={{ width: previewW, height: dim.h * previewScale }}
                data-testid="card-preview"
              >
                <div
                  style={{
                    width: dim.w,
                    height: dim.h,
                    transform: `scale(${previewScale})`,
                    transformOrigin: "top left",
                  }}
                >
                  {tpl.render({ data, format })}
                </div>
              </div>
            </div>
            <div
              role="listbox"
              aria-label={t`Chọn mẫu`}
              className={
                narrow
                  ? "flex snap-x gap-1.5 overflow-x-auto border-t pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  : "flex shrink-0 snap-y flex-col gap-1.5 overflow-y-auto overflow-x-hidden border-l pl-2 pr-1 sm:pl-3"
              }
              style={
                narrow
                  ? undefined
                  : { height: dim.h * previewScale, width: THUMB_W + COL_EXTRA }
              }
            >
              {templatesByGenre(genre).map((tp) => {
                const sc = THUMB_W / dim.w;
                const active = tp.id === tpl.id;
                return (
                  <button
                    key={tp.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => setTemplateId(tp.id)}
                    title={tp.name}
                    style={narrow ? { width: THUMB_W + 12 } : undefined}
                    className={`shrink-0 snap-start rounded-lg border-2 p-1 text-left transition-colors ${active ? "border-primary bg-background" : "border-transparent hover:border-muted-foreground/40"}`}
                  >
                    <div
                      className="overflow-hidden rounded-md"
                      style={{ width: THUMB_W, height: dim.h * sc }}
                    >
                      <div
                        style={{
                          transform: `scale(${sc})`,
                          transformOrigin: "top left",
                          width: dim.w,
                          height: dim.h,
                          pointerEvents: "none",
                        }}
                      >
                        {tp.render({ data, format })}
                      </div>
                    </div>
                    <div className="mt-1 truncate text-[11px] font-medium leading-tight">
                      {tp.name}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 [scrollbar-gutter:stable]">
          {/* Các bước: ① Chọn kiểu → ② Tuỳ chỉnh → ③ Chia sẻ */}
          <div className="space-y-4">
            <CardStepper step={step} onStep={setStep} />

            {step === 1 && (
              <div className="space-y-4">
                {/* Mẫu chọn ở cột ảnh thu nhỏ bên cạnh ảnh xem trước (luôn thấy, đổi là ảnh đổi ngay). */}
                <div className="grid grid-cols-1 gap-x-3 gap-y-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="card-genre">{t`Bạn muốn khoe điều gì?`}</Label>
                    <Select
                      id="card-genre"
                      icon={<IconTag />}
                      value={genre}
                      onChange={(e) => setGenre(e.target.value as CardGenre)}
                    >
                      {GENRES.map((g) => (
                        <option key={g} value={g}>
                          {CARD_GENRE_LABEL[g]}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="card-format">{t`Khổ thiệp`}</Label>
                    <Select
                      id="card-format"
                      icon={<IconCamera />}
                      value={format}
                      onChange={(e) => setFormat(e.target.value as CardFormat)}
                    >
                      <option value="square">{t`Vuông (đăng tường)`}</option>
                      <option value="vertical">{t`Dọc (story)`}</option>
                    </Select>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t`Chọn mẫu ở cột ảnh thu nhỏ bên cạnh ảnh xem trước.`}
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                {/* Chọn thành viên → lấy ảnh làm nền thiệp */}
                {props.members && props.members.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      {t`Thành viên (lấy ảnh làm nền)`}
                    </label>
                    {pickedMemberId ? (
                      <div className="flex items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <span className="truncate">
                          {props.members.find((m) => m.id === pickedMemberId)
                            ?.full_name ?? "—"}
                          {!props.members.find((m) => m.id === pickedMemberId)
                            ?.photo_path && (
                            <span className="text-muted-foreground">
                              <Trans> (chưa có ảnh)</Trans>
                            </span>
                          )}
                        </span>
                        <button
                          type="button"
                          onClick={() => setPickedMemberId(null)}
                          className="text-primary hover:underline shrink-0"
                        >
                          {t`Bỏ chọn`}
                        </button>
                      </div>
                    ) : (
                      <>
                        <input
                          value={memberSearch}
                          onChange={(e) => setMemberSearch(e.target.value)}
                          placeholder={t`Gõ tên để tìm thành viên…`}
                          className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                        />
                        {memberSearch.trim() && (
                          <ul className="max-h-40 overflow-y-auto rounded-md border divide-y">
                            {props.members
                              .filter((m) =>
                                unaccent(m.full_name).includes(
                                  unaccent(memberSearch),
                                ),
                              )
                              .slice(0, 30)
                              .map((m) => (
                                <li key={m.id}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPickedMemberId(m.id);
                                      setMemberSearch("");
                                    }}
                                    className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50"
                                  >
                                    {m.full_name}
                                    {!m.photo_path && (
                                      <span className="text-muted-foreground">
                                        <Trans> · chưa có ảnh</Trans>
                                      </span>
                                    )}
                                  </button>
                                </li>
                              ))}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                )}
                {/* Sửa chữ */}
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {t`Dòng nhãn (vd "Tin vui dòng họ")`}
                  </label>
                  <Input
                    icon={<IconTag />}
                    value={kicker}
                    onChange={(e) => setKicker(e.target.value)}
                    className="h-10 text-sm"
                    maxLength={60}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t`Tiêu đề`}</label>
                  <Input
                    icon={<IconScroll />}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="h-10 text-sm"
                    maxLength={120}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t`Lời trích / mô tả`}</label>
                  <Textarea
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                    rows={3}
                    className="text-sm"
                    maxLength={400}
                  />
                </div>
                {/* Chọn ảnh */}
                {props.photoUrls && props.photoUrls.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t`Ảnh trên thiệp`}</label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setPhotoIdx(-1)}
                        className={`h-14 w-14 rounded-md border grid place-items-center text-xs ${photoIdx === -1 ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}
                      >
                        {t`Không`}
                      </button>
                      {props.photoUrls.map((u, i) => (
                        <button
                          key={u}
                          type="button"
                          onClick={() => setPhotoIdx(i)}
                          className={`h-14 w-14 overflow-hidden rounded-md border ${photoIdx === i ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}
                        >
                          <img
                            src={u}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Font chữ (đặc biệt: thư pháp) */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">{t`Kiểu chữ tiêu đề`}</label>
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
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                {/* Khoe: chọn hạn link công khai (tối đa 3 tháng). */}
                {publish && (
                  <div className="space-y-1.5">
                    <span className="text-sm font-medium">{t`Link khoe có hạn`}</span>
                    <div className="flex gap-2">
                      {[
                        { d: 7, label: t`1 tuần` },
                        { d: 30, label: t`1 tháng` },
                        { d: 90, label: t`3 tháng` },
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
                      <Trans>
                        <Trans>
                          Quét mã QR trên thiệp sẽ mở trang khoe này. Hết hạn
                          link tự xoá.
                        </Trans>
                      </Trans>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t`Ảnh và tên trên thiệp sẽ công khai tới khi hết hạn; bạn có thể gỡ sớm.`}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full px-3 text-sm"
                    onClick={onShare}
                    disabled={busy}
                  >
                    <IconShare2 className="h-4 w-4 mr-1.5 shrink-0" />
                    {busy ? t`Đang tạo…` : t`Chia sẻ`}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full px-3 text-sm"
                    disabled={busy}
                    onClick={async () => {
                      setBusy(true);
                      try {
                        const blob = await exportPng();
                        if (blob) {
                          await ensurePublished(blob);
                          const { downloadBlob } =
                            await import("@/lib/cards/exportCard");
                          downloadBlob(blob, `thiep-${tpl.id}.png`);
                          toast.success(t`Đã tải ảnh thiệp`);
                        }
                      } catch (e) {
                        toast.error(t`Không tải được`, {
                          description: (e as Error).message,
                        });
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <IconDownload className="h-4 w-4 mr-1.5" />
                    {t`Tải ảnh`}
                  </Button>
                </div>

                {/* Hướng dẫn đăng ẢNH thiệp. Facebook web không cho gắn ảnh
                qua nút chia sẻ link → trên máy tính phải tải ảnh rồi đăng
                như ảnh thường. */}
                <Callout className="[&_p]:leading-relaxed">
                  <p>
                    <span className="font-medium text-foreground">{t`Điện thoại:`}</span>{" "}
                    bấm <span className="font-medium">{t`Chia sẻ`}</span> để gửi
                    thẳng tấm thiệp (ảnh) sang Zalo/Facebook.
                  </p>
                  <p>
                    <span className="font-medium text-foreground">{t`Máy tính:`}</span>{" "}
                    bấm <span className="font-medium">{t`Tải ảnh`}</span> rồi
                    đăng lên Facebook như đăng ảnh thường (Facebook không cho
                    gắn ảnh qua nút chia sẻ nhanh).
                  </p>
                </Callout>

                {/* Chép link công khai để dán vào Zalo/Facebook. Ở chế độ
                khoe phải lưu ảnh trước (publish) để link /khoe mở được. */}
                {effectiveShareUrl && (
                  <div className="space-y-1.5">
                    <span className="text-sm text-muted-foreground">
                      {publish
                        ? t`Link khoe để dán vào Zalo/Facebook:`
                        : t`Đường dẫn trang để gửi người thân:`}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full px-3 text-sm"
                      disabled={busy}
                      title={t`Chép link để dán vào Zalo/Facebook`}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          if (publish) {
                            const blob = await exportPng();
                            if (blob) await ensurePublished(blob);
                          }
                          await navigator.clipboard.writeText(
                            effectiveShareUrl,
                          );
                          toast.success(
                            t`Đã chép link — dán vào Zalo/Facebook để chia sẻ.`,
                          );
                        } catch (e) {
                          toast.error(t`Không chép được link`, {
                            description: (e as Error).message,
                          });
                        } finally {
                          setBusy(false);
                        }
                      }}
                    >
                      <IconCopy className="mr-1.5 h-4 w-4 shrink-0" />
                      {t`Sao chép link`}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <CardStepFooter step={step} onStep={setStep} />
      </div>

      {/* Node ẩn full-size để xuất PNG đúng cỡ */}
      <div
        style={{
          position: "fixed",
          left: -100000,
          top: 0,
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <div ref={exportRef}>{tpl.render({ data, format })}</div>
      </div>
      {publish && (
        <div
          style={{
            position: "fixed",
            left: -100000,
            top: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        >
          <div ref={ogRef}>
            <KhoeOgImage
              card={tpl.render({ data, format })}
              cardW={dim.w}
              cardH={dim.h}
              clanName={data.clanName}
              title={data.title}
              subtitle={publish.subtitle ?? props.dateText ?? null}
            />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * MỘT ngăn kéo cho mọi thiệp: tab "Thiệp khoe / giới thiệu" (nhiều thể loại, khổ, có link khoe) và — khi biết dòng họ —
 * tab "Mời người thân góp" (infographic + tin nhắn soạn sẵn, tự lấy / tạo link mời góp chung). Ảnh xem trước luôn cố định ở đầu
 * ngăn kéo; phần chỉnh bên dưới cuộn riêng.
 */
export function ShareCardDialog(props: ShareCardDialogProps) {
  const clanId = props.clanId ?? props.publish?.clanId;
  const [kind, setKind] = useState<"share" | "invite">("share");
  const inviteUrl = useQuery({
    queryKey: ["invite-general-url", clanId],
    queryFn: () => getOrCreateGeneralInviteUrl(clanId!),
    enabled: props.open && !!clanId && kind === "invite",
    staleTime: Infinity,
    retry: false,
  });
  return (
    <SidePanel
      open={props.open}
      onClose={props.onClose}
      size="lg"
      title={t`Tạo thiệp chia sẻ`}
      // Không đặt phụ đề theo tab: tiêu đề đổi chiều cao khi chuyển tab làm cả bố cục nhảy.
      guard={false}
      bare
    >
      {clanId && (
        <div
          role="tablist"
          aria-label={t`Loại thiệp`}
          className="flex shrink-0 gap-5 overflow-x-auto border-b px-4 sm:px-5"
        >
          {(
            [
              ["share", t`Thiệp khoe / giới thiệu`],
              ["invite", t`Mời người thân góp`],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-11 whitespace-nowrap border-b-2 px-1 text-sm ${kind === k ? "border-primary font-semibold" : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      {kind === "share" && <ShareCardBody {...props} />}
      {kind === "invite" &&
        clanId &&
        (inviteUrl.data ? (
          <InviteCardBody
            open
            clanId={clanId}
            clanName={props.clanName}
            url={inviteUrl.data}
            variants={["chung", "camon"]}
          />
        ) : (
          <p className="p-6 text-center text-muted-foreground">
            {inviteUrl.isError
              ? t`Không tạo được link mời góp. Hãy thử lại sau.`
              : t`Đang chuẩn bị link mời góp…`}
          </p>
        ))}
    </SidePanel>
  );
}
