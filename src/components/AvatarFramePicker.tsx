import {
  AVATAR_FRAMES,
  AVATAR_FRAME_LABEL,
  PersonAvatar,
  type AvatarFrame,
} from "@/components/PersonAvatar";
import { RichSelect } from "@/components/ui/rich-select";

import { t } from "@lingui/core/macro";

const NONE = "none";

/**
 * Chọn viền avatar: không viền hoặc một trong các khung (vòng nguyệt quế,
 * vàng, bạc, hoàng gia, sen, phúc lộc). Lưu ở persons.avatar_frame.
 * Dùng RichSelect để mỗi lựa chọn hiện hình viền thay vì lưới 11 ô chiếm chỗ.
 */
export function AvatarFramePicker({
  value,
  onChange,
  gender,
  photoUrl,
  label = t`Viền avatar`,
  hint,
}: {
  value: string | null;
  onChange: (frame: AvatarFrame | null) => void;
  gender: "M" | "F";
  photoUrl?: string | null;
  label?: string;
  hint?: string;
}) {
  const frames: (AvatarFrame | null)[] = [null, ...AVATAR_FRAMES];
  return (
    <div className="pt-2">
      <RichSelect
        label={label}
        hint={hint}
        ariaLabel={t`Viền avatar`}
        value={value ?? NONE}
        onChange={(v) => onChange(v === NONE ? null : (v as AvatarFrame))}
        options={frames.map((f) => ({
          value: f ?? NONE,
          label: f ? AVATAR_FRAME_LABEL[f] : t`Không viền`,
          leading: (size) => (
            <PersonAvatar
              gender={gender}
              photoUrl={photoUrl}
              frame={f}
              size={size}
            />
          ),
        }))}
      />
    </div>
  );
}
