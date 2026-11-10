import { Text, View } from "@react-pdf/renderer";
import type { Style } from "@react-pdf/types";

import { serifStyle } from "./registerFont";

/**
 * Số trang của từng mục, thu lúc dựng PDF để in vào mục lục.
 *
 * react-pdf chỉ cho biết số trang của CHÍNH phần tử đang vẽ, không cho
 * tham chiếu tới trang khác, nên mục lục không tự biết số. Cách làm: dựng
 * một lượt để tiêu đề từng mục ghi số trang vào đây, rồi dựng lượt hai với
 * mục lục đã có số (trang mục lục không đổi cỡ nên số trang không lệch).
 */
export const pageRegistry: Record<string, number> = {};

export function resetPageRegistry() {
  for (const k of Object.keys(pageRegistry)) delete pageRegistry[k];
}

/** Tiêu đề mục: là mốc nhảy của mục lục và ghi lại số trang. Mục kéo qua nhiều trang lấy trang đầu. */
export function SectionTitle({
  id,
  style,
  children,
}: {
  id: string;
  style?: Style | Style[];
  children: string;
}) {
  return (
    <>
      <Text id={id} style={[serifStyle(), ...(Array.isArray(style) ? style : style ? [style] : [])]}>
        {children}
      </Text>
      {/* Phần tử vô hình chỉ để biết số trang: Text `render` với font tuỳ chỉnh không vẽ được chữ, nên tách riêng khỏi tiêu đề. */}
      <Text
        style={{ position: "absolute", width: 1, height: 1, fontSize: 1 }}
        render={({ pageNumber }) => {
          if (pageNumber && (pageRegistry[id] === undefined || pageNumber < pageRegistry[id])) {
            pageRegistry[id] = pageNumber;
          }
          return " ";
        }}
      />
    </>
  );
}

/**
 * Số trang ở chân trang, giữa. Bìa không có.
 *
 * Định vị bằng `top` (từ cỡ trang) chứ KHÔNG dùng `bottom`: với phần tử
 * `fixed`, react-pdf tính `bottom` sai khi trang có khối `wrap={false}` rơi
 * đúng mép trang (toạ độ ra -1.5e22, dựng PDF báo "unsupported number").
 */
export function PageNumber({ pageHeight = 842 }: { pageHeight?: number }) {
  return (
    <View
      fixed
      wrap={false}
      style={{ position: "absolute", top: pageHeight - 46, left: 0, right: 0, alignItems: "center" }}
    >
      <Text
        style={{ fontSize: 10, color: "#6F665F" }}
        render={({ pageNumber }) => `${pageNumber}`}
      />
    </View>
  );
}
