import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { IconHome, IconMapPin, IconSearch } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { queryKeys } from "@/lib/queries/keys";
import {
  listProvinces,
  listWardsOfProvince,
  VN_WARD_KIND_LABEL,
} from "@/lib/queries/vnDivisions";
import { unaccent } from "@/lib/unaccent";

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
  const [wardFilter, setWardFilter] = useState("");

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

  const shownWards = useMemo(() => {
    const q = unaccent(wardFilter.trim()).toLowerCase();
    if (!q) return wards;
    return wards.filter(
      (w) => w.code === value.ward_code || unaccent(w.name).toLowerCase().includes(q),
    );
  }, [wards, wardFilter, value.ward_code]);

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-province`}>Tỉnh / Thành phố</Label>
        <Select
          id={`${idPrefix}-province`}
          icon={<IconMapPin />}
          value={value.province_code ?? ""}
          onChange={(e) => {
            setWardFilter("");
            onChange({ province_code: e.target.value || null, ward_code: null });
          }}
        >
          <option value="">Chưa chọn</option>
          {provinces.map((p) => (
            <option key={p.code} value={p.code}>
              {p.name}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-ward`}>Xã / Phường</Label>
        {wards.length > 20 && (
          <Input
            icon={<IconSearch />}
            value={wardFilter}
            onChange={(e) => setWardFilter(e.target.value)}
            placeholder="Gõ để lọc xã / phường (không cần dấu)"
            aria-label="Lọc xã / phường"
          />
        )}
        <Select
          id={`${idPrefix}-ward`}
          icon={<IconHome />}
          value={value.ward_code ?? ""}
          disabled={!value.province_code}
          onChange={(e) => onChange({ province_code: value.province_code, ward_code: e.target.value || null })}
        >
          <option value="">{value.province_code ? "Chưa chọn" : "Chọn tỉnh / thành trước"}</option>
          {shownWards.map((w) => (
            <option key={w.code} value={w.code}>
              {VN_WARD_KIND_LABEL[w.kind]} {w.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
