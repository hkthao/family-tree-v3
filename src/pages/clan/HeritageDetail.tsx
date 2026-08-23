import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconChevronUp,
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
  IconUser,
  IconX,
} from "@/components/icons";
import { ImageLightbox, type LightboxImage } from "@/components/ImageLightbox";
import { PageHeader } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { QrCodeModal } from "@/components/QrCodeModal";
import { ShareCardDialog } from "@/components/ShareCardDialog";
import type { CardGenre } from "@/lib/cards/types";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { useAudioRecorder, HERITAGE_AUDIO_MAX_SEC, isAudioRecordingSupported } from "@/lib/audioRecord";
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

// Giới hạn để chặn phình dung lượng storage VPS.
const MAX_PHOTOS = 12;
const MAX_AUDIO = 5;

function fmtDuration(sec: number | null): string {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HeritageDetail() {
  const { clan } = useClanContext();
  const { itemId } = useParams<{ itemId: string }>();
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
      if (photos.length >= MAX_PHOTOS) throw new Error(`Tối đa ${MAX_PHOTOS} ảnh mỗi mục.`);
      if (overQuota) throw new Error(`Dòng họ đã dùng hết ${formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}. Hãy xoá bớt ảnh/ghi âm cũ.`);
      const { path, bytes } = await uploadHeritagePhoto(clan.id, itemId!, file);
      const { id } = await addMedia(itemId!, { kind: "photo", path, bytes, sort: photos.length });
      // ảnh đầu tiên → đặt làm ảnh đại diện
      if (!item?.cover_media_id && photos.length === 0) await setCoverMedia(itemId!, id);
    },
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      toast.success("Đã thêm ảnh");
    },
    onError: (e) => toast.error("Không thêm được ảnh", { description: (e as Error).message }),
  });

  const uploadAudioM = useMutation({
    mutationFn: async ({ blob, ext, durationSec }: { blob: Blob; ext: string; durationSec: number }) => {
      if (audios.length >= MAX_AUDIO) throw new Error(`Tối đa ${MAX_AUDIO} đoạn ghi âm mỗi mục.`);
      if (overQuota) throw new Error(`Dòng họ đã dùng hết ${formatBytes(HERITAGE_CLAN_QUOTA_BYTES)}. Hãy xoá bớt ảnh/ghi âm cũ.`);
      const { path, bytes } = await uploadHeritageAudio(clan.id, itemId!, blob, ext);
      await addMedia(itemId!, { kind: "audio", path, bytes, duration_sec: durationSec, sort: audios.length });
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã lưu đoạn ghi âm");
    },
    onError: (e) => toast.error("Không lưu được ghi âm", { description: (e as Error).message }),
  });

  // Xem ảnh phóng to (lightbox) + thu gọn/mở rộng nội dung.
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [bodyExpanded, setBodyExpanded] = useState(false);
  // Đoạn nội dung đang mở (accordion). Mặc định mở đoạn đầu.
  const [openSecs, setOpenSecs] = useState<Set<number>>(() => new Set([0]));

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
      toast.success("Đã thêm ảnh từ liên kết");
    },
    onError: (e) =>
      toast.error("Không thêm được", { description: (e as Error).message }),
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
      toast.success("Đã thêm liên kết");
    },
    onError: (e) => setExtErr((e as Error).message),
  });

  const removeMediaM = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string | null }) => removeMedia(id, path),
    onSuccess: () => {
      invalidate();
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteHeritageItem(itemId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["heritage", clan.id] });
      toast.success("Đã xoá");
      navigate(`/clans/${clan.id}/heritage`);
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  // QR chia sẻ công khai + thiệp chia sẻ
  const [qrOpen, setQrOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const qrM = useMutation({
    mutationFn: () => getOrCreateHeritageShareLink(clan.id, itemId!),
    onError: (e) => toast.error("Không tạo được QR", { description: (e as Error).message }),
  });
  const qrUrl = qrM.data ? `${window.location.origin}/share/${qrM.data.token}` : "";

  if (isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!item) return <p className="text-muted-foreground">Không tìm thấy.</p>;

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

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Di sản dòng họ", to: `/clans/${clan.id}/heritage` },
          { label: item.title },
        ]}
      />
      <PageHeader
        icon={<IconScroll className="h-7 w-7" />}
        title={item.title}
        description={HERITAGE_CATEGORY_LABEL[item.category]}
        actionsBelow
        actions={
          <div className="flex flex-wrap gap-2">
            {canAdmin && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    setCardOpen(true);
                    if (!qrM.data) qrM.mutate();
                  }}
                >
                  <IconSparkles className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Thiệp</span>
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setQrOpen(true);
                    if (!qrM.data) qrM.mutate();
                  }}
                >
                  <IconQrCode className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">QR</span>
                </Button>
              </>
            )}
            {canEdit && (
              <>
                <Button size="sm" variant="outline" asChild>
                  <Link to={`/clans/${clan.id}/heritage/${item.id}/edit`}>
                    <IconPencil className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Sửa</span>
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="destructive-outline"
                  onClick={() =>
                    askConfirm({
                      title: "Xoá mục di sản này?",
                      description: "Xoá cả ảnh và ghi âm kèm theo.",
                      confirmLabel: "Xoá",
                      destructive: true,
                    }).then((ok) => ok && deleteM.mutate())
                  }
                >
                  <IconTrash className="h-4 w-4 sm:mr-1" /><span className="hidden sm:inline">Xoá</span>
                </Button>
              </>
            )}
          </div>
        }
      />

      {/* Ảnh */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={<IconCamera className="h-4 w-4" />}>
            Hình ảnh{photos.length > 0 ? ` (${photos.length}/${MAX_PHOTOS})` : ""}
          </SectionTitle>
          {canEdit && (
            <>
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhotoM.mutate(f); e.target.value = ""; }} />
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPhotoM.mutate(f); e.target.value = ""; }} />
              <div className="flex flex-wrap justify-end gap-2 w-full sm:w-auto">
                <Button size="sm" disabled={uploadPhotoM.isPending || photos.length >= MAX_PHOTOS || overQuota}
                  onClick={() => cameraRef.current?.click()}>
                  <IconCamera className="h-4 w-4 mr-1" /> Chụp ảnh
                </Button>
                <Button size="sm" variant="outline" disabled={uploadPhotoM.isPending || photos.length >= MAX_PHOTOS || overQuota}
                  onClick={() => fileRef.current?.click()}>
                  <IconPlus className="h-4 w-4 mr-1" /> {uploadPhotoM.isPending ? "Đang tải…" : "Tải ảnh"}
                </Button>
                <Button size="sm" variant="outline"
                  disabled={addPhotoLinkM.isPending || photos.length >= MAX_PHOTOS}
                  title="Dán link ảnh có sẵn trên mạng — không tốn dung lượng"
                  onClick={() => {
                    const u = window.prompt("Dán link ảnh (https://…):");
                    if (u?.trim()) addPhotoLinkM.mutate(u.trim());
                  }}>
                  <IconLink className="h-4 w-4 mr-1" /> Liên kết ngoài
                </Button>
              </div>
            </>
          )}
        </CardHeader>
        <CardContent>
          {photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có ảnh.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((ph) => (
                <div key={ph.id} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  {srcOf(ph) ? (
                    <button
                      type="button"
                      onClick={() => setLightboxIdx(lightboxIndexOf(ph))}
                      className="h-full w-full cursor-zoom-in"
                      aria-label="Xem ảnh lớn"
                    >
                      <img src={srcOf(ph)} alt={ph.caption ?? ""} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                    </button>
                  ) : (
                    <div className="h-full w-full grid place-items-center">
                      <IconScroll className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {canEdit && (
                    <button type="button" onClick={() => removeMediaM.mutate({ id: ph.id, path: ph.path })}
                      className="absolute top-1 right-1 rounded-full bg-background/80 p-1 hover:bg-background" aria-label="Xoá ảnh">
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ghi âm kể chuyện */}
      <Card>
        <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
          <SectionTitle icon={<IconMicrophone className="h-4 w-4" />}>
            Ghi âm kể chuyện{audios.length > 0 ? ` (${audios.length}/${MAX_AUDIO})` : ""}
          </SectionTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {audios.length > 0 && (
            <ul className="space-y-2">
              {audios.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <audio controls preload="none" src={srcOf(a)} className="h-9 flex-1 min-w-0" />
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDuration(a.duration_sec)}</span>
                  {canEdit && (
                    <button type="button" aria-label="Xoá ghi âm" onClick={() => removeMediaM.mutate({ id: a.id, path: a.path })}
                      className="shrink-0 text-muted-foreground hover:text-foreground">
                      <IconX className="h-4 w-4" />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canEdit && audios.length < MAX_AUDIO && !overQuota && (
            <AudioRecorder
              disabled={uploadAudioM.isPending}
              onSave={(blob, ext, durationSec) => uploadAudioM.mutate({ blob, ext, durationSec })}
            />
          )}
          {canEdit && overQuota && (
            <p className="text-sm text-red-600">
              Dòng họ đã dùng hết {formatBytes(HERITAGE_CLAN_QUOTA_BYTES)} — hãy xoá bớt ảnh/ghi âm cũ trước khi thêm.
            </p>
          )}
          {audios.length === 0 && !canEdit && (
            <p className="text-sm text-muted-foreground">Chưa có ghi âm.</p>
          )}
        </CardContent>
      </Card>

      {/* Video (chỉ qua link ngoài) */}
      {videos.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle icon={<IconPlay className="h-4 w-4" />}>Video</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {videos.map((v) => {
              const embed = videoEmbedUrl(v.external_url ?? "");
              return (
                <div key={v.id} className="space-y-1">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      {embed ? (
                        <iframe
                          src={embed}
                          title="Video di sản"
                          className="aspect-video w-full rounded-md border"
                          allow="encrypted-media; picture-in-picture; fullscreen"
                          allowFullScreen
                          referrerPolicy="strict-origin-when-cross-origin"
                        />
                      ) : (
                        <video controls preload="none" src={srcOf(v)} className="w-full rounded-md border" />
                      )}
                    </div>
                    {canEdit && (
                      <button type="button" aria-label="Xoá video" onClick={() => removeMediaM.mutate({ id: v.id, path: v.path })}
                        className="shrink-0 text-muted-foreground hover:text-foreground">
                        <IconX className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Thêm liên kết ngoài — không tốn dung lượng VPS */}
      {canEdit && (
        <Card>
          <CardHeader>
            <SectionTitle icon={<IconLink className="h-4 w-4" />}>Thêm liên kết ngoài</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Dán link ảnh / video / âm thanh đã đăng ở nơi khác. <strong>Không tính vào dung lượng</strong> của họ —
              dùng khi đã đầy, hoặc muốn nhúng video YouTube.
            </p>
            <div className="flex flex-wrap gap-2">
              <Select
                value={extKind}
                onChange={(e) => { setExtKind(e.target.value as HeritageMediaKind); setExtErr(null); }}
                icon={<IconPlay />}
                className="h-11 w-auto"
                aria-label="Loại nội dung"
              >
                <option value="video">Video</option>
                <option value="photo">Ảnh</option>
                <option value="audio">Âm thanh</option>
              </Select>
              {/* Một hành động duy nhất → nằm TRONG ô, xem
                  docs/design-language.md §Đặt hành động ở đâu. */}
              <div className="min-w-[220px] flex-1">
                <Input
                  value={extUrl}
                  onChange={(e) => { setExtUrl(e.target.value); setExtErr(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && extUrl.trim() && !addExternalM.isPending) {
                      e.preventDefault();
                      addExternalM.mutate();
                    }
                  }}
                  placeholder="Dán link https://… vào đây"
                  inputMode="url"
                  icon={<IconLink />}
                  className="h-11"
                  action={
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => addExternalM.mutate()}
                      disabled={addExternalM.isPending || !extUrl.trim()}
                      aria-label="Thêm link"
                      title="Thêm link"
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
              <summary className="cursor-pointer font-medium">Hướng dẫn lấy link (bấm để xem)</summary>
              <div className="mt-2 space-y-2 text-muted-foreground">
                <p><strong>🎬 Video → YouTube</strong>: tải video lên youtube.com, đặt chế độ "Không công khai (Unlisted)", rồi sao chép link trên thanh địa chỉ (dạng <code>https://youtu.be/…</code>). Dán vào đây.</p>
                <p><strong>🖼 Ảnh → Google Drive / Google Photos</strong>: tải ảnh lên, bấm "Chia sẻ" → "Bất kỳ ai có liên kết", rồi copy link. (Hoặc dùng dịch vụ ảnh có link trực tiếp như imgur.com.)</p>
                <p><strong>🔊 Âm thanh</strong>: tải file lên Google Drive (chia sẻ công khai) rồi dán link; hoặc dùng link file <code>.mp3</code> trực tiếp.</p>
                <p className="text-xs">Lưu ý: link phải bắt đầu bằng <code>https://</code> và để chế độ ai có link đều xem được, nếu không người trong họ sẽ không mở được.</p>
              </div>
            </details>
          </CardContent>
        </Card>
      )}

      {/* Nội dung */}
      {(item.summary || item.body || sections.length > 0) && (
        <Card>
          <CardHeader>
            <SectionTitle icon={<IconScroll className="h-4 w-4" />}>Nội dung</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {item.summary && <p className="text-base font-medium">{item.summary}</p>}

            {/* Kiểu cũ: 1 ô body (khi chưa chia đoạn) */}
            {sections.length === 0 && item.body && (
              <div>
                <p
                  className={`whitespace-pre-wrap text-base leading-relaxed ${
                    bodyExpanded ? "" : "line-clamp-6"
                  }`}
                >
                  {item.body}
                </p>
                {(item.body.length > 300 ||
                  (item.body.match(/\n/g)?.length ?? 0) > 5) && (
                  <button
                    type="button"
                    onClick={() => setBodyExpanded((v) => !v)}
                    className="mt-1.5 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    {bodyExpanded ? (
                      <><IconChevronUp className="h-4 w-4" /> Thu gọn</>
                    ) : (
                      <><IconChevronDown className="h-4 w-4" /> Xem thêm</>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* Kiểu mới: nhiều đoạn — mục lục + accordion */}
            {sections.length > 0 && (
              <>
                {sections.length > 1 && (
                  <nav className="rounded-md border bg-muted/30 p-3">
                    <p className="mb-1.5 text-sm font-medium">Mục lục</p>
                    <ol className="list-decimal space-y-0.5 pl-5 text-sm">
                      {sections.map((s, i) => (
                        <li key={i}>
                          <button
                            type="button"
                            className="text-left text-primary hover:underline"
                            onClick={() => {
                              setOpenSecs((prev) => new Set(prev).add(i));
                              document
                                .getElementById(`hsec-${i}`)
                                ?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                          >
                            {s.heading || `Đoạn ${i + 1}`}
                          </button>
                        </li>
                      ))}
                    </ol>
                  </nav>
                )}
                <div className="space-y-2">
                  {sections.map((s, i) => {
                    const open = openSecs.has(i);
                    return (
                      <div key={i} id={`hsec-${i}`} className="scroll-mt-4 rounded-md border">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenSecs((prev) => {
                              const n = new Set(prev);
                              if (n.has(i)) n.delete(i);
                              else n.add(i);
                              return n;
                            })
                          }
                          className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left font-medium"
                        >
                          <span>{s.heading || `Đoạn ${i + 1}`}</span>
                          {open ? (
                            <IconChevronUp className="h-4 w-4 shrink-0" />
                          ) : (
                            <IconChevronDown className="h-4 w-4 shrink-0" />
                          )}
                        </button>
                        {open && (
                          <p className="whitespace-pre-wrap px-3 pb-3 text-base leading-relaxed">
                            {s.body}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Thông tin nơi (place) */}
      {item.category === "place" && (item.location_name || item.address || item.built_year || dir) && (
        <Card>
          <CardHeader>
            <SectionTitle icon={<IconMapPin className="h-4 w-4" />}>Thông tin</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-base">
            <Row label="Ở đâu" value={item.location_name} />
            <Row label="Địa chỉ" value={item.address} />
            {item.built_year && <Row label="Lập / xây năm" value={String(item.built_year)} />}
          </CardContent>
          {dir && (
            <CardFooter className="border-t pt-4">
              <Button size="sm" variant="outline" asChild>
                <a href={dir} target="_blank" rel="noopener noreferrer">
                  <IconMapPin className="h-4 w-4 mr-1" /> Chỉ đường
                </a>
              </Button>
            </CardFooter>
          )}
        </Card>
      )}

      {/* Người liên quan */}
      {item.people.length > 0 && (
        <Card>
          <CardHeader>
            <SectionTitle icon={<IconUser className="h-4 w-4" />}>Người liên quan ({item.people.length})</SectionTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5">
              {item.people.map((p) => (
                <li key={p.link_id}>
                  <Link to={`/clans/${clan.id}/people/${p.person_id}`}
                    className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors">
                    <PersonAvatar gender={p.gender} photoUrl={null} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{p.full_name}</p>
                      {p.role_note && <p className="text-xs text-muted-foreground truncate">{p.role_note}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={qrUrl}
        loading={qrM.isPending}
        title={item.title}
        description="Quét QR để xem mục di sản này — chia sẻ với con cháu trong họ."
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
          index={lightboxIdx}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

/** Tiêu đề mục: huy hiệu icon (màu đồng) + chữ serif — đồng nhất, trang nhã. */
function SectionTitle({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <CardTitle className="inline-flex items-center gap-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent/15 text-accent">
        {icon}
      </span>
      <span className="clan-name text-xl font-semibold">{children}</span>
    </CardTitle>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-3">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 flex-1 break-words">{value}</span>
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
    return <p className="text-sm text-muted-foreground">Thiết bị/trình duyệt này không hỗ trợ ghi âm.</p>;
  }

  if (rec.state === "recorded" && rec.result) {
    return (
      <div className="space-y-2 rounded-md border p-3">
        <p className="text-sm font-medium">Nghe thử trước khi lưu ({fmtDuration(rec.result.durationSec)}):</p>
        <audio controls src={rec.result.url} className="w-full" />
        <div className="flex gap-2">
          <Button size="sm" disabled={disabled}
            onClick={() => { onSave(rec.result!.blob, rec.result!.ext, rec.result!.durationSec); rec.reset(); }}>
            <IconCheck className="h-4 w-4 mr-1.5" />
            {disabled ? "Đang lưu…" : "Lưu đoạn này"}
          </Button>
          <Button size="sm" variant="ghost" onClick={rec.reset} disabled={disabled}>
            <IconMicrophone className="h-4 w-4 mr-1.5" />
            Ghi lại
          </Button>
        </div>
      </div>
    );
  }

  if (rec.state === "recording") {
    return (
      <div className="flex items-center gap-3 rounded-md border p-3">
        <span className="inline-flex items-center gap-2 text-base font-medium text-red-600">
          <span className="h-3 w-3 animate-pulse rounded-full bg-red-600" />
          Đang ghi… {fmtDuration(rec.seconds)} / {fmtDuration(rec.maxSeconds)}
        </span>
        <Button size="sm" variant="outline" className="ml-auto" onClick={rec.stop}>
          <IconPlay className="h-4 w-4 mr-1.5" />
          Dừng &amp; nghe lại
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <Button type="button" variant="outline" onClick={rec.start} disabled={disabled}>
        <IconMicrophone className="h-4 w-4 mr-1.5" /> Bắt đầu ghi âm
      </Button>
      {rec.error && <p className="text-sm text-red-600">{rec.error}</p>}
      <p className="text-sm text-muted-foreground">Tối đa {Math.round(HERITAGE_AUDIO_MAX_SEC / 60)} phút mỗi đoạn. Hãy kể tự nhiên bằng lời của bạn.</p>
    </div>
  );
}
