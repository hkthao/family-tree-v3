import { useContext } from "react";

import { AddressPicker } from "@/components/AddressPicker";
import { IconMapPin, IconTag } from "@/components/icons";
import { InSidePanelContext } from "@/components/panel/context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Chip } from "@/components/Chip";
import type { PersonAddressInput } from "@/lib/queries/personAddresses";

import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
export const EMPTY_PERSON_ADDRESS: PersonAddressInput = {
  province_code: null,
  ward_code: null,
  street_detail: null,
};

/**
 * Thẻ "Nơi ở hiện tại" trong form người — TUỲ CHỌN và tách khỏi các thẻ thông tin cơ bản. Ghi rõ
 * rằng nhập ở đây thì tỉnh/thành sẽ hiện trên Bản đồ (chỉ thành viên dòng họ xem được); không
 * nhập thì người này không xuất hiện trên bản đồ. Khoá cùng form khi ở chế độ xem.
 */
export function PersonAddressCard({
  value,
  onChange,
}: {
  value: PersonAddressInput;
  onChange: (next: PersonAddressInput) => void;
}) {
  // Trong ngăn kéo: không khung thẻ (ngăn kéo đã có nền + tiêu đề); trên trang: giữ thẻ.
  const inPanel = useContext(InSidePanelContext);
  return (
    <section
      className={`space-y-3 ${inPanel ? "" : "rounded-xl border bg-card p-4 shadow-sm"}`}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="inline-flex items-center gap-2 text-base font-semibold">
          <IconMapPin className="h-5 w-5" />
          {t`Nơi ở hiện tại`}
        </h3>
        <Chip tone="neutral" icon={<IconTag />}>
          {t`Tuỳ chọn`}
        </Chip>
      </div>
      <p className="rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
        <Trans>
        Không bắt buộc. Nếu bạn nhập thông tin ở đây,
        <strong>tỉnh/thành sẽ được hiển thị trên Bản đồ</strong> của dòng
        họ (chỉ thành viên dòng họ xem được). Không nhập thì người này sẽ không
        xuất hiện trên bản đồ.
        </Trans>
      </p>
      <AddressPicker
        idPrefix="person-addr"
        value={{
          province_code: value.province_code,
          ward_code: value.ward_code,
        }}
        onChange={(a) => onChange({ ...value, ...a })}
      />
      <div className="space-y-1.5">
        <Label htmlFor="person-addr-street">{t`Số nhà, thôn / xóm (tuỳ chọn)`}</Label>
        <Input
          id="person-addr-street"
          icon={<IconMapPin />}
          maxLength={300}
          value={value.street_detail ?? ""}
          onChange={(e) =>
            onChange({ ...value, street_detail: e.target.value || null })
          }
          placeholder={t`vd: số 12, ngõ 5, thôn Đông`}
        />
        <p className="text-xs text-muted-foreground">{t`Chỉ hiện ở hồ sơ người này, không vẽ lên bản đồ.`}</p>
      </div>
    </section>
  );
}
