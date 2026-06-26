import type { CSSProperties } from "react";

import type { CardFormat, CardGenre, CardTemplateProps } from "./types";
import { CARD_DIMENSIONS } from "./types";

/**
 * KHO THIỆP — hệ template THAM SỐ HOÁ để có nhiều mẫu mà code gọn:
 *   mẫu = 1 PRESET { layout × theme × kicker × ornament × genre }.
 * Có vài LAYOUT (bố cục) và nhiều THEME (tông màu/chủ đề); ghép lại ra
 * ~50 mẫu phủ đủ dịp. Thêm mẫu mới = thêm 1 dòng vào PRESETS.
 *
 * Inline style + font hệ thống/serif phổ biến để html-to-image xuất chuẩn.
 */

export interface CardTemplate {
  id: string;
  name: string;
  genre: CardGenre;
  render: (props: CardTemplateProps) => JSX.Element;
}

const SERIF = '"Times New Roman", Georgia, "Noto Serif", serif';
const SANS = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

// ─── Theme (tông màu/chủ đề) ──────────────────────────────────────
interface Theme {
  bg: string;        // nền (có thể là gradient)
  accent: string;    // viền / gạch / nền-ngày
  accentText: string;// chữ trên nền accent
  title: string;     // màu tiêu đề trên nền
  body: string;      // màu nội dung trên nền
  kicker: string;    // màu dòng kicker
  panel: string;     // nền "giấy" (layout photoTop)
  panelInk: string;  // chữ trên giấy
}

const T: Record<string, Theme> = {
  oxblood: { bg: "radial-gradient(circle at 50% 28%, #7A2E2E, #511C1C)", accent: "#B8893B", accentText: "#511C1C", title: "#F3E9D8", body: "#F3E9D8", kicker: "#D9B468", panel: "#FBF7F0", panelInk: "#2B2320" },
  night:   { bg: "linear-gradient(160deg, #211a16, #0d0a08)", accent: "#C9A227", accentText: "#1c1714", title: "#F3E9D8", body: "#E7DDD0", kicker: "#C9A227", panel: "#F5EFE6", panelInk: "#2B2320" },
  royal:   { bg: "linear-gradient(160deg, #1E2E4A, #0F1A2E)", accent: "#C9A227", accentText: "#0F1A2E", title: "#EAF0F7", body: "#D7E0EC", kicker: "#C9A227", panel: "#EEF2F8", panelInk: "#1E2E4A" },
  plum:    { bg: "linear-gradient(160deg, #3A1E3A, #241024)", accent: "#D9B468", accentText: "#241024", title: "#F3E4F0", body: "#E6D2E2", kicker: "#D9B468", panel: "#F6EEF4", panelInk: "#3A1E3A" },
  forest:  { bg: "linear-gradient(160deg, #1F3A2C, #10231A)", accent: "#CDA94B", accentText: "#10231A", title: "#EAF3EC", body: "#D3E4D8", kicker: "#CDA94B", panel: "#EEF4EF", panelInk: "#1F3A2C" },
  lotus:   { bg: "linear-gradient(180deg, #FCEFF2, #F7DDE4)", accent: "#B23A5B", accentText: "#FFFFFF", title: "#7A2E46", body: "#5A2336", kicker: "#B23A5B", panel: "#FFFFFF", panelInk: "#5A2336" },
  paper:   { bg: "linear-gradient(180deg, #FBF7F0, #F3E9D8)", accent: "#B8893B", accentText: "#FFFFFF", title: "#2B2320", body: "#2B2320", kicker: "#7A2E2E", panel: "#FFFFFF", panelInk: "#2B2320" },
  gold:    { bg: "linear-gradient(180deg, #FBF3E2, #F0E2C6)", accent: "#9C6B22", accentText: "#FFFFFF", title: "#5A3E14", body: "#4A381E", kicker: "#9C6B22", panel: "#FFFFFF", panelInk: "#4A381E" },
  tet:     { bg: "radial-gradient(circle at 50% 30%, #C1272D, #7A0F14)", accent: "#F2C84B", accentText: "#7A0F14", title: "#FFF3D6", body: "#FBE7C2", kicker: "#F2C84B", panel: "#FFF7E8", panelInk: "#7A0F14" },
  crimson: { bg: "linear-gradient(180deg, #FFF1F0, #FBD9D6)", accent: "#C1272D", accentText: "#FFFFFF", title: "#8A1B20", body: "#5A1316", kicker: "#C1272D", panel: "#FFFFFF", panelInk: "#5A1316" },
  jade:    { bg: "linear-gradient(180deg, #EAF6EF, #CFEBDD)", accent: "#2E7D5B", accentText: "#FFFFFF", title: "#1F5A40", body: "#1C4A36", kicker: "#2E7D5B", panel: "#FFFFFF", panelInk: "#1C4A36" },
  sky:     { bg: "linear-gradient(180deg, #EEF4FB, #D6E6F5)", accent: "#2F6BA8", accentText: "#FFFFFF", title: "#1E4A78", body: "#1A3C60", kicker: "#2F6BA8", panel: "#FFFFFF", panelInk: "#1A3C60" },
};

function frame(format: CardFormat, bg: string, extra?: CSSProperties): CSSProperties {
  const { w, h } = CARD_DIMENSIONS[format];
  return { width: w, height: h, position: "relative", overflow: "hidden", boxSizing: "border-box", fontFamily: SANS, background: bg, ...extra };
}
function Kicker({ children, color }: { children: string; color: string }) {
  return <div style={{ color, fontFamily: SANS, fontWeight: 700, letterSpacing: "0.3em", textTransform: "uppercase", fontSize: 30 }}>{children}</div>;
}
function Divider({ color }: { color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16, color }}>
      <span style={{ height: 2, width: 110, background: color }} /><span style={{ fontSize: 24 }}>◆</span><span style={{ height: 2, width: 110, background: color }} />
    </div>
  );
}
function qrImg(src: string, size: number, border?: string) {
  return <img src={src} alt="" width={size} height={size} style={{ width: size, height: size, background: "#fff", padding: 8, borderRadius: 12, border: border ?? "none" }} />;
}

// ─── Layouts ──────────────────────────────────────────────────────
interface Preset {
  id: string; name: string; genre: CardGenre;
  layout: keyof typeof LAYOUTS; theme: keyof typeof T;
  kicker: string; ornament?: string;
}

const LAYOUTS = {
  // Căn giữa, viền kép — chạy được cả khi không có ảnh.
  centered(t: Theme, p: Preset, { data, format }: CardTemplateProps) {
    return (
      <div style={frame(format, t.bg)}>
        <div style={{ position: "absolute", inset: 44, border: `3px solid ${t.accent}`, borderRadius: 8 }} />
        <div style={{ position: "absolute", inset: 56, border: `1px solid ${t.accent}`, opacity: 0.5, borderRadius: 4 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 110px", gap: 28 }}>
          {p.ornament && <div style={{ fontSize: 84 }}>{p.ornament}</div>}
          <Kicker color={t.kicker}>{p.kicker}</Kicker>
          <div style={{ fontFamily: SERIF, color: t.accent, fontSize: 38, fontStyle: "italic" }}>{data.clanName}</div>
          <div style={{ fontFamily: data.titleFont || SERIF, color: t.title, fontSize: 72, fontWeight: 700, lineHeight: 1.15 }}>{data.title}</div>
          <Divider color={t.accent} />
          {data.excerpt && <div style={{ fontFamily: SERIF, color: t.body, fontSize: 38, lineHeight: 1.5, opacity: 0.95 }}>{data.excerpt}</div>}
          {data.dateText && <div style={{ color: t.kicker, fontSize: 36, fontWeight: 600 }}>{data.dateText}</div>}
          {data.qrDataUrl && qrImg(data.qrDataUrl, 150, `2px solid ${t.accent}`)}
        </div>
      </div>
    );
  },
  // Ngày là điểm nhấn (viên thuốc) — hợp giỗ / mời / lễ.
  dateHero(t: Theme, p: Preset, { data, format }: CardTemplateProps) {
    return (
      <div style={frame(format, t.bg)}>
        <div style={{ position: "absolute", inset: 44, border: `2px solid ${t.accent}`, borderRadius: 10 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 110px", gap: 26 }}>
          {p.ornament && <div style={{ fontSize: 72 }}>{p.ornament}</div>}
          <Kicker color={t.kicker}>{p.kicker}</Kicker>
          <div style={{ fontFamily: SERIF, color: t.body, fontSize: 36, fontStyle: "italic", opacity: 0.9 }}>{data.clanName}</div>
          <div style={{ fontFamily: data.titleFont || SERIF, color: t.title, fontSize: 70, fontWeight: 700, lineHeight: 1.15 }}>{data.title}</div>
          {data.dateText && <div style={{ background: t.accent, color: t.accentText, fontFamily: SERIF, fontWeight: 700, fontSize: 46, padding: "16px 44px", borderRadius: 999 }}>{data.dateText}</div>}
          {data.excerpt && <div style={{ fontFamily: SERIF, color: t.body, fontSize: 36, lineHeight: 1.5, maxWidth: 800, opacity: 0.95 }}>{data.excerpt}</div>}
          {data.qrDataUrl && qrImg(data.qrDataUrl, 140, `2px solid ${t.accent}`)}
        </div>
      </div>
    );
  },
  // Số liệu lớn + QR — khoe gia phả & mời tham gia.
  statHero(t: Theme, p: Preset, { data, format }: CardTemplateProps) {
    return (
      <div style={frame(format, t.bg)}>
        <div style={{ position: "absolute", inset: 40, border: `2px solid ${t.accent}`, borderRadius: 10 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 110px", gap: 26 }}>
          <div style={{ fontSize: 92 }}>{p.ornament ?? "🌳"}</div>
          <Kicker color={t.kicker}>{p.kicker}</Kicker>
          <div style={{ fontFamily: data.titleFont || SERIF, color: t.title, fontSize: 66, fontWeight: 700 }}>{data.clanName}</div>
          {data.statText && <div style={{ fontFamily: SERIF, color: t.accent, fontSize: 82, fontWeight: 700 }}>{data.statText}</div>}
          <Divider color={t.accent} />
          <div style={{ fontFamily: SERIF, color: t.body, fontSize: 38, lineHeight: 1.5, maxWidth: 760 }}>{data.excerpt || "Mời con cháu cùng gìn giữ và bổ sung gia phả dòng họ."}</div>
          {data.qrDataUrl && (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, marginTop: 6 }}>
              {qrImg(data.qrDataUrl, 200, `2px solid ${t.accent}`)}
              <div style={{ color: t.body, fontSize: 28, opacity: 0.85 }}>Quét mã để xem cây gia phả</div>
            </div>
          )}
        </div>
      </div>
    );
  },
  // Trích dẫn — gia huấn / lời hay / giai thoại.
  quote(t: Theme, p: Preset, { data, format }: CardTemplateProps) {
    return (
      <div style={frame(format, t.bg)}>
        <div style={{ position: "absolute", inset: 44, border: `2px solid ${t.accent}`, borderRadius: 10 }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "0 120px", gap: 24 }}>
          <Kicker color={t.kicker}>{p.kicker}</Kicker>
          <div style={{ fontFamily: SERIF, color: t.accent, fontSize: 160, lineHeight: 0.6, height: 70 }}>&ldquo;</div>
          <div style={{ fontFamily: data.titleFont || SERIF, color: t.title, fontSize: 64, fontStyle: "italic", fontWeight: 600, lineHeight: 1.3 }}>{data.title}</div>
          {data.excerpt && <div style={{ fontFamily: SERIF, color: t.body, fontSize: 36, lineHeight: 1.5, opacity: 0.92 }}>{data.excerpt}</div>}
          <Divider color={t.accent} />
          <div style={{ fontFamily: SERIF, color: t.accent, fontSize: 38, fontStyle: "italic" }}>{data.clanName}</div>
        </div>
      </div>
    );
  },
  // Ảnh nền phủ tối + chữ dưới.
  photoBg(t: Theme, p: Preset, { data, format }: CardTemplateProps) {
    return (
      <div style={frame(format, t.bg)}>
        {data.photoDataUrl && <img src={data.photoDataUrl} alt="" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />}
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,12,10,0.35) 0%, rgba(20,12,10,0.2) 38%, rgba(20,12,10,0.92) 100%)" }} />
        <div style={{ position: "absolute", inset: 44, border: `3px solid ${t.accent}`, borderRadius: 8 }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "0 100px 100px", display: "flex", flexDirection: "column", gap: 22, textAlign: "center" }}>
          {p.ornament && <div style={{ fontSize: 60 }}>{p.ornament}</div>}
          <Kicker color={t.kicker}>{p.kicker}</Kicker>
          <div style={{ fontFamily: data.titleFont || SERIF, color: "#fff", fontSize: 70, fontWeight: 700, lineHeight: 1.15 }}>{data.title}</div>
          {data.excerpt && <div style={{ fontFamily: SERIF, color: "#F3E9D8", fontSize: 34, lineHeight: 1.45, opacity: 0.95 }}>{data.excerpt}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8 }}>
            <div style={{ fontFamily: SERIF, color: t.kicker, fontSize: 36, fontStyle: "italic" }}>{data.clanName}{data.dateText ? ` · ${data.dateText}` : ""}</div>
            {data.qrDataUrl && qrImg(data.qrDataUrl, 116)}
          </div>
        </div>
      </div>
    );
  },
  // Ảnh trên, giấy dưới.
  photoTop(t: Theme, p: Preset, { data, format }: CardTemplateProps) {
    const imgH = format === "vertical" ? 980 : 560;
    return (
      <div style={frame(format, t.panel, { display: "flex", flexDirection: "column" })}>
        <div style={{ height: imgH, width: "100%", background: t.bg, position: "relative", overflow: "hidden" }}>
          {data.photoDataUrl
            ? <img src={data.photoDataUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: t.accent, fontSize: 120, fontFamily: SERIF }}>{p.ornament ?? "❖"}</div>}
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 6, background: t.accent }} />
        </div>
        <div style={{ flex: 1, padding: "52px 84px", display: "flex", flexDirection: "column", gap: 24 }}>
          <Kicker color={t.accent}>{p.kicker}</Kicker>
          <div style={{ fontFamily: SERIF, color: t.panelInk, fontSize: 64, fontWeight: 700, lineHeight: 1.18 }}>{data.title}</div>
          {data.excerpt && <div style={{ fontFamily: SERIF, color: t.panelInk, fontSize: 36, lineHeight: 1.5, flex: 1, overflow: "hidden" }}>{data.excerpt}</div>}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `2px solid ${t.accent}`, paddingTop: 22 }}>
            <div style={{ fontFamily: SERIF, color: t.accent, fontSize: 36, fontStyle: "italic", fontWeight: 600 }}>{data.clanName}{data.dateText ? ` · ${data.dateText}` : ""}</div>
            {data.qrDataUrl && qrImg(data.qrDataUrl, 104)}
          </div>
        </div>
      </div>
    );
  },
};

// ─── PRESETS — ~50 mẫu phủ đủ chủ đề ──────────────────────────────
const PRESETS: Preset[] = [
  // Giỗ Tổ / Tưởng niệm
  { id: "memorial-ox", name: "Tưởng niệm · oxblood", genre: "memorial", layout: "centered", theme: "oxblood", kicker: "Tưởng nhớ tổ tiên", ornament: "❖" },
  { id: "memorial-photo", name: "Tưởng niệm · ảnh nền", genre: "memorial", layout: "photoBg", theme: "oxblood", kicker: "Tưởng nhớ tổ tiên" },
  { id: "memorial-night", name: "Kính nhớ · đêm vàng", genre: "memorial", layout: "centered", theme: "night", kicker: "Kính nhớ gia tiên", ornament: "🕯️" },
  { id: "memorial-gioto", name: "Giỗ Tổ · ngày nổi bật", genre: "memorial", layout: "dateHero", theme: "oxblood", kicker: "Giỗ Tổ dòng họ", ornament: "🏮" },
  // Tảo mộ / Thanh minh / Chạp họ
  { id: "grave-thanhminh", name: "Thanh minh · tảo mộ", genre: "grave", layout: "dateHero", theme: "forest", kicker: "Thanh minh tảo mộ", ornament: "🌿" },
  { id: "grave-centered", name: "Tảo mộ · trang nhã", genre: "grave", layout: "centered", theme: "forest", kicker: "Tảo mộ tổ tiên", ornament: "⛰️" },
  { id: "grave-photo", name: "Chạp họ · ảnh", genre: "grave", layout: "photoTop", theme: "paper", kicker: "Chạp họ cuối năm" },
  { id: "grave-night", name: "Lễ chạp họ · đêm", genre: "grave", layout: "dateHero", theme: "night", kicker: "Lễ chạp họ", ornament: "🕯️" },
  // Vu Lan
  { id: "vulan-lotus", name: "Vu Lan · sen", genre: "vulan", layout: "centered", theme: "lotus", kicker: "Vu Lan báo hiếu", ornament: "🪷" },
  { id: "vulan-date", name: "Rằm tháng Bảy", genre: "vulan", layout: "dateHero", theme: "lotus", kicker: "Rằm tháng Bảy", ornament: "🪷" },
  { id: "vulan-quote", name: "Uống nước nhớ nguồn", genre: "vulan", layout: "quote", theme: "lotus", kicker: "Vu Lan" },
  // Họp họ
  { id: "reunion-royal", name: "Họp họ · trang trọng", genre: "reunion", layout: "dateHero", theme: "royal", kicker: "Họp mặt dòng họ", ornament: "🤝" },
  { id: "reunion-gold", name: "Kính mời họp họ", genre: "reunion", layout: "centered", theme: "gold", kicker: "Kính mời họp họ", ornament: "✦" },
  { id: "reunion-photo", name: "Gặp mặt · ảnh nền", genre: "reunion", layout: "photoBg", theme: "royal", kicker: "Gặp mặt dòng họ" },
  { id: "reunion-crimson", name: "Mời họp họ · rộn ràng", genre: "reunion", layout: "dateHero", theme: "crimson", kicker: "Mời họp họ", ornament: "🎉" },
  // Tết / Mừng xuân
  { id: "tet-classic", name: "Chúc mừng năm mới", genre: "tet", layout: "centered", theme: "tet", kicker: "Chúc mừng năm mới", ornament: "🧧" },
  { id: "tet-date", name: "Mừng xuân", genre: "tet", layout: "dateHero", theme: "tet", kicker: "Mừng xuân", ornament: "🌸" },
  { id: "tet-quote", name: "Cung chúc tân xuân", genre: "tet", layout: "quote", theme: "tet", kicker: "Tân xuân" },
  { id: "tet-crimson", name: "Tân niên như ý", genre: "tet", layout: "centered", theme: "crimson", kicker: "Tân niên như ý", ornament: "🧧" },
  // Mừng thọ
  { id: "longevity-jade", name: "Mừng thọ · ngọc", genre: "longevity", layout: "centered", theme: "jade", kicker: "Kính mừng đại thọ", ornament: "🎂" },
  { id: "longevity-date", name: "Lễ mừng thọ", genre: "longevity", layout: "dateHero", theme: "jade", kicker: "Lễ mừng thọ", ornament: "🌺" },
  { id: "longevity-photo", name: "Đại thọ · ảnh", genre: "longevity", layout: "photoBg", theme: "gold", kicker: "Kính mừng đại thọ" },
  { id: "longevity-gold", name: "Phúc · Lộc · Thọ", genre: "longevity", layout: "centered", theme: "gold", kicker: "Phúc Lộc Thọ", ornament: "✦" },
  // Câu chuyện / Giai thoại
  { id: "story-paper", name: "Câu chuyện · ảnh & giấy", genre: "story", layout: "photoTop", theme: "paper", kicker: "Câu chuyện dòng họ" },
  { id: "story-quote", name: "Giai thoại tổ tiên", genre: "story", layout: "quote", theme: "paper", kicker: "Giai thoại dòng họ" },
  { id: "story-night", name: "Chuyện kể · ảnh nền", genre: "story", layout: "photoBg", theme: "night", kicker: "Chuyện kể dòng họ" },
  { id: "story-gold", name: "Truyền thống dòng họ", genre: "story", layout: "centered", theme: "gold", kicker: "Truyền thống dòng họ", ornament: "❖" },
  // Từ đường / Di tích
  { id: "shrine-ox", name: "Từ đường · ảnh nền", genre: "shrine", layout: "photoBg", theme: "oxblood", kicker: "Từ đường dòng họ" },
  { id: "shrine-gold", name: "Nhà thờ họ · ảnh", genre: "shrine", layout: "photoTop", theme: "gold", kicker: "Nhà thờ họ" },
  { id: "shrine-forest", name: "Khánh thành từ đường", genre: "shrine", layout: "dateHero", theme: "forest", kicker: "Khánh thành từ đường", ornament: "🏛️" },
  { id: "shrine-royal", name: "Di tích dòng họ", genre: "shrine", layout: "centered", theme: "royal", kicker: "Di tích dòng họ", ornament: "🏛️" },
  // Khoe gia phả & Mời
  { id: "invite-paper", name: "Gia phả · giấy", genre: "invite", layout: "statHero", theme: "paper", kicker: "Gia phả dòng họ", ornament: "🌳" },
  { id: "invite-royal", name: "Cây gia phả · lam", genre: "invite", layout: "statHero", theme: "royal", kicker: "Cây gia phả", ornament: "🌳" },
  { id: "invite-ox", name: "Gia phả · oxblood", genre: "invite", layout: "statHero", theme: "oxblood", kicker: "Gia phả dòng họ", ornament: "🌳" },
  { id: "invite-jade", name: "Mời con cháu · ngọc", genre: "invite", layout: "statHero", theme: "jade", kicker: "Mời con cháu", ornament: "🌳" },
  // Tin vui
  { id: "joy-crimson", name: "Tin vui dòng họ", genre: "joy", layout: "centered", theme: "crimson", kicker: "Tin vui dòng họ", ornament: "🎉" },
  { id: "joy-date", name: "Chúc mừng · ngày", genre: "joy", layout: "dateHero", theme: "crimson", kicker: "Chúc mừng", ornament: "🎊" },
  { id: "joy-tangia", name: "Mừng tân gia", genre: "joy", layout: "photoBg", theme: "jade", kicker: "Mừng tân gia" },
  { id: "joy-baby", name: "Mừng đầy tháng", genre: "joy", layout: "centered", theme: "sky", kicker: "Mừng đầy tháng", ornament: "🍼" },
  { id: "joy-wedding", name: "Vu quy · Thành hôn", genre: "joy", layout: "centered", theme: "gold", kicker: "Hỷ sự dòng họ", ornament: "💍" },
  // Khuyến học / Vinh danh
  { id: "study-sky", name: "Vinh danh học tập", genre: "study", layout: "centered", theme: "sky", kicker: "Vinh danh học tập", ornament: "🎓" },
  { id: "study-date", name: "Khuyến học dòng họ", genre: "study", layout: "dateHero", theme: "sky", kicker: "Khuyến học dòng họ", ornament: "📚" },
  { id: "study-royal", name: "Bảng vàng dòng họ", genre: "study", layout: "centered", theme: "royal", kicker: "Bảng vàng dòng họ", ornament: "🏅" },
  // Tri ân / Công đức
  { id: "merit-gold", name: "Tri ân công đức", genre: "merit", layout: "centered", theme: "gold", kicker: "Tri ân công đức", ornament: "🙏" },
  { id: "merit-stat", name: "Công đức xây từ đường", genre: "merit", layout: "statHero", theme: "oxblood", kicker: "Công đức dòng họ", ornament: "🏮" },
  { id: "merit-royal", name: "Ghi công con cháu", genre: "merit", layout: "centered", theme: "royal", kicker: "Ghi công con cháu", ornament: "✦" },
  // Lời hay / Gia huấn
  { id: "wisdom-paper", name: "Lời dạy tổ tiên", genre: "wisdom", layout: "quote", theme: "paper", kicker: "Lời dạy tổ tiên" },
  { id: "wisdom-night", name: "Gia huấn · đêm", genre: "wisdom", layout: "quote", theme: "night", kicker: "Gia huấn dòng họ" },
  { id: "wisdom-jade", name: "Nếp nhà", genre: "wisdom", layout: "quote", theme: "jade", kicker: "Nếp nhà dòng họ" },
  { id: "wisdom-ox", name: "Gia phong dòng họ", genre: "wisdom", layout: "centered", theme: "oxblood", kicker: "Gia phong dòng họ", ornament: "❖" },
  // Sự kiện / Kính mời (chung)
  { id: "event-invite", name: "Kính mời · trang nhã", genre: "event", layout: "dateHero", theme: "paper", kicker: "Kính mời", ornament: "✦" },
  { id: "event-solemn", name: "Sự kiện · trang nghiêm", genre: "event", layout: "dateHero", theme: "oxblood", kicker: "Trân trọng kính mời", ornament: "🕯️" },
  { id: "event-royal", name: "Sự kiện · trang trọng", genre: "event", layout: "centered", theme: "royal", kicker: "Sự kiện dòng họ", ornament: "✦" },
];

export const CARD_TEMPLATES: CardTemplate[] = PRESETS.map((p) => ({
  id: p.id,
  name: p.name,
  genre: p.genre,
  render: (props: CardTemplateProps) => LAYOUTS[p.layout](T[p.theme], p, props),
}));

export function templatesByGenre(genre: CardGenre): CardTemplate[] {
  return CARD_TEMPLATES.filter((t) => t.genre === genre);
}
