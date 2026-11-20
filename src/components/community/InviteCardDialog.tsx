import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { SidePanel } from "@/components/SidePanel";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_THEME,
  INVITE_THEMES,
  InviteCard,
  inviteMessage,
  type InviteAudience,
  type InviteTheme,
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

const PREVIEW_MAX = 360;
const THUMB_W = 76;

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
  // Danh sách mẫu: mẫu riêng của ngữ cảnh + "Mời cả nhà góp" / "Cảm ơn cả nhà" (trừ link câu hỏi), mỗi mẫu 3 tông màu.
  const allVariants = useMemo<InviteVariant[]>(
    () => (variants.includes("hoi") ? variants : [...new Set<InviteVariant>([...variants, "chung", "camon"])]),
    [variants],
  );
  const templates = useMemo(
    () =>
      allVariants.flatMap((v) => [DEFAULT_THEME[v], ...INVITE_THEMES.filter((th) => th !== DEFAULT_THEME[v])].map((theme) => ({ variant: v, theme }))),
    [allVariants],
  );
  const [variant, setVariant] = useState<InviteVariant>(variants[0]);
  const [theme, setTheme] = useState<InviteTheme>(DEFAULT_THEME[variants[0]]);
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

  // Ảnh vuông luôn có QR; "Link nằm ở đâu" chỉ đổi câu hướng dẫn. Nhãn dán link chỉ có ở Story.
  useEffect(() => {
    if (format === "square" && linkPlace === "sticker") setLinkPlace("comment");
  }, [format, linkPlace]);

  const { data: summary } = useQuery({
    queryKey: ["community-summary", clanId],
    queryFn: () => getCommunitySummary(clanId),
    enabled: open, // ảnh thu nhỏ mẫu "chung"/"camon" luôn có trong danh sách
  });
  const { data: memories } = useQuery({
    queryKey: ["clan-memories-count", clanId],
    queryFn: () => listClanMemories(clanId),
    enabled: open, // ảnh thu nhỏ mẫu "chung"/"camon" luôn có trong danh sách
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
    theme,
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
  // Ảnh lớn co theo bề rộng khung (điện thoại hẹp) chừa chỗ cho cột mẫu.
  const stageRef = useRef<HTMLDivElement>(null);
  const [stageW, setStageW] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setStageW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [open]);
  const previewW = Math.max(160, Math.min(PREVIEW_MAX, (stageW || PREVIEW_MAX + THUMB_W + 40) - THUMB_W - 40));
  const scale = previewW / dim.w;

  async function render(): Promise<Blob> {
    await ensureCardFontsLoaded();
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    await fonts?.load('700 64px "Noto Serif"', "Gia phả họ Nguyễn ữỗọệ").catch(() => undefined);
    return nodeToPngBlob(exportRef.current!.firstElementChild as HTMLElement, dim.w, dim.h);
  }
  const filename = `moi-gop-${variant}-${theme}-${format}.png`;
  const THEME_LABEL: Record<InviteTheme, string> = { ruou: t`Đỏ rượu vang`, dem: t`Đêm vàng`, nga: t`Giấy ngà` };

  async function onDownload() {
    setBusy(true);
    try {
      downloadBlob(await render(), filename);
      track("community_invite_card", { variant, theme, format, action: "download" });
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
      track("community_invite_card", { variant, theme, format, action: r });
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
          {/* Ảnh lớn bên trái + cột mẫu DỌC bên phải (cuộn trong khung cao bằng ảnh) — bấm mẫu thấy ngay ảnh đổi. */}
          <div ref={stageRef} className="flex gap-2 rounded-lg border bg-muted/40 p-2 sm:gap-3 sm:p-3">
            <div className="flex min-w-0 flex-1 justify-center">
              <div style={{ width: previewW, height: dim.h * scale, overflow: "hidden" }}>
                <div style={{ transform: `scale(${scale})`, transformOrigin: "top left", width: dim.w, height: dim.h }}>
                  <InviteCard data={data} format={format} />
                </div>
              </div>
            </div>
            <div
              role="listbox"
              aria-label={t`Chọn mẫu (${templates.length} mẫu)`}
              className="flex shrink-0 snap-y flex-col gap-1.5 overflow-y-auto border-l pl-2 sm:pl-3"
              style={{ height: dim.h * scale, width: THUMB_W + 16 }}
            >
              {templates.map((tp) => {
                const active = tp.variant === variant && tp.theme === theme;
                return (
                  <button
                    key={`${tp.variant}-${tp.theme}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => {
                      setVariant(tp.variant);
                      setTheme(tp.theme);
                    }}
                    title={`${VARIANT_LABEL[tp.variant]} · ${THEME_LABEL[tp.theme]}`}
                    className={`shrink-0 snap-start rounded-lg border-2 p-1 text-left transition-colors ${active ? "border-primary bg-background" : "border-transparent hover:border-muted-foreground/40"}`}
                  >
                    <div className="overflow-hidden rounded" style={{ width: THUMB_W, height: dim.h * (THUMB_W / dim.w) }}>
                      <div style={{ transform: `scale(${THUMB_W / dim.w})`, transformOrigin: "top left", width: dim.w, height: dim.h, pointerEvents: "none" }}>
                        <InviteCard data={{ ...data, variant: tp.variant, theme: tp.theme }} format={format} />
                      </div>
                    </div>
                    <div className="mt-1 truncate text-[11px] font-medium leading-tight">{VARIANT_LABEL[tp.variant]}</div>
                    <div className="truncate text-[10px] leading-tight text-muted-foreground">{THEME_LABEL[tp.theme]}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
