import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router-dom";

import { Breadcrumb } from "@/components/Breadcrumb";
import { useConfirm } from "@/components/ConfirmDialog";
import { IconGrave, IconMapPin, IconPencil, IconPlus, IconTrash, IconX } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/components/Toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { canEditClan, useClanContext } from "@/hooks/useClanContext";
import {
  createCemetery,
  deleteCemetery,
  listCemeteries,
  updateCemetery,
  type CemeteryListItem,
} from "@/lib/queries/cemeteries";

export default function Cemeteries() {
  const { clan } = useClanContext();
  const { user } = useAuth();
  const userId = user?.id ?? "";
  const qc = useQueryClient();
  const toast = useToast();
  const askConfirm = useConfirm();
  const canEdit = canEditClan(clan);

  const { data: cemeteries } = useQuery({
    queryKey: ["cemeteries", clan.id, userId],
    queryFn: () => listCemeteries(clan.id),
    enabled: !!userId,
  });

  // editing: null = closed, "new" = add form, or a cemetery being edited
  const [editing, setEditing] = useState<CemeteryListItem | "new" | null>(null);
  const invalidate = () => qc.invalidateQueries({ queryKey: ["cemeteries", clan.id] });

  return (
    <div className="space-y-3">
      <Breadcrumb
        items={[
          { label: clan.name, to: `/clans/${clan.id}` },
          { label: "Mộ phần & tro cốt", to: `/clans/${clan.id}/graves` },
          { label: "Cơ sở / nghĩa trang" },
        ]}
      />
      <PageHeader
        icon={<IconMapPin className="h-7 w-7" />}
        title="Cơ sở / nghĩa trang"
        description="Nghĩa trang, chùa, hoa viên, tháp lưu tro… để gom các mộ phần theo cơ sở."
        actionsBelow
        actions={
          canEdit && editing === null ? (
            <Button size="sm" onClick={() => setEditing("new")}>
              <IconPlus className="h-4 w-4 mr-1" /> Thêm cơ sở
            </Button>
          ) : undefined
        }
      />

      {editing !== null && (
        <CemeteryForm
          clanId={clan.id}
          initial={editing === "new" ? null : editing}
          onDone={() => {
            setEditing(null);
            invalidate();
          }}
          onCancel={() => setEditing(null)}
        />
      )}

      {cemeteries && cemeteries.length === 0 && editing === null && (
        <p className="text-sm text-muted-foreground">
          Chưa có cơ sở nào.{canEdit ? " Bấm 'Thêm cơ sở' để tạo." : ""}
        </p>
      )}

      <ul className="space-y-2">
        {(cemeteries ?? []).map((c) => (
          <li key={c.id}>
            <div className="rounded-lg border bg-card p-3">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{c.name}</p>
                  {c.address && (
                    <p className="text-xs text-muted-foreground truncate">{c.address}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {c.place_count} nơi an nghỉ
                    {c.latitude != null && c.longitude != null ? " · có vị trí" : ""}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Link
                    to={`/clans/${clan.id}/graves?cemetery=${c.id}`}
                    className="text-xs text-primary hover:underline self-center mr-1"
                  >
                    Xem mộ
                  </Link>
                  {canEdit && (
                    <>
                      <button
                        type="button"
                        aria-label="Sửa"
                        onClick={() => setEditing(c)}
                        className="p-1.5 text-muted-foreground hover:text-foreground"
                      >
                        <IconPencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        aria-label="Xoá"
                        onClick={() =>
                          askConfirm({
                            title: `Xoá cơ sở "${c.name}"?`,
                            description: "Các mộ đang gắn cơ sở này sẽ bị gỡ liên kết (không xoá mộ).",
                            confirmLabel: "Xoá",
                            destructive: true,
                          }).then((ok) => {
                            if (ok) deleteCemetery(c.id).then(invalidate).catch((e) => toast.error("Không xoá được", { description: (e as Error).message }));
                          })
                        }
                        className="p-1.5 text-muted-foreground hover:text-destructive"
                      >
                        <IconTrash className="h-4 w-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <p className="text-xs text-muted-foreground pt-2">
        <Link to={`/clans/${clan.id}/graves`} className="inline-flex items-center gap-1 text-primary hover:underline">
          <IconGrave className="h-3.5 w-3.5" /> Về danh sách mộ phần
        </Link>
      </p>
    </div>
  );
}

function CemeteryForm({
  clanId,
  initial,
  onDone,
  onCancel,
}: {
  clanId: string;
  initial: CemeteryListItem | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(initial?.name ?? "");
  const [address, setAddress] = useState(initial?.address ?? "");
  const [lat, setLat] = useState(initial?.latitude != null ? String(initial.latitude) : "");
  const [lng, setLng] = useState(initial?.longitude != null ? String(initial.longitude) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const m = useMutation({
    mutationFn: () => {
      const fields = {
        name: name.trim(),
        address: address.trim() || null,
        latitude: lat.trim() ? Number(lat) : null,
        longitude: lng.trim() ? Number(lng) : null,
        notes: notes.trim() || null,
      };
      return initial
        ? updateCemetery(initial.id, fields).then(() => ({ id: initial.id }))
        : createCemetery(clanId, fields);
    },
    onSuccess: () => {
      toast.success(initial ? "Đã lưu" : "Đã thêm cơ sở");
      onDone();
    },
    onError: (e) => toast.error("Không lưu được", { description: (e as Error).message }),
  });

  function useCurrentLocation() {
    if (!navigator.geolocation) return toast.error("Trình duyệt không hỗ trợ định vị");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setLat(p.coords.latitude.toFixed(6));
        setLng(p.coords.longitude.toFixed(6));
      },
      () => toast.error("Không lấy được vị trí (cần cấp quyền)"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) m.mutate();
          }}
          className="space-y-3"
        >
          <div className="space-y-2">
            <Label htmlFor="cem-name" required>Tên cơ sở</Label>
            <Input id="cem-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Nghĩa trang Lạc Hồng, Chùa Vĩnh Nghiêm" maxLength={200} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cem-addr">Địa chỉ</Label>
            <Input id="cem-addr" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="vd: xã …, huyện …, tỉnh …" />
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="cem-notes">Ghi chú</Label>
            <Input id="cem-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <div className="flex gap-2 justify-end">
            <Button type="submit" variant="outline" disabled={m.isPending || !name.trim()}>
              {m.isPending ? "Đang lưu…" : "Lưu"}
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              <IconX className="h-4 w-4 mr-1" /> Hủy
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
