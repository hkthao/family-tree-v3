import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";

import { FilterableSelect, type FilterableOption } from "@/components/FilterableSelect";
import { IconCheck, IconPlus, IconTrash, IconUser, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { t } from "@lingui/core/macro";

export type FaceBox = [number, number, number, number];

/** Một khung khuôn mặt để vẽ + liệt kê. `label` null = gợi ý chưa xác nhận (khách chỉ thấy số). */
export interface TaggerFace {
  id: string;
  box: FaceBox;
  confirmed: boolean;
  label: string | null;
  note?: string | null;
  /** Thêm cho người quản lý: ai gợi ý, gợi ý gì. */
  detail?: string | null;
  canDelete?: boolean;
}

export interface FaceSubmit {
  box: FaceBox;
  person_id: string | null;
  suggested_name: string | null;
  suggested_note: string | null;
}

const MIN_SIDE = 0.03;

/**
 * Ảnh "đây là ai?" (P2): ảnh có các khung đánh số; bấm "Khoanh một người" rồi kéo trên ảnh (chuột
 * hoặc ngón tay — pointer events) để vẽ khung, chọn người trong gia phả hoặc gõ tên + nghề rồi gửi.
 * Toạ độ lưu theo tỉ lệ 0..1 nên khung đúng chỗ ở mọi cỡ màn hình.
 */
export function FaceTagger({
  src,
  alt,
  faces,
  personOptions,
  canAdd,
  canModerate = false,
  onSubmit,
  onConfirm,
  onReject,
  onDelete,
  submitting,
}: {
  src: string;
  alt: string;
  faces: TaggerFace[];
  personOptions: FilterableOption[];
  canAdd: boolean;
  canModerate?: boolean;
  onSubmit: (f: FaceSubmit) => Promise<void> | void;
  onConfirm?: (id: string) => void;
  onReject?: (id: string) => void;
  onDelete?: (id: string) => void;
  submitting?: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [start, setStart] = useState<[number, number] | null>(null);
  const [draft, setDraft] = useState<FaceBox | null>(null);
  const [personId, setPersonId] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");

  const rel = (e: ReactPointerEvent): [number, number] => {
    const r = wrapRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    ];
  };
  const onDown = (e: ReactPointerEvent) => {
    if (!drawing) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = rel(e);
    setStart(p);
    setDraft([p[0], p[1], 0, 0]);
  };
  const onMove = (e: ReactPointerEvent) => {
    if (!drawing || !start) return;
    const [x, y] = rel(e);
    setDraft([Math.min(start[0], x), Math.min(start[1], y), Math.abs(x - start[0]), Math.abs(y - start[1])]);
  };
  const onUp = () => {
    if (!drawing || !start) return;
    setStart(null);
    if (draft && (draft[2] < MIN_SIDE || draft[3] < MIN_SIDE)) setDraft(null);
  };
  const reset = () => {
    setDrawing(false);
    setDraft(null);
    setStart(null);
    setPersonId("");
    setName("");
    setNote("");
  };

  const ready = !!draft && draft[2] >= MIN_SIDE && draft[3] >= MIN_SIDE && !start;
  const pct = (v: number) => `${(v * 100).toFixed(2)}%`;

  return (
    <div className="space-y-3">
      <div
        ref={wrapRef}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        className={`relative select-none overflow-hidden rounded-md border bg-muted ${drawing ? "cursor-crosshair touch-none" : ""}`}
      >
        <img src={src} alt={alt} draggable={false} className="block w-full" />
        {faces.map((f, i) => (
          <div
            key={f.id}
            className={`pointer-events-none absolute rounded-sm border-2 ${f.confirmed ? "border-emerald-400" : "border-amber-400 border-dashed"}`}
            style={{ left: pct(f.box[0]), top: pct(f.box[1]), width: pct(f.box[2]), height: pct(f.box[3]) }}
          >
            <span
              className={`absolute -left-0.5 -top-6 rounded px-1.5 text-xs font-bold text-black ${f.confirmed ? "bg-emerald-400" : "bg-amber-400"}`}
            >
              {i + 1}
            </span>
          </div>
        ))}
        {draft && (
          <div
            className="pointer-events-none absolute rounded-sm border-2 border-primary bg-primary/10"
            style={{ left: pct(draft[0]), top: pct(draft[1]), width: pct(draft[2]), height: pct(draft[3]) }}
          />
        )}
      </div>

      {canAdd && !drawing && (
        <Button type="button" variant="outline" size="sm" onClick={() => setDrawing(true)}>
          <IconPlus className="mr-1.5 h-4 w-4" />
          {t`Khoanh một người`}
        </Button>
      )}
      {drawing && !ready && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t`Kéo trên ảnh để khoanh khuôn mặt người bạn nhận ra.`}</span>
          <Button type="button" variant="outline" size="sm" onClick={reset}>
            {t`Huỷ`}
          </Button>
        </div>
      )}
      {drawing && ready && (
        <div className="space-y-3 rounded-lg border p-3">
          <div className="space-y-1.5">
            <Label htmlFor="face-person">{t`Người này là ai trong gia phả?`}</Label>
            <FilterableSelect
              id="face-person"
              icon={<IconUser />}
              value={personId}
              onChange={setPersonId}
              options={personOptions}
              emptyLabel={t`Không có trong gia phả / không chắc`}
              filterLabel={t`Tìm người`}
              filterPlaceholder={t`Gõ tên để tìm (không cần dấu)`}
            />
          </div>
          {!personId && (
            <div className="space-y-1.5">
              <Label htmlFor="face-name">{t`Hoặc ghi tên người đó`}</Label>
              <Input
                id="face-name"
                icon={<IconUser />}
                value={name}
                maxLength={120}
                onChange={(e) => setName(e.target.value)}
                placeholder={t`vd: ông Tư, bác Hai Lành`}
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="face-note">{t`Làm nghề gì / ghi chú (nếu biết)`}</Label>
            <Input
              id="face-note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t`vd: thợ mộc, giáo viên làng`}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={reset}>
              {t`Huỷ`}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={submitting || (!personId && !name.trim())}
              onClick={async () => {
                await onSubmit({
                  box: draft!,
                  person_id: personId || null,
                  suggested_name: personId ? null : name.trim() || null,
                  suggested_note: note.trim() || null,
                });
                reset();
              }}
            >
              <IconCheck className="mr-1.5 h-4 w-4" />
              {t`Gửi`}
            </Button>
          </div>
        </div>
      )}

      {faces.length > 0 && (
        <ol className="divide-y overflow-hidden rounded-lg border text-sm">
          {faces.map((f, i) => (
            <li key={f.id} className="flex items-start gap-2 p-2">
              <span
                className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs font-bold text-black ${f.confirmed ? "bg-emerald-400" : "bg-amber-400"}`}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {f.label ?? t`Đã có người gợi ý — chờ xác nhận`}
                  {f.note && <span className="font-normal text-muted-foreground"> · {f.note}</span>}
                </p>
                {f.detail && <p className="text-xs text-muted-foreground">{f.detail}</p>}
              </div>
              {(canModerate || f.canDelete) && (
                <div className="flex shrink-0 gap-1">
                  {canModerate && !f.confirmed && onConfirm && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-emerald-600"
                      aria-label={t`Xác nhận`}
                      title={t`Xác nhận`}
                      onClick={() => onConfirm(f.id)}
                    >
                      <IconCheck className="h-4 w-4" />
                    </Button>
                  )}
                  {canModerate && !f.confirmed && onReject && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9"
                      aria-label={t`Bác gợi ý`}
                      title={t`Bác gợi ý`}
                      onClick={() => onReject(f.id)}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                  )}
                  {onDelete && (canModerate || f.canDelete) && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      aria-label={t`Xoá khung`}
                      title={t`Xoá khung`}
                      onClick={() => onDelete(f.id)}
                    >
                      <IconTrash className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
