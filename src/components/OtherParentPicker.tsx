import { PersonAvatar } from "@/components/PersonAvatar";
import { Callout } from "@/components/ui/callout";
import { RichSelect } from "@/components/ui/rich-select";

import { t } from "@lingui/core/macro";

/** Giá trị "chưa rõ / đơn thân" của ô chọn. */
export const SOLO_VALUE = "__solo__";

// Thứ tự vợ/chồng → "cả, hai, ba…" (khớp thứ tự spouse_order do query
// trả về). Quá 10 thì rơi về "thứ N".
const SPOUSE_ORDINALS = [
  "cả",
  "hai",
  "ba",
  "tư",
  "năm",
  "sáu",
  "bảy",
  "tám",
  "chín",
  "mười",
];

function spouseRankLabel(spouseGender: "M" | "F", index: number): string {
  const noun = spouseGender === "F" ? t`Vợ` : t`Chồng`;
  const ord = SPOUSE_ORDINALS[index] ?? t`thứ ${index + 1}`;
  return `${noun} ${ord}`;
}

interface Spouse {
  id: string;
  full_name: string;
  gender: "M" | "F";
}

/**
 * "Con này là con chung với ai?" — danh sách lựa chọn LỚN, từng dòng có ảnh, tên và vai
 * (vợ cả / vợ hai…), thay cho ô xổ xuống: phần lớn người dùng là người lớn tuổi, cần thấy
 * hết các lựa chọn cùng lúc và bấm trúng một dòng to thay vì mở danh sách nhỏ.
 */
export function OtherParentPicker({
  focalName,
  spouses,
  value,
  onChange,
}: {
  focalName: string;
  spouses: Spouse[];
  value: string;
  onChange: (id: string) => void;
}) {
  const options = [
    ...spouses.map((s, i) => ({
      id: s.id,
      gender: s.gender,
      title: s.full_name,
      note:
        spouses.length > 1
          ? t`${spouseRankLabel(s.gender, i)} của ${focalName}`
          : t`${s.gender === "F" ? t`Vợ` : t`Chồng`} của ${focalName}`,
    })),
    {
      id: SOLO_VALUE,
      gender: null,
      title: t`Chưa rõ / không ghi`,
      note: t`Chỉ ghi ${focalName} là cha/mẹ của con này.`,
    },
  ];
  return (
    <div className="space-y-3">
      <RichSelect
        label={t`Con này là con chung với ai?`}
        hint={t`Bấm chọn người còn lại là cha hoặc mẹ của con (cùng với ${focalName}).`}
        ariaLabel={t`Con chung với ai`}
        value={value}
        onChange={onChange}
        options={options.map((o) => ({
          value: o.id,
          label: o.title,
          description: o.note,
          leading: (size) =>
            o.gender ? (
              <PersonAvatar gender={o.gender} size={size} />
            ) : (
              <span
                aria-hidden="true"
                style={{ width: size, height: size }}
                className="flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
              >
                ?
              </span>
            ),
        }))}
      />
      {spouses.length > 0 && value === SOLO_VALUE && (
        <Callout tone="warning">
          {t`${focalName} đã có vợ/chồng ở trên — hãy chọn đúng người để con được gắn đúng. Chỉ chọn "Chưa rõ" khi con này thực sự không cùng cha mẹ với các anh chị em hiện có.`}
        </Callout>
      )}
      {spouses.length > 1 && (
        <p className="text-sm text-muted-foreground">
          {t`Ví dụ: ông có hai đời vợ, muốn nhập con của bà hai thì chọn đúng dòng "Vợ hai". Nếu vợ/chồng chưa có trong cây, hãy bấm "Thêm vợ/chồng" trước.`}
        </p>
      )}
    </div>
  );
}
