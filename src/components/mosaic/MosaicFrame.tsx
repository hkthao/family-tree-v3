import type { ReactNode } from "react";

const GOLD = "var(--gold)";

/** Họa tiết góc: hình thoi vàng nhỏ ghim ở bốn góc khung. */
function Corner({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`absolute h-3.5 w-3.5 rotate-45 rounded-[2px] ${className}`}
      style={{
        background: `linear-gradient(135deg, hsl(${GOLD} / 1), hsl(38 62% 33%))`,
        boxShadow:
          "0 1px 2px rgba(0,0,0,.45), inset 0 0 0 1px rgba(255,255,255,.35)",
      }}
    />
  );
}

/**
 * Khung tranh cho bức ảnh ghép: viền gỗ mạ vàng → đường chỉ rượu vang → giấy lót
 * (passe-partout) ngà → mặt tranh lõm nhẹ; dưới chân có bảng tên khắc.
 */
export function MosaicFrame({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <figure className="mx-auto w-full max-w-5xl">
      {/* Khung gỗ mạ vàng */}
      <div
        className="relative rounded-md p-3 sm:p-4"
        style={{
          background: `linear-gradient(145deg, hsl(${GOLD}) 0%, hsl(38 62% 33%) 28%, hsl(${GOLD}) 52%, hsl(38 62% 28%) 78%, hsl(${GOLD}) 100%)`,
          boxShadow:
            "0 18px 38px -12px rgba(0,0,0,.65), 0 2px 0 rgba(255,255,255,.25) inset, 0 -2px 0 rgba(0,0,0,.35) inset",
        }}
      >
        <Corner className="-left-1.5 -top-1.5" />
        <Corner className="-right-1.5 -top-1.5" />
        <Corner className="-bottom-1.5 -left-1.5" />
        <Corner className="-bottom-1.5 -right-1.5" />

        {/* Đường chỉ rượu vang */}
        <div
          className="rounded-[3px] p-[3px]"
          style={{
            background: "hsl(var(--primary))",
            boxShadow:
              "0 0 0 1px rgba(0,0,0,.35), 0 1px 3px rgba(0,0,0,.5) inset",
          }}
        >
          {/* Giấy lót */}
          <div
            className="rounded-[2px] p-3 sm:p-5"
            style={{
              background: "#efe9df",
              boxShadow: "inset 0 2px 6px rgba(60,40,20,.28)",
            }}
          >
            {/* Mặt tranh lõm vào giấy lót */}
            <div
              className="overflow-hidden"
              style={{
                boxShadow:
                  "0 0 0 1px rgba(120,90,40,.55), 0 0 0 4px #efe9df, 0 0 0 5px rgba(120,90,40,.35), 0 4px 10px rgba(60,40,20,.35)",
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>

      {/* Bảng tên khắc dưới chân tranh */}
      <figcaption
        className="mx-auto -mt-1 w-fit max-w-[92%] rounded-b-md px-6 pb-2 pt-3 text-center"
        style={{
          background: `linear-gradient(180deg, hsl(${GOLD}) 0%, hsl(38 62% 33%) 100%)`,
          boxShadow:
            "0 6px 12px -4px rgba(0,0,0,.55), 0 1px 0 rgba(255,255,255,.3) inset",
        }}
      >
        <span className="block truncate font-serif text-base font-semibold text-[#2a1708]">
          {title}
        </span>
        {caption && (
          <span className="block text-xs tracking-wide text-[#2a1708]/80">
            {caption}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
