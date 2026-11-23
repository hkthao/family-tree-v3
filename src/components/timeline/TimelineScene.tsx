import { useId } from "react";

import { TIMELINE_ICON_PATHS } from "@/components/timeline/TimelineIcon";
import type { TimelineIconKey } from "@/lib/timeline/eras";

/**
 * THƯ VIỆN HÌNH dựng sẵn cho dòng thời gian: mỗi cảnh ứng với một mẫu mốc (cùng id với `templates.ts`),
 * cùng một phong cách — nền trời chuyển màu, đồi, vài chi tiết (mặt trời / trăng / sao / mây / sóng) và một
 * biểu tượng lớn ở giữa. Vẽ bằng SVG thuần (không file ảnh, không bản quyền, xuất ảnh/in vẫn nét).
 * Thêm cảnh mới = thêm id vào `SCENES` (và một mẫu cùng id nếu muốn nó hiện ở danh sách mẫu).
 */
type Deco = "sun" | "moon" | "stars" | "clouds" | "waves" | "none";

interface Scene {
  sky: [string, string];
  hill: [string, string];
  deco: Deco;
  icon: TimelineIconKey;
}

export const SCENES: Record<string, Scene> = {
  "lap-gia-dinh": { sky: ["#F7D9C9", "#F2B8A5"], hill: ["#C98B7A", "#A96A5C"], deco: "sun", icon: "ring" },
  "con-dau-long": { sky: ["#FBE9B8", "#F7CF8E"], hill: ["#D9A862", "#B98640"], deco: "sun", icon: "cradle" },
  "sum-hop": { sky: ["#F6E3B8", "#EBC97F"], hill: ["#B8944F", "#8F6F33"], deco: "clouds", icon: "family" },
  "dung-nha": { sky: ["#CFE3EE", "#A8CCE0"], hill: ["#7FA06A", "#5E8050"], deco: "clouds", icon: "citadel" },
  "tu-duong": { sky: ["#E9D6A9", "#D3B676"], hill: ["#9A7A3E", "#755A28"], deco: "sun", icon: "citadel" },
  "hop-ho": { sky: ["#2E3A5C", "#1B2440"], hill: ["#3F4D70", "#2A3555"], deco: "stars", icon: "candle" },
  "tien-biet": { sky: ["#3A3F4F", "#23262F"], hill: ["#4A4F60", "#33374A"], deco: "moon", icon: "candle" },
  "gia-pha": { sky: ["#EFE3C6", "#DCC896"], hill: ["#B59A62", "#8C743F"], deco: "none", icon: "scroll" },
  "ky-niem": { sky: ["#F2C9C2", "#E3958B"], hill: ["#B5584E", "#8F3F37"], deco: "sun", icon: "banner" },
  "di-cu": { sky: ["#BFDDE8", "#8FBBD0"], hill: ["#4F7C96", "#365F78"], deco: "waves", icon: "boat" },
  "hoi-huong": { sky: ["#F8DDB0", "#EDB77A"], hill: ["#6E8F5A", "#4E6E3F"], deco: "sun", icon: "boat" },
  "tong-quan": { sky: ["#D9D2B8", "#B9AE86"], hill: ["#6F7A4C", "#4F5A33"], deco: "clouds", icon: "sword" },
  "chien-tranh": { sky: ["#8A8478", "#5E5A52"], hill: ["#4A4740", "#33312C"], deco: "clouds", icon: "sword" },
  "do-dat": { sky: ["#DDE8F2", "#B6CCE2"], hill: ["#7C98B8", "#587599"], deco: "sun", icon: "book" },
  "lam-an": { sky: ["#F4E7A8", "#E7CE72"], hill: ["#8FA24E", "#6B7E34"], deco: "sun", icon: "rice" },
  "xe-dap": { sky: ["#DCEBD2", "#B7D3A4"], hill: ["#7FA06A", "#5A7D49"], deco: "clouds", icon: "bicycle" },
  "radio-tivi": { sky: ["#E6D5EE", "#C9AEDB"], hill: ["#8F70A8", "#6E5088"], deco: "stars", icon: "radio" },
  "hien-dai": { sky: ["#CDE7EE", "#9FD0DE"], hill: ["#5A9AAE", "#3F7A8F"], deco: "clouds", icon: "phone" },
};

export const SCENE_IDS = Object.keys(SCENES);

/** Khung 4:3 — luôn lấp đầy ô cha (cha cần có kích thước). */
export function TimelineScene({ id, className }: { id: string; className?: string }) {
  const uid = useId().replace(/:/g, "");
  const sc = SCENES[id];
  if (!sc) return null;
  const light = sc.deco === "stars" || sc.deco === "moon" || id === "chien-tranh";
  const paths = TIMELINE_ICON_PATHS[sc.icon];
  return (
    <svg
      viewBox="0 0 400 300"
      preserveAspectRatio="xMidYMid slice"
      className={className}
      role="img"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={sc.sky[0]} />
          <stop offset="1" stopColor={sc.sky[1]} />
        </linearGradient>
      </defs>
      <rect width="400" height="300" fill={`url(#sky-${uid})`} />

      {sc.deco === "sun" && (
        <>
          <circle cx="322" cy="68" r="44" fill="#FFF3C9" opacity="0.35" />
          <circle cx="322" cy="68" r="30" fill="#FFE9A8" opacity="0.95" />
        </>
      )}
      {sc.deco === "moon" && <circle cx="324" cy="66" r="26" fill="#F4E7B4" opacity="0.95" />}
      {sc.deco === "stars" &&
        [
          [60, 50], [130, 90], [210, 40], [290, 80], [350, 40], [90, 130], [330, 120], [250, 130],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 === 0 ? 3 : 2} fill="#F4E7B4" opacity="0.9" />
        ))}
      {sc.deco === "clouds" && (
        <g fill="#FFFFFF" opacity={light ? 0.25 : 0.7}>
          <ellipse cx="90" cy="70" rx="40" ry="14" />
          <ellipse cx="116" cy="60" rx="26" ry="14" />
          <ellipse cx="320" cy="96" rx="34" ry="12" />
          <ellipse cx="344" cy="88" rx="22" ry="12" />
        </g>
      )}

      {/* Đồi / mặt nước phía dưới */}
      <path d="M0 230 Q90 190 190 225 T400 215 V300 H0Z" fill={sc.hill[0]} />
      <path d="M0 258 Q110 225 210 255 T400 248 V300 H0Z" fill={sc.hill[1]} />
      {sc.deco === "waves" && (
        <g fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.6">
          <path d="M30 252 q12 -10 24 0 t24 0 t24 0" />
          <path d="M250 272 q12 -10 24 0 t24 0 t24 0" />
        </g>
      )}

      {/* Biểu tượng lớn ở giữa */}
      <circle cx="200" cy="146" r="68" fill="#FFFFFF" opacity="0.88" />
      <g
        transform="translate(147.6 93.6) scale(4.4)"
        fill="none"
        stroke={light ? "#2A3555" : sc.hill[1]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {paths.map((d, i) => (
          <path key={i} d={d} />
        ))}
      </g>
    </svg>
  );
}
