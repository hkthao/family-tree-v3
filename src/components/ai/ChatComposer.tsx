import { IconSend } from "@/components/icons";
import { Button } from "@/components/ui/button";

/**
 * Ô nhập + chip gợi ý. Dùng chung cho trang toàn màn hình và khung nổi.
 *
 * Chip gợi ý chỉ hiện khi **chưa có tin nào** và bàn phím đang đóng: nó là
 * mồi cho lần đầu, không phải thanh công cụ thường trực. Hỏi rồi thì chỗ
 * đó nhường cho câu trả lời.
 */

const SUGGESTIONS = [
  "Giỗ sắp tới là ngày nào?",
  "Dòng họ có bao nhiêu người?",
  "Ông tổ của dòng họ là ai?",
  "Tôi gọi bác cả là gì?",
];

export function ChatComposer({
  draft,
  onDraftChange,
  onSend,
  pending,
  showSuggestions,
  suggestionLayout = "scroll",
  className,
}: {
  draft: string;
  onDraftChange: (v: string) => void;
  onSend: (text: string) => void;
  pending: boolean;
  showSuggestions: boolean;
  /**
   * `scroll` — một hàng, vuốt ngang. Đúng cho khung rộng cả màn hình.
   * `wrap`   — xuống dòng. Khung nổi chỉ rộng 24rem, để cuộn ngang thì
   *            chip thứ hai luôn bị cắt lửng ở mép, trông như lỗi.
   */
  suggestionLayout?: "scroll" | "wrap";
  className?: string;
}) {
  const wrap = suggestionLayout === "wrap";
  return (
    <div className={className}>
      {showSuggestions && (
        <div className={`shrink-0 px-3 pb-2 ${wrap ? "" : "overflow-x-auto"}`}>
          <div
            className={`flex gap-2 ${wrap ? "flex-wrap" : ""}`}
            style={wrap ? undefined : { scrollSnapType: "x proximity" }}
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onSend(s)}
                className={`min-h-[44px] shrink-0 rounded-full border px-4 text-sm hover:bg-secondary ${
                  wrap ? "" : "whitespace-nowrap"
                }`}
                style={wrap ? undefined : { scrollSnapAlign: "start" }}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onSend(draft);
        }}
        className="flex shrink-0 items-end gap-2 border-t bg-background px-3 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        {/* icon-audit: ok — ô chat chiếm gần hết chiều ngang, đã có nút gửi cạnh bên */}
        <textarea
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              onSend(draft);
            }
          }}
          rows={1}
          placeholder="Hỏi về gia phả…"
          aria-label="Câu hỏi"
          // 18px: dưới 16px là iOS tự phóng to khi focus, mà app đang
          // chặn pinch-zoom nên người dùng không zoom lại được.
          className="max-h-32 min-h-[48px] flex-1 resize-none rounded-2xl border bg-background px-4 py-3 leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring"
          style={{ fontSize: 18 }}
        />
        <Button
          type="submit"
          size="icon"
          disabled={!draft.trim() || pending}
          aria-label="Gửi"
          className="h-12 w-12 shrink-0 rounded-full"
        >
          <IconSend className="h-5 w-5" />
        </Button>
      </form>
    </div>
  );
}
