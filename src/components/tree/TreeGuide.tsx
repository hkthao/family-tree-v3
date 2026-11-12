import { useState } from "react";

/**
 * Bảng "Cách xem" nổi ở góc dưới-trái biểu đồ cây 2D: cách thao tác (máy tính / điện thoại) và
 * chú thích màu. Dùng CHUNG cho trang Cây và trang Chia sẻ — sửa nội dung ở đây là cả hai trang theo.
 * Đặt trong khung `relative` bọc biểu đồ. `defaultOpen=false` để bắt đầu thu gọn thành nút "Cách xem".
 */
export function TreeGuide({ defaultOpen = true }: { defaultOpen?: boolean }) {
  const [showGuide, setShowGuide] = useState(defaultOpen);
  return (
    <>
      {showGuide ? (
        <div className="pointer-events-none absolute bottom-3 left-3 z-10 max-w-[16rem] space-y-1 rounded-lg border border-border bg-background/85 px-3 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur print-hide">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="font-medium text-foreground">Cách xem</span>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="pointer-events-auto -mr-1 -mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Ẩn hướng dẫn"
              title="Ẩn hướng dẫn"
            >
              ✕
            </button>
          </div>
          {/* Máy tính */}
          <div className="hidden space-y-1 sm:block">
            <div>
              <b className="text-foreground">Kéo</b> — di chuyển
            </div>
            <div>
              <b className="text-foreground">Lăn chuột</b> — phóng to / thu nhỏ
            </div>
            <div>
              <b className="text-foreground">Bấm một thẻ</b> — đặt làm trung tâm
            </div>
          </div>
          {/* Điện thoại */}
          <div className="space-y-1 sm:hidden">
            <div>Vuốt 1 ngón để di chuyển</div>
            <div>Kéo 2 ngón để phóng to / thu nhỏ</div>
            <div>Chạm thẻ để đặt trung tâm</div>
          </div>
          {/* Chú thích màu: thẻ theo giới; dâu/rể viền đứt. */}
          <div className="mt-1.5 space-y-1 border-t border-border pt-1.5 text-foreground">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ background: "var(--tree-card-male)" }}
                />{" "}
                Nam
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-border"
                  style={{ background: "var(--tree-card-female)" }}
                />{" "}
                Nữ
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-2.5 w-2.5 rounded-full border border-dashed"
                  style={{ borderColor: "#B8862A" }}
                />{" "}
                Dâu/rể
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ background: "#B8862A" }}
                />{" "}
                Con trai
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ background: "#C27B6A" }}
                />{" "}
                Con gái
              </span>
              <span className="inline-flex items-center gap-1">
                <span
                  className="h-0.5 w-4 rounded"
                  style={{ background: "#9B3535" }}
                />{" "}
                Vợ chồng
              </span>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="pointer-events-auto absolute bottom-3 left-3 z-10 inline-flex items-center gap-1 rounded-lg border border-border bg-background/85 px-2.5 py-1.5 text-xs text-muted-foreground shadow-sm backdrop-blur hover:text-foreground print-hide"
          aria-label="Hiện hướng dẫn"
          title="Hiện hướng dẫn"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-current text-[10px] font-bold">
            ?
          </span>
          Cách xem
        </button>
      )}
    </>
  );
}
