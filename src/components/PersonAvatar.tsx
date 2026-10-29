import { createContext, useContext, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

/**
 * Viền avatar do dòng họ chọn (lưu ở clans.avatar_frame). Khung vẽ
 * bằng SVG nên không cần tệp ảnh; ảnh người thu nhỏ vào trong để tổng kích
 * thước vẫn đúng `size`.
 */
export const AVATAR_FRAMES = ["laurel", "gold", "silver", "royal", "lotus", "fortune"] as const;
export type AvatarFrame = (typeof AVATAR_FRAMES)[number];

export const AVATAR_FRAME_LABEL: Record<AvatarFrame, string> = {
  laurel: "Vòng nguyệt quế",
  gold: "Vòng vàng",
  silver: "Vòng bạc",
  royal: "Hoàng gia",
  lotus: "Sen hồng",
  fortune: "Phúc lộc",
};

export function isAvatarFrame(v: string | null | undefined): v is AvatarFrame {
  return !!v && (AVATAR_FRAMES as readonly string[]).includes(v);
}

/**
 * Viền avatar mặc định của dòng họ đang xem (clans.avatar_frame). ClanLayout
 * bọc nội dung bằng provider này nên mọi avatar trong họ tự có khung; prop
 * `frame` chỉ dùng để xem trước (kể cả null = ép không viền).
 */
const ClanAvatarFrameContext = createContext<string | null>(null);
export const ClanAvatarFrameProvider = ClanAvatarFrameContext.Provider;

interface Props {
  gender: "M" | "F";
  /**
   * Pre-resolved signed URL pointing at the person's photo in
   * Supabase Storage. Caller is expected to feed it from
   * `useSignedPhotoUrl(photoPath)` so we don't trigger a fresh API
   * call on every avatar render. Falsy → fall back to the gendered
   * illustration.
   */
  photoUrl?: string | null;
  /** Diameter in px. Defaults to 40. */
  size?: number;
  /** Ghi đè viền của dòng họ (xem trước). undefined = theo dòng họ; null = không viền. */
  frame?: string | null;
  className?: string;
}

/**
 * Circular avatar for a person. Renders the uploaded photo when
 * `photoUrl` is provided, otherwise the gendered illustration from
 * /public/avatars.
 */
export function PersonAvatar({ gender, photoUrl, size = 40, frame: frameProp, className }: Props) {
  const clanFrame = useContext(ClanAvatarFrameContext);
  const frame = frameProp !== undefined ? frameProp : clanFrame;
  const fallback = gender === "M" ? "/avatars/male.png" : "/avatars/female.png";
  const framed = isAvatarFrame(frame);
  // Khung chiếm ~10% mỗi bên; ảnh nằm gọn trong vòng.
  const inner = framed ? Math.round(size * 0.8) : size;
  const img = (
    <img
      src={photoUrl || fallback}
      alt=""
      width={inner}
      height={inner}
      loading="lazy"
      decoding="async"
      // Khoá cả hai chiều bằng style: Tailwind đặt `height: auto` cho <img>, nên
      // ảnh đứng / ngang (vd tượng thờ 3:4 từ link ngoài) sẽ méo thành bầu dục;
      // object-cover cắt ảnh vừa khung tròn. shrink-0: không bị ép hẹp trong flex.
      style={
        framed
          ? { width: inner, height: inner, position: "absolute", left: (size - inner) / 2, top: (size - inner) / 2 }
          : { width: size, height: size }
      }
      className={`shrink-0 rounded-full object-cover object-top bg-muted ${framed ? "" : (className ?? "")}`}
      aria-hidden="true"
      draggable={false}
    />
  );
  if (!framed) return img;
  return (
    <span
      className={`relative inline-block shrink-0 ${className ?? ""}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {img}
      <svg viewBox="0 0 100 100" width={size} height={size} className="pointer-events-none absolute inset-0 overflow-visible">
        <FrameArt frame={frame} />
      </svg>
    </span>
  );
}

/**
 * Nét vẽ của khung dạng chuỗi SVG (hệ toạ độ 100×100) cho nơi không dùng React:
 * thẻ cây đồ thị (family-chart) tự dựng DOM SVG.
 */
export function avatarFrameSvg(frame: string | null | undefined): string {
  return isAvatarFrame(frame) ? renderToStaticMarkup(<FrameArt frame={frame} />) : "";
}

// Khung kiểu app hiện đại: viền mảnh + KHE HỞ giữa ảnh và viền (ảnh r=40, viền
// r≈46), gradient kim loại nhiều điểm dừng, huy hiệu nhỏ ở đáy thay vì phụ kiện
// nhô lên. Hệ toạ độ 100×100, overflow hiển thị được.
const RING_R = 46;

function Gradient({ id, stops, vertical }: { id: string; stops: string[]; vertical?: boolean }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2={vertical ? "0" : "1"} y2="1">
      {stops.map((c, i) => (
        <stop key={i} offset={i / (stops.length - 1)} stopColor={c} />
      ))}
    </linearGradient>
  );
}

function Ring({ id, stops, width = 4.5 }: { id: string; stops: string[]; width?: number }) {
  return (
    <>
      <defs>
        <Gradient id={id} stops={stops} />
      </defs>
      <circle cx="50" cy="50" r={RING_R} fill="none" stroke={`url(#${id})`} strokeWidth={width} />
    </>
  );
}

const GOLD = ["#FFF1B8", "#E8B923", "#9A6A07", "#F6D668", "#B8860B"];
const SILVER = ["#FFFFFF", "#C9CED6", "#7B828C", "#E6E9EE", "#9AA1AB"];

/** Huy hiệu tròn ở đáy khung (đồng xu có viền trắng). */
function Badge({ id, children }: { id: string; children: ReactElement }) {
  return (
    <g>
      <circle cx="50" cy="93" r="9.5" fill={`url(#${id})`} stroke="#fff" strokeWidth="2" />
      {children}
    </g>
  );
}

/** Vòng nguyệt quế: hai cành mảnh ôm ảnh từ đáy lên, lá so le trong/ngoài, hở đỉnh. */
function Laurel(): ReactElement {
  const leaves: ReactElement[] = [];
  const N = 8;
  for (const side of [-1, 1]) {
    for (let i = 0; i < N; i++) {
      const theta = 0.42 + i * 0.27;
      const t = Math.PI / 2 + side * theta;
      for (const out of [true, false]) {
        const r = RING_R + (out ? 2.2 : -2.2);
        const cx = 50 + r * Math.cos(t);
        const cy = 50 + r * Math.sin(t);
        const tangent = (t * 180) / Math.PI + 90;
        const lean = (out ? 1 : -1) * side * 34;
        leaves.push(
          <ellipse
            key={`${side}-${i}-${out}`}
            cx={cx}
            cy={cy}
            rx={5.4 - i * 0.22}
            ry={2.1}
            transform={`rotate(${tangent + lean} ${cx} ${cy})`}
            fill={out ? "url(#af-laurel-a)" : "url(#af-laurel-b)"}
          />,
        );
      }
    }
  }
  const a0 = Math.PI / 2 + 0.3;
  const a1 = Math.PI / 2 + 0.42 + (N - 1) * 0.27 + 0.1;
  const arc = (side: number) => {
    const p = (a: number) => `${50 + RING_R * Math.cos(Math.PI / 2 + side * (a - Math.PI / 2))} ${50 + RING_R * Math.sin(Math.PI / 2 + side * (a - Math.PI / 2))}`;
    return `M ${p(a0)} A ${RING_R} ${RING_R} 0 0 ${side === 1 ? 1 : 0} ${p(a1)}`;
  };
  return (
    <>
      <defs>
        <Gradient id="af-laurel-a" stops={["#A8D26B", "#5E9B35"]} />
        <Gradient id="af-laurel-b" stops={["#7FB04A", "#3E7A25"]} />
      </defs>
      <path d={arc(-1)} fill="none" stroke="#4F8A2B" strokeWidth="1.1" strokeLinecap="round" />
      <path d={arc(1)} fill="none" stroke="#4F8A2B" strokeWidth="1.1" strokeLinecap="round" />
      {leaves}
    </>
  );
}

function FrameArt({ frame }: { frame: AvatarFrame }): ReactElement {
  switch (frame) {
    case "laurel":
      return <Laurel />;
    case "gold":
      return <Ring id="af-gold" stops={GOLD} />;
    case "silver":
      return <Ring id="af-silver" stops={SILVER} />;
    case "royal":
      return (
        <>
          <Ring id="af-royal" stops={GOLD} width={5} />
          <defs>
            <Gradient id="af-royal-b" stops={["#FFE27A", "#C9961A"]} vertical />
          </defs>
          <Badge id="af-royal-b">
            {/* Vương miện nhỏ trong huy hiệu */}
            <path d="M44 96.5 L43.5 89.5 L47 92.5 L50 88.5 L53 92.5 L56.5 89.5 L56 96.5 Z" fill="#7A4B00" />
          </Badge>
        </>
      );
    case "lotus":
      return <Ring id="af-lotus" stops={["#FFB3C7", "#FF6B9A", "#C13584", "#FF9966", "#FFB3C7"]} />;
    case "fortune":
      return (
        <>
          <Ring id="af-fortune" stops={["#E0463A", "#B3261E", "#8E1A14", "#D8372C"]} width={5} />
          <circle cx="50" cy="50" r="42.4" fill="none" stroke="#F2C94C" strokeWidth="1" />
        </>
      );
  }
}
