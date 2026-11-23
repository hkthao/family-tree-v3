import { AvatarFramePicker } from "@/components/AvatarFramePicker";
import { BookMetaFields } from "@/components/BookMetaFields";
import { BookTextsSection } from "@/components/BookTextsSection";
import {
  ClanBasicFields,
  ClanDisplayFields,
  type ClanFormValues,
} from "@/components/ClanFormFields";
import { FormGroup } from "@/components/FormGroup";
import type { ClanBookTexts } from "@/lib/queries/clan-book";

import { t } from "@lingui/core/macro";

/**
 * Các card của form dòng họ — DÙNG CHUNG cho Tạo mới (NewClan), Thông tin & Sổ gia phả
 * (BookInfo) và Cài đặt dòng họ (Settings). Thêm ô, đổi chữ, đổi nhóm: sửa một chỗ ở đây.
 */

/** Card 1: tên, mô tả (+ Riêng tư/Công khai khi `withVisibility`). */
export function ClanMainGroup({
  value,
  onChange,
  disabled,
  idPrefix,
  withVisibility,
  desc,
}: {
  value: ClanFormValues;
  onChange: (next: ClanFormValues) => void;
  disabled?: boolean;
  idPrefix: string;
  withVisibility?: boolean;
  desc: string;
}) {
  return (
    <FormGroup step={1} title={t`Thông tin chính`} desc={desc}>
      <ClanBasicFields
        value={value}
        onChange={onChange}
        disabled={disabled}
        idPrefix={idPrefix}
        showFrame={false}
      />
      {withVisibility && (
        <ClanDisplayFields
          value={value}
          onChange={onChange}
          disabled={disabled}
          part="visibility"
        />
      )}
    </FormGroup>
  );
}

/** Card 2: thông tin biên soạn + nội dung sổ gia phả (cùng một `meta`, lưu một lần). */
export function ClanBookGroup({
  meta,
  onChange,
  clanName,
  idPrefix,
  defaultOpen,
  canEdit = true,
}: {
  meta: ClanBookTexts;
  onChange: (next: ClanBookTexts) => void;
  clanName: string;
  idPrefix: string;
  defaultOpen?: boolean;
  canEdit?: boolean;
}) {
  return (
    <FormGroup
      step={2}
      title={t`Sổ gia phả`}
      desc={t`In ở bìa và các trang của sổ PDF; chọn mẫu để có sẵn bài rồi sửa lại. Điền sau cũng được.`}
      collapsible
      defaultOpen={defaultOpen}
    >
      <BookMetaFields value={meta} onChange={onChange} idPrefix={idPrefix} />
      <BookTextsSection
        clanName={clanName}
        canEdit={canEdit}
        value={meta}
        onChange={onChange}
      />
    </FormGroup>
  );
}

/**
 * Card hiển thị & quyền xem: viền avatar, người ngoài xem được gì, cách hiển thị.
 * `withVisibility`: gồm cả Riêng tư/Công khai (trang Cài đặt); form Tạo đã đặt ô này ở card 1.
 */
export function ClanDisplayGroup({
  value,
  onChange,
  withVisibility,
  step,
  desc,
  defaultOpen,
}: {
  value: ClanFormValues;
  onChange: (next: ClanFormValues) => void;
  withVisibility?: boolean;
  step?: number;
  desc: string;
  defaultOpen?: boolean;
}) {
  return (
    <FormGroup
      step={step}
      title={t`Hiển thị & quyền xem`}
      desc={desc}
      collapsible
      defaultOpen={defaultOpen}
      badge={step === undefined ? "none" : undefined}
    >
      <AvatarFramePicker
        value={value.avatar_frame}
        onChange={(f) => onChange({ ...value, avatar_frame: f })}
        gender="M"
        label={t`Viền avatar cả dòng họ`}
        hint={t`Áp cho avatar của mọi thành viên trong họ.`}
      />
      <ClanDisplayFields
        value={value}
        onChange={onChange}
        part={withVisibility ? "all" : "rest"}
      />
    </FormGroup>
  );
}
