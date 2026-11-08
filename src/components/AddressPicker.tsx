import { useQuery } from "@tanstack/react-query";
import { FilterableSelect } from "@/components/FilterableSelect";
import { IconHome, IconMapPin } from "@/components/icons";
import { Label } from "@/components/ui/label";
import { queryKeys } from "@/lib/queries/keys";
import {
  listProvinces,
  listWardsOfProvince,
  VN_WARD_KIND_LABEL,
} from "@/lib/queries/vnDivisions";

export interface AddressValue {
  province_code: string | null;
  ward_code: string | null;
}

/**
 * Chọn Tỉnh/thành → Xã/phường từ danh mục có sẵn (34 tỉnh, 3.321 xã/phường). Đổi tỉnh thì xã bị
 * xoá. Danh sách xã dài (tới vài trăm) nên có ô lọc gõ không dấu. Khoá toàn bộ khi nằm trong
 * `<fieldset disabled>` (chế độ xem) — không cần prop riêng.
 */
export function AddressPicker({
  value,
  onChange,
  idPrefix = "addr",
}: {
  value: AddressValue;
  onChange: (next: AddressValue) => void;
  idPrefix?: string;
}) {
  const { data: provinces = [] } = useQuery({
    queryKey: queryKeys.vnProvinces(),
    queryFn: () => listProvinces(),
    staleTime: 60 * 60_000,
  });
  const { data: wards = [] } = useQuery({
    queryKey: ["vn-wards-of", value.province_code],
    queryFn: () => listWardsOfProvince(value.province_code!),
    enabled: !!value.province_code,
    staleTime: 60 * 60_000,
  });

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-province`}>Tỉnh / Thành phố</Label>
        <FilterableSelect
          id={`${idPrefix}-province`}
          icon={<IconMapPin />}
          value={value.province_code ?? ""}
          onChange={(code) => onChange({ province_code: code || null, ward_code: null })}
          options={provinces.map((p) => ({ value: p.code, label: p.name }))}
          emptyLabel="Chưa chọn"
          filterLabel="Lọc tỉnh / thành phố"
          filterPlaceholder="Gõ để lọc tỉnh / thành (không cần dấu)"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-ward`}>Xã / Phường</Label>
        <FilterableSelect
          id={`${idPrefix}-ward`}
          icon={<IconHome />}
          value={value.ward_code ?? ""}
          disabled={!value.province_code}
          onChange={(code) => onChange({ province_code: value.province_code, ward_code: code || null })}
          options={wards.map((w) => ({ value: w.code, label: `${VN_WARD_KIND_LABEL[w.kind]} ${w.name}` }))}
          emptyLabel={value.province_code ? "Chưa chọn" : "Chọn tỉnh / thành trước"}
          filterLabel="Lọc xã / phường"
          filterPlaceholder="Gõ để lọc xã / phường (không cần dấu)"
        />
      </div>
    </div>
  );
}
