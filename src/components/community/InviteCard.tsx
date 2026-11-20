import type { CSSProperties, ReactNode } from "react";

import { CARD_DIMENSIONS, type CardFormat } from "@/lib/cards/types";

/**
 * Ảnh infographic mời góp (plan §4.3 — design đã duyệt: artifact "Mẫu infographic mời góp").
 * Inline style + font đã bundle để html-to-image xuất chuẩn (giống Kho thiệp). Nội dung ĐỘNG:
 * người đọc (trẻ / lớn tuổi), xưng hô, link nằm ở đâu (ảnh trên mạng xã hội không bấm được →
 * bước 1 luôn nói chỗ mở link), hướng dẫn 3 bước bật/tắt.
 */

export type InviteVariant = "chung" | "hoso" | "hoi" | "camon";
export type InviteAudience = "young" | "old";
export type InviteLinkPlace = "qr" | "post" | "comment" | "sticker";
/** Tông màu — áp cho mọi mẫu (đỏ rượu vang · đêm vàng · giấy ngà), theo màu của app. */
export type InviteTheme = "ruou" | "dem" | "nga";
export const INVITE_THEMES: InviteTheme[] = ["ruou", "dem", "nga"];
/** Tông mặc định của từng mẫu (đúng design đã duyệt). */
export const DEFAULT_THEME: Record<InviteVariant, InviteTheme> = { chung: "ruou", camon: "ruou", hoi: "dem", hoso: "nga" };

export interface InviteFact {
  label: string;
  done: boolean;
}

export interface InviteCardData {
  clanName: string;
  variant: InviteVariant;
  theme?: InviteTheme;
  audience: InviteAudience;
  xungHo: string;
  linkPlace: InviteLinkPlace;
  showGuide: boolean;
  qrDataUrl: string | null;
  shortLink: string;
  /** hoso: người được nhắc + ảnh + các mảnh đã có / còn thiếu. */
  personName?: string | null;
  personYears?: string | null;
  photoDataUrl?: string | null;
  facts?: InviteFact[];
  /** hoi: câu hỏi + hỏi ai. */
  question?: string | null;
  askName?: string | null;
  /** camon / chung: số liệu thật của họ. */
  stats?: { memories: number; contributors: number; visits: number; pending?: number };
}

const SERIF = '"Noto Serif", Georgia, serif';
const SANS = '"Be Vietnam Pro", system-ui, sans-serif';
const OX = "radial-gradient(circle at 50% 28%, #7A2E2E, #511C1C)";
const NIGHT = "linear-gradient(160deg, #211a16, #0d0a08)";
const GOLD = "#D9B468";
const CREAM = "#F3E9D8";
const SOFT = "#E7D9C3";

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

interface Palette {
  bg: string;
  ink: string;
  soft: string;
  heading: string;
  accent: string;
  /** Chữ trên nền accent (số bước). */
  accentInk: string;
  /** Khối nổi (câu hỏi / thanh kêu gọi) và chữ trên đó. */
  panel: string;
  panelInk: string;
  panelAccent: string;
  tint: string;
  border: string;
  track: string;
  bar: string;
}

const PALETTES: Record<InviteTheme, Palette> = {
  ruou: {
    bg: OX,
    ink: CREAM,
    soft: SOFT,
    heading: CREAM,
    accent: GOLD,
    accentInk: "#511C1C",
    panel: "#FBF7F0",
    panelInk: "#511C1C",
    panelAccent: "#7A2E2E",
    tint: "rgba(243,233,216,0.1)",
    border: "rgba(217,180,104,0.4)",
    track: "rgba(243,233,216,0.18)",
    bar: GOLD,
  },
  dem: {
    bg: NIGHT,
    ink: CREAM,
    soft: SOFT,
    heading: CREAM,
    accent: "#C9A227",
    accentInk: "#1c1714",
    panel: "#F5EFE6",
    panelInk: "#511C1C",
    panelAccent: "#7A2E2E",
    tint: "rgba(201,162,39,0.1)",
    border: "rgba(201,162,39,0.45)",
    track: "rgba(243,233,216,0.15)",
    bar: "#C9A227",
  },
  nga: {
    bg: "linear-gradient(180deg, #FBF7F0, #F3E9D8)",
    ink: "#2B2320",
    soft: "#4A3A33",
    heading: "#511C1C",
    accent: "#7A2E2E",
    accentInk: CREAM,
    panel: "#7A2E2E",
    panelInk: CREAM,
    panelAccent: GOLD,
    tint: "rgba(122,46,46,0.06)",
    border: "rgba(122,46,46,0.25)",
    track: "#E6D6BC",
    bar: "#B8893B",
  },
};

export const paletteOf = (d: Pick<InviteCardData, "variant" | "theme">): Palette => PALETTES[d.theme ?? DEFAULT_THEME[d.variant]];

/** Bước 1 theo chỗ đặt link (ảnh trên mạng xã hội không bấm được). */
function linkStep(place: InviteLinkPlace, old: boolean, qr: boolean): string {
  if (qr && place !== "qr") {
    const where = place === "comment" ? "ở bình luận" : "trong bài";
    return old ? `Quét mã QR trên ảnh, hoặc bấm đường link ${where}` : `Quét mã QR, hoặc bấm link ${where}`;
  }
  switch (place) {
    case "qr":
      return old ? "Dùng điện thoại quét mã trên ảnh" : "Quét mã QR trên ảnh này";
    case "post":
      return old ? "Bấm vào đường link trong bài viết" : "Bấm link trong bài viết";
    case "comment":
      return old ? "Bấm vào đường link ở phần bình luận" : "Bấm link ở bình luận đầu tiên";
    case "sticker":
      return old ? "Bấm vào ô đường link bên dưới" : "Bấm vào nhãn link bên dưới";
  }
}

function copyFor(d: InviteCardData, qr: boolean) {
  const old = d.audience === "old";
  const x = d.xungHo;
  const L = linkStep(d.linkPlace, old, qr);
  switch (d.variant) {
    case "hoso":
      return {
        kicker: `Gia phả ${d.clanName}`,
        lead: old ? "Kính mời các cụ, các bác nhớ lại về" : "Cả nhà còn nhớ gì về",
        title: d.personName ?? "",
        cta: old ? `Ai nhớ điều gì, xin kể giúp ${x} ạ` : `Ai nhớ chút nào, kể giúp ${x} nha`,
        steps: [L, old ? "Chọn điều mình còn nhớ" : "Chọn ô còn trống mình biết", old ? "Gõ vài chữ, hoặc bấm 🎤 trên bàn phím để nói" : "Viết một câu, bấm Gửi"],
      };
    case "hoi":
      return {
        kicker: "Câu hỏi của tuần",
        lead: old ? "Con cháu kính hỏi" : "Tuần này cả nhà hỏi",
        title: d.askName ?? (old ? "các cụ, ông bà" : "ông bà, cha mẹ"),
        cta: old ? `Xin trả lời giúp ${x} ạ` : `Ai biết thì trả lời giúp ${x} nha`,
        steps: [L, old ? "Bấm Trả lời" : "Chọn câu hỏi, bấm Trả lời", old ? "Bấm 🎤 trên bàn phím rồi nói, bấm Gửi" : "Viết (hoặc nói qua 🎤 bàn phím), bấm Gửi"],
      };
    case "camon":
      return {
        kicker: `Gia phả ${d.clanName}`,
        lead: "",
        title: old ? "Kính cảm ơn các cụ, các bác đã cùng góp" : "Cảm ơn cả nhà đã cùng góp",
        cta: old ? "Xin mời cả nhà vào góp tiếp" : "Cả nhà vào góp tiếp nha",
        steps: [L, "Chọn người hoặc câu hỏi", old ? "Viết, hoặc bấm 🎤 để nói" : "Kể điều mình biết, Gửi"],
      };
    case "chung":
    default:
      return {
        kicker: `Gia phả ${d.clanName}`,
        lead: "",
        title: old ? "Kính mời các cụ, các bác cùng góp chuyện ông bà, ảnh cũ" : "Cả nhà ơi, cùng góp chuyện ông bà, ảnh cũ nha",
        cta: old ? `Xin góp giúp ${x} ạ` : `Góp giúp ${x} một chút nha`,
        steps: [L, "Chọn người mình muốn kể", old ? "Viết, hoặc bấm 🎤 để nói, bấm Gửi" : "Viết vài câu hoặc dán link ảnh, Gửi"],
      };
  }
}

function Qr({ src, size }: { src: string | null; size: number }) {
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size, background: "#fff", padding: 10, borderRadius: 14, boxSizing: "border-box" }}
    />
  );
}

function Steps({ steps, color, num, numInk, size }: { steps: string[]; color: string; num: string; numInk: string; size: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {steps.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span
            style={{
              width: size * 1.6,
              height: size * 1.6,
              flexShrink: 0,
              borderRadius: "50%",
              background: num,
              color: numInk,
              fontWeight: 800,
              fontSize: size,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {i + 1}
          </span>
          <span style={{ fontSize: size, lineHeight: 1.3, color }}>{s}</span>
        </div>
      ))}
    </div>
  );
}

function Frame({ format, bg, ink, children, style }: { format: CardFormat; bg: string; ink: string; children: ReactNode; style?: CSSProperties }) {
  const { w, h } = CARD_DIMENSIONS[format];
  const vertical = format === "vertical";
  return (
    <div
      style={{
        width: w,
        height: h,
        boxSizing: "border-box",
        padding: vertical ? "250px 72px 280px" : "56px 72px",
        background: bg,
        color: ink,
        fontFamily: SANS,
        display: "flex",
        flexDirection: "column",
        gap: vertical ? 40 : 24,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Footer({ d, format, P }: { d: InviteCardData; format: CardFormat; P: Palette }) {
  const ink = P.accent;
  const vertical = format === "vertical";
  if (vertical) {
    return (
      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        {d.linkPlace === "sticker" ? (
          <div style={{ border: `4px dashed ${ink}`, padding: "20px 40px", borderRadius: 999, fontSize: 30, fontWeight: 700 }}>
            {d.audience === "old" ? "Ô đường link ở đây ạ" : "Dán nhãn link vào đây"}
          </div>
        ) : (
          <div style={{ background: P.panel, color: P.panelInk, fontSize: 34, fontWeight: 800, padding: "20px 44px", borderRadius: 999 }}>
            {d.linkPlace === "comment" ? "Link ở bình luận nha" : d.linkPlace === "post" ? "Link ở trong bài nha" : d.shortLink}
          </div>
        )}
        <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.12em", color: ink }}>DÒNG HỌ VIỆT</div>
      </div>
    );
  }
  return null;
}

/** Tấm ảnh đủ kích thước (1080×1080 hoặc 1080×1920) — dùng cho xem trước (scale) và xuất PNG. */
export function InviteCard({ data: d, format }: { data: InviteCardData; format: CardFormat }) {
  const old = d.audience === "old";
  const vertical = format === "vertical";
  // Ảnh vuông LUÔN có mã QR (design đã duyệt); Story thì không (không ai quét màn hình của chính mình).
  const showQr = !vertical && !!d.qrDataUrl;
  const c = copyFor(d, showQr);
  const P = paletteOf(d);
  const stepSize = vertical ? (old ? 38 : 34) : old ? 30 : 26;
  const linkNote = d.linkPlace === "comment" ? "Link ở bình luận" : d.linkPlace === "post" ? "Link ở trong bài" : d.shortLink;

  // ─── Hỏi ông bà (nền đêm, câu hỏi chữ to) ──────────────────────
  if (d.variant === "hoi") {
    return (
      <Frame format={format} bg={P.bg} ink={P.ink}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 24 }}>
          <span style={{ fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: P.accent }}>{c.kicker}</span>
          <span style={{ color: P.soft }}>{d.clanName}</span>
        </div>
        <div>
          <div style={{ fontSize: 28, color: P.soft }}>{c.lead}</div>
          <div style={{ fontSize: vertical ? 56 : 46, fontWeight: 800, color: P.heading }}>{cap(c.title)}</div>
        </div>
        <div style={{ position: "relative", background: P.panel, color: P.panelInk, borderRadius: 26, padding: "44px 46px 36px" }}>
          <div style={{ position: "absolute", top: -28, left: 44, fontFamily: SERIF, fontSize: 120, lineHeight: 1, color: P.panelAccent === GOLD ? GOLD : "#C9A227" }}>“</div>
          <p style={{ margin: 0, fontFamily: SERIF, fontStyle: "italic", fontWeight: 600, fontSize: vertical ? 64 : 54, lineHeight: 1.22 }}>
            {d.question}
          </p>
        </div>
        {d.showGuide ? (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: P.accent, marginBottom: 12 }}>
              {c.cta}
            </div>
            <Steps steps={c.steps} color={P.ink} num={P.accent} numInk={P.accentInk} size={stepSize} />
          </div>
        ) : (
          <div style={{ fontSize: stepSize + 4, fontWeight: 700 }}>{c.cta}</div>
        )}
        {vertical ? (
          <Footer d={d} format={format} P={P} />
        ) : (
          <div style={{ marginTop: "auto", display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderTop: `2px solid ${P.border}`, paddingTop: 18 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ fontSize: 26, fontWeight: 700, color: P.accent }}>{showQr ? "Quét mã để trả lời" : linkNote}</div>
              <div style={{ fontSize: 22, color: P.soft }}>{showQr ? `${linkNote} · ${d.shortLink}` : ""}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", color: P.accent }}>DÒNG HỌ VIỆT</span>
              {showQr && <Qr src={d.qrDataUrl} size={130} />}
            </div>
          </div>
        )}
      </Frame>
    );
  }

  // ─── Hồ sơ còn thiếu (nền giấy, thanh tiến độ, danh sách ✓ / ○) ─
  if (d.variant === "hoso") {
    const facts = d.facts ?? [];
    const done = facts.filter((f) => f.done).length;
    const pct = facts.length ? Math.round((done / facts.length) * 100) : 0;
    return (
      <Frame format={format} bg={P.bg} ink={P.ink}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: P.accent }}>{c.kicker}</span>
          <span style={{ fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", color: P.accent }}>DÒNG HỌ VIỆT</span>
        </div>
        <div style={{ display: "flex", gap: 36, alignItems: "center" }}>
          {d.photoDataUrl ? (
            <img src={d.photoDataUrl} alt="" style={{ width: 180, height: 220, objectFit: "cover", borderRadius: 16, border: "6px solid #fff", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 180, height: 220, borderRadius: 16, background: "linear-gradient(170deg, #C9B08A, #8E7556)", border: "6px solid #fff", flexShrink: 0 }} />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 28, fontWeight: 600, color: P.accent }}>{c.lead}</div>
            <div style={{ fontFamily: SERIF, fontSize: 66, lineHeight: 1.05, fontWeight: 700, color: P.heading }}>{c.title}</div>
            {d.personYears && <div style={{ fontSize: 28, color: P.soft }}>{d.personYears}</div>}
          </div>
        </div>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, fontWeight: 700, marginBottom: 10 }}>
            <span>{old ? `Gia phả mới ghi được ${done} trong ${facts.length} điều về cụ` : `Nhà mình mới biết được ${done} / ${facts.length} điều về cụ`}</span>
            <span style={{ color: P.accent }}>{pct}%</span>
          </div>
          <div style={{ height: 20, borderRadius: 999, background: P.track, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: P.bar, borderRadius: 999 }} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "12px 28px", fontSize: old ? 30 : 28 }}>
          {facts.map((f) => (
            <div key={f.label} style={{ display: "flex", gap: 14, alignItems: "center", fontWeight: f.done ? 400 : 700, color: f.done ? P.soft : P.heading }}>
              {f.done ? (
                <span style={{ width: 36, height: 36, flexShrink: 0, borderRadius: "50%", background: "#2E7D5B", color: "#fff", fontSize: 22, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>✓</span>
              ) : (
                <span style={{ width: 32, height: 32, flexShrink: 0, borderRadius: "50%", border: `4px dashed ${P.bar}` }} />
              )}
              {f.label}
            </div>
          ))}
        </div>
        <div style={{ marginTop: vertical ? 0 : "auto", display: "flex", gap: 28, alignItems: "center", background: P.panel, color: P.panelInk, borderRadius: 22, padding: "24px 28px" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 34, fontWeight: 800 }}>{c.cta}</div>
            {d.showGuide && <Steps steps={c.steps} color={P.panelInk} num={P.panelAccent} numInk={P.panel} size={old ? 26 : 24} />}
          </div>
          {showQr && <Qr src={d.qrDataUrl} size={150} />}
        </div>
        {vertical && <Footer d={d} format={format} P={P} />}
      </Frame>
    );
  }

  // ─── Cảm ơn cả nhà / Mời chung (nền đỏ rượu vang, số liệu thật) ─
  const s = d.stats ?? { memories: 0, contributors: 0, visits: 0 };
  const boxes =
    d.variant === "camon"
      ? [
          { n: s.memories, l: "đóng góp" },
          { n: s.contributors, l: "người đã góp" },
          { n: s.visits, l: "lượt ghé thăm" },
        ]
      : [
          { n: s.contributors, l: "người đã góp" },
          { n: s.memories, l: "câu chuyện, ảnh cũ" },
        ];
  return (
    <Frame format={format} bg={P.bg} ink={P.ink} style={{ alignItems: "center", textAlign: "center" }}>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: "0.28em", textTransform: "uppercase", color: P.accent }}>{c.kicker}</div>
      <div style={{ fontFamily: SERIF, fontSize: vertical ? 80 : 68, lineHeight: 1.1, fontWeight: 700, color: P.heading }}>{c.title}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: P.accent }}>
        <span style={{ height: 2, width: 110, background: P.accent }} />
        <span style={{ fontSize: 22 }}>◆</span>
        <span style={{ height: 2, width: 110, background: P.accent }} />
      </div>
      {boxes.some((b) => b.n > 0) && (
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: `repeat(${boxes.length}, minmax(0, 1fr))`, gap: 18 }}>
          {boxes.map((b) => (
            <div key={b.l} style={{ background: P.tint, border: `2px solid ${P.border}`, borderRadius: 20, padding: "24px 12px" }}>
              <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1, color: P.accent }}>{b.n}</div>
              <div style={{ fontSize: 24, marginTop: 8 }}>{b.l}</div>
            </div>
          ))}
        </div>
      )}
      {d.showGuide && (
        <div style={{ width: "100%", textAlign: "left", background: P.tint, borderRadius: 20, padding: "20px 24px", boxSizing: "border-box" }}>
          <Steps steps={c.steps} color={P.ink} num={P.accent} numInk={P.accentInk} size={stepSize} />
        </div>
      )}
      {vertical ? (
        <Footer d={d} format={format} P={P} />
      ) : (
        <div style={{ marginTop: "auto", width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 20, background: P.panel, color: P.panelInk, borderRadius: 20, padding: "20px 28px", boxSizing: "border-box", textAlign: "left" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontSize: 30, fontWeight: 800 }}>{c.cta}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: P.panelAccent }}>{showQr ? `Quét mã · ${linkNote.toLowerCase()}` : linkNote}</div>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: "0.12em", color: P.panelAccent, opacity: 0.8 }}>DÒNG HỌ VIỆT</div>
          </div>
          {showQr && <Qr src={d.qrDataUrl} size={130} />}
        </div>
      )}
    </Frame>
  );
}

/** Tin nhắn soạn sẵn đi kèm ảnh — cùng lựa chọn với ảnh (người đọc, xưng hô, chỗ đặt link). */
export function inviteMessage(d: InviteCardData, url: string): string {
  const old = d.audience === "old";
  const hi = old ? "Kính thưa các cụ, các ông bà, cô chú" : "Cả nhà ơi";
  const where = d.linkPlace === "comment" ? (old ? "Đường link ở phần bình luận ạ." : "Link ở bình luận nha.") : url;
  switch (d.variant) {
    case "hoso":
      return `${hi}, gia phả ${d.clanName} đang thu thập thêm về ${d.personName}. Ai nhớ một kỷ niệm, nghề nghiệp, ngày giỗ hay quê quán của cụ thì bấm link để đóng góp, không cần đăng ký.\n${where}`;
    case "hoi":
      return `${hi}, tuần này cùng hỏi ${d.askName ?? "ông bà"} một câu: “${d.question}”. Ai biết thì bấm link viết câu trả lời (trên điện thoại bấm 🎤 trên bàn phím để nói), không cần đăng ký.\n${where}`;
    case "camon":
      return `${hi}, cảm ơn mọi người đã cùng góp vào gia phả ${d.clanName}${d.stats?.memories ? ` — đã có ${d.stats.memories} đóng góp` : ""}. Ai chưa góp thì vào đây nha.\n${where}`;
    default:
      return `${hi}, gia phả ${d.clanName} đang thu thập câu chuyện, ảnh cũ về ông bà, tổ tiên. Ai nhớ một kỷ niệm hay có tấm ảnh cũ thì bấm link để đóng góp, không cần đăng ký.\n${where}`;
  }
}
