import { i18n } from "@lingui/core";
import { msg } from "@lingui/core/macro";

/**
 * Mẫu nền poster dòng thời gian. Mỗi mẫu là một bảng màu hoàn chỉnh (nền, chữ, trục, chấm, giấy ghi chú)
 * — poster chỉ đọc màu từ đây nên thêm mẫu mới = thêm một phần tử vào `RAW`, không sửa chỗ nào khác.
 * Nền dùng CSS thuần (gradient), không cần file ảnh → xuất ảnh/in ổn định.
 */
export interface PosterTheme {
  id: string;
  label: string;
  /** Mô tả một dòng, hiện trong danh sách chọn. */
  hint: string;
  /** Giá trị CSS `background` (màu hoặc gradient). */
  bg: string;
  /** Màu đặc tương đương nền — dùng làm viền hở quanh chấm trên trục. */
  solid: string;
  border: string;
  ink: string;
  text: string;
  muted: string;
  accent: string;
  green: string;
  line: string;
  /** Màu mực con triện (viền + chữ): đỏ son trên nền sáng, vàng trên nền đỏ / tối. */
  seal: string;
  dots: string[];
  notes: string[];
  /** Chữ trên giấy ghi chú (luôn nền sáng nên cần tương phản riêng, kể cả khi poster nền tối). */
  noteInk: string;
  noteText: string;
}

interface Raw extends Omit<PosterTheme, "label" | "hint"> {
  label: ReturnType<typeof msg>;
  hint: ReturnType<typeof msg>;
}

const NOTE_LIGHT = ["#F4E7B4", "#DDE8C9", "#EBD9BD", "#F2D7C6", "#D6E3E4"];

const RAW: Raw[] = [
  {
    id: "giay-kem",
    label: msg`Giấy kem`,
    hint: msg`Ấm áp, truyền thống — mặc định`,
    bg: "#F6EEDC",
    solid: "#F6EEDC",
    border: "#d8c9a6",
    ink: "#1F2A44",
    text: "#4A4032",
    muted: "#7B6F5C",
    accent: "#7A2E2E",
    green: "#5E7B4F",
    line: "#2B3558",
    seal: "#C23A2B",
    dots: ["#1F2A44", "#5E7B4F", "#B8862A", "#7A2E2E", "#3F6E7A"],
    notes: NOTE_LIGHT,
    noteInk: "#1F2A44",
    noteText: "#4A4032",
  },
  {
    id: "giay-co",
    label: msg`Giấy cổ`,
    hint: msg`Màu da bò sẫm, như gia phả xưa`,
    bg: "radial-gradient(ellipse at 50% 0%, #EBD8AE 0%, #D8BE88 100%)",
    solid: "#E2CB9A",
    border: "#b79a62",
    ink: "#3B2A14",
    text: "#4A3720",
    muted: "#7A6238",
    accent: "#6E2B1F",
    green: "#6B6A2F",
    line: "#4A3720",
    seal: "#B32E1E",
    dots: ["#3B2A14", "#6B6A2F", "#A8742A", "#6E2B1F", "#5A5A3A"],
    notes: ["#F1E2B6", "#E2E3BE", "#EED7B3", "#EFD0BC", "#DCE0C8"],
    noteInk: "#3B2A14",
    noteText: "#4A3720",
  },
  {
    id: "thuy-mac",
    label: msg`Thuỷ mặc`,
    hint: msg`Trắng xám, nét mực đen — trang nhã`,
    bg: "linear-gradient(180deg, #F5F4F0 0%, #E3E1DA 100%)",
    solid: "#ECEAE4",
    border: "#c9c6bc",
    ink: "#1B1B1B",
    text: "#3B3B3B",
    muted: "#6B6B6B",
    accent: "#9A2B2B",
    green: "#4F5E57",
    line: "#222222",
    seal: "#B3261E",
    dots: ["#222222", "#4F5E57", "#6B6B6B", "#9A2B2B", "#3A3A3A"],
    notes: ["#ECEAE4", "#E1E3DF", "#E8E4DC", "#EBDFDA", "#DDE3E3"],
    noteInk: "#1B1B1B",
    noteText: "#3B3B3B",
  },
  {
    id: "tre-xanh",
    label: msg`Tre xanh`,
    hint: msg`Xanh lá dịu, thanh bình`,
    bg: "linear-gradient(180deg, #EEF3E6 0%, #DCE8D0 100%)",
    solid: "#E4EDDA",
    border: "#b5c9a3",
    ink: "#1F3A2B",
    text: "#35503F",
    muted: "#62786A",
    accent: "#8A3B2E",
    green: "#3F6E4A",
    line: "#2A4A36",
    seal: "#B8392C",
    dots: ["#1F3A2B", "#3F6E4A", "#B8862A", "#8A3B2E", "#3F6E7A"],
    notes: ["#F2EBC0", "#D4E6C8", "#EADFC4", "#F0D9C8", "#D2E4E2"],
    noteInk: "#1F3A2B",
    noteText: "#35503F",
  },
  {
    id: "do-vang",
    label: msg`Đỏ – vàng`,
    hint: msg`Nền đỏ son, chữ vàng — ngày Tết, lễ lớn`,
    bg: "radial-gradient(ellipse at 50% 0%, #A23630 0%, #6F1E1B 100%)",
    solid: "#842925",
    border: "#c9a24a",
    ink: "#F8E7B5",
    text: "#F3E3C3",
    muted: "#E4CFA0",
    accent: "#F2D68A",
    green: "#F2D68A",
    line: "#F2D68A",
    seal: "#F2D68A",
    dots: ["#F2D68A", "#F8E7B5", "#E9B84E", "#F4C9A0", "#D9C48A"],
    notes: NOTE_LIGHT,
    noteInk: "#6F1E1B",
    noteText: "#4A4032",
  },
  {
    id: "xanh-dem",
    label: msg`Xanh đêm`,
    hint: msg`Nền xanh than, nét vàng nhạt — sang trọng`,
    bg: "linear-gradient(180deg, #24324F 0%, #141C30 100%)",
    solid: "#1B2540",
    border: "#8A7A4A",
    ink: "#F4E7B4",
    text: "#DCE0EA",
    muted: "#A9B1C6",
    accent: "#E9B84E",
    green: "#9CC0A8",
    line: "#E9B84E",
    seal: "#E9B84E",
    dots: ["#E9B84E", "#9CC0A8", "#F4E7B4", "#E39A8C", "#8FB4D6"],
    notes: NOTE_LIGHT,
    noteInk: "#1F2A44",
    noteText: "#4A4032",
  },
];

export const DEFAULT_THEME_ID = "giay-kem";

/** Các mẫu nền, đã dịch theo ngôn ngữ hiện tại. Gọi lúc render. */
export function getPosterThemes(): PosterTheme[] {
  return RAW.map((r) => ({
    ...r,
    label: i18n._(r.label),
    hint: i18n._(r.hint),
  }));
}

export function getPosterTheme(id: string | null | undefined): PosterTheme {
  const all = getPosterThemes();
  return all.find((x) => x.id === id) ?? all[0];
}
