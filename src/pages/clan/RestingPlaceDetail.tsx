import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DatePicker } from "@/components/ui/date-picker";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import {
  Article,
  ArticleActionBar,
  ArticleFactBox,
  ArticleFigure,
  ArticleHeader,
  ArticleList,
  ArticleProse,
  ArticleSection,
} from "@/components/Article";
import { PanelLink } from "@/components/panel/PanelLink";
import { Breadcrumb } from "@/components/Breadcrumb";
import { ImageLightbox } from "@/components/ImageLightbox";
import { PersonViewLink } from "@/components/panel/PersonViewLink";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconBell,
  IconCalendar,
  IconCheck,
  IconGrave,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconQrCode,
  IconScroll,
  IconTrash,
  IconX,
} from "@/components/icons";
import { PersonAvatar } from "@/components/PersonAvatar";
import { QrCodeModal } from "@/components/QrCodeModal";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { DrawerViewActions } from "@/components/ui/form-actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import {
  canEditClan,
  isClanAdmin,
  useClanContext,
} from "@/hooks/useClanContext";
import { formatDate } from "@/lib/formatDate";
import { createEvent } from "@/lib/queries/events";
import { getOrCreateRestingPlaceShareLink } from "@/lib/queries/share-links";
import {
  getSignedPhotoUrlMap,
  PHOTO_URL_STALE_MS,
  uploadRestingPlacePhoto,
} from "@/lib/photoUpload";
import {
  addPhoto,
  addRelocation,
  deleteRestingPlace,
  directionsUrl,
  getRestingPlace,
  removePhoto,
  removeRelocation,
  RESTING_PLACE_KIND_LABEL,
  RESTING_PLACE_STATUS_LABEL,
} from "@/lib/queries/restingPlaces";

import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
// Giới hạn ảnh / nơi an nghỉ — chặn phình dung lượng storage Supabase.
const MAX_GRAVE_PHOTOS = 12;

/** Hiện trong ngăn kéo XEM (thay cho form khoá ô): lấy id từ đây, bỏ breadcrumb, xoá xong thì đóng ngăn kéo. */
export interface EmbeddedRestingPlace {
  id: string;
  onClose: () => void;
}

export default function RestingPlaceDetail({
  embedded,
}: { embedded?: EmbeddedRestingPlace } = {}) {
  const { clan } = useClanContext();
  const { graveId: routeId } = useParams<{ graveId: string }>();
  const graveId = embedded?.id ?? routeId;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const askConfirm = useConfirm();
  const canEdit = canEditClan(clan);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: place, isLoading } = useQuery({
    queryKey: ["resting-place", graveId, userId],
    queryFn: () => getRestingPlace(graveId!),
    enabled: !!graveId,
  });

  const { data: photoUrls } = useQuery({
    queryKey: [
      "resting-place-photos",
      graveId,
      (place?.photos ?? []).map((p) => p.path).join(","),
    ],
    queryFn: () =>
      getSignedPhotoUrlMap((place?.photos ?? []).map((p) => p.path)),
    enabled: !!place && place.photos.length > 0,
    staleTime: PHOTO_URL_STALE_MS,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["resting-place", graveId] });

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const sort = place?.photos.length ?? 0;
      if (sort >= MAX_GRAVE_PHOTOS)
        throw new Error(t`Tối đa ${MAX_GRAVE_PHOTOS} ảnh mỗi nơi an nghỉ.`);
      const { path } = await uploadRestingPlacePhoto(clan.id, graveId!, file);
      await addPhoto(graveId!, path, null, sort);
    },
    onSuccess: () => {
      invalidate();
      toast.success(t`Đã thêm ảnh`);
    },
    onError: (e) =>
      toast.error(t`Không thêm được ảnh`, {
        description: (e as Error).message,
      }),
  });

  const removePhotoM = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) =>
      removePhoto(id, path),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(t`Không xoá được ảnh`, { description: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteRestingPlace(graveId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resting-places", clan.id] });
      toast.success(t`Đã xoá`);
      if (embedded) embedded.onClose();
      else navigate(`/clans/${clan.id}/graves`);
    },
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  // Đặt nhắc tảo mộ / chạp họ — tạo 1 sự kiện âm-lịch lặp hằng năm gắn
  // với nơi an nghỉ này (tái dùng hệ events + notify-events).
  const [reminderOpen, setReminderOpen] = useState(false);
  const [rTitle, setRTitle] = useState("");
  const [rMonth, setRMonth] = useState("");
  const [rDay, setRDay] = useState("");
  const reminderM = useMutation({
    mutationFn: () =>
      createEvent({
        clan_id: clan.id,
        title: rTitle.trim(),
        event_type: "tomb_visit",
        resting_place_id: graveId!,
        lunar_month: Number(rMonth),
        lunar_day: Number(rDay),
        is_yearly: true,
      }),
    onSuccess: () => {
      toast.success(t`Đã đặt nhắc tảo mộ / chạp họ`, {
        description: t`Cả họ theo dõi sẽ được nhắc trước (xem ở Sự kiện).`,
      });
      setReminderOpen(false);
      setRTitle("");
      setRMonth("");
      setRDay("");
    },
    onError: (e) =>
      toast.error(t`Không đặt được`, { description: (e as Error).message }),
  });
  const canRemind =
    rTitle.trim() &&
    Number(rMonth) >= 1 &&
    Number(rMonth) <= 12 &&
    Number(rDay) >= 1 &&
    Number(rDay) <= 30;

  // Lịch sử cải táng
  const [relOpen, setRelOpen] = useState(false);
  const [relFrom, setRelFrom] = useState("");
  const [relDate, setRelDate] = useState("");
  const [relNote, setRelNote] = useState("");
  const addRelM = useMutation({
    mutationFn: () =>
      addRelocation(graveId!, {
        from_label: relFrom.trim() || null,
        moved_on: relDate || null,
        note: relNote.trim() || null,
      }),
    onSuccess: () => {
      invalidate();
      toast.success(t`Đã thêm lần cải táng`);
      setRelOpen(false);
      setRelFrom("");
      setRelDate("");
      setRelNote("");
    },
    onError: (e) =>
      toast.error(t`Không thêm được`, { description: (e as Error).message }),
  });
  const removeRelM = useMutation({
    mutationFn: (id: string) => removeRelocation(id),
    onSuccess: invalidate,
    onError: (e) =>
      toast.error(t`Không xoá được`, { description: (e as Error).message }),
  });

  // QR tại mộ (clan admin) — public share link of this resting place.
  const canAdmin = isClanAdmin(clan);
  const [qrOpen, setQrOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const qrM = useMutation({
    mutationFn: () => getOrCreateRestingPlaceShareLink(clan.id, graveId!),
    onError: (e) =>
      toast.error(t`Không tạo được QR`, { description: (e as Error).message }),
  });
  const qrUrl = qrM.data
    ? `${window.location.origin}/share/${qrM.data.token}`
    : "";

  if (isLoading) return <p className="text-muted-foreground">{t`Đang tải…`}</p>;
  if (!place)
    return <p className="text-muted-foreground">{t`Không tìm thấy.`}</p>;

  const dir = directionsUrl(place.latitude, place.longitude);
  const title =
    place.name || place.location_name || RESTING_PLACE_KIND_LABEL[place.kind];

  // Ảnh: ảnh đầu tiên là ảnh lớn đầu bài; mục "Hình ảnh" cuối bài chỉ hiện khi còn ảnh khác / người sửa cần quản lý.
  const canEditMedia = canEdit && !embedded;
  const photoImages = place.photos.flatMap((ph) => {
    const src = photoUrls?.get(ph.path);
    return src ? [{ src, caption: ph.caption }] : [];
  });
  const cover = place.photos.find((ph) => photoUrls?.get(ph.path));
  const coverSrc = cover ? photoUrls?.get(cover.path) : undefined;
  const photosBlock = (
    <>
      {(place.photos.length > 1 || canEditMedia) && (
        <ArticleSection
          title={t`Hình ảnh`}
          aside={
            place.photos.length > 0
              ? `${place.photos.length}/${MAX_GRAVE_PHOTOS}`
              : undefined
          }
        >
          {place.photos.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">{t`Chưa có ảnh.`}</p>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {place.photos.map((ph) => (
                <div
                  key={ph.id}
                  className="relative aspect-square overflow-hidden rounded-md bg-muted"
                >
                  {photoUrls?.get(ph.path) ? (
                    <button
                      type="button"
                      className="block h-full w-full cursor-zoom-in"
                      onClick={() =>
                        setLightboxIdx(
                          photoImages.findIndex(
                            (im) => im.src === photoUrls.get(ph.path),
                          ),
                        )
                      }
                      aria-label={t`Xem ảnh lớn`}
                    >
                      <img
                        src={photoUrls.get(ph.path)}
                        alt={ph.caption ?? ""}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ) : (
                    <div className="grid h-full w-full place-items-center">
                      <IconGrave className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {canEditMedia && (
                    <button
                      type="button"
                      onClick={() =>
                        removePhotoM.mutate({ id: ph.id, path: ph.path })
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
            <div className="mt-3 flex justify-end font-sans">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadM.mutate(f);
                  e.target.value = "";
                }}
              />
              <Button
                size="sm"
                variant="outline"
                disabled={
                  uploadM.isPending || place.photos.length >= MAX_GRAVE_PHOTOS
                }
                onClick={() => fileRef.current?.click()}
                title={
                  place.photos.length >= MAX_GRAVE_PHOTOS
                    ? t`Tối đa ${MAX_GRAVE_PHOTOS} ảnh`
                    : undefined
                }
              >
                <IconPlus className="h-4 w-4 mr-1" />
                {uploadM.isPending ? t`Đang tải…` : t`Thêm ảnh`}
              </Button>
            </div>
          )}
        </ArticleSection>
      )}
    </>
  );

  // Thanh dính đáy (Xoá → QR → Sửa): ngăn kéo — DrawerViewActions; trang đầy đủ — ArticleActionBar.
  const actionButtons = (
    <>
      {canAdmin && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setQrOpen(true);
            if (!qrM.data) qrM.mutate();
          }}
        >
          <IconQrCode className="h-4 w-4 mr-1" /> QR
        </Button>
      )}
      <Button size="sm" className="order-last" asChild>
        <PanelLink
          to={`/clans/${clan.id}/graves/${place.id}/edit`}
          panel="grave-edit"
          panelParams={{ pid: place.id }}
        >
          <IconPencil className="h-4 w-4 mr-1" /> {t`Sửa`}
        </PanelLink>
      </Button>
      <Button
        size="sm"
        variant="destructive-outline"
        className="order-first"
        onClick={() =>
          askConfirm({
            title: t`Xoá nơi an nghỉ này?`,
            description: t`Xoá bản ghi mộ phần / tro cốt (không xoá hồ sơ người).`,
            confirmLabel: t`Xoá`,
            destructive: true,
          }).then((ok) => ok && deleteM.mutate())
        }
      >
        <IconTrash className="h-4 w-4 mr-1" /> {t`Xoá`}
      </Button>
    </>
  );

  const names = place.occupants.map((o) => o.full_name);
  const updated = formatDate(place.updated_at);

  return (
    <div className="space-y-3">
      {!embedded && (
        <Breadcrumb
          items={[
            { label: clan.name, to: `/clans/${clan.id}` },
            { label: t`Mộ phần & tro cốt`, to: `/clans/${clan.id}/graves` },
            { label: title },
          ]}
        />
      )}

      {/* Dạng bài báo: không bọc thẻ — chuyên mục, tít, sapo (người an nghỉ), ảnh lớn, hộp thông tin, các mục. */}
      <Article>
        <ArticleHeader
          kicker={RESTING_PLACE_KIND_LABEL[place.kind]}
          title={title}
          deck={
            names.length > 0
              ? t`Nơi an nghỉ của ${names.join(", ")}.`
              : undefined
          }
          meta={[
            place.location_name !== title ? place.location_name : null,
            RESTING_PLACE_STATUS_LABEL[place.status],
            updated ? t`Cập nhật ${updated}` : null,
          ]}
        />

        {cover && coverSrc && (
          <ArticleFigure
            src={coverSrc}
            alt={cover.caption ?? title}
            caption={cover.caption}
            onOpen={() =>
              setLightboxIdx(photoImages.findIndex((im) => im.src === coverSrc))
            }
            openLabel={t`Xem ảnh lớn`}
          />
        )}

        {place.notes && (
          <ArticleSection>
            <ArticleProse>{place.notes}</ArticleProse>
          </ArticleSection>
        )}

        <ArticleFactBox
          title={t`Thông tin`}
          rows={[
            {
              label: t`Hình thức`,
              value: RESTING_PLACE_KIND_LABEL[place.kind],
            },
            {
              label: t`Cơ sở`,
              value: place.cemetery_name && (
                <Link
                  to={`/clans/${clan.id}/graves?cemetery=${place.cemetery_id}`}
                  className="text-primary hover:underline"
                >
                  {place.cemetery_name}
                </Link>
              ),
            },
            { label: t`Nơi`, value: place.location_name },
            { label: t`Vị trí chi tiết`, value: place.location_detail },
            { label: t`Địa chỉ`, value: place.address },
            { label: t`Hướng`, value: place.orientation },
            {
              label: t`Trạng thái`,
              value: RESTING_PLACE_STATUS_LABEL[place.status],
            },
            {
              label: t`Năm xây`,
              value: place.built_year ? String(place.built_year) : null,
            },
            { label: t`Vật liệu`, value: place.material },
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

        {/* Người an nghỉ */}
        <ArticleSection
          title={t`Người an nghỉ`}
          aside={String(place.occupants.length)}
        >
          {place.occupants.length === 0 ? (
            <p className="font-sans text-sm text-muted-foreground">
              {t`Chưa gắn người nào. Bấm Sửa để thêm.`}
            </p>
          ) : (
            <ArticleList>
              {place.occupants.map((o) => (
                <li key={o.occupant_id}>
                  <PersonViewLink
                    inPanel={!!embedded}
                    personId={o.person_id}
                    to={`/clans/${clan.id}/people/${o.person_id}`}
                    className="flex items-center gap-3 py-2.5 transition-colors hover:text-primary"
                  >
                    <PersonAvatar gender={o.gender} photoUrl={null} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.full_name}</p>
                      {o.note && (
                        <p className="truncate text-sm text-muted-foreground">
                          {o.note}
                        </p>
                      )}
                    </div>
                  </PersonViewLink>
                </li>
              ))}
            </ArticleList>
          )}
        </ArticleSection>

        {/* Lịch sử cải táng */}
        {(place.relocations.length > 0 || canEdit) && (
          <ArticleSection title={t`Lịch sử cải táng`}>
            <div className="space-y-3 font-sans">
              {place.relocations.length === 0 && !relOpen && (
                <p className="text-sm text-muted-foreground">
                  {t`Chưa ghi lần cải táng nào (bốc mộ / sang cát).`}
                </p>
              )}
              {place.relocations.length > 0 && (
                <ol className="space-y-2 border-l pl-4">
                  {place.relocations.map((r) => (
                    <li key={r.id} className="relative">
                      <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-base">
                            {r.moved_on && (
                              <span className="font-medium">{r.moved_on}</span>
                            )}
                            {r.from_label && (
                              <span> · cải táng từ {r.from_label}</span>
                            )}
                          </p>
                          {r.note && (
                            <p className="text-sm text-muted-foreground">
                              {r.note}
                            </p>
                          )}
                        </div>
                        {canEdit && (
                          <button
                            type="button"
                            aria-label={t`Xoá`}
                            onClick={() => removeRelM.mutate(r.id)}
                            className="shrink-0 text-muted-foreground hover:text-foreground"
                          >
                            <IconX className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
              {relOpen && (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="rel-from">
                      {t`Nơi cũ (trước khi dời về đây)`}
                    </Label>
                    <Input
                      id="rel-from"
                      icon={<IconMapPin />}
                      value={relFrom}
                      onChange={(e) => setRelFrom(e.target.value)}
                      placeholder={t`vd: Nghĩa trang X, lô 3`}
                    />
                  </div>
                  <div className="space-y-2 max-w-[200px]">
                    <Label htmlFor="rel-date">{t`Ngày cải táng (tuỳ chọn)`}</Label>
                    <DatePicker id="rel-date" value={relDate} onChange={setRelDate} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rel-note">{t`Ghi chú`}</Label>
                    <Input
                      id="rel-note"
                      icon={<IconScroll />}
                      value={relNote}
                      onChange={(e) => setRelNote(e.target.value)}
                      placeholder={t`vd: bốc mộ sang cát, người chủ trì…`}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setRelOpen(false)}
                    >
                      <IconX className="h-4 w-4 mr-1.5" />
                      {t`Huỷ`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={
                        addRelM.isPending ||
                        (!relFrom.trim() && !relDate && !relNote.trim())
                      }
                      onClick={() => addRelM.mutate()}
                    >
                      <IconCheck className="h-4 w-4 mr-1.5" />
                      {addRelM.isPending ? t`Đang lưu…` : t`Lưu`}
                    </Button>
                  </div>
                </div>
              )}
              {canEdit && !relOpen && (
                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setRelOpen(true)}
                  >
                    <IconPlus className="h-4 w-4 mr-1" /> {t`Thêm lần cải táng`}
                  </Button>
                </div>
              )}
            </div>
          </ArticleSection>
        )}

        {/* Nhắc tảo mộ / chạp họ */}
        {canEdit && (
          <ArticleSection title={t`Nhắc tảo mộ / chạp họ`}>
            <div className="space-y-3 font-sans">
              {!reminderOpen ? (
                <p className="text-sm text-muted-foreground">
                  <Trans>
                    Đặt ngày âm lịch (vd mùng 10 tháng Chạp) — cả họ theo dõi sẽ
                    được nhắc trước qua email/thông báo hằng năm.
                  </Trans>
                </p>
              ) : (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label htmlFor="r-title">{t`Tên dịp`}</Label>
                    <Input
                      id="r-title"
                      icon={<IconBell />}
                      value={rTitle}
                      onChange={(e) => setRTitle(e.target.value)}
                      maxLength={150}
                    />
                  </div>
                  <div className="grid max-w-xs grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="r-day">{t`Ngày âm`}</Label>
                      <Input
                        id="r-day"
                        icon={<IconCalendar />}
                        inputMode="numeric"
                        value={rDay}
                        onChange={(e) => setRDay(e.target.value)}
                        placeholder="1–30"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="r-month">{t`Tháng âm`}</Label>
                      <Input
                        id="r-month"
                        icon={<IconCalendar />}
                        inputMode="numeric"
                        value={rMonth}
                        onChange={(e) => setRMonth(e.target.value)}
                        placeholder="1–12"
                      />
                    </div>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2">
                {!reminderOpen ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setRTitle(t`Tảo mộ ${title}`);
                      setReminderOpen(true);
                    }}
                  >
                    <IconPlus className="h-4 w-4 mr-1" /> {t`Đặt nhắc`}
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setReminderOpen(false)}
                    >
                      <IconX className="h-4 w-4 mr-1.5" />
                      {t`Huỷ`}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={!canRemind || reminderM.isPending}
                      onClick={() => reminderM.mutate()}
                    >
                      <IconCheck className="h-4 w-4 mr-1.5" />
                      {reminderM.isPending ? t`Đang lưu…` : t`Lưu nhắc`}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </ArticleSection>
        )}

        {photosBlock}
      </Article>

      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={qrUrl}
        loading={qrM.isPending}
        title={title}
        description={t`Dán hoặc khắc QR này tại mộ / tháp — quét để xem thông tin nơi an nghỉ.`}
      />
      {lightboxIdx !== null && photoImages.length > 0 && (
        <ImageLightbox
          images={photoImages}
          index={Math.max(0, lightboxIdx)}
          onIndexChange={setLightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
      {canEdit &&
        (embedded ? (
          <DrawerViewActions>{actionButtons}</DrawerViewActions>
        ) : (
          <ArticleActionBar>{actionButtons}</ArticleActionBar>
        ))}
    </div>
  );
}
