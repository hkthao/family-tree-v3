import MDEditor, { commands, type ICommand } from "@uiw/react-md-editor";
import "@uiw/react-md-editor/markdown-editor.css";
import "@uiw/react-markdown-preview/markdown.css";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

import "./editor.css";
import { markdownSanitizeSchema } from "./schema";

const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/** Giữ biểu tượng gốc (gọn), chỉ đổi gợi ý khi rê chuột / đọc màn hình sang tiếng Việt. */
function hinted(cmd: ICommand, hint: string, icon?: ICommand["icon"]): ICommand {
  return { ...cmd, ...(icon ? { icon } : {}), buttonProps: { ...cmd.buttonProps, title: hint, "aria-label": hint } };
}

/** Nút tiêu đề gốc là nhãn chữ ("Heading 2") rộng hơn các nút khác, làm lệch hàng: thay bằng ký hiệu H2 gọn. */
const H2_ICON = <span style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>H2</span>;

const TOOLBAR: ICommand[] = [
  hinted(commands.title2, "Tiêu đề mục (##)", H2_ICON),
  hinted(commands.bold, "Chữ đậm"),
  hinted(commands.italic, "Chữ nghiêng"),
  hinted(commands.unorderedListCommand, "Danh sách gạch đầu dòng"),
  hinted(commands.orderedListCommand, "Danh sách đánh số 1, 2, 3"),
  hinted(commands.quote, "Đoạn trích dẫn"),
  hinted(commands.link, "Chèn liên kết"),
  hinted(commands.image, "Chèn ảnh bằng địa chỉ"),
  hinted(commands.table, "Chèn bảng"),
];

/**
 * Trình soạn Markdown có thanh công cụ và xem trước trực tiếp (@uiw/react-md-editor). Xem trước cho phép HTML an toàn
 * (đã qua rehype-sanitize). Component nặng → luôn nạp bằng React.lazy ở nơi dùng. Tái dùng cho bài Sổ tay, phả ký,
 * tiểu sử, lời nói đầu…
 */
export default function MarkdownEditor({
  value,
  onChange,
  height = 520,
  placeholder,
  preview = "live",
}: {
  value: string;
  onChange: (v: string) => void;
  height?: number;
  placeholder?: string;
  /** "live": soạn + xem trước cạnh nhau; "edit": chỉ soạn (chỗ hẹp như ngăn kéo — vẫn có nút bật xem trước). */
  preview?: "live" | "edit";
}) {
  return (
    <div data-color-mode={isDark() ? "dark" : "light"} className="big-md rounded-lg border">
      <MDEditor
        value={value}
        onChange={(v) => onChange(v ?? "")}
        height={height}
        preview={preview}
        commands={TOOLBAR}
        visibleDragbar={false}
        textareaProps={{ placeholder }}
        previewOptions={{ rehypePlugins: [rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]] }}
      />
    </div>
  );
}
