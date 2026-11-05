import { useMemo, useState } from "react";

import { IconLink, IconTrash, IconX } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  CANVAS_FONTS,
  CARD_DESIGNS,
  type CardDesign,
  type CustomLink,
  LINK_PRESETS,
  type EdgeStyle,
  type LinkPreset,
  type NodeStyle,
} from "@/lib/tree/canvasModel";

/** Mime dùng khi kéo mục từ bảng trái thả lên canvas. */
export const PALETTE_MIME = "application/x-canvas-item";

export type PaletteItem =
  | { t: "design"; design: CardDesign; gender: "M" | "F" }
  | { t: "text" }
  | { t: "person"; id: string };

const PREVIEW_D: Record<string, string> = {
  straight: "M6 22 L58 6",
  step: "M6 22 H32 V6 H58",
  bezier: "M6 22 C34 22 30 6 58 6",
  zigzag: "M6 22 L18 8 L30 22 L42 8 L58 20",
};

/** Hình xem trước một kiểu đường nối. */
function PresetPreview({ preset }: { preset: LinkPreset }) {
  const d = PREVIEW_D[preset.zigzag ? "zigzag" : preset.style];
  const mid = `pv-${preset.id}`;
  return (
    <svg viewBox="0 0 64 28" className="h-7 w-full" aria-hidden="true">
      <defs>
        <marker id={mid} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0 0 L10 5 L0 10 z" fill="currentColor" />
        </marker>
      </defs>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={preset.dash ? "5 4" : undefined}
        markerEnd={preset.arrow !== "none" ? `url(#${mid})` : undefined}
        markerStart={preset.arrow === "both" ? `url(#${mid})` : undefined}
      />
    </svg>
  );
}

/** Danh sách kiểu đường nối dựng sẵn: chọn để dùng cho đường mới, và áp luôn cho đường đang chọn. */
export function LinkPresetGallery({
  value,
  onPick,
}: {
  value: string | null;
  onPick: (p: LinkPreset) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2" role="listbox" aria-label="Kiểu đường nối">
      {LINK_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          role="option"
          aria-selected={value === p.id}
          title={p.label}
          onClick={() => onPick(p)}
          className={`flex flex-col items-center gap-0.5 rounded-lg border p-1.5 text-[11px] leading-tight hover:bg-secondary ${value === p.id ? "border-primary bg-primary/10" : "bg-card"}`}
        >
          <PresetPreview preset={p} />
          <span className="line-clamp-1 w-full text-center">{p.label}</span>
        </button>
      ))}
    </div>
  );
}

export interface PaletteMember {
  id: string;
  name: string;
  onCanvas: boolean;
}

const DESIGN_SWATCH: Record<CardDesign, string> = {
  classic: "border-amber-600 bg-amber-50",
  royal: "border-yellow-500 bg-red-900",
  minimal: "border-stone-300 bg-white",
  plaque: "border-stone-700 bg-stone-800",
};

function dragStart(e: React.DragEvent, item: PaletteItem) {
  e.dataTransfer.setData(PALETTE_MIME, JSON.stringify(item));
  e.dataTransfer.effectAllowed = "copy";
}

/**
 * Bảng trái của canvas: thẻ thiết kế sẵn / ô chữ / thành viên để kéo thả,
 * và phần thuộc tính của mục đang chọn (chữ, font, màu, đường nối).
 * Trên màn hình cảm ứng không kéo thả HTML5 được → mỗi mục có thể nhấp để thêm.
 */
export function CanvasPalette({
  members,
  onAdd,
  linkMode,
  onToggleLink,
  linkPreset,
  onPickPreset,
  selection,
}: {
  members: PaletteMember[];
  onAdd: (item: PaletteItem) => void;
  linkMode: boolean;
  onToggleLink: () => void;
  linkPreset: string | null;
  onPickPreset: (p: LinkPreset) => void;
  selection: React.ReactNode;
}) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return members.filter((m) => !s || m.name.toLowerCase().includes(s)).slice(0, 80);
  }, [members, q]);

  return (
    <div className="space-y-4 text-sm">
      <section className="space-y-2">
        <h3 className="font-semibold">Thẻ thiết kế sẵn</h3>
        <p className="text-xs text-muted-foreground">Kéo thả vào canvas (hoặc nhấp để thêm).</p>
        <div className="grid grid-cols-3 gap-2">
          {CARD_DESIGNS.map((d) => (
            <button
              key={d.id}
              type="button"
              draggable
              onDragStart={(e) => dragStart(e, { t: "design", design: d.id, gender: "M" })}
              onClick={() => onAdd({ t: "design", design: d.id, gender: "M" })}
              className="flex flex-col items-center gap-1 rounded-lg border bg-card p-2 text-xs hover:bg-secondary"
            >
              <span className={`flex h-12 w-10 items-center justify-center rounded-md border-2 ${DESIGN_SWATCH[d.id]}`}>
                <span className="h-4 w-4 rounded-full bg-black/20" />
              </span>
              {d.label}
            </button>
          ))}
          <button
            type="button"
            draggable
            onDragStart={(e) => dragStart(e, { t: "text" })}
            onClick={() => onAdd({ t: "text" })}
            className="flex flex-col items-center gap-1 rounded-lg border bg-card p-2 text-xs hover:bg-secondary"
          >
            <span className="flex h-12 w-10 items-center justify-center text-lg font-bold">Aa</span>
            Ô chữ
          </button>
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Đường nối tuỳ chỉnh</h3>
        <p className="text-xs text-muted-foreground">
          Chọn kiểu rồi rê chuột vào thẻ/đường, kéo chấm xanh sang nơi cần nối. Chọn sẵn một đường để đổi kiểu của nó.
        </p>
        <LinkPresetGallery value={linkPreset} onPick={onPickPreset} />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={linkMode ? "default" : "outline"}
            className="h-10 w-10 shrink-0 px-0"
            onClick={onToggleLink}
            title={linkMode ? "Tắt chế độ nối (Esc)" : "Bật chế độ nối: nhấp lần lượt hai thẻ"}
            aria-label="Chế độ nối đường"
            aria-pressed={linkMode}
          >
            <IconLink className="h-4 w-4" />
          </Button>
          {linkMode && <span className="text-xs text-muted-foreground">Đang nối: nhấp 2 thẻ (Esc để thoát)</span>}
        </div>
      </section>

      <section className="space-y-2">
        <h3 className="font-semibold">Thành viên</h3>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên…" className="h-9" />
        <ul className="max-h-48 space-y-1 overflow-y-auto pr-1">
          {list.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => dragStart(e, { t: "person", id: m.id })}
                onClick={() => onAdd({ t: "person", id: m.id })}
                className="flex w-full items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-secondary"
                title={m.onCanvas ? "Đã có trên canvas — thả để dời tới chỗ mới" : "Thả vào canvas"}
              >
                <span className="truncate">{m.name}</span>
                {!m.onCanvas && <span className="shrink-0 text-xs text-muted-foreground">đã ẩn</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      {selection}
    </div>
  );
}

const colorInput =
  "h-9 w-full cursor-pointer rounded-md border bg-background p-1";

/** Thuộc tính của thẻ / ô chữ đang chọn. */
export function NodeInspector({
  title,
  kind,
  style,
  defaults,
  onChange,
  onRemove,
  removeLabel,
}: {
  title: string;
  kind: "person" | "card" | "text";
  style: NodeStyle;
  defaults: { name: string; sub: string };
  onChange: (patch: NodeStyle) => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <section className="space-y-2 rounded-lg border bg-muted/40 p-3">
      <h3 className="font-semibold">{title}</h3>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">{kind === "text" ? "Nội dung" : "Tên hiển thị"}</span>
        <Input value={style.name ?? defaults.name} onChange={(e) => onChange({ name: e.target.value })} className="h-9" />
      </label>
      {kind !== "text" && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Dòng phụ (năm sinh–mất…)</span>
          <Input value={style.sub ?? defaults.sub} onChange={(e) => onChange({ sub: e.target.value })} className="h-9" />
        </label>
      )}
      {kind !== "text" && (
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Kiểu thẻ</span>
          <Select value={style.design ?? ""} onChange={(e) => onChange({ design: (e.target.value || undefined) as CardDesign | undefined })} className="h-9 text-sm">
            <option value="">Theo khung chung</option>
            {CARD_DESIGNS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </Select>
        </label>
      )}
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Font chữ</span>
        <Select value={style.font ?? "be"} onChange={(e) => onChange({ font: e.target.value })} className="h-9 text-sm">
          {CANVAS_FONTS.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
        </Select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Màu chữ</span>
          <input type="color" className={colorInput} value={style.color ?? "#2a211b"} onChange={(e) => onChange({ color: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Cỡ chữ ({style.size ?? 14})</span>
          <input type="range" min={10} max={36} value={style.size ?? 14} onChange={(e) => onChange({ size: Number(e.target.value) })} className="h-9 w-full" />
        </label>
      </div>
      <Button size="sm" variant="destructive-outline" className="h-10 w-10 px-0" onClick={onRemove} title={removeLabel} aria-label={removeLabel}>
        <IconTrash className="h-4 w-4" />
      </Button>
    </section>
  );
}

/** Thuộc tính của đường nối tuỳ chỉnh đang chọn. */
export function LinkInspector({
  link,
  onChange,
  onRemove,
}: {
  link: CustomLink;
  onChange: (patch: Partial<CustomLink>) => void;
  onRemove: () => void;
}) {
  return (
    <section className="space-y-2 rounded-lg border bg-muted/40 p-3">
      <h3 className="font-semibold">Đường nối</h3>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Màu</span>
          <input type="color" className={colorInput} value={link.color} onChange={(e) => onChange({ color: e.target.value })} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">Độ dày ({link.width})</span>
          <input type="range" min={1} max={12} value={link.width} onChange={(e) => onChange({ width: Number(e.target.value) })} className="h-9 w-full" />
        </label>
      </div>
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Kiểu</span>
        <Select value={link.style} onChange={(e) => onChange({ style: e.target.value as EdgeStyle })} className="h-9 text-sm">
          <option value="bezier">Đường cong</option>
          <option value="step">Vuông góc</option>
          <option value="straight">Thẳng / gấp khúc</option>
        </Select>
      </label>
      <p className="rounded-md bg-background/60 p-2 text-xs text-muted-foreground">
        Kéo chấm xanh ở hai đầu để nối sang thẻ khác hoặc thả ra khoảng trống/lên một đường. Nhấp chấm nhỏ giữa đoạn để thêm điểm uốn, kéo ô vuông để uốn theo ý, nhấp đúp ô vuông để bỏ.
      </p>
      {(link.points?.length ?? 0) > 0 && (
        <Button size="sm" variant="outline" className="h-10 w-10 px-0" onClick={() => onChange({ points: [] })} title={`Bỏ ${link.points?.length} điểm uốn`} aria-label="Bỏ điểm uốn">
          <IconX className="h-4 w-4" />
        </Button>
      )}
      <label className="block space-y-1">
        <span className="text-xs text-muted-foreground">Mũi tên</span>
        <Select value={link.arrow ?? "none"} onChange={(e) => onChange({ arrow: e.target.value as CustomLink["arrow"] })} className="h-9 text-sm">
          <option value="none">Không</option>
          <option value="end">Ở cuối</option>
          <option value="both">Hai đầu</option>
        </Select>
      </label>
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={link.dash} onChange={(e) => onChange({ dash: e.target.checked })} />
        Nét đứt
      </label>
      <Button size="sm" variant="destructive-outline" className="h-10 w-10 px-0" onClick={onRemove} title="Xoá đường nối" aria-label="Xoá đường nối">
        <IconTrash className="h-4 w-4" />
      </Button>
    </section>
  );
}
