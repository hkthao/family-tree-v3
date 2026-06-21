import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  IconBell,
  IconGrave,
  IconMapPin,
  IconPencil,
  IconPlus,
  IconQrCode,
  IconTrash,
  IconX,
} from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { QrCodeModal } from "@/components/QrCodeModal";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, isClanAdmin, useClanContext } from "@/hooks/useClanContext";
import { createEvent } from "@/lib/queries/events";
import { getOrCreateRestingPlaceShareLink } from "@/lib/queries/share-links";
import { getSignedPhotoUrlMap, uploadRestingPlacePhoto } from "@/lib/photoUpload";
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

// Giới hạn ảnh / nơi an nghỉ — chặn phình dung lượng storage Supabase.
const MAX_GRAVE_PHOTOS = 12;

export default function RestingPlaceDetail() {
  const { clan } = useClanContext();
  const { graveId } = useParams<{ graveId: string }>();
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
    queryKey: ["resting-place-photos", graveId, (place?.photos ?? []).map((p) => p.path).join(",")],
    queryFn: () => getSignedPhotoUrlMap((place?.photos ?? []).map((p) => p.path)),
    enabled: !!place && place.photos.length > 0,
  });

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["resting-place", graveId] });

  const uploadM = useMutation({
    mutationFn: async (file: File) => {
      const sort = place?.photos.length ?? 0;
      if (sort >= MAX_GRAVE_PHOTOS) throw new Error(`Tối đa ${MAX_GRAVE_PHOTOS} ảnh mỗi nơi an nghỉ.`);
      const { path } = await uploadRestingPlacePhoto(clan.id, graveId!, file);
      await addPhoto(graveId!, path, null, sort);
    },
    onSuccess: () => {
      invalidate();
      toast.success("Đã thêm ảnh");
    },
    onError: (e) => toast.error("Không thêm được ảnh", { description: (e as Error).message }),
  });

  const removePhotoM = useMutation({
    mutationFn: ({ id, path }: { id: string; path: string }) => removePhoto(id, path),
    onSuccess: invalidate,
    onError: (e) => toast.error("Không xoá được ảnh", { description: (e as Error).message }),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteRestingPlace(graveId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["resting-places", clan.id] });
      toast.success("Đã xoá");
      navigate(`/clans/${clan.id}/graves`);
    },
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
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
      toast.success("Đã đặt nhắc tảo mộ / chạp họ", {
        description: "Cả họ theo dõi sẽ được nhắc trước (xem ở Sự kiện).",
      });
      setReminderOpen(false);
      setRTitle("");
      setRMonth("");
      setRDay("");
    },
    onError: (e) => toast.error("Không đặt được", { description: (e as Error).message }),
  });
  const canRemind =
    rTitle.trim() &&
    Number(rMonth) >= 1 && Number(rMonth) <= 12 &&
    Number(rDay) >= 1 && Number(rDay) <= 30;

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
      toast.success("Đã thêm lần cải táng");
      setRelOpen(false);
      setRelFrom("");
      setRelDate("");
      setRelNote("");
    },
    onError: (e) => toast.error("Không thêm được", { description: (e as Error).message }),
  });
  const removeRelM = useMutation({
    mutationFn: (id: string) => removeRelocation(id),
    onSuccess: invalidate,
    onError: (e) => toast.error("Không xoá được", { description: (e as Error).message }),
  });

  // QR tại mộ (clan admin) — public share link of this resting place.
  const canAdmin = isClanAdmin(clan);
  const [qrOpen, setQrOpen] = useState(false);
  const qrM = useMutation({
    mutationFn: () => getOrCreateRestingPlaceShareLink(clan.id, graveId!),
    onError: (e) => toast.error("Không tạo được QR", { description: (e as Error).message }),
  });
  const qrUrl = qrM.data ? `${window.location.origin}/share/${qrM.data.token}` : "";

  if (isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!place) return <p className="text-muted-foreground">Không tìm thấy.</p>;

  const dir = directionsUrl(place.latitude, place.longitude);
  const title = place.name || place.location_name || RESTING_PLACE_KIND_LABEL[place.kind];

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Mộ phần & tro cốt", to: `/clans/${clan.id}/graves` },
          { label: title },
        ]}
      />
      <PageHeader
        icon={<IconGrave className="h-7 w-7" />}
        title={title}
        description={RESTING_PLACE_KIND_LABEL[place.kind]}
        actionsBelow
        actions={
          canEdit ? (
            <div className="flex gap-2">
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
              <Button size="sm" variant="outline" asChild>
                <Link to={`/clans/${clan.id}/graves/${place.id}/edit`}>
                  <IconPencil className="h-4 w-4 mr-1" /> Sửa
                </Link>
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  askConfirm({
                    title: "Xoá nơi an nghỉ này?",
                    description: "Xoá bản ghi mộ phần / tro cốt (không xoá hồ sơ người).",
                    confirmLabel: "Xoá",
                    destructive: true,
                  }).then((ok) => ok && deleteM.mutate())
                }
              >
                <IconTrash className="h-4 w-4 mr-1" /> Xoá
              </Button>
            </div>
          ) : undefined
        }
      />

      {/* Photos */}
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Hình ảnh{place.photos.length > 0 ? ` (${place.photos.length}/${MAX_GRAVE_PHOTOS})` : ""}</CardTitle>
          {canEdit && (
            <>
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
                disabled={uploadM.isPending || place.photos.length >= MAX_GRAVE_PHOTOS}
                onClick={() => fileRef.current?.click()}
                title={place.photos.length >= MAX_GRAVE_PHOTOS ? `Tối đa ${MAX_GRAVE_PHOTOS} ảnh` : undefined}
              >
                <IconPlus className="h-4 w-4 mr-1" />
                {uploadM.isPending ? "Đang tải…" : "Thêm ảnh"}
              </Button>
            </>
          )}
        </CardHeader>
        <CardContent>
          {place.photos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa có ảnh.</p>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {place.photos.map((ph) => (
                <div key={ph.id} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  {photoUrls?.get(ph.path) ? (
                    <img src={photoUrls.get(ph.path)} alt={ph.caption ?? ""} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full grid place-items-center">
                      <IconGrave className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removePhotoM.mutate({ id: ph.id, path: ph.path })}
                      className="absolute top-1 right-1 rounded-full bg-background/80 p-1 hover:bg-background"
                      aria-label="Xoá ảnh"
                    >
                      <IconX className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Thông tin */}
      <Card>
        <CardHeader>
          <CardTitle>Thông tin</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <Row label="Hình thức" value={RESTING_PLACE_KIND_LABEL[place.kind]} />
          <Row label="Nơi" value={place.location_name} />
          <Row label="Vị trí chi tiết" value={place.location_detail} />
          <Row label="Địa chỉ" value={place.address} />
          {place.orientation && <Row label="Hướng" value={place.orientation} />}
          <Row label="Trạng thái" value={RESTING_PLACE_STATUS_LABEL[place.status]} />
          {place.built_year && <Row label="Năm xây" value={String(place.built_year)} />}
          {place.material && <Row label="Vật liệu" value={place.material} />}
          {place.notes && <Row label="Ghi chú" value={place.notes} />}
          {dir && (
            <div className="pt-1">
              <Button size="sm" variant="outline" asChild>
                <a href={dir} target="_blank" rel="noopener noreferrer">
                  <IconMapPin className="h-4 w-4 mr-1" /> Chỉ đường
                </a>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Người an nghỉ */}
      <Card>
        <CardHeader>
          <CardTitle>Người an nghỉ ({place.occupants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {place.occupants.length === 0 ? (
            <p className="text-sm text-muted-foreground">Chưa gắn người nào. Bấm Sửa để thêm.</p>
          ) : (
            <ul className="space-y-1.5">
              {place.occupants.map((o) => (
                <li key={o.occupant_id}>
                  <Link
                    to={`/clans/${clan.id}/people/${o.person_id}`}
                    className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 hover:border-primary transition-colors"
                  >
                    <PersonAvatar gender={o.gender} photoUrl={null} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{o.full_name}</p>
                      {o.note && <p className="text-xs text-muted-foreground truncate">{o.note}</p>}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Lịch sử cải táng */}
      {(place.relocations.length > 0 || canEdit) && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Lịch sử cải táng</CardTitle>
            {canEdit && !relOpen && (
              <Button size="sm" variant="outline" onClick={() => setRelOpen(true)}>
                <IconPlus className="h-4 w-4 mr-1" /> Thêm
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {place.relocations.length === 0 && !relOpen && (
              <p className="text-sm text-muted-foreground">
                Chưa ghi lần cải táng nào (bốc mộ / sang cát).
              </p>
            )}
            {place.relocations.length > 0 && (
              <ol className="space-y-2 border-l pl-4">
                {place.relocations.map((r) => (
                  <li key={r.id} className="relative">
                    <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm">
                          {r.moved_on && (
                            <span className="font-medium">{r.moved_on}</span>
                          )}
                          {r.from_label && (
                            <span> · cải táng từ {r.from_label}</span>
                          )}
                        </p>
                        {r.note && (
                          <p className="text-xs text-muted-foreground">{r.note}</p>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          aria-label="Xoá"
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
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  addRelM.mutate();
                }}
                className="space-y-3 border-t pt-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="rel-from">Nơi cũ (trước khi dời về đây)</Label>
                  <Input id="rel-from" value={relFrom} onChange={(e) => setRelFrom(e.target.value)} placeholder="vd: Nghĩa trang X, lô 3" />
                </div>
                <div className="space-y-2 max-w-[200px]">
                  <Label htmlFor="rel-date">Ngày cải táng (tuỳ chọn)</Label>
                  <Input id="rel-date" type="date" value={relDate} onChange={(e) => setRelDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rel-note">Ghi chú</Label>
                  <Input id="rel-note" value={relNote} onChange={(e) => setRelNote(e.target.value)} placeholder="vd: bốc mộ sang cát, người chủ trì…" />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="outline" disabled={addRelM.isPending || (!relFrom.trim() && !relDate && !relNote.trim())}>
                    {addRelM.isPending ? "Đang lưu…" : "Lưu"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setRelOpen(false)}>
                    Huỷ
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      {/* Nhắc tảo mộ / chạp họ */}
      {canEdit && (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="inline-flex items-center gap-2">
              <IconBell className="h-5 w-5" /> Nhắc tảo mộ / chạp họ
            </CardTitle>
            {!reminderOpen && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRTitle(`Tảo mộ ${title}`);
                  setReminderOpen(true);
                }}
              >
                <IconPlus className="h-4 w-4 mr-1" /> Đặt nhắc
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!reminderOpen ? (
              <p className="text-sm text-muted-foreground">
                Đặt ngày âm lịch (vd mùng 10 tháng Chạp) — cả họ theo dõi sẽ
                được nhắc trước qua email/thông báo hằng năm.
              </p>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (canRemind) reminderM.mutate();
                }}
                className="space-y-3"
              >
                <div className="space-y-2">
                  <Label htmlFor="r-title">Tên dịp</Label>
                  <Input id="r-title" value={rTitle} onChange={(e) => setRTitle(e.target.value)} maxLength={150} />
                </div>
                <div className="grid grid-cols-2 gap-3 max-w-xs">
                  <div className="space-y-2">
                    <Label htmlFor="r-day">Ngày âm</Label>
                    <Input id="r-day" inputMode="numeric" value={rDay} onChange={(e) => setRDay(e.target.value)} placeholder="1–30" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="r-month">Tháng âm</Label>
                    <Input id="r-month" inputMode="numeric" value={rMonth} onChange={(e) => setRMonth(e.target.value)} placeholder="1–12" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit" size="sm" variant="outline" disabled={!canRemind || reminderM.isPending}>
                    {reminderM.isPending ? "Đang lưu…" : "Lưu nhắc"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setReminderOpen(false)}>
                    Huỷ
                  </Button>
                </div>
              </form>
            )}
          </CardContent>
        </Card>
      )}

      <QrCodeModal
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        url={qrUrl}
        loading={qrM.isPending}
        title={title}
        description="Dán hoặc khắc QR này tại mộ / tháp — quét để xem thông tin nơi an nghỉ."
      />
    </div>
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
