import { AVATAR_FRAMES, AVATAR_FRAME_LABEL, PersonAvatar, type AvatarFrame } from "@/components/PersonAvatar";
import { Label } from "@/components/ui/label";

/**
 * Chọn viền avatar: không viền hoặc một trong các khung (vòng nguyệt quế,
 * vàng, bạc, hoàng gia, sen, phúc lộc). Lưu ở persons.avatar_frame.
 */
export function AvatarFramePicker({
  value,
  onChange,
  gender,
  photoUrl,
}: {
  value: string | null;
  onChange: (frame: AvatarFrame | null) => void;
  gender: "M" | "F";
  photoUrl?: string | null;
}) {
  const options: (AvatarFrame | null)[] = [null, ...AVATAR_FRAMES];
  return (
    <div className="space-y-2 pt-2">
      <Label>Viền avatar</Label>
      <div role="radiogroup" aria-label="Viền avatar" className="flex flex-wrap gap-2">
        {options.map((f) => {
          const selected = (value ?? null) === f;
          const label = f ? AVATAR_FRAME_LABEL[f] : "Không viền";
          return (
            <button
              key={f ?? "none"}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(f)}
              className={`flex w-[88px] flex-col items-center gap-1 rounded-lg border p-2 text-center text-xs transition-colors ${
                selected ? "border-primary bg-primary/5" : "bg-card hover:border-primary/60"
              }`}
            >
              <PersonAvatar gender={gender} photoUrl={photoUrl} frame={f} size={56} />
              <span className="leading-tight">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
