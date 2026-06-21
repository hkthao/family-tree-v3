import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { IconCheck, IconGrave, IconMapPin, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { PersonAvatar } from "@/components/PersonAvatar";
import { useToast } from "@/components/Toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { useClanContext } from "@/hooks/useClanContext";
import { queryKeys } from "@/lib/queries/keys";
import { getKinshipIndex } from "@/lib/queries/kinship";
import {
  ADDRESS_PLACEHOLDER,
  addOccupant,
  createRestingPlace,
  getRestingPlace,
  KIND_LOCATION_LABELS,
  removeOccupant,
  RESTING_PLACE_KIND_LABEL,
  RESTING_PLACE_STATUS_LABEL,
  updateRestingPlace,
  type RestingPlaceKind,
  type RestingPlaceStatus,
} from "@/lib/queries/restingPlaces";
import { matchesName } from "@/lib/unaccent";

const KINDS = Object.keys(RESTING_PLACE_KIND_LABEL) as RestingPlaceKind[];
const STATUSES = Object.keys(RESTING_PLACE_STATUS_LABEL) as RestingPlaceStatus[];

interface StagedOccupant {
  personId: string;
  name: string;
  gender: "M" | "F";
  occupantId: string | null; // set if already saved (edit mode)
}

export default function RestingPlaceForm() {
  const { clan } = useClanContext();
  const { graveId } = useParams<{ graveId?: string }>();
  const isEdit = !!graveId;
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const navigate = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();

  const [kind, setKind] = useState<RestingPlaceKind>("grave");
  const [name, setName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [locationDetail, setLocationDetail] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [orientation, setOrientation] = useState("");
  const [status, setStatus] = useState<RestingPlaceStatus>("existing");
  const [builtYear, setBuiltYear] = useState("");
  const [material, setMaterial] = useState("");
  const [notes, setNotes] = useState("");
  const [occupants, setOccupants] = useState<StagedOccupant[]>([]);
  const [origOccupants, setOrigOccupants] = useState<StagedOccupant[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerFilter, setPickerFilter] = useState("");

  // Load existing (edit)
  const { data: existing } = useQuery({
    queryKey: ["resting-place", graveId, userId],
    queryFn: () => getRestingPlace(graveId!),
    enabled: isEdit,
  });
  useEffect(() => {
    if (!existing) return;
    setKind(existing.kind);
    setName(existing.name ?? "");
    setLocationName(existing.location_name ?? "");
    setLocationDetail(existing.location_detail ?? "");
    setAddress(existing.address ?? "");
    setLat(existing.latitude != null ? String(existing.latitude) : "");
    setLng(existing.longitude != null ? String(existing.longitude) : "");
    setOrientation(existing.orientation ?? "");
    setStatus(existing.status);
    setBuiltYear(existing.built_year != null ? String(existing.built_year) : "");
    setMaterial(existing.material ?? "");
    setNotes(existing.notes ?? "");
    const occ = existing.occupants.map((o) => ({
      personId: o.person_id, name: o.full_name, gender: o.gender, occupantId: o.occupant_id,
    }));
    setOccupants(occ);
    setOrigOccupants(occ);
  }, [existing]);

  const { data: clanIndex } = useQuery({
    queryKey: queryKeys.kinshipIndex(clan.id, userId),
    queryFn: () => getKinshipIndex(clan.id),
    enabled: !!userId && pickerOpen,
    staleTime: 5 * 60_000,
  });
  const candidates = useMemo(() => {
    if (!clanIndex) return [];
    const taken = new Set(occupants.map((o) => o.personId));
    return clanIndex.ordered
      .filter((p) => !taken.has(p.id) && matchesName(p.full_name, pickerFilter))
      .slice(0, 50);
  }, [clanIndex, occupants, pickerFilter]);

  const labels = KIND_LOCATION_LABELS[kind];

  const save = useMutation({
    mutationFn: async () => {
      const fields = {
        kind,
        name: name.trim() || null,
        location_name: locationName.trim() || null,
        location_detail: labels.detail ? locationDetail.trim() || null : null,
        address: address.trim() || null,
        latitude: lat.trim() ? Number(lat) : null,
        longitude: lng.trim() ? Number(lng) : null,
        orientation: kind === "grave" ? orientation.trim() || null : null,
        status,
        built_year: builtYear.trim() ? Math.floor(Number(builtYear)) : null,
        material: material.trim() || null,
        notes: notes.trim() || null,
      };
      let id = graveId ?? "";
      if (isEdit) {
        await updateRestingPlace(id, fields);
        // diff occupants
        const stagedIds = new Set(occupants.map((o) => o.personId));
        const origIds = new Set(origOccupants.map((o) => o.personId));
        for (const o of occupants) if (!origIds.has(o.personId)) await addOccupant(id, o.personId);
        for (const o of origOccupants)
          if (!stagedIds.has(o.personId) && o.occupantId) await removeOccupant(o.occupantId);
      } else {
        const res = await createRestingPlace(clan.id, fields);
        id = res.id;
        for (const o of occupants) await addOccupant(id, o.personId);
      }
      return id;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["resting-places", clan.id] });
      qc.invalidateQueries({ queryKey: ["resting-place", id] });
      toast.success(isEdit ? "Đã lưu" : "Đã thêm");
      navigate(`/clans/${clan.id}/graves/${id}`);
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      toast.error("Trình duyệt không hỗ trợ định vị");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLng(pos.coords.longitude.toFixed(6));
        toast.success("Đã lấy vị trí hiện tại");
      },
      () => toast.error("Không lấy được vị trí (cần cấp quyền định vị)"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  const back = isEdit ? `/clans/${clan.id}/graves/${graveId}` : `/clans/${clan.id}/graves`;

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Mộ phần & tro cốt", to: `/clans/${clan.id}/graves` },
          { label: isEdit ? "Sửa" : "Thêm" },
        ]}
      />
      <PageHeader
        icon={<IconGrave className="h-7 w-7" />}
        title={isEdit ? "Sửa nơi an nghỉ" : "Thêm nơi an nghỉ"}
      />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFormError(null);
          if (!locationName.trim() && !name.trim()) {
            setFormError("Cần ít nhất tên hoặc nơi (nghĩa trang / chùa…).");
            return;
          }
          save.mutate();
        }}
        className="space-y-6"
      >
        {/* Hình thức + Trạng thái — 2 trường ngắn, ghép 1 hàng */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="kind">Hình thức</Label>
            <select
              id="kind"
              value={kind}
              onChange={(e) => setKind(e.target.value as RestingPlaceKind)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>{RESTING_PLACE_KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Trạng thái</Label>
            <select id="status" value={status} onChange={(e) => setStatus(e.target.value as RestingPlaceStatus)}
              className="h-12 w-full rounded-md border border-input bg-background px-3 text-sm">
              {STATUSES.map((s) => <option key={s} value={s}>{RESTING_PLACE_STATUS_LABEL[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="name">Tên gọi (tuỳ chọn)</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="vd: Mộ cụ Tổ, Tháp họ Cao" maxLength={200} />
        </div>

        {/* Nơi + vị trí chi tiết — ghép 1 hàng khi có cả hai */}
        <div className={labels.detail ? "grid gap-4 sm:grid-cols-2" : "space-y-2"}>
          <div className="space-y-2">
            <Label htmlFor="loc-name">{labels.name}</Label>
            <Input id="loc-name" value={locationName} onChange={(e) => setLocationName(e.target.value)} placeholder={labels.namePh} />
          </div>
          {labels.detail && (
            <div className="space-y-2">
              <Label htmlFor="loc-detail">{labels.detail}</Label>
              <Input id="loc-detail" value={locationDetail} onChange={(e) => setLocationDetail(e.target.value)} placeholder={labels.detailPh} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="address">Địa chỉ</Label>
          <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder={ADDRESS_PLACEHOLDER} />
        </div>

        <div className="space-y-2">
          <Label>Toạ độ GPS (tuỳ chọn)</Label>
          <div className="flex flex-wrap items-center gap-2">
            <Input className="w-32" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} placeholder="vĩ độ" />
            <Input className="w-32" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} placeholder="kinh độ" />
            <Button type="button" variant="outline" onClick={useCurrentLocation}>
              <IconMapPin className="h-4 w-4 mr-1" /> Lấy vị trí hiện tại
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Đứng tại nơi an nghỉ rồi bấm "Lấy vị trí hiện tại" để lưu toạ độ chỉ đường.</p>
        </div>

        {/* Các trường ngắn còn lại — ghép lưới 2 cột */}
        <div className="grid gap-4 sm:grid-cols-2">
          {kind === "grave" && (
            <div className="space-y-2">
              <Label htmlFor="orientation">Hướng mộ (tuỳ chọn)</Label>
              <Input id="orientation" value={orientation} onChange={(e) => setOrientation(e.target.value)} placeholder="vd: hướng Đông Nam" />
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="year">Năm xây (tuỳ chọn)</Label>
            <Input id="year" inputMode="numeric" value={builtYear} onChange={(e) => setBuiltYear(e.target.value)} placeholder="vd: 1990" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="material">Vật liệu (tuỳ chọn)</Label>
            <Input id="material" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="vd: đá granit, xi măng" />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="notes">Ghi chú</Label>
          <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            placeholder="vd: năm cải táng, người trông coi, lối vào, ghi chú dòng tộc…"
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-base" />
        </div>

        {/* Người an nghỉ */}
        <div className="space-y-2">
          <Label className="block">Người an nghỉ tại đây</Label>
          {occupants.length > 0 && (
            <ul className="space-y-1.5">
              {occupants.map((o) => (
                <li key={o.personId} className="flex items-center gap-2 rounded-md border bg-card px-3 py-2">
                  <PersonAvatar gender={o.gender} size={28} />
                  <span className="flex-1 truncate text-sm">{o.name}</span>
                  <button type="button" aria-label="Bỏ" onClick={() => setOccupants((p) => p.filter((x) => x.personId !== o.personId))}>
                    <IconX className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {!pickerOpen ? (
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              Gắn người
            </Button>
          ) : (
            <div className="space-y-2 rounded-md border p-2">
              <Input value={pickerFilter} onChange={(e) => setPickerFilter(e.target.value)} placeholder="Gõ tên để tìm (không cần dấu)" autoFocus />
              <ul className="max-h-60 overflow-y-auto divide-y text-sm">
                {candidates.length === 0 && <li className="px-2 py-2 text-muted-foreground italic">{clanIndex ? "Không có người khớp." : "Đang tải…"}</li>}
                {candidates.map((p) => (
                  <li key={p.id}>
                    <button type="button" className="w-full text-left px-2 py-2 flex items-center gap-2 hover:bg-muted/50"
                      onClick={() => {
                        setOccupants((prev) => [...prev, { personId: p.id, name: p.full_name, gender: p.gender, occupantId: null }]);
                        setPickerFilter("");
                      }}>
                      <PersonAvatar gender={p.gender} size={28} />
                      <span className="truncate">{p.full_name}</span>
                      {p.birth_year && <span className="text-xs text-muted-foreground ml-auto">{p.birth_year}</span>}
                    </button>
                  </li>
                ))}
              </ul>
              <Button type="button" size="sm" variant="ghost" onClick={() => setPickerOpen(false)}>Xong</Button>
            </div>
          )}
        </div>

        {formError && <Alert variant="destructive"><AlertDescription>{formError}</AlertDescription></Alert>}

        <div className="flex gap-3 justify-end pt-2">
          <Button type="submit" variant="outline" disabled={save.isPending}>
            <IconCheck className="h-4 w-4 mr-1.5" />
            {save.isPending ? "Đang lưu…" : "Lưu"}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(back)}>
            <IconX className="h-4 w-4 mr-1.5" /> Hủy
          </Button>
        </div>
      </form>
    </div>
  );
}
