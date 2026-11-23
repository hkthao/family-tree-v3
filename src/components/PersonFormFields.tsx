import { BirthOrderPicker } from "@/components/BirthOrderPicker";
import { CalendarDateInput } from "@/components/CalendarDateInput";
import { FormGroup } from "@/components/FormGroup";
import {
  IconCalendar,
  IconGrave,
  IconMapPin,
  IconScroll,
  IconUser,
} from "@/components/icons";
import { PersonAddressCard } from "@/components/PersonAddressCard";
import type { PersonAddressInput } from "@/lib/queries/personAddresses";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  buildDeathAnniversary,
  buildPersonDateColumns,
  EMPTY_CALENDAR_DATE,
  EMPTY_LUNAR_CALENDAR_DATE,
  loadCalendarDateValue,
  type CalendarDateValue,
} from "@/lib/personDates";
import type { PersonDetail } from "@/lib/queries/persons";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";

/**
 * Bộ ô nhập hồ sơ một người — DÙNG CHUNG cho form Thêm/Sao chép (NewPerson) và
 * form Sửa/Xem (EditPerson). Thêm ô mới, đổi chữ, đổi nhóm card: sửa MỘT chỗ ở đây.
 * Trang chủ form chỉ lo nạp dữ liệu, nút Lưu và những gì riêng của nó (ảnh, dòng thời gian…).
 */
export interface PersonFormValues {
  fullName: string;
  gender: "M" | "F";
  isLiving: boolean;
  isRoot: boolean;
  birth: CalendarDateValue;
  death: CalendarDateValue;
  birthPlace: string;
  burialPlace: string;
  courtesyName: string;
  nickname: string;
  posthumousName: string;
  bio: string;
  lifespanYears: string;
  /** Chỉ form Sửa. */
  todoExcluded: boolean;
  /** Chỉ form Sửa. */
  birthOrder: string;
}

export const EMPTY_PERSON_FORM: PersonFormValues = {
  fullName: "",
  gender: "M",
  isLiving: true,
  isRoot: false,
  birth: EMPTY_CALENDAR_DATE,
  death: EMPTY_LUNAR_CALENDAR_DATE,
  birthPlace: "",
  burialPlace: "",
  courtesyName: "",
  nickname: "",
  posthumousName: "",
  bio: "",
  lifespanYears: "",
  todoExcluded: false,
  birthOrder: "",
};

/** Giá trị form từ một hàng persons (nạp form Sửa, hoặc điền sẵn khi Sao chép). */
export function personFormFromPerson(p: PersonDetail): PersonFormValues {
  return {
    fullName: p.full_name,
    gender: p.gender,
    isLiving: p.is_living,
    isRoot: p.is_root,
    birth: loadCalendarDateValue({
      solarDate: p.birth_date,
      solarPrecision: p.birth_date_precision,
      lunarYear: p.birth_lunar_year,
      lunarMonth: p.birth_lunar_month,
      lunarDay: p.birth_lunar_day,
    }),
    // Ưu tiên nhập âm lịch cho ngày mất (giỗ thường chỉ có tháng/ngày âm, không có năm).
    death: loadCalendarDateValue(
      {
        solarDate: p.death_date,
        solarPrecision: p.death_date_precision,
        lunarYear: p.death_lunar_year,
        lunarMonth: p.death_lunar_month,
        lunarDay: p.death_lunar_day,
      },
      true,
    ),
    birthPlace: p.birth_place ?? "",
    burialPlace: p.burial_place ?? "",
    courtesyName: p.courtesy_name ?? "",
    nickname: p.nickname ?? "",
    posthumousName: p.posthumous_name ?? "",
    bio: p.bio ?? "",
    lifespanYears: p.lifespan_years != null ? String(p.lifespan_years) : "",
    todoExcluded: p.todo_excluded ?? false,
    birthOrder: p.birth_order != null ? String(p.birth_order) : "",
  };
}

/** Người này đã có dữ liệu ở card "Chi tiết bổ sung" chưa — có thì mở sẵn, không giấu dữ liệu. */
export function personHasDetails(p: PersonDetail): boolean {
  return !!(
    p.courtesy_name ||
    p.nickname ||
    p.posthumous_name ||
    p.birth_place ||
    p.burial_place ||
    p.bio ||
    p.death_date ||
    // Người chỉ có giỗ âm (tháng/ngày, không năm) → death_date NULL nhưng vẫn có ngày mất đã ghi.
    p.death_lunar_month != null ||
    p.death_anniv_lunar_month != null ||
    p.birth_order != null ||
    p.lifespan_years != null ||
    p.todo_excluded
  );
}

/** Các cột persons chung của thêm và sửa (form Sửa thêm todo_excluded, birth_order). */
export function personFormToColumns(v: PersonFormValues) {
  const birthCols = buildPersonDateColumns(v.birth);
  const deathCols = buildPersonDateColumns(v.death);
  const anniv = buildDeathAnniversary(v.death);
  return {
    full_name: v.fullName.trim(),
    gender: v.gender,
    is_living: v.isLiving,
    is_root: v.isRoot,
    birth_date: birthCols.solar_date,
    birth_date_precision: birthCols.solar_precision,
    death_date: deathCols.solar_date,
    death_date_precision: deathCols.solar_precision,
    birth_lunar_year: birthCols.lunar_year,
    birth_lunar_month: birthCols.lunar_month,
    birth_lunar_day: birthCols.lunar_day,
    birth_lunar_is_leap: birthCols.lunar_is_leap,
    death_lunar_year: deathCols.lunar_year,
    death_lunar_month: deathCols.lunar_month,
    death_lunar_day: deathCols.lunar_day,
    death_lunar_is_leap: deathCols.lunar_is_leap,
    death_anniv_lunar_month: anniv.death_anniv_lunar_month,
    death_anniv_lunar_day: anniv.death_anniv_lunar_day,
    death_anniv_lunar_is_leap: anniv.death_anniv_lunar_is_leap,
    birth_place: v.birthPlace.trim() || null,
    burial_place: v.burialPlace.trim() || null,
    courtesy_name: v.courtesyName.trim() || null,
    nickname: v.nickname.trim() || null,
    posthumous_name: v.posthumousName.trim() || null,
    bio: v.bio.trim() || null,
    lifespan_years: v.lifespanYears.trim()
      ? Math.max(0, Math.min(150, Math.floor(Number(v.lifespanYears))))
      : null,
  };
}

/** Kiểm tra ngày sinh/mất hợp lệ trước khi gọi API; ném lỗi có thông điệp rõ. */
export function validatePersonForm(v: PersonFormValues) {
  buildPersonDateColumns(v.birth);
  buildPersonDateColumns(v.death);
}

export function PersonFormFields({
  values,
  onChange,
  mode,
  readOnly = false,
  detailsOpen,
  photoSlot,
  timelineSlot,
  address,
  onAddressChange,
}: {
  values: PersonFormValues;
  onChange: (patch: Partial<PersonFormValues>) => void;
  /** create: thêm/sao chép (ẩn ô chỉ có khi sửa); edit: sửa/xem. */
  mode: "create" | "edit";
  readOnly?: boolean;
  /** Mở sẵn card "Chi tiết bổ sung" (đã có dữ liệu). */
  detailsOpen: boolean;
  /** Đặt đầu card "Thông tin chính" (ảnh đại diện — chỉ form Sửa). */
  photoSlot?: React.ReactNode;
  /** Đặt cuối card "Chi tiết bổ sung" (dòng thời gian — chỉ dòng họ lịch sử). */
  timelineSlot?: React.ReactNode;
  /** Không truyền thì ẩn card "Nơi ở hiện tại" (người ngoài dòng họ không thấy). */
  address?: PersonAddressInput;
  onAddressChange?: (next: PersonAddressInput) => void;
}) {
  const v = values;
  const edit = mode === "edit";
  return (
    <>
      <FormGroup
        step={1}
        title={t`Thông tin chính`}
        desc={t`Chỉ cần họ tên là lưu được; các nhóm bên dưới điền sau cũng được.`}
      >
        {photoSlot}

        <div className="space-y-2">
          <Label htmlFor="full_name" required>
            {t`Họ và tên`}
          </Label>
          <Input
            icon={<IconUser />}
            id="full_name"
            data-testid={edit ? "edit-person-name-input" : "person-name-input"}
            required
            autoFocus={!edit}
            maxLength={200}
            value={v.fullName}
            onChange={(e) => onChange({ fullName: e.target.value })}
            placeholder={t`Vd: Nguyễn Văn A`}
          />
        </div>

        <fieldset className="space-y-3">
          <legend className="mb-2 text-base font-medium">{t`Giới tính`}</legend>
          <div className="flex gap-6">
            {(
              [
                ["M", t`Nam`],
                ["F", t`Nữ`],
              ] as const
            ).map(([g, label]) => (
              <label key={g} className="flex cursor-pointer items-center gap-3">
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  checked={v.gender === g}
                  onChange={() => onChange({ gender: g })}
                  className="h-4 w-4 accent-primary"
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <CalendarDateInput
          label={t`Ngày sinh`}
          idPrefix="birth"
          hideHelp={readOnly}
          value={v.birth}
          onChange={(birth) => onChange({ birth })}
          helperText={t`Chỉ nhớ năm cũng được — bỏ trống ngày, tháng. Bấm 'Nhập theo lịch Âm' nếu tài liệu hoặc bia mộ ghi ngày âm.`}
        />

        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={!v.isLiving}
            onChange={(e) => onChange({ isLiving: !e.target.checked })}
            className="h-5 w-5 shrink-0 accent-primary"
          />
          <span>{t`Đã mất`}</span>
        </label>

        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            data-testid="person-is-root-checkbox"
            checked={v.isRoot}
            onChange={(e) => onChange({ isRoot: e.target.checked })}
            className="mt-1 h-5 w-5 shrink-0 accent-primary"
          />
          <span>
            <span className="font-medium">{t`Thuỷ tổ`}</span>
            <span className="block text-sm text-muted-foreground">
              {t`Đánh dấu khi đây là gốc của dòng họ (đời 1). Có thể có nhiều Thuỷ tổ nếu nhiều chi tách lập.`}
            </span>
          </span>
        </label>
      </FormGroup>

      <FormGroup
        key={`more-${detailsOpen}`}
        step={2}
        title={t`Chi tiết bổ sung`}
        desc={t`Tên gọi khác, nơi sinh, ngày mất, an táng, tiểu sử.`}
        collapsible
        defaultOpen={detailsOpen}
      >
        <div className="space-y-2">
          <Label htmlFor="courtesy_name">{t`Tên tự`}</Label>
          <Input
            icon={<IconScroll />}
            id="courtesy_name"
            maxLength={100}
            value={v.courtesyName}
            onChange={(e) => onChange({ courtesyName: e.target.value })}
            placeholder={t`Tên đặt khi trưởng thành, dùng nơi trang trọng`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="nickname">{t`Tên húy / biệt hiệu`}</Label>
          <Input
            icon={<IconScroll />}
            id="nickname"
            maxLength={100}
            value={v.nickname}
            onChange={(e) => onChange({ nickname: e.target.value })}
            placeholder={t`Tên khai sinh, kiêng gọi sau khi mất`}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="posthumous_name">{t`Tên thụy`}</Label>
          <Input
            icon={<IconScroll />}
            id="posthumous_name"
            maxLength={100}
            value={v.posthumousName}
            onChange={(e) => onChange({ posthumousName: e.target.value })}
            placeholder={t`Tên đặt khi mất, dùng trong văn cúng`}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="birth_place">{t`Nơi sinh`}</Label>
          <Input
            icon={<IconMapPin />}
            id="birth_place"
            maxLength={200}
            value={v.birthPlace}
            onChange={(e) => onChange({ birthPlace: e.target.value })}
            placeholder={t`Vd: xã Mỹ Thọ, huyện Bình Lục, tỉnh Hà Nam`}
          />
        </div>

        <CalendarDateInput
          label={t`Ngày mất (nếu đã mất)`}
          idPrefix="death"
          hideHelp={readOnly}
          value={v.death}
          onChange={(death) =>
            onChange({
              death,
              ...(death.parts.year || death.parts.month || death.parts.day
                ? { isLiving: false }
                : {}),
            })
          }
          helperText={t`Để trống nếu còn sống. Ưu tiên ghi ngày âm — chỉ cần nhớ ngày giỗ là đủ: điền tháng/ngày âm, bỏ trống năm cũng được.`}
          referenceYear={
            v.birth.parts.year && /^\d+$/.test(v.birth.parts.year)
              ? Number(v.birth.parts.year) + 70
              : undefined
          }
        />

        {!v.isLiving && (
          <div className="space-y-2">
            <Label htmlFor="lifespan_years">{t`Tuổi thọ`}</Label>
            <Input
              icon={<IconCalendar />}
              id="lifespan_years"
              type="number"
              inputMode="numeric"
              min={0}
              max={150}
              placeholder="VD: 82"
              value={v.lifespanYears}
              onChange={(e) => onChange({ lifespanYears: e.target.value })}
              className="max-w-[10rem]"
            />
            <p className="text-sm text-muted-foreground">
              {t`Để trống thì hệ thống tự tính từ năm sinh – năm mất (nếu có đủ). Từ 60 tuổi hiển thị "hưởng thọ", dưới 60 là "hưởng dương".`}
            </p>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="burial_place">{t`Nơi an táng`}</Label>
          <Input
            icon={<IconGrave />}
            id="burial_place"
            maxLength={200}
            value={v.burialPlace}
            onChange={(e) => onChange({ burialPlace: e.target.value })}
            placeholder={t`Vd: nghĩa trang xã, khu mộ dòng họ`}
          />
        </div>

        {edit && (
          <>
            <BirthOrderPicker
              value={v.birthOrder}
              onChange={(birthOrder) => onChange({ birthOrder })}
            />

            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={v.todoExcluded}
                onChange={(e) => onChange({ todoExcluded: e.target.checked })}
                className="mt-1 h-5 w-5 shrink-0 accent-primary"
              />
              <span>
                <span className="font-medium">
                  {t`Loại khỏi "Việc cần làm"`}
                </span>
                <span className="block text-sm text-muted-foreground">
                  <Trans>
                    Bật khi thông tin thiếu là <em>cố ý</em> hoặc không thể bổ
                    sung (vd. thuỷ tổ không có cha mẹ, người mất tích không rõ
                    năm sinh/mất). App sẽ không nhắc nữa.
                  </Trans>
                </span>
              </span>
            </label>
          </>
        )}

        <Textarea
          id="bio"
          label={t`Tiểu sử`}
          icon={<IconScroll />}
          rows={4}
          maxLength={5000}
          value={v.bio}
          onChange={(e) => onChange({ bio: e.target.value })}
          placeholder={t`Vài dòng về cuộc đời, công trạng, nghề nghiệp…`}
        />

        {timelineSlot}
      </FormGroup>

      {address && onAddressChange && (
        <FormGroup
          step={3}
          title={t`Nơi ở hiện tại`}
          desc={t`Nhập thì người này hiện trên Bản đồ của dòng họ.`}
          collapsible
        >
          <PersonAddressCard bare value={address} onChange={onAddressChange} />
        </FormGroup>
      )}
    </>
  );
}
