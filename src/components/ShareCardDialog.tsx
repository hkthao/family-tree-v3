import { useQuery } from "@tanstack/react-query";
import { InviteCardBody } from "@/components/community/InviteCardDialog";
import { getOrCreateGeneralInviteUrl } from "@/components/community/inviteLink";
import { SidePanel } from "@/components/SidePanel";
import { Callout } from "@/components/ui/callout";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  IconArrowLeft,
  IconArrowRight,
  IconCopy,
  IconDownload,
  IconScroll,
  IconShare2,
  IconTag,
} from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/Toast";
import {
  imageUrlToDataUrl,
  makeQrDataUrl,
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
const STEPS = [
  { n: 1 as const, label: () => t`Chọn kiểu` },
  { n: 2 as const, label: () => t`Tuỳ chỉnh` },
  { n: 3 as const, label: () => t`Chia sẻ` },
];

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
  const [step, setStep] = useState<1 | 2 | 3>(1);
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
  const previewW = Math.min(PREVIEW_W, (maxH * dim.w) / dim.h);
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
          <div className="flex justify-center rounded-lg border bg-muted/40 p-2 sm:p-3">
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
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5 [scrollbar-gutter:stable]">
          {/* Các bước: ① Chọn kiểu → ② Tuỳ chỉnh → ③ Chia sẻ */}
          <div className="space-y-4">
            <ol
              aria-label={t`Các bước`}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
            >
              {STEPS.map((s) => (
                <li key={s.n}>
                  <button
                    type="button"
                    onClick={() => setStep(s.n)}
                    aria-current={step === s.n ? "step" : undefined}
                    className="inline-flex min-h-11 items-center gap-2"
                  >
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-xs font-semibold ${step >= s.n ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"}`}
                    >
                      {s.n}
                    </span>
                    <span
                      className={
                        step === s.n ? "font-semibold" : "text-muted-foreground"
                      }
                    >
                      {s.label()}
                    </span>
                  </button>
                </li>
              ))}
            </ol>

            {step === 1 && (
              <div className="space-y-4">
                <p className="text-sm font-medium">{t`Bạn muốn khoe điều gì?`}</p>
                {/* Thể loại */}
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setGenre(g)}
                      className={`rounded-full border px-3 py-1.5 text-sm ${genre === g ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"}`}
                    >
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
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setTemplateId(t.id)}
                        className={`rounded-md border p-1 text-left ${active ? "border-primary ring-2 ring-primary" : "hover:border-primary"}`}
                      >
                        <div
                          className="mx-auto overflow-hidden rounded bg-muted"
                          style={{ width: 88, height: dim.h * s }}
                        >
                          <div
                            style={{
                              width: dim.w,
                              height: dim.h,
                              transform: `scale(${s})`,
                              transformOrigin: "top left",
                              pointerEvents: "none",
                            }}
                          >
                            {t.render({ data, format })}
                          </div>
                        </div>
                        <span className="block mt-1 text-[11px] leading-tight text-muted-foreground">
                          {t.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-sm font-medium">{t`Khổ thiệp`}</p>
                {/* Định dạng */}
                <div className="flex gap-2">
                  {(["square", "vertical"] as CardFormat[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFormat(f)}
                      className={`rounded-full border px-4 py-1.5 text-sm ${format === f ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:border-primary"}`}
                    >
                      {f === "square" ? t`Vuông (đăng tường)` : t`Dọc (story)`}
                    </button>
                  ))}
                </div>
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

        {/* Chân cố định: điều hướng giữa các bước */}
        <div className="flex shrink-0 items-center justify-between gap-2 border-t bg-background px-4 py-3 sm:px-5">
          <>
            {step > 1 ? (
              <Button
                size="sm"
                variant="outline"
                className="px-3 text-sm"
                onClick={() => setStep((step - 1) as 1 | 2)}
              >
                <IconArrowLeft className="mr-1.5 h-4 w-4" />
                {t`Quay lại`}
              </Button>
            ) : (
              <span />
            )}
            {step < 3 && (
              <Button
                size="sm"
                className="px-3 text-sm"
                onClick={() => setStep((step + 1) as 2 | 3)}
              >
                {step === 1 ? t`Tiếp: Tuỳ chỉnh` : t`Tiếp: Chia sẻ`}
                <IconArrowRight className="ml-1.5 h-4 w-4" />
              </Button>
            )}
          </>
        </div>
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
      subtitle={
        kind === "invite" ? t`Ảnh + tin nhắn mời người thân góp` : undefined
      }
      guard={false}
      bare
    >
      {clanId && (
        <div
          role="tablist"
          aria-label={t`Loại thiệp`}
          className="flex shrink-0 gap-2 border-b px-4 py-2 sm:px-5"
        >
          {(
            [
              ["share", t`Thiệp khoe / giới thiệu`],
              ["invite", t`Mời người thân góp`],
            ] as const
          ).map(([k, label]) => (
            <Button
              key={k}
              role="tab"
              aria-selected={kind === k}
              size="sm"
              variant={kind === k ? "default" : "outline"}
              className="px-3 text-sm"
              onClick={() => setKind(k)}
            >
              {label}
            </Button>
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
