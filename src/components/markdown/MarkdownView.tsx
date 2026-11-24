import MDEditor from "@uiw/react-md-editor";
import "@uiw/react-markdown-preview/markdown.css";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";

import { markdownSanitizeSchema } from "./schema";

const isDark = () => typeof document !== "undefined" && document.documentElement.classList.contains("dark");

/** Hiển thị nội dung Markdown (cho phép HTML an toàn) với kiểu chữ đẹp, đồng bộ với bản xem trước của trình soạn. */
export default function MarkdownView({ source }: { source: string }) {
  return (
    <div data-color-mode={isDark() ? "dark" : "light"}>
      <MDEditor.Markdown
        source={source}
        style={{ background: "transparent", fontSize: 17, lineHeight: 1.9 }}
        rehypePlugins={[rehypeRaw, [rehypeSanitize, markdownSanitizeSchema]]}
      />
    </div>
  );
}
