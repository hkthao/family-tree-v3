import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import {
  InviteCard,
  inviteMessage,
  type InviteAudience,
  type InviteCardData,
  type InviteFact,
  type InviteLinkPlace,
  type InviteVariant,
} from "@/components/community/InviteCard";
import { IconCopy, IconDownload, IconCamera, IconLink, IconShare2, IconUser, IconUsers } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { FormActions } from "@/components/ui/form-actions";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { track } from "@/lib/analytics";
import { downloadBlob, imageUrlToDataUrl, makeQrDataUrl, nodeToPngBlob, sharePngBlob } from "@/lib/cards/exportCard";
import { ensureCardFontsLoaded } from "@/lib/cards/fonts";
import { CARD_DIMENSIONS, type CardFormat } from "@/lib/cards/types";
import { getCommunitySummary, listClanMemories } from "@/lib/queries/community";

import { t } from "@lingui/core/macro";

export interface InviteContext {
  personName?: string | null;
  personYears?: string | null;
  photoUrl?: string | null;
  facts?: InviteFact[];
  question?: string | null;
  askName?: string | null;
}

const PREVIEW_W = 360;

/**
 * "Tạo ảnh để đăng" (plan §4.3): ảnh infographic mời góp + tin nhắn soạn sẵn, cùng lựa chọn người đọc,
 * xưng hô, chỗ đặt link, khổ vuông / Story. Ảnh xuất ở máy người dùng (không lưu trên server).
 */
export function InviteCardDialog({
  open,
  onClose,
  clanId,
  clanName,
  url,
  variants,
  context,
}: {
  open: boolean;
  onClose: () => void;
  clanId: string;
  clanName: string;
  /** Link mời góp / link trả lời câu hỏi mà ảnh + tin nhắn trỏ tới. */
  url: string;
  /** Các mẫu dùng được trong ngữ cảnh này (mẫu đầu là mặc định). */
  variants: InviteVariant[];
  context?: InviteContext;
}) {
  const toast = useToast();
  const exportRef = useRef<HTMLDivElement>(null);
  const [variant, setVariant] = useState<InviteVariant>(variants[0]);
  const [format, setFormat] = useState<CardFormat>("square");
  const [audience, setAudience] = useState<InviteAudience>("young");
  const [xungHo, setXungHo] = useState("con");
  const [linkPlace, setLinkPlace] = useState<InviteLinkPlace>("comment");
  const [showGuide, setShowGuide] = useState(true);
  const [qr, setQr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    void makeQrDataUrl(url).then(setQr);
    if (context?.photoUrl) void imageUrlToDataUrl(context.photoUrl).then(setPhoto);
  }, [open, url, context?.photoUrl]);

  // Story thì không có QR (không ai quét màn hình của chính mình) → mặc định nhãn dán link.
  useEffect(() => {
    if (format === "vertical" && linkPlace === "qr") setLinkPlace("sticker");
    if (format === "square" && linkPlace === "sticker") setLinkPlace("comment");
  }, [format, linkPlace]);

  const needsStats = variant === "camon" || variant === "chung";
  const { data: summary } = useQuery({
    queryKey: ["community-summary", clanId],
    queryFn: () => getCommunitySummary(clanId),
    enabled: open && needsStats,
  });
  const { data: memories } = useQuery({
    queryKey: ["clan-memories-count", clanId],
    queryFn: () => listClanMemories(clanId),
    enabled: open && needsStats,
    staleTime: 60_000,
  });
  const stats = useMemo(() => {
    const visible = (memories ?? []).filter((m) => m.status === "visible");
    return {
      memories: visible.length,
      contributors: new Set(visible.map((m) => m.author_user_id ?? `g:${m.author_label}`)).size,
      visits: summary?.visits_total ?? 0,
    };
  }, [memories, summary]);

  const shortLink = url.replace(/^https?:\/\//, "").replace(/(.{38}).+/, "$1…");
  const data: InviteCardData = {
    clanName,
    variant,
    audience,
    xungHo,
    linkPlace,
    showGuide,
    qrDataUrl: qr,
    shortLink,
    personName: context?.personName,
    personYears: context?.personYears,
    photoDataUrl: photo,
    facts: context?.facts,
    question: context?.question,
    askName: context?.askName,
    stats,
  };
  const autoMessage = inviteMessage(data, url);
  // Tin nhắn đổi theo lựa chọn cho tới khi người dùng tự sửa.
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!edited) setMessage(autoMessage);
  }, [autoMessage, edited]);

  const dim = CARD_DIMENSIONS[format];
  const scale = PREVIEW_W / dim.w;

  async function render(): Promise<Blob> {
    await ensureCardFontsLoaded();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    await fonts?.load('700 64px "Noto Serif"', "Gia phả họ Nguyễn ữỗọệ").catch(() => undefined);
    return nodeToPngBlob(exportRef.current!.firstElementChild as HTMLElement, dim.w, dim.h);
  }
  const filename = `moi-gop-${variant}-${format}.png`;

  async function onDownload() {
    setBusy(true);
    try {
      downloadBlob(await render(), filename);
      track("community_invite_card", { variant, format, action: "download" });
    } catch (e) {
      toast.error(t`Không tạo được ảnh`, { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }
  async function onShare() {
    setBusy(true);
    try {
      const r = await sharePngBlob(await render(), filename, message);
      track("community_invite_card", { variant, format, action: r });
      if (r === "downloaded") {
        await navigator.clipboard.writeText(message).catch(() => undefined);
        toast.success(t`Đã tải ảnh và sao chép tin nhắn — dán vào bài đăng nhé`);
      }
    } catch (e) {
      toast.error(t`Không tạo được ảnh`, { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const VARIANT_LABEL: Record<InviteVariant, string> = {
    chung: t`Mời cả nhà góp`,
    hoso: t`Hồ sơ còn thiếu`,
    hoi: t`Hỏi ông bà`,
    camon: t`Cảm ơn cả nhà`,
  };

  return (
    <SidePanel open={open} onClose={onClose} size="lg" title={t`Tạo ảnh để đăng`} subtitle={t`Ảnh + tin nhắn mời người thân góp`} guard={false}>
      <div>
        <div className="space-y-4">
          <div className="flex justify-center rounded-lg border bg-muted/40 p-3">
            <div style={{ width: PREVIEW_W, height: dim.h * scale, overflow: "hidden" }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: dim.w, height: dim.h }}>
                <InviteCard data={data} format={format} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {variants.length > 1 && (
              <div className="space-y-1.5">
                <Label htmlFor="inv-variant">{t`Mẫu`}</Label>
                <Select id="inv-variant" icon={<IconCamera />} value={variant} onChange={(e) => setVariant(e.target.value as InviteVariant)}>
                  {variants.map((v) => (
                    <option key={v} value={v}>
                      {VARIANT_LABEL[v]}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="inv-format">{t`Khổ ảnh`}</Label>
              <Select id="inv-format" icon={<IconCamera />} value={format} onChange={(e) => setFormat(e.target.value as CardFormat)}>
                <option value="square">{t`Vuông (Facebook, Zalo)`}</option>
                <option value="vertical">{t`Dọc (Story, TikTok)`}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-aud">{t`Người đọc`}</Label>
              <Select id="inv-aud" icon={<IconUsers />} value={audience} onChange={(e) => setAudience(e.target.value as InviteAudience)}>
                <option value="young">{t`Người trẻ (thân mật)`}</option>
                <option value="old">{t`Người lớn tuổi (lễ phép, chữ to)`}</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-xh">{t`Xưng hô`}</Label>
              <Select id="inv-xh" icon={<IconUser />} value={xungHo} onChange={(e) => setXungHo(e.target.value)}>
                {["con", "cháu", "em", "mình"].map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="inv-link">{t`Link nằm ở đâu`}</Label>
              <Select id="inv-link" icon={<IconLink />} value={linkPlace} onChange={(e) => setLinkPlace(e.target.value as InviteLinkPlace)}>
                {format === "square" && <option value="qr">{t`Mã QR trên ảnh`}</option>}
                <option value="post">{t`Link trong bài viết`}</option>
                <option value="comment">{t`Link ở bình luận`}</option>
                {format === "vertical" && <option value="sticker">{t`Nhãn dán link (Story)`}</option>}
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm sm:mt-7">
              <input type="checkbox" className="h-4 w-4 accent-primary" checked={showGuide} onChange={(e) => setShowGuide(e.target.checked)} />
              {t`Hiện hướng dẫn 3 bước`}
            </label>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="inv-msg">{t`Tin nhắn đăng kèm (sửa thoải mái)`}</Label>
            <Textarea
              id="inv-msg"
              rows={5}
              value={message}
              onChange={(e) => {
                setEdited(true);
                setMessage(e.target.value);
              }}
            />
            <p className="text-xs text-muted-foreground">
              {t`Ảnh trên mạng xã hội không bấm được — nhớ dán link ở chỗ đã chọn. Mẹo: để link ở bình luận đầu tiên.`}
            </p>
          </div>
        </div>

        <FormActions>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void navigator.clipboard.writeText(message).then(() => toast.success(t`Đã sao chép tin nhắn`));
            }}
          >
            <IconCopy className="mr-1.5 h-4 w-4" />
            {t`Sao chép tin nhắn`}
          </Button>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void onDownload()}>
            <IconDownload className="mr-1.5 h-4 w-4" />
            {t`Tải ảnh`}
          </Button>
          <Button type="button" disabled={busy} onClick={() => void onShare()}>
            <IconShare2 className="mr-1.5 h-4 w-4" />
            {busy ? t`Đang tạo…` : t`Chia sẻ`}
          </Button>
        </FormActions>
      </div>

      {/* Bản đủ kích thước để xuất PNG (ngoài màn hình). */}
      <div aria-hidden="true" style={{ position: "fixed", left: -100000, top: 0 }}>
        <div ref={exportRef}>
          <InviteCard data={data} format={format} />
        </div>
      </div>
    </SidePanel>
  );
}
