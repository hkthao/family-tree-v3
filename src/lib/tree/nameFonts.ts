/** Font tên trên thẻ cây (2D + 3D). `family` đưa vào CSS / canvas. */
export const NAME_FONTS = [
  { id: "playfair", label: "Trang nhã (Playfair)", family: '"Playfair Display"' },
  { id: "cormorant", label: "Cổ điển (Cormorant)", family: '"Cormorant Garamond"' },
  { id: "charm", label: "Thư pháp (Charm)", family: '"Charm"' },
  { id: "playwrite", label: "Thư pháp (Playwrite VN)", family: '"Playwrite VN"' },
  { id: "dancing", label: "Thư pháp (Dancing Script)", family: '"Dancing Script"' },
] as const;

export const NAME_FONT_KEY = "family-tree:tree-name-font";

export function readNameFontId(): string {
  try {
    const v = localStorage.getItem(NAME_FONT_KEY);
    return NAME_FONTS.some((f) => f.id === v) ? (v as string) : "playfair";
  } catch {
    return "playfair";
  }
}

export function nameFontFamily(id: string): string {
  return (NAME_FONTS.find((f) => f.id === id) ?? NAME_FONTS[0]).family;
}
