import { formatLunarDate, solarStringToLunar } from "@/lib/lunarDate";
import { GENERATION_COLORS, generationColor } from "@/lib/tree/folderModel";

/**
 * Bước 1 của kế hoạch (docs/plan-zalo-mini-app.md): màn hình KIỂM CHỨNG,
 * chưa phải giao diện thật.
 *
 * Việc duy nhất nó cần chứng minh: Mini App gọi được logic dùng chung
 * trong `src/lib` của web — một hàm thuần (màu theo đời) và một hàm kéo
 * theo thư viện cài ở node_modules gốc (đổi ngày âm lịch). Hai thứ này
 * chạy được thì các bước sau (đăng nhập, cây thư mục) mới có nền để dựng.
 */
export function App() {
  const today = new Date().toISOString().slice(0, 10);
  const lunar = solarStringToLunar(today);

  return (
    <main style={{ padding: 16, fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 20, margin: "0 0 4px" }}>Dòng Họ Việt</h1>
      <p style={{ margin: "0 0 16px", color: "#6F665F", fontSize: 14 }}>
        Bản kiểm chứng: Mini App dùng chung logic với bản web.
      </p>

      <p style={{ fontSize: 14 }}>
        Hôm nay {today} — âm lịch: <b>{lunar ? formatLunarDate(lunar) : "?"}</b>
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {GENERATION_COLORS.map((_, i) => (
          <span
            key={i}
            style={{
              background: generationColor(i + 1) ?? undefined,
              color: "#fff",
              borderRadius: 999,
              padding: "2px 10px",
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            Đời {i + 1}
          </span>
        ))}
      </div>
    </main>
  );
}
