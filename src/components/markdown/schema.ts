import { defaultSchema } from "rehype-sanitize";
import type { Options as SanitizeOptions } from "rehype-sanitize";

/**
 * Danh sách thẻ/thuộc tính được phép khi xem trước Markdown có chèn HTML (figure/img/table như bài Sổ tay).
 * Dựa trên schema mặc định của rehype-sanitize (đã chặn script, on*, javascript:), chỉ thêm thẻ ảnh có chú thích.
 */
export const markdownSanitizeSchema: SanitizeOptions = {
  ...defaultSchema,
  tagNames: [...(defaultSchema.tagNames ?? []), "figure", "figcaption"],
  attributes: {
    ...defaultSchema.attributes,
    img: [...(defaultSchema.attributes?.img ?? []), "width", "height", "loading", "alt", "src"],
  },
};
