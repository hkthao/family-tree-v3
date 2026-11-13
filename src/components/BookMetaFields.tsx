import { msg } from "@lingui/core/macro";
import { lazyAs } from "@/lib/i18n/lazy";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClanBookTexts } from "@/lib/queries/clan-book";

const FIELDS: {
  key: keyof ClanBookTexts;
  label: string;
  placeholder: string;
  hint?: string;
  max: number;
}[] = lazyAs<{
  key: keyof ClanBookTexts;
  label: string;
  placeholder: string;
  hint?: string;
  max: number;
}[]>([
  {
    key: "place_line",
    label: msg`Địa danh dưới tựa sách`,
    placeholder: msg`Thôn La Cầu, xã Mỹ Thọ, huyện Bình Lục, tỉnh Hà Nam`,
    hint: msg`Ghi từ thôn/xã/huyện đến tỉnh theo địa danh hành chính đương thời để người tìm không nhầm lẫn.`,
    max: 300,
  },
  {
    key: "origin_place",
    label: msg`Nguyên quán / tổ quán`,
    placeholder: msg`Nơi phát tích của dòng họ`,
    max: 300,
  },
  {
    key: "ancestral_hall",
    label: msg`Nhà thờ họ`,
    placeholder: msg`Tên và địa chỉ nhà thờ họ (từ đường)`,
    max: 300,
  },
  {
    key: "ancestor_anniversary",
    label: msg`Ngày giỗ tổ`,
    placeholder: msg`Vd: 10 tháng 3 âm lịch`,
    max: 100,
  },
  {
    key: "chief_name",
    label: msg`Trưởng họ / người chủ trì`,
    placeholder: msg`Họ tên`,
    max: 200,
  },
  {
    key: "compilers",
    label: msg`Ban biên soạn`,
    placeholder: msg`Họ tên những người biên soạn`,
    max: 500,
  },
  {
    key: "compiled_year",
    label: msg`Năm biên soạn`,
    placeholder: "Vd: 2026",
    max: 20,
  },
  {
    key: "contact",
    label: msg`Liên hệ`,
    placeholder: msg`Số điện thoại / email người giữ phả`,
    max: 300,
  },
]);

/** Các ô thông tin biên soạn của sổ gia phả — dùng ở form tạo và trang Sổ gia phả. */
export function BookMetaFields({
  value,
  onChange,
  disabled,
  idPrefix = "meta",
}: {
  value: ClanBookTexts;
  onChange: (next: ClanBookTexts) => void;
  disabled?: boolean;
  idPrefix?: string;
}) {
  return (
    <div className="space-y-4">
      {FIELDS.map((f) => (
        <div key={f.key} className="space-y-1.5">
          <Label htmlFor={`${idPrefix}-${f.key}`}>{f.label}</Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            className="h-10"
            maxLength={f.max}
            disabled={disabled}
            placeholder={f.placeholder}
            value={value[f.key] ?? ""}
            onChange={(e) => onChange({ ...value, [f.key]: e.target.value })}
          />
          {f.hint ? (
            <p className="text-xs text-muted-foreground">{f.hint}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
