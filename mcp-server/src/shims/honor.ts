/** Thay `@/lib/queries/honor` (dùng macro i18n của Lingui, không chạy được ngoài Vite): sổ PDF luôn bằng tiếng Việt. */
export type HonorCategory = "donation_money" | "donation_labor" | "academic" | "other";

export const HONOR_CATEGORY_LABEL: Record<HonorCategory, string> = {
  donation_money: "Công đức (tiền)",
  donation_labor: "Đóng góp công sức",
  academic: "Thành tích học tập",
  other: "Khác",
};
