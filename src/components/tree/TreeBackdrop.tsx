import type { Backdrop } from "@/lib/tree/viewPrefs";

/**
 * Nền phượng / rồng sau biểu đồ cây 2D (chọn ở Tuỳ chọn): lớp trang trí rất mờ để không át
 * chữ trong thẻ; PNG đen trong suốt nên đảo màu ở giao diện tối. Dùng chung trang Cây và Chia sẻ.
 */
export function TreeBackdrop({ backdrop }: { backdrop: Backdrop }) {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-lg bg-card"
    >
      {/* Chất liệu nền: hoa văn mây tản rất mờ + viền tối nhẹ (vignette) như giấy sắc / sơn mài. */}
      <div
        className="absolute inset-0 opacity-[0.07] dark:invert dark:opacity-[0.06]"
        style={{
          backgroundImage: "url(/textures/pat-endless-clouds.svg)",
          backgroundSize: "56px 28px",
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(90,50,20,0.10) 100%)",
        }}
      />
      {backdrop === "phoenix" && (
        <img
          src="/watermarks/phoenix.png"
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute left-1/2 top-1/2 h-[80%] max-h-[560px] w-auto -translate-x-1/2 -translate-y-1/2 opacity-[0.08] dark:invert dark:opacity-[0.11]"
        />
      )}
      {backdrop === "dragon" && (
        <img
          src="/watermarks/dragon.png"
          alt=""
          loading="lazy"
          draggable={false}
          className="absolute left-1/2 top-1/2 w-[92%] max-w-[640px] -translate-x-1/2 -translate-y-1/2 opacity-[0.10] dark:invert dark:opacity-[0.12]"
        />
      )}
    </div>
  );
}
