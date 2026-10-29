import { createContext, useContext, type ReactElement } from "react";

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
  lotus: "Hoa sen",
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

const GOLD = ["#F6E27A", "#D4A017", "#8A5A00"];
const SILVER = ["#F4F4F4", "#B5B8BD", "#6F7379"];

function Gradient({ id, stops }: { id: string; stops: string[] }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stopColor={stops[0]} />
      <stop offset="0.5" stopColor={stops[1]} />
      <stop offset="1" stopColor={stops[2]} />
    </linearGradient>
  );
}

/** Vòng nguyệt quế: hai cành lá ôm hai bên ảnh, hở phía trên. */
function Laurel(): ReactElement {
  const leaves: ReactElement[] = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 9; i++) {
      const t = Math.PI / 2 + side * (0.32 + i * 0.3);
      const cx = 50 + 45 * Math.cos(t);
      const cy = 50 + 45 * Math.sin(t);
      const tangent = (t * 180) / Math.PI + 90;
      for (const lean of [-38, 38]) {
        leaves.push(
          <ellipse
            key={`${side}-${i}-${lean}`}
            cx={cx}
            cy={cy}
            rx={6.2 - i * 0.18}
            ry={2.5}
            transform={`rotate(${tangent + lean} ${cx} ${cy})`}
            fill="url(#af-laurel)"
          />,
        );
      }
    }
  }
  return (
    <>
      <defs>
        <Gradient id="af-laurel" stops={["#9BCB5B", "#4F8A2B", "#2D5A1B"]} />
      </defs>
      <circle cx="50" cy="50" r="44" fill="none" stroke="#4F8A2B" strokeWidth="1" opacity="0.5" />
      {leaves}
    </>
  );
}

function FrameArt({ frame }: { frame: AvatarFrame }): ReactElement {
  switch (frame) {
    case "laurel":
      return <Laurel />;
    case "gold":
      return (
        <>
          <defs>
            <Gradient id="af-gold" stops={GOLD} />
          </defs>
          <circle cx="50" cy="50" r="45" fill="none" stroke="url(#af-gold)" strokeWidth="6" />
          <circle cx="50" cy="50" r="40.5" fill="none" stroke="url(#af-gold)" strokeWidth="1.5" />
        </>
      );
    case "silver":
      return (
        <>
          <defs>
            <Gradient id="af-silver" stops={SILVER} />
          </defs>
          <circle cx="50" cy="50" r="45" fill="none" stroke="url(#af-silver)" strokeWidth="6" />
          <circle cx="50" cy="50" r="40.5" fill="none" stroke="url(#af-silver)" strokeWidth="1.5" />
        </>
      );
    case "royal":
      return (
        <>
          <defs>
            <Gradient id="af-royal" stops={GOLD} />
          </defs>
          <circle cx="50" cy="50" r="45" fill="none" stroke="url(#af-royal)" strokeWidth="6" />
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4 + Math.PI / 8;
            const x = 50 + 45 * Math.cos(a);
            const y = 50 + 45 * Math.sin(a);
            return <rect key={i} x={x - 3} y={y - 3} width="6" height="6" transform={`rotate(45 ${x} ${y})`} fill="#B3261E" stroke="#F6E27A" strokeWidth="1" />;
          })}
          {/* Mão vương miện ở đỉnh */}
          <path d="M36 12 L38 -4 L45 5 L50 -8 L55 5 L62 -4 L64 12 Z" fill="url(#af-royal)" stroke="#8A5A00" strokeWidth="1" />
        </>
      );
    case "lotus":
      return (
        <>
          <defs>
            <linearGradient id="af-lotus" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFD6E8" />
              <stop offset="1" stopColor="#E0679A" />
            </linearGradient>
          </defs>
          {Array.from({ length: 14 }, (_, i) => {
            const a = (i * 2 * Math.PI) / 14;
            const x = 50 + 44 * Math.cos(a);
            const y = 50 + 44 * Math.sin(a);
            return <ellipse key={i} cx={x} cy={y} rx="7.5" ry="3.6" transform={`rotate(${(a * 180) / Math.PI} ${x} ${y})`} fill="url(#af-lotus)" stroke="#fff" strokeWidth="0.8" />;
          })}
        </>
      );
    case "fortune":
      return (
        <>
          <circle cx="50" cy="50" r="45" fill="none" stroke="#B3261E" strokeWidth="6" />
          <circle cx="50" cy="50" r="41" fill="none" stroke="#F6E27A" strokeWidth="1.2" />
          {Array.from({ length: 16 }, (_, i) => {
            const a = (i * 2 * Math.PI) / 16;
            return <circle key={i} cx={50 + 45 * Math.cos(a)} cy={50 + 45 * Math.sin(a)} r="1.7" fill="#F6E27A" />;
          })}
        </>
      );
  }
}
