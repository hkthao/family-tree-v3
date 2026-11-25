import { OG_H, OG_W } from "@/components/cards/KhoeOgImage";
import { clanOgStyle, type ClanOgStyleId } from "@/lib/cards/clanOgStyles";

export interface ClanOgData {
  clanName: string;
  /** Câu giới thiệu ngắn (đã cắt); trống thì bỏ dòng này. */
  tagline: string | null;
  persons: number;
  generations: number | null;
  /** Quê gốc / địa danh (tuỳ chọn). */
  place: string | null;
}

/**
 * Ảnh xem trước 1200×630 của trang chủ dòng họ (dán link lên Facebook / Zalo). Chỉ style nội tuyến để html-to-image xuất đúng;
 * bố cục: tên họ thật lớn + câu giới thiệu + hàng số liệu. Đổi giao diện = sửa CLAN_OG_STYLES (lib/cards/clanOgStyles).
 */
export function ClanOgImage({
  styleId,
  data,
}: {
  styleId: ClanOgStyleId;
  data: ClanOgData;
}) {
  const s = clanOgStyle(styleId);
  const stats: Array<[string, string]> = [[String(data.persons), "thành viên"]];
  if (data.generations) stats.push([String(data.generations), "đời"]);
  if (data.place) stats.push([data.place, "quê gốc"]);
  return (
    <div
      style={{
        width: OG_W,
        height: OG_H,
        boxSizing: "border-box",
        position: "relative",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 26,
        padding: "0 96px",
        background: s.background,
        color: s.text,
        fontFamily: "'Be Vietnam Pro', system-ui, sans-serif",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 18,
          border: `1px solid ${s.frame}`,
          borderRadius: 20,
        }}
      />
      <div
        style={{
          fontSize: 26,
          letterSpacing: 6,
          textTransform: "uppercase",
          color: s.accent,
          fontWeight: 600,
        }}
      >
        Gia phả dòng họ
      </div>
      <div
        style={{
          fontFamily: "'Noto Serif', serif",
          fontWeight: 700,
          fontSize: 96,
          lineHeight: 1.1,
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
          overflowWrap: "anywhere",
        }}
      >
        {data.clanName}
      </div>
      {data.tagline && (
        <div
          style={{
            fontSize: 30,
            lineHeight: 1.4,
            color: s.muted,
            maxWidth: 900,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {data.tagline}
        </div>
      )}
      <div style={{ display: "flex", gap: 20, marginTop: 6 }}>
        {stats.map(([v, l]) => (
          <div
            key={l}
            style={{
              background: s.statBg,
              borderRadius: 16,
              padding: "14px 28px",
              maxWidth: 420,
            }}
          >
            <div
              style={{
                fontFamily: "'Noto Serif', serif",
                fontWeight: 700,
                fontSize: 44,
                lineHeight: 1.1,
                color: s.accent,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {v}
            </div>
            <div style={{ fontSize: 20, color: s.muted }}>{l}</div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          right: 56,
          bottom: 44,
          fontSize: 22,
          color: s.accent,
        }}
      >
        Dòng Họ Việt
      </div>
    </div>
  );
}
