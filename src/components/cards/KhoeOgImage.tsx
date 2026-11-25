import type { ReactNode } from "react";

export const OG_W = 1200;
export const OG_H = 630;
/** Khung dành cho tấm thiệp ở bên trái ảnh OG. */
const BOX_W = 480;
const BOX_H = 500;

/**
 * Ảnh xem trước 1200×630 cho link khoe khi dán vào Zalo / Facebook (docs/plan-thiep-khoe-design.md, T6). Khổ vuông / dọc của
 * thiệp không hợp tỉ lệ 1,91:1 nên đặt thiệp (đã thu nhỏ, giữ nguyên tỉ lệ) bên trái trên nền thương hiệu, tên họ + tiêu đề chữ LỚN
 * bên phải (đọc được cả ở cỡ thu nhỏ). Chỉ dùng style nội tuyến để html-to-image xuất đúng; luôn nền tối, không phụ thuộc giao diện.
 */
export function KhoeOgImage({
  card,
  cardW,
  cardH,
  clanName,
  title,
  subtitle,
}: {
  /** Nội dung tấm thiệp ở kích thước gốc (cardW × cardH). */
  card: ReactNode;
  cardW: number;
  cardH: number;
  clanName: string;
  title: string;
  subtitle?: string | null;
}) {
  const scale = Math.min(BOX_W / cardW, BOX_H / cardH);
  const w = cardW * scale;
  const h = cardH * scale;
  return (
    <div
      style={{
        width: OG_W,
        height: OG_H,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        gap: 56,
        padding: "0 72px",
        background: "radial-gradient(circle at 15% 10%, #3a2a24, #1a1612 65%)",
        color: "#efe9db",
        fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 18,
          border: "1px solid rgba(212,160,69,.45)",
          borderRadius: 20,
        }}
      />
      <div
        style={{
          flex: "none",
          width: BOX_W,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: w,
            height: h,
            overflow: "hidden",
            borderRadius: 14,
            boxShadow: "0 14px 40px rgba(0,0,0,.45)",
          }}
        >
          <div
            style={{
              width: cardW,
              height: cardH,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
            }}
          >
            {card}
          </div>
        </div>
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <div
          style={{
            fontFamily: "'Noto Serif', serif",
            fontWeight: 700,
            fontSize: 30,
            color: "#d4a045",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {clanName}
        </div>
        <div
          style={{
            fontFamily: "'Noto Serif', serif",
            fontWeight: 700,
            fontSize: 60,
            lineHeight: 1.15,
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.35,
              color: "#bab1a3",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {subtitle}
          </div>
        )}
        <div style={{ marginTop: 6, fontSize: 22, color: "#d4a045" }}>
          Dòng Họ Việt
        </div>
      </div>
    </div>
  );
}
