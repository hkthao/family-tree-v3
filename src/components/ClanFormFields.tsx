import { AvatarFramePicker } from "@/components/AvatarFramePicker";
import { IconBuildings, IconScroll } from "@/components/icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { ClanDetail } from "@/lib/queries/clan-detail";
import type { CreateClanInput } from "@/lib/queries/clans";
import type { UpdateClanInput } from "@/lib/queries/clan-update";

/** Giá trị form dòng họ — dùng chung cho Tạo mới và Chỉnh sửa. */
export interface ClanFormValues {
  name: string;
  description: string;
  avatar_frame: string | null;
  visibility: "private" | "public";
  public_show_tree: boolean;
  public_show_heritage: boolean;
  public_show_graves: boolean;
  public_show_events: boolean;
  root_is_gen_zero: boolean;
  display_death_details: boolean;
  display_living_full_dob: boolean;
  hide_photos_in_share: boolean;
}

export const DEFAULT_CLAN_FORM: ClanFormValues = {
  name: "",
  description: "",
  avatar_frame: null,
  visibility: "private",
  public_show_tree: true,
  public_show_heritage: true,
  public_show_graves: true,
  public_show_events: true,
  root_is_gen_zero: false,
  display_death_details: false,
  display_living_full_dob: false,
  hide_photos_in_share: false,
};

export function clanFormFromClan(clan: ClanDetail): ClanFormValues {
  return {
    name: clan.name,
    description: clan.description ?? "",
    avatar_frame: clan.avatar_frame ?? null,
    visibility: clan.visibility as "private" | "public",
    public_show_tree: clan.public_show_tree,
    public_show_heritage: clan.public_show_heritage,
    public_show_graves: clan.public_show_graves,
    public_show_events: clan.public_show_events,
    root_is_gen_zero: clan.generation_offset === 1,
    display_death_details: clan.display_death_details,
    display_living_full_dob: clan.display_living_full_dob,
    hide_photos_in_share: clan.hide_photos_in_share,
  };
}

/** Các cột dòng họ giống nhau giữa tạo mới và cập nhật. */
export function clanFormToColumns(v: ClanFormValues): UpdateClanInput & CreateClanInput {
  return {
    name: v.name.trim(),
    description: v.description.trim() || undefined,
    visibility: v.visibility,
    avatar_frame: v.avatar_frame,
    generation_offset: v.root_is_gen_zero ? 1 : 0,
    hide_photos_in_share: v.hide_photos_in_share,
    display_death_details: v.display_death_details,
    display_living_full_dob: v.display_living_full_dob,
    public_show_tree: v.public_show_tree,
    public_show_heritage: v.public_show_heritage,
    public_show_graves: v.public_show_graves,
    public_show_events: v.public_show_events,
  };
}

interface FieldsProps {
  value: ClanFormValues;
  onChange: (next: ClanFormValues) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/** Tên, mô tả, viền avatar. */
export function ClanBasicFields({ value, onChange, disabled, idPrefix = "clan" }: FieldsProps) {
  const set = (patch: Partial<ClanFormValues>) => onChange({ ...value, ...patch });
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-name`} required>
          Tên dòng họ
        </Label>
        <Input
          id={`${idPrefix}-name`}
          className="h-10"
          icon={<IconBuildings />}
          data-testid="clan-name-input"
          required
          maxLength={100}
          disabled={disabled}
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Vd: Họ Nguyễn Hữu"
        />
      </div>
      <div className="space-y-1">
        <Textarea
          id={`${idPrefix}-description`}
          label="Mô tả (tuỳ chọn)"
          icon={<IconScroll />}
          data-testid="clan-description-input"
          maxLength={500}
          rows={3}
          disabled={disabled}
          value={value.description}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Vài dòng giới thiệu về dòng họ"
          className="leading-relaxed"
        />
        <p className="text-right text-xs text-muted-foreground">{value.description.length}/500</p>
      </div>
      {disabled ? null : (
        <AvatarFramePicker
          value={value.avatar_frame}
          onChange={(f) => set({ avatar_frame: f })}
          gender="M"
          label="Viền avatar cả dòng họ"
          hint="Áp cho avatar của mọi thành viên trong họ."
        />
      )}
    </div>
  );
}

const PUBLIC_OPTIONS = [
  { key: "public_show_tree", label: "Cây gia phả & Danh bạ", desc: "Xem cây gia phả và danh sách thành viên (thông tin nhạy cảm của người sống vẫn được ẩn)." },
  { key: "public_show_heritage", label: "Di sản dòng họ", desc: "Xem từ đường, tục lệ, giai thoại, kỷ vật kèm ảnh." },
  { key: "public_show_graves", label: "Mộ phần & tro cốt", desc: "Xem nơi an nghỉ, người an nghỉ và ảnh mộ." },
  { key: "public_show_events", label: "Sự kiện", desc: "Xem lịch sự kiện dòng họ (giỗ, họp họ, lễ tiết)." },
] as const;

const DISPLAY_OPTIONS = [
  { key: "root_is_gen_zero", label: "Thủy tổ là Đời 0", desc: "Mặc định Thủy tổ là Đời 1, con cháu là Đời 2, 3, 4… Bật nếu dòng họ quen tính Thủy tổ là Đời 0. Chỉ đổi cách hiển thị, không động vào dữ liệu gốc." },
  { key: "display_death_details", label: "Người đã mất: hiện ngày giỗ và tuổi thọ", desc: "Thẻ người đã mất trên cây và trong sách PDF hiện thêm ngày giỗ (âm lịch) và tuổi thọ." },
  { key: "display_living_full_dob", label: "Người sống: hiện đầy đủ ngày-tháng-năm sinh", desc: "Mặc định chỉ hiện năm sinh. Bật để hiện đủ ngày/tháng/năm trên cây và trong sách PDF." },
  { key: "hide_photos_in_share", label: "Ẩn ảnh thật khi xem qua link công khai", desc: "Người vào bằng link chỉ thấy ảnh đại diện mặc định (nam/nữ). Thành viên đăng nhập vẫn thấy ảnh thật." },
] as const;

/** Chế độ hiển thị, phần người ngoài được xem, đánh số đời, tuỳ chọn hiển thị. */
export function ClanDisplayFields({ value, onChange, disabled }: FieldsProps) {
  const set = (patch: Partial<ClanFormValues>) => onChange({ ...value, ...patch });
  const isPrivate = value.visibility === "private";
  return (
    <div className="space-y-5">
      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-base font-medium mb-2">Chế độ hiển thị</legend>
        {(
          [
            { v: "private", label: "Riêng tư", desc: "Chỉ thành viên được mời xem được." },
            { v: "public", label: "Công khai", desc: "Mọi tài khoản đăng nhập xem được; người còn sống bị ẩn thông tin nhạy cảm." },
          ] as const
        ).map((o) => (
          <label key={o.v} className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="visibility"
              checked={value.visibility === o.v}
              onChange={() => set({ visibility: o.v })}
              className="mt-1.5 h-4 w-4 accent-primary"
            />
            <div>
              <p className="font-medium">{o.label}</p>
              <p className="text-sm text-muted-foreground">{o.desc}</p>
            </div>
          </label>
        ))}
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-base font-medium mb-1">Người xem công khai được xem</legend>
        <p className="text-sm text-muted-foreground">
          Chọn phần nào người ngoài (đã đăng nhập, không phải thành viên) xem được.
          {isPrivate ? " Cần chọn chế độ Công khai ở trên trước." : ""}
        </p>
        <div className={isPrivate ? "space-y-3 opacity-50 pointer-events-none" : "space-y-3"}>
          {PUBLIC_OPTIONS.map((o) => (
            <label key={o.key} className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={value[o.key]}
                disabled={isPrivate}
                onChange={(e) => set({ [o.key]: e.target.checked })}
                className="mt-1 h-5 w-5 accent-primary shrink-0"
              />
              <div>
                <p className="font-medium">{o.label}</p>
                <p className="text-sm text-muted-foreground">{o.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="space-y-3" disabled={disabled}>
        <legend className="text-base font-medium mb-1">Cách hiển thị</legend>
        {DISPLAY_OPTIONS.map((o) => (
          <label key={o.key} className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={value[o.key]}
              onChange={(e) => set({ [o.key]: e.target.checked })}
              className="mt-1 h-5 w-5 accent-primary shrink-0"
            />
            <div>
              <p className="font-medium">{o.label}</p>
              <p className="text-sm text-muted-foreground">{o.desc}</p>
            </div>
          </label>
        ))}
      </fieldset>
    </div>
  );
}
