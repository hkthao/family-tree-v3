import type { CSSProperties } from "react";

import type { CardData, CardFormat, CardGenre, CardTemplateProps } from "./types";
import { CARD_DIMENSIONS } from "./types";

/**
 * KHO THIỆP — mỗi mẫu là 1 entry trong CARD_TEMPLATES. Thêm thiệp mới =
 * thêm 1 entry (id + tên + thể loại + hàm render). Mọi mẫu nhận
 * { data, format } và vẽ ở đúng kích thước gốc (1080×1080 / 1080×1920) —
 * dialog sẽ thu nhỏ để xem trước và xuất PNG ở cỡ thật.
 *
 * Dùng inline style + font hệ thống/serif phổ biến để html-to-image xuất
 * chuẩn (không phụ thuộc web font / mạng).
 */

export interface CardTemplate {
  id: string;
  name: string;
  genre: CardGenre;
  render: (props: CardTemplateProps) => JSX.Element;
}

// ─── Palette ──────────────────────────────────────────────────────
const C = {
  paper: "#FBF7F0",
  cream: "#F3E9D8",
  ink: "#2B2320",
  ox: "#7A2E2E",
  oxDeep: "#511C1C",
  gold: "#B8893B",
  goldLight: "#D9B468",
  muted: "#6E635B",
};
const SERIF = '"Times New Roman", Georgia, "Noto Serif", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

function frame(format: CardFormat, extra?: CSSProperties): CSSProperties {
  const { w, h } = CARD_DIMENSIONS[format];
  return {
    width: w,
    height: h,
    position: "relative",
    overflow: "hidden",
    boxSizing: "border-box",
    fontFamily: SANS,
    ...extra,
  };
}

function Kicker({ children, color = C.gold }: { children: string; color?: string }) {
  return (
    <div
      style={{
        color,
        fontFamily: SANS,
        fontWeight: 700,
        letterSpacing: "0.32em",
        textTransform: "uppercase",
        fontSize: 30,
      }}
    >
      {children}
    </div>
  );
}

function Diamond({ color = C.gold }: { color?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, color }}>
      <span style={{ height: 2, width: 120, background: color, display: "block" }} />
      <span style={{ fontSize: 26 }}>◆</span>
      <span style={{ height: 2, width: 120, background: color, display: "block" }} />
    </div>
  );
}

function QrBadge({ data, dark }: { data: CardData; dark?: boolean }) {
  if (!data.qrDataUrl) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
      <img src={data.qrDataUrl} alt="" width={132} height={132}
        style={{ width: 132, height: 132, borderRadius: 12, background: "#fff", padding: 8 }} />
      <div style={{ color: dark ? C.cream : C.muted, fontSize: 26, lineHeight: 1.3, maxWidth: 360 }}>
        Quét mã để xem<br />gia phả dòng họ
      </div>
    </div>
  );
}

// ─── 1. Tưởng niệm — nền oxblood, khung vàng (không cần ảnh) ───────
function MemorialClassic({ data, format }: CardTemplateProps) {
  return (
    <div style={frame(format, { background: `radial-gradient(circle at 50% 30%, ${C.ox}, ${C.oxDeep})` })}>
      <div style={{
        position: "absolute", inset: 44, border: `3px solid ${C.gold}`, borderRadius: 8,
      }} />
      <div style={{
        position: "absolute", inset: 56, border: `1px solid ${C.goldLight}`, borderRadius: 4,
      }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: format === "vertical" ? "0 120px" : "0 110px", gap: 34,
      }}>
        <Kicker>Tưởng nhớ tổ tiên</Kicker>
        <div style={{ fontFamily: SERIF, color: C.goldLight, fontSize: 40, fontStyle: "italic" }}>
          {data.clanName}
        </div>
        <div style={{ fontFamily: SERIF, color: C.cream, fontSize: 76, fontWeight: 700, lineHeight: 1.15 }}>
          {data.title}
        </div>
        <Diamond />
        {data.excerpt && (
          <div style={{ fontFamily: SERIF, color: C.cream, fontSize: 38, lineHeight: 1.5, opacity: 0.92 }}>
            {data.excerpt}
          </div>
        )}
        {data.dateText && (
          <div style={{ color: C.goldLight, fontSize: 34, fontWeight: 600 }}>{data.dateText}</div>
        )}
      </div>
      {data.qrDataUrl && (
        <div style={{ position: "absolute", left: 80, bottom: 80 }}>
          <QrBadge data={data} dark />
        </div>
      )}
    </div>
  );
}

// ─── 2. Tưởng niệm — ảnh nền phủ tối + khung vàng ─────────────────
function MemorialPhoto({ data, format }: CardTemplateProps) {
  return (
    <div style={frame(format, { background: C.oxDeep })}>
      {data.photoDataUrl && (
        <img src={data.photoDataUrl} alt="" style={{
          position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover",
        }} />
      )}
      <div style={{
        position: "absolute", inset: 0,
        background: `linear-gradient(180deg, rgba(40,15,15,0.35) 0%, rgba(40,15,15,0.2) 40%, rgba(40,15,15,0.92) 100%)`,
      }} />
      <div style={{ position: "absolute", inset: 44, border: `3px solid ${C.gold}`, borderRadius: 8 }} />
      <div style={{
        position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 110px 110px",
        display: "flex", flexDirection: "column", gap: 26, textAlign: "center",
      }}>
        <Kicker>Tưởng nhớ tổ tiên</Kicker>
        <div style={{ fontFamily: SERIF, color: "#fff", fontSize: 72, fontWeight: 700, lineHeight: 1.15 }}>
          {data.title}
        </div>
        {data.excerpt && (
          <div style={{ fontFamily: SERIF, color: C.cream, fontSize: 36, lineHeight: 1.45, opacity: 0.95 }}>
            {data.excerpt}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 10 }}>
          <div style={{ fontFamily: SERIF, color: C.goldLight, fontSize: 36, fontStyle: "italic" }}>
            {data.clanName}{data.dateText ? ` · ${data.dateText}` : ""}
          </div>
          {data.qrDataUrl && (
            <img src={data.qrDataUrl} alt="" width={120} height={120}
              style={{ width: 120, height: 120, borderRadius: 10, background: "#fff", padding: 7 }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 3. Câu chuyện — ảnh trên, giấy dưới ──────────────────────────
function StoryPaper({ data, format }: CardTemplateProps) {
  const imgH = format === "vertical" ? 980 : 560;
  return (
    <div style={frame(format, { background: C.paper, display: "flex", flexDirection: "column" })}>
      <div style={{ height: imgH, width: "100%", background: C.ox, position: "relative", overflow: "hidden" }}>
        {data.photoDataUrl ? (
          <img src={data.photoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: C.goldLight, fontSize: 120, fontFamily: SERIF }}>❖</div>
        )}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: C.gold }} />
      </div>
      <div style={{ flex: 1, padding: "56px 90px", display: "flex", flexDirection: "column", gap: 26 }}>
        <Kicker color={C.ox}>Câu chuyện dòng họ</Kicker>
        <div style={{ fontFamily: SERIF, color: C.ink, fontSize: 66, fontWeight: 700, lineHeight: 1.18 }}>
          {data.title}
        </div>
        {data.excerpt && (
          <div style={{ fontFamily: SERIF, color: C.ink, fontSize: 38, lineHeight: 1.5, flex: 1, overflow: "hidden" }}>
            {data.excerpt}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `2px solid ${C.gold}`, paddingTop: 24 }}>
          <div style={{ fontFamily: SERIF, color: C.ox, fontSize: 38, fontStyle: "italic", fontWeight: 600 }}>
            {data.clanName}{data.dateText ? ` · ${data.dateText}` : ""}
          </div>
          {data.qrDataUrl && (
            <img src={data.qrDataUrl} alt="" width={110} height={110}
              style={{ width: 110, height: 110 }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 4. Khoe gia phả & mời tham gia ───────────────────────────────
function InviteTree({ data, format }: CardTemplateProps) {
  return (
    <div style={frame(format, { background: `linear-gradient(180deg, ${C.paper}, ${C.cream})` })}>
      <div style={{ position: "absolute", inset: 40, border: `2px solid ${C.gold}`, borderRadius: 10 }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "0 110px", gap: 30,
      }}>
        <div style={{ fontSize: 96 }}>🌳</div>
        <Kicker color={C.ox}>Gia phả dòng họ</Kicker>
        <div style={{ fontFamily: SERIF, color: C.ink, fontSize: 72, fontWeight: 700 }}>
          {data.clanName}
        </div>
        {data.statText && (
          <div style={{ fontFamily: SERIF, color: C.ox, fontSize: 86, fontWeight: 700, letterSpacing: "0.01em" }}>
            {data.statText}
          </div>
        )}
        <Diamond color={C.gold} />
        <div style={{ fontFamily: SERIF, color: C.ink, fontSize: 40, lineHeight: 1.5, maxWidth: 760 }}>
          {data.excerpt || "Mời con cháu cùng gìn giữ và bổ sung gia phả dòng họ."}
        </div>
        {data.qrDataUrl && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, marginTop: 8 }}>
            <img src={data.qrDataUrl} alt="" width={210} height={210}
              style={{ width: 210, height: 210, background: "#fff", padding: 10, borderRadius: 14, border: `2px solid ${C.gold}` }} />
            <div style={{ color: C.muted, fontSize: 30 }}>Quét mã để xem cây gia phả</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 5. Sự kiện — Kính mời (ngày là điểm nhấn) ────────────────────
function EventInvite({ data, format }: CardTemplateProps) {
  return (
    <div style={frame(format, { background: `linear-gradient(180deg, ${C.paper}, ${C.cream})` })}>
      <div style={{ position: "absolute", inset: 40, border: `2px solid ${C.gold}`, borderRadius: 10 }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
        padding: "0 110px", gap: 28,
      }}>
        <Kicker color={C.ox}>Kính mời</Kicker>
        <div style={{ fontFamily: SERIF, color: C.muted, fontSize: 38, fontStyle: "italic" }}>
          {data.clanName}
        </div>
        <div style={{ fontFamily: SERIF, color: C.ink, fontSize: 72, fontWeight: 700, lineHeight: 1.15 }}>
          {data.title}
        </div>
        {data.dateText && (
          <div style={{
            background: C.ox, color: C.goldLight, fontFamily: SERIF, fontWeight: 700,
            fontSize: 46, padding: "18px 46px", borderRadius: 999, border: `2px solid ${C.gold}`,
          }}>
            {data.dateText}
          </div>
        )}
        {data.excerpt && (
          <div style={{ fontFamily: SERIF, color: C.ink, fontSize: 38, lineHeight: 1.5, maxWidth: 780, opacity: 0.95 }}>
            {data.excerpt}
          </div>
        )}
        {data.qrDataUrl && (
          <div style={{ marginTop: 6 }}><QrBadge data={data} /></div>
        )}
      </div>
    </div>
  );
}

// ─── 6. Sự kiện — giỗ / tảo mộ (trang nghiêm) ─────────────────────
function EventSolemn({ data, format }: CardTemplateProps) {
  return (
    <div style={frame(format, { background: `radial-gradient(circle at 50% 28%, ${C.ox}, ${C.oxDeep})` })}>
      <div style={{ position: "absolute", inset: 44, border: `3px solid ${C.gold}`, borderRadius: 8 }} />
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 110px", gap: 30,
      }}>
        <div style={{ fontSize: 70 }}>🕯️</div>
        <div style={{ fontFamily: SERIF, color: C.goldLight, fontSize: 38, fontStyle: "italic" }}>{data.clanName}</div>
        <div style={{ fontFamily: SERIF, color: C.cream, fontSize: 74, fontWeight: 700, lineHeight: 1.15 }}>{data.title}</div>
        {data.dateText && (
          <div style={{ color: C.goldLight, fontSize: 44, fontWeight: 700 }}>{data.dateText}</div>
        )}
        <Diamond />
        {data.excerpt && (
          <div style={{ fontFamily: SERIF, color: C.cream, fontSize: 36, lineHeight: 1.5, opacity: 0.92 }}>{data.excerpt}</div>
        )}
      </div>
    </div>
  );
}

export const CARD_TEMPLATES: CardTemplate[] = [
  { id: "memorial-classic", name: "Tưởng niệm — cổ điển", genre: "memorial", render: MemorialClassic },
  { id: "memorial-photo", name: "Tưởng niệm — ảnh nền", genre: "memorial", render: MemorialPhoto },
  { id: "story-paper", name: "Câu chuyện — ảnh & giấy", genre: "story", render: StoryPaper },
  { id: "invite-tree", name: "Mời tham gia — cây gia phả", genre: "invite", render: InviteTree },
  { id: "event-invite", name: "Kính mời — trang nhã", genre: "event", render: EventInvite },
  { id: "event-solemn", name: "Giỗ / tảo mộ — trang nghiêm", genre: "event", render: EventSolemn },
];

export function templatesByGenre(genre: CardGenre): CardTemplate[] {
  return CARD_TEMPLATES.filter((t) => t.genre === genre);
}
