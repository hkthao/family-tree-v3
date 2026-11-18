import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  Article,
  ArticleActionBar,
  ArticleFactBox,
  ArticleFigure,
  ArticleHeader,
  ArticleList,
  ArticleProse,
  ArticleSection,
  ArticleToc,
} from "@/components/Article";
import { PanelLink } from "@/components/panel/PanelLink";
import { Breadcrumb } from "@/components/Breadcrumb";
import { PersonViewLink } from "@/components/panel/PersonViewLink";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconCamera,
  IconCheck,
  IconLink,
  IconMapPin,
  IconMicrophone,
  IconPencil,
  IconPlay,
  IconPlus,
  IconQrCode,
  IconScroll,
  IconSparkles,
  IconTrash,
  IconX,
} from "@/components/icons";
import { ImageLightbox, type LightboxImage } from "@/components/ImageLightbox";
import { PersonAvatar } from "@/components/PersonAvatar";
import { QrCodeModal } from "@/components/QrCodeModal";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import type { CardGenre } from "@/lib/cards/types";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { DrawerViewActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/formatDate";
import {
  canEditClan,
  isClanAdmin,
  useClanContext,
} from "@/hooks/useClanContext";
import {
  useAudioRecorder,
  HERITAGE_AUDIO_MAX_SEC,
  isAudioRecordingSupported,
} from "@/lib/audioRecord";
import { getOrCreateHeritageShareLink } from "@/lib/queries/share-links";
import {
  getSignedPhotoUrlMap,
  PHOTO_URL_STALE_MS,
  uploadHeritageAudio,
  uploadHeritagePhoto,
} from "@/lib/photoUpload";
import {
  addMedia,
  clanHeritageStorageBytes,
  deleteHeritageItem,
  formatBytes,
  getHeritageItem,
  heritageDirectionsUrl,
  HERITAGE_CATEGORY_LABEL,
  HERITAGE_CLAN_QUOTA_BYTES,
  removeMedia,
  setCoverMedia,
  validateExternalMedia,
  videoEmbedUrl,
  type HeritageMedia,
  type HeritageMediaKind,
} from "@/lib/queries/heritage";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
// Giới hạn để chặn phình dung lượng storage VPS.
const MAX_PHOTOS = 12;
const MAX_AUDIO = 5;

function fmtDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Hiện trong ngăn kéo XEM (thay cho form khoá ô): lấy id từ đây, bỏ breadcrumb, xoá xong thì đóng ngăn kéo. */
export interface EmbeddedHeritage {
  id: string;
  onClose: () => void;
}

export default function HeritageDetail({
  embedded,
}: { embedded?: EmbeddedHeritage } = {}) {
  const { clan } = useClanContext();
  const { itemId: routeId } = useParams<{ itemId: string }>();
  const itemId = embedded?.id ?? routeId;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const askConfirm = useConfirm();
  const canEdit = canEditClan(clan);
  const canAdmin = isClanAdmin(clan);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  const { data: item, isLoading } = useQuery({
    queryKey: ["heritage-item", itemId, userId],
    queryFn: () => getHeritageItem(itemId!),
    enabled: !!itemId,
  });

  const photos = (item?.media ?? []).filter((m) => m.kind === "photo");
  const audios = (item?.media ?? []).filter((m) => m.kind === "audio");
  const videos = (item?.media ?? []).filter((m) => m.kind === "video");
  // Chỉ ký URL cho file trong bucket; link ngoài dùng trực tiếp.
  const bucketPaths = (item?.media ?? [])
    .map((m) => m.path)
    .filter((p): p is string => !!p);

  const { data: mediaUrls } = useQuery({
    queryKey: ["heritage-media-urls", itemId, bucketPaths.join(",")],
    queryFn: () => getSignedPhotoUrlMap(bucketPaths),
    enabled: !!item && bucketPaths.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });
  // Nguồn hiển thị của một media: link ngoài (trực tiếp) hoặc URL đã ký.
  const srcOf = (m: HeritageMedia): string | undefined =>
    m.external_url ?? (m.path ? mediaUrls?.get(m.path) : undefined);

  // Danh sách ảnh (có URL) cho lightbox + cách tìm index khi click 1 ảnh.
  const photoImages: LightboxImage[] = photos.flatMap((ph) => {
    const src = srcOf(ph);
    return src ? [{ src, caption: ph.caption }] : [];
  });
  const lightboxIndexOf = (ph: HeritageMedia) =>
    photoImages.findIndex((im) => im.src === srcOf(ph));

  const { data: storageBytes } = useQuery({
    queryKey: ["heritage-storage", clan.id, userId],
    queryFn: () => clanHeritageStorageBytes(clan.id),
    enabled: !!userId,
  });
  const overQuota = (storageBytes ?? 0) >= HERITAGE_CLAN_QUOTA_BYTES;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["heritage-item", itemId] });
    qc.invalidateQueries({ queryKey: ["heritage-storage", clan.id] });
  };

  const uploadPhotoM = useMutation({
    mutationFn: async (file: File) => {
      if (photos.length >= MAX_PHOTOS)
        throw new Error(t`Tối đa ${MAX_PHOTOS} ảnh mỗi mục.`);
      if (overQuota)
        throw new Error(
          t`Dòng họ đã dùng hết ${formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}. Hãy xoá bớt ảnh/ghi âm cũ.`,
        );
      const { path, bytes } = await uploadHeritagePhoto(clan.id, itemId!, file);
      const { id } = await addMedia(itemId!, {
        kind: "photo",
        path,
        bytes,
        sort: photos.length,
      });
      // ảnh đầu tiên → đặt làm ảnh đại diện
      if (!item?.cover_media_id && photos.length === 0)
        await setCoverMedia(itemId!, id);
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      toast.success(t`Đã thêm ảnh`);
    },
    onError: (e) =>
      toast.error(t`Không thêm được ảnh`, {
        description: (e as Error).message,
      }),
  });

  const uploadAudioM = useMutation({
    mutationFn: async ({
      blob,
      ext,
      durationSec,
    }: {
      blob: Blob;
      ext: string;
      durationSec: number;
    }) => {
      if (audios.length >= MAX_AUDIO)
        throw new Error(t`Tối đa ${MAX_AUDIO} đoạn ghi âm mỗi mục.`);
      if (overQuota)
        throw new Error(
          t`Dòng họ đã dùng hết ${formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}. Hãy xoá bớt ảnh/ghi âm cũ.`,
        );
      const { path, bytes } = await uploadHeritageAudio(
        clan.id,
        itemId!,
        blob,
        ext,
      );
      await addMedia(itemId!, {
        kind: "audio",
        path,
        bytes,
        duration_sec: durationSec,
        sort: audios.length,
      });
    },
    onSuccess: () => {
      invalidate();
      toast.success(t`Đã lưu đoạn ghi âm`);
    },
    onError: (e) =>
      toast.error(t`Không lưu được ghi âm`, {
        description: (e as Error).message,
      }),
  });

  // Xem ảnh phóng to (lightbox).
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Thêm liên kết ngoài (ảnh/audio/video host nơi khác) — KHÔNG tốn storage VPS.
  const [extKind, setExtKind] = useState<HeritageMediaKind>("video");
  const [extUrl, setExtUrl] = useState("");
  const [extErr, setExtErr] = useState<string | null>(null);

  // Thêm nhanh ảnh bằng link ngoài (nút trong khu Hình ảnh).
  const addPhotoLinkM = useMutation({
    mutationFn: async (url: string) => {
      const check = validateExternalMedia("photo", url);
      if (!check.ok) throw new Error(check.error);
      const same = (item?.media ?? []).filter((m) => m.kind === "photo");
      await addMedia(itemId!, {
        kind: "photo",
        external_url: url.trim(),
        sort: same.length,
      });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      toast.success(t`Đã thêm ảnh từ liên kết`);
    },
    onError: (e) =>
      toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });
  const addExternalM = useMutation({
    mutationFn: async () => {
      const check = validateExternalMedia(extKind, extUrl);
      if (!check.ok) throw new Error(check.error);
      const sameKind = (item?.media ?? []).filter((m) => m.kind === extKind);
      await addMedia(itemId!, {
        kind: extKind,
        external_url: extUrl.trim(),
        sort: sameKind.length,
      });
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      setExtUrl("");
      setExtErr(null);
      toast.success(t`Đã thêm liên kết`);
    },
    onError: (e) => setExtErr((e as Error).message),
  });

  const removeMediaM = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string | null }) =>
      removeMedia(id, path),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteHeritageItem(itemId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      toast.success(t`Đã xoá`);
      if (embedded) embedded.onClose();
      else navigate(`/clans/${clan.id}/heritage`);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  // QR chia sẻ công khai + thiệp chia sẻ
  const [qrOpen, setQrOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const qrM = useMutation({
    mutationFn: () => getOrCreateHeritageShareLink(clan.id, itemId!),
    onError: (e) =>
      toast.error(t`Không tạo được QR`, { description: (e as Error).message }),
  });
  const qrUrl = qrM.data
    ? `${window.location.origin}/share/${qrM.data.token}`
    : "";

  if (isLoading) return <p className="text-muted-foreground">{t`Đang tải…`}</p>;
  if (!item)
    return <p className="text-muted-foreground">{t`Không tìm thấy.`}</p>;

  // Phòng cache cũ (trước khi có cột sections) → sections có thể undefined.
  const sections = item.sections ?? [];

  const dir = heritageDirectionsUrl(item.latitude, item.longitude);

  // Dữ liệu cho thiệp chia sẻ.
  const cardPhotoUrls = photos
    .map((p) => srcOf(p))
    .filter((u): u is string => !!u);
  const cardExcerpt = (item.summary || item.body || "").slice(0, 240);
  const cardGenre: CardGenre =
    item.category === "place"
      ? "shrine"
      : item.category === "story" || item.category === "artifact"
        ? "story"
        : "memorial";

  // Ảnh lớn đầu bài: ảnh đại diện (hoặc ảnh đầu tiên). Bộ ảnh bên dưới chỉ hiện khi còn ảnh khác / người sửa cần quản lý.
  const cover =
    photos.find((p) => p.id === item.cover_media_id && srcOf(p)) ??
    photos.find((p) => srcOf(p));
  const coverSrc = cover ? srcOf(cover) : undefined;

  // Ảnh / ghi âm / video / thêm liên kết — các mục cuối bài. Trong ngăn kéo XEM: ẩn mục trống và công cụ thêm/xoá
  // (sửa ở trang đầy đủ hoặc nút "Sửa").
  const canEditMedia = canEdit && !embedded;
  const mediaBlock = (
    <>
      {/* Ảnh */}
      {(photos.length > 1 || canEditMedia) && (
        <ArticleSection
          title={t`Hình ảnh`}
          aside={
            photos.length > 0 ? `${photos.length}/${MAX_PHOTOS}` : undefined
          }
        >
          {photos.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">{t`Chưa có ảnh.`}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {photos.map((ph) => (
                <div
                  key={ph.id}
                  className="relative aspect-square overflow-hidden rounded-md bg-muted"
                >
                  {srcOf(ph) ? (
                    <button
                      type="button"
                      onClick={() => setLightboxIdx(lightboxIndexOf(ph))}
                      className="h-full w-full cursor-zoom-in"
                      aria-label={t`Xem ảnh lớn`}
                    >
                      <img
                        src={srcOf(ph)}
                        alt={ph.caption ?? ""}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <IconScroll className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {canEditMedia && (
                    <button
                      type="button"
                      onClick={() =>
                        removeMediaM.mutate({ id: ph.id, path: ph.path })
                      }
                      className="absolute right-1 top-1 rounded-full bg-background/80 p-1 hover:bg-background"
                      aria-label={t`Xoá ảnh`}
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {canEditMedia && (
            <div className="mt-3 flex flex-wrap justify-end gap-2 font-sans">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhotoM.mutate(f);
                  e.target.value = "";
                }}
              />
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadPhotoM.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={
                  uploadPhotoM.isPending ||
                  photos.length >= MAX_PHOTOS ||
                  overQuota
                }
                onClick={() => fileRef.current?.click()}
              >
                <IconPlus className="h-4 w-4 mr-1" />{" "}
                {uploadPhotoM.isPending ? t`Đang tải…` : t`Tải ảnh`}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={
                  addPhotoLinkM.isPending || photos.length >= MAX_PHOTOS
                }
                title={t`Dán link ảnh có sẵn trên mạng — không tốn dung lượng`}
                onClick={() => {
                  const u = window.prompt(t`Dán link ảnh (https://…):`);
                  if (u?.trim()) addPhotoLinkM.mutate(u.trim());
                }}
              >
                <IconLink className="h-4 w-4 mr-1" /> {t`Liên kết ngoài`}
              </Button>
              <Button
                size="sm"
                disabled={
                  uploadPhotoM.isPending ||
                  photos.length >= MAX_PHOTOS ||
                  overQuota
                }
                onClick={() => cameraRef.current?.click()}
              >
                <IconCamera className="h-4 w-4 mr-1" /> {t`Chụp ảnh`}
              </Button>
            </div>
          )}
        </ArticleSection>
      )}

      {/* Ghi âm kể chuyện */}
      {(audios.length > 0 || canEditMedia) && (
        <ArticleSection
          title={t`Ghi âm kể chuyện`}
          aside={
            audios.length > 0 ? `${audios.length}/${MAX_AUDIO}` : undefined
          }
        >
          <div className="space-y-3 font-sans">
            {audios.length > 0 && (
              <ul className="space-y-2">
                {audios.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center gap-2 border-b pb-2 last:border-b-0"
                  >
                    <audio
                      controls
                      preload="none"
                      src={srcOf(a)}
                      className="h-9 min-w-0 flex-1"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {fmtDuration(a.duration_sec)}
                    </span>
                    {canEditMedia && (
                      <button
                        type="button"
                        aria-label={t`Xoá ghi âm`}
                        onClick={() =>
                          removeMediaM.mutate({ id: a.id, path: a.path })
                        }
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                      >
                        <IconX className="h-4 w-4" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {canEditMedia && audios.length < MAX_AUDIO && !overQuota && (
              <AudioRecorder
                disabled={uploadAudioM.isPending}
                onSave={(blob, ext, durationSec) =>
                  uploadAudioM.mutate({ blob, ext, durationSec })
                }
              />
            )}
            {canEditMedia && overQuota && (
              <p className="text-sm text-red-600">
                <Trans>
                  Dòng họ đã dùng hết {formatBytes(HERITAGE_CLAN_QUOTA_BYTES)} —
                  hãy xoá bớt ảnh/ghi âm cũ trước khi thêm.
                </Trans>
              </p>
            )}
          </div>
        </ArticleSection>
      )}

      {/* Video (chỉ qua link ngoài) */}
      {videos.length > 0 && (
        <ArticleSection title="Video">
          <div className="space-y-3">
            {videos.map((v) => {
              const embed = videoEmbedUrl(v.external_url ?? "");
              return (
                <div key={v.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    {embed ? (
                      <iframe
                        src={embed}
                        title={t`Video di sản`}
                        className="aspect-video w-full rounded-lg border"
                        allow="encrypted-media; picture-in-picture; fullscreen"
                        allowFullScreen
                        referrerPolicy="strict-origin-when-cross-origin"
                      />
                    ) : (
                      <video
                        controls
                        preload="none"
                        src={srcOf(v)}
                        className="w-full rounded-lg border"
                      />
                    )}
                  </div>
                  {canEditMedia && (
                    <button
                      type="button"
                      aria-label={t`Xoá video`}
                      onClick={() =>
                        removeMediaM.mutate({ id: v.id, path: v.path })
                      }
                      className="shrink-0 text-muted-foreground hover:text-foreground"
                    >
                      <IconX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </ArticleSection>
      )}

      {/* Thêm liên kết ngoài — không tốn dung lượng VPS */}
      {canEditMedia && (
        <ArticleSection title={t`Thêm liên kết ngoài`}>
          <div className="space-y-3 font-sans">
            <p className="text-sm text-muted-foreground">
              <Trans>
                Dán link ảnh / video / âm thanh đã đăng ở nơi khác.
                <strong>Không tính vào dung lượng</strong> của họ — dùng khi đã
                đầy, hoặc muốn nhúng video YouTube.
              </Trans>
            </p>
            <div className="flex flex-wrap gap-2">
              <Select
                value={extKind}
                onChange={(e) => {
                  setExtKind(e.target.value as HeritageMediaKind);
                  setExtErr(null);
                }}
                icon={<IconPlay />}
                className="h-11 w-auto"
                aria-label={t`Loại nội dung`}
              >
                <option value="video">Video</option>
                <option value="photo">{t`Ảnh`}</option>
                <option value="audio">{t`Âm thanh`}</option>
              </Select>
              {/* Một hành động duy nhất → nằm TRONG ô, xem
                  docs/design-language.md §Đặt hành động ở đâu. */}
              <div className="min-w-[220px] flex-1">
                <Input
                  value={extUrl}
                  onChange={(e) => {
                    setExtUrl(e.target.value);
                    setExtErr(null);
                  }}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      extUrl.trim() &&
                      !addExternalM.isPending
                    ) {
                      e.preventDefault();
                      addExternalM.mutate();
                    }
                  }}
                  placeholder={t`Dán link https://… vào đây`}
                  inputMode="url"
                  icon={<IconLink />}
                  className="h-11"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => addExternalM.mutate()}
                      disabled={addExternalM.isPending || !extUrl.trim()}
                      aria-label={t`Thêm link`}
                      title={t`Thêm link`}
                      className="h-9 w-9"
                    >
                      <IconPlus className="h-4 w-4" />
                    </Button>
                  }
                />
              </div>
            </div>
            {extErr && <p className="text-sm text-red-600">{extErr}</p>}

            {/* Hướng dẫn nền tảng cho user tự làm */}
            <details className="rounded-md border bg-muted/40 p-3 text-sm">
              <summary className="cursor-pointer font-medium">{t`Hướng dẫn lấy link (bấm để xem)`}</summary>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p>
                  <strong>🎬 Video → YouTube</strong>: tải video lên
                  youtube.com, đặt chế độ "Không công khai (Unlisted)", rồi sao
                  {t`chép link trên thanh địa chỉ (dạng`}{" "}
                  <code>https://youtu.be/…</code>
                  {t`). Dán vào đây.`}
                </p>
                <p>
                  <strong>{t`🖼 Ảnh → Google Drive / Google Photos`}</strong>
                  {t`: tải ảnh lên, bấm "Chia sẻ" → "Bất kỳ ai có liên kết", rồi copy link. (Hoặc dùng dịch vụ ảnh có link trực tiếp như imgur.com.)`}
                </p>
                <p>
                  <strong>{t`🔊 Âm thanh`}</strong>: tải file lên Google Drive
                  {t`(chia sẻ công khai) rồi dán link; hoặc dùng link file`}{" "}
                  <code>.mp3</code> trực tiếp.
                </p>
                <p className="text-xs">
                  <Trans>
                    Lưu ý: link phải bắt đầu bằng <code>https://</code> và để
                    chế độ ai có link đều xem được, nếu không người trong họ sẽ
                    không mở được.
                  </Trans>
                </p>
              </div>
            </details>
          </div>
        </ArticleSection>
      )}
    </>
  );

  // Nút có nhãn, nằm ở thanh dính đáy — ngăn kéo: DrawerViewActions; trang đầy đủ: ArticleActionBar
  // (Xoá → Thiệp → QR → Sửa).
  const iconCls = "h-4 w-4 mr-1.5 shrink-0";
  const labelCls = undefined;
  const actionButtons = (
    <>
      {canAdmin && (
        <>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setCardOpen(true);
              if (!qrM.data) qrM.mutate();
            }}
          >
            <IconSparkles className={iconCls} />
            <span className={labelCls}>{t`Thiệp`}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setQrOpen(true);
              if (!qrM.data) qrM.mutate();
            }}
          >
            <IconQrCode className={iconCls} />
            <span className={labelCls}>QR</span>
          </Button>
        </>
      )}
      {canEdit && (
        <>
          <Button size="sm" className="order-last" asChild>
            <PanelLink
              to={`/clans/${clan.id}/heritage/${item.id}/edit`}
              panel="heritage-edit"
              panelParams={{ pid: item.id }}
            >
              <IconPencil className={iconCls} />
              <span className={labelCls}>{t`Sửa`}</span>
            </PanelLink>
          </Button>
          <Button
            size="sm"
            variant="destructive-outline"
            className="order-first"
            onClick={() =>
              askConfirm({
                title: t`Xoá mục di sản này?`,
                description: t`Xoá cả ảnh và ghi âm kèm theo.`,
                confirmLabel: t`Xoá`,
                destructive: true,
              }).then((ok) => ok && deleteM.mutate())
            }
          >
            <IconTrash className={iconCls} />
            <span className={labelCls}>{t`Xoá`}</span>
          </Button>
        </>
      )}
    </>
  );

  const secId = (i: number) => `hsec-${i}`;
  const updated = formatDate(item.updated_at);

  return (
    <div className="space-y-3">
      {!embedded && (
        <Breadcrumb
          items={[
            { label: clan.name, to: `/clans/${clan.id}` },
            { label: t`Di sản dòng họ`, to: `/clans/${clan.id}/heritage` },
            { label: item.title },
          ]}
        />
      )}

      {/* Dạng bài báo: không bọc thẻ — chuyên mục, tít, sapo, ảnh lớn, thân bài, hộp thông tin, tư liệu. */}
      <Article>
        <ArticleHeader
          kicker={HERITAGE_CATEGORY_LABEL[item.category]}
          title={item.title}
          deck={item.summary}
          meta={[
            // Mục "nơi" đã có hộp Thông tin (nơi, năm lập) — dòng thông tin không lặp lại.
            item.category === "place" ? null : item.location_name,
            item.category !== "place" && item.built_year
              ? t`Lập năm ${item.built_year}`
              : null,
            updated ? t`Cập nhật ${updated}` : null,
          ]}
        />

        {cover && coverSrc && (
          <ArticleFigure
            src={coverSrc}
            alt={cover.caption ?? item.title}
            caption={cover.caption}
            onOpen={() => setLightboxIdx(lightboxIndexOf(cover))}
            openLabel={t`Xem ảnh lớn`}
          />
        )}

        {sections.length >= 3 && (
          <ArticleToc
            label={t`Trong bài này`}
            items={sections.map((s, i) => ({
              id: secId(i),
              title: s.heading || t`Đoạn ${i + 1}`,
            }))}
          />
        )}

        {/* Kiểu cũ: 1 ô body (khi chưa chia đoạn). Kiểu mới: nhiều đoạn, hiện đầy đủ — không bắt bấm mở. */}
        {sections.length === 0 && item.body && (
          <ArticleSection>
            <ArticleProse>{item.body}</ArticleProse>
          </ArticleSection>
        )}
        {sections.map((s, i) => (
          <ArticleSection
            key={i}
            id={secId(i)}
            title={
              s.heading || (sections.length > 1 ? t`Đoạn ${i + 1}` : undefined)
            }
          >
            <ArticleProse>{s.body}</ArticleProse>
          </ArticleSection>
        ))}

        {/* Thông tin nơi (place) */}
        {item.category === "place" && (
          <ArticleFactBox
            title={t`Thông tin`}
            rows={[
              { label: t`Ở đâu`, value: item.location_name },
              { label: t`Địa chỉ`, value: item.address },
              {
                label: t`Lập / xây năm`,
                value: item.built_year ? String(item.built_year) : null,
              },
            ]}
            footer={
              dir && (
                <Button size="sm" variant="outline" asChild>
                  <a href={dir} target="_blank" rel="noopener noreferrer">
                    <IconMapPin className="h-4 w-4 mr-1" /> {t`Chỉ đường`}
                  </a>
                </Button>
              )
            }
          />
        )}

        {/* Người liên quan */}
        {item.people.length > 0 && (
          <ArticleSection
            title={t`Người liên quan`}
            aside={String(item.people.length)}
          >
            <ArticleList>
              {item.people.map((p) => (
                <li key={p.link_id}>
                  <PersonViewLink
                    inPanel={!!embedded}
                    personId={p.person_id}
                    to={`/clans/${clan.id}/people/${p.person_id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:text-primary"
                  >
                    <PersonAvatar gender={p.gender} photoUrl={null} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{p.full_name}</p>
                      {p.role_note && (
                        <p className="truncate text-sm text-muted-foreground">
                          {p.role_note}
                        </p>
                      )}
                    </div>
                  </PersonViewLink>
                </li>
              ))}
            </ArticleList>
          </ArticleSection>
        )}

        {mediaBlock}
      </Article>

      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={qrUrl}
        loading={qrM.isPending}
        title={item.title}
        description={t`Quét QR để xem mục di sản này — chia sẻ với con cháu trong họ.`}
      />

      <ShareCardDialog
        open={cardOpen}
        onClose={() => setCardOpen(false)}
        clanName={clan.name}
        shareUrl={qrUrl}
        initialTitle={item.title}
        initialExcerpt={cardExcerpt}
        photoUrls={cardPhotoUrls}
        defaultGenre={cardGenre}
      />

      {lightboxIdx !== null && photoImages.length > 0 && (
        <ImageLightbox
          images={photoImages}
          index={Math.max(0, lightboxIdx)}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
      {(canAdmin || canEdit) &&
        (embedded ? (
          <DrawerViewActions>{actionButtons}</DrawerViewActions>
        ) : (
          <ArticleActionBar>{actionButtons}</ArticleActionBar>
        ))}
    </div>
  );
}

/** Bộ ghi âm cho người lớn tuổi: nút to, hiện đồng hồ, nghe thử trước khi lưu. */
function AudioRecorder({
  disabled,
  onSave,
}: {
  disabled: boolean;
  onSave: (blob: Blob, ext: string, durationSec: number) => void;
}) {
  const rec = useAudioRecorder(HERITAGE_AUDIO_MAX_SEC);

  if (!isAudioRecordingSupported()) {
    return (
      <p className="text-sm text-muted-foreground">{t`Thiết bị/trình duyệt này không hỗ trợ ghi âm.`}</p>
    );
  }

  if (rec.state === "recorded" && rec.result) {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">
          <Trans>
            Nghe thử trước khi lưu ({fmtDuration(rec.result.durationSec)}):
          </Trans>
        </p>
        <audio controls src={rec.result.url} className="w-full" />
        <div className="flex gap-2">
          <Button
            size="sm"
            disabled={disabled}
            onClick={() => {
              onSave(
                rec.result!.blob,
                rec.result!.ext,
                rec.result!.durationSec,
              );
              rec.reset();
            }}
          >
            <IconCheck className="h-4 w-4 mr-1.5" />
            {disabled ? t`Đang lưu…` : t`Lưu đoạn này`}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={rec.reset}
            disabled={disabled}
          >
            <IconMicrophone className="h-4 w-4 mr-1.5" />
            {t`Ghi lại`}
          </Button>
        </div>
      </div>
    );
  }

  if (rec.state === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-md border p-3">
        <span className="inline-flex items-center gap-2 text-base font-medium text-red-600">
          <Trans>
            <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
            Đang ghi… {fmtDuration(rec.seconds)} / {fmtDuration(rec.maxSeconds)}
          </Trans>
        </span>
        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={rec.stop}
        >
          <IconPlay className="h-4 w-4 mr-1.5" />
          {t`Dừng & nghe lại`}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        onClick={rec.start}
        disabled={disabled}
      >
        <IconMicrophone className="h-4 w-4 mr-1.5" /> {t`Bắt đầu ghi âm`}
      </Button>
      {rec.error && <p className="text-sm text-red-600">{rec.error}</p>}
      <p className="text-sm text-muted-foreground">
        <Trans>
          Tối đa {Math.round(HERITAGE_AUDIO_MAX_SEC / 60)} phút mỗi đoạn. Hãy kể
          tự nhiên bằng lời của bạn.
        </Trans>
      </p>
    </div>
  );
}
