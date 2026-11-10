import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ClanBookTexts } from "@/lib/queries/clan-book";

const FIELDS: {
  key: keyof ClanBookTexts;
  label: string;
  placeholder: string;
  hint?: string;
  max: number;
}[] = [
  {
    key: "place_line",
    label: "Địa danh dưới tựa sách",
    placeholder: "Thôn La Cầu, xã Mỹ Thọ, huyện Bình Lục, tỉnh Hà Nam",
    hint: "Ghi từ thôn/xã/huyện đến tỉnh theo địa danh hành chính đương thời để người tìm không nhầm lẫn.",
    max: 300,
  },
  {
    key: "origin_place",
    label: "Nguyên quán / tổ quán",
    placeholder: "Nơi phát tích của dòng họ",
    max: 300,
  },
  {
    key: "ancestral_hall",
    label: "Nhà thờ họ",
    placeholder: "Tên và địa chỉ nhà thờ họ (từ đường)",
    max: 300,
  },
  {
    key: "ancestor_anniversary",
    label: "Ngày giỗ tổ",
    placeholder: "Vd: 10 tháng 3 âm lịch",
    max: 100,
  },
  {
    key: "chief_name",
    label: "Trưởng họ / người chủ trì",
    placeholder: "Họ tên",
    max: 200,
  },
  {
    key: "compilers",
    label: "Ban biên soạn",
    placeholder: "Họ tên những người biên soạn",
    max: 500,
  },
  {
    key: "compiled_year",
    label: "Năm biên soạn",
    placeholder: "Vd: 2026",
    max: 20,
  },
  {
    key: "contact",
    label: "Liên hệ",
    placeholder: "Số điện thoại / email người giữ phả",
    max: 300,
  },
];

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
          {f.hint ? <p className="text-xs text-muted-foreground">{f.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
