import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

import { AppLogo } from "@/components/AppLogo";
import { TimelineIcon } from "@/components/timeline/TimelineIcon";
import { pickScene, TimelineScene } from "@/components/timeline/TimelineScene";
import { parseImageRef } from "@/lib/timeline/images";
import { creditText, findLibraryPhotoByUrl } from "@/lib/timeline/photoLibrary";
import type { MilestoneContext } from "@/lib/timeline/context";
import type { Milestone } from "@/lib/timeline/mergeTimeline";
import { getPosterTheme, type PosterTheme } from "@/lib/timeline/themes";

import { t } from "@lingui/core/macro";

/**
 * Poster dòng thời gian — nền giấy kem cố định (không đổi theo giao diện sáng/tối) để khi xuất ảnh/in
 * cho ra đúng một diện mạo. Một component cho cả trang xem lẫn xuất poster; hai kiểu xếp:
 *  - "horizontal": trục nằm ngang, cuộn ngang (giống poster mẫu, hợp màn rộng / in);
 *  - "vertical": trục dọc, cuộn dọc (hợp điện thoại).
 * Hai kiểu dùng chung các mảnh (nhãn, khung ảnh, chữ, thẻ bối cảnh) nên đổi kiểu vẽ chỉ sửa một chỗ.
 */
const ThemeCtx = createContext<PosterTheme>(getPosterTheme(null));
const useTheme = () => useContext(ThemeCtx);

/** Phần của mốc mà poster cần vẽ (Milestone thoả mãn). */
export type PosterEntry = Pick<
  Milestone,
  "key" | "bucket" | "year" | "era" | "title" | "body" | "iconKey" | "context" | "imageUrl"
>;

export interface PosterMilestone {
  c: PosterEntry;
  /** URL ảnh người đại diện (đã ký); thiếu thì dùng hình minh hoạ theo `iconKey`. */
  photoUrl?: string | null;
}

export type PosterLayout = "horizontal" | "vertical";

export function TimelinePoster({
  clanName,
  items,
  tagline,
  onSelect,
  layout = "horizontal",
  themeId,
  bare = false,
  qrUrl,
  title,
  subtitle,
  quote,
  iconFrames = !bare,
}: {
  /** Tên hiện trong tiêu đề (dòng họ); bỏ qua khi `bare`. */
  clanName: string;
  items: PosterMilestone[];
  tagline?: string;
  /** Có = bấm vào một mốc để sửa (người có quyền sửa). */
  onSelect?: (c: PosterEntry) => void;
  layout?: PosterLayout;
  /** Mẫu nền (xem lib/timeline/themes.ts); mặc định "Giấy kem". */
  themeId?: string | null;
  /**
   * Chế độ nhúng (dòng thời gian của một người trong Danh bạ): KHÔNG tiêu đề / câu chốt, khung ảnh chỉ hiện khi
   * mốc có hình thật (không chèn biểu tượng cho từng dòng), và nếu không mốc nào có thẻ bối cảnh thì xếp một bên.
   */
  bare?: boolean;
  /** Có = in mã QR (quét để xem dòng thời gian) ở chân poster; xuất PDF/PNG cũng mang theo mã này. */
  qrUrl?: string | null;
  /** Tiêu đề thay cho "Dòng họ {tên}" (vd. tên một người cho dòng thời gian cá nhân). */
  title?: string;
  /** Dòng nghiêng dưới tiêu đề (mặc định "Câu chuyện qua các thế hệ"). */
  subtitle?: string;
  /** Câu chốt ở chân poster (mặc định "Mỗi thế hệ một hành trình — chung một cội nguồn."). */
  quote?: string;
  /**
   * Mốc không có hình thật vẫn vẽ khung ảnh kèm biểu tượng (mặc định: có, trừ chế độ nhúng `bare`). Dòng thời gian
   * một người thường có nhiều mốc nên tắt để khỏi chèn hàng chục khung biểu tượng.
   */
  iconFrames?: boolean;
}) {
  const th = getPosterTheme(themeId);
  // Tên dòng họ thường đã có chữ "Họ" ("Họ Hồ") → bỏ đi để tiêu đề không thành "Dòng họ Họ Hồ".
  const shortName = clanName.replace(/^\s*họ\s+/i, "").trim() || clanName;
  return (
    <ThemeCtx.Provider value={th}>
    <div
      className="overflow-hidden rounded-xl border shadow-sm"
      style={{ background: th.bg, color: th.text, borderColor: th.border }}
    >
      <SealFilter />
      {!bare && (
      <header className="px-4 pt-7 text-center">
        <div className="mx-auto mb-2 flex justify-center">
          <AppLogo size={44} />
        </div>
        <h2
          className="font-serif text-3xl font-bold uppercase tracking-wide"
          style={{ color: th.ink }}
        >
          {title ?? t`Dòng họ ${shortName}`}
        </h2>
        <p className="mt-1 font-serif text-lg italic" style={{ color: th.green }}>
          {subtitle ?? t`Câu chuyện qua các thế hệ`}
        </p>
        {tagline && (
          <p className="mt-1 text-sm" style={{ color: th.muted }}>
            {tagline}
          </p>
        )}
      </header>
      )}

      {layout === "vertical" ? (
        <Vertical items={items} onSelect={onSelect} iconFrames={iconFrames} />
      ) : (
        <Horizontal items={items} onSelect={onSelect} iconFrames={iconFrames} />
      )}

      {!bare && (
        <footer className="flex items-center gap-3 px-8 pb-5 pt-1">
          {qrUrl && <PosterQr url={qrUrl} />}
          <div className="min-w-0 space-y-1 text-left">
            <p className="font-serif text-xs italic" style={{ color: th.ink }}>
              {quote ?? t`Mỗi thế hệ một hành trình — chung một cội nguồn.`}
            </p>
            {qrUrl && (
              <p className="text-[11px] leading-snug" style={{ color: th.muted }}>
                {t`Quét mã để xem dòng thời gian của dòng họ trên điện thoại`}
              </p>
            )}
          </div>
        </footer>
      )}
    </div>
    </ThemeCtx.Provider>
  );
}

/** Mã QR dẫn tới trang xem dòng thời gian — nền trắng, chữ đen để quét được trên mọi mẫu nền. */
function PosterQr({ url }: { url: string }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const QR = (await import("qrcode")).default;
        const data = await QR.toDataURL(url, {
          width: 240,
          margin: 1,
          errorCorrectionLevel: "M",
          color: { dark: "#1F1A17", light: "#FFFFFF" },
        });
        if (!cancelled) setSrc(data);
      } catch {
        if (!cancelled) setSrc(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [url]);
  if (!src) return null;
  return (
    <img
      src={src}
      alt={t`Mã QR xem dòng thời gian`}
      width={64}
      height={64}
      className="shrink-0 rounded bg-white p-0.5 shadow-sm"
    />
  );
}

// ─── Các mảnh dùng chung ───────────────────────────────────────────

/** Vùng bấm được (khi có quyền sửa): cả nhãn + ảnh + chữ của một mốc. */
function Clickable({
  c,
  onSelect,
  className,
  style,
  children,
}: {
  c: PosterEntry;
  onSelect?: (c: PosterEntry) => void;
  className: string;
  style?: React.CSSProperties;
  children: ReactNode;
}) {
  if (!onSelect)
    return (
      <div className={className} style={style}>
        {children}
      </div>
    );
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={t`Sửa mốc ${c.title}`}
      style={style}
      onClick={() => onSelect(c)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(c);
        }
      }}
      className={`${className} cursor-pointer transition-colors hover:bg-black/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2`}
    >
      {children}
    </div>
  );
}

/** "inherit": không tự căn — chữ theo lớp căn của khối cha (dùng cho kiểu dọc so le, căn khác nhau theo bên). */
type Align = "center" | "left" | "right" | "inherit";
const ALIGN_CLASS: Record<Align, string> = {
  center: "text-center",
  left: "text-left",
  right: "text-right",
  inherit: "",
};

/** Khung ảnh trắng kiểu polaroid, hơi nghiêng; không có ảnh thì dùng hình minh hoạ. */
function Photo({
  c,
  photoUrl,
  tilt,
}: {
  c: PosterEntry;
  photoUrl?: string | null;
  tilt: number;
}) {
  const th = useTheme();
  return (
    <div
      className="w-full bg-white p-1.5 shadow-md"
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <div
        className="relative flex aspect-[4/3] items-center justify-center overflow-hidden"
        style={{
          background: photoUrl ? "#e9e0cc" : "linear-gradient(160deg,#EFE3C6,#E2D2AC)",
          color: th.noteInk,
        }}
      >
        <PhotoContent c={c} photoUrl={photoUrl} />
      </div>
    </div>
  );
}

/** Nội dung khung ảnh: hình riêng của mốc (thư viện / link) thắng ảnh người; không có gì thì dùng biểu tượng. */
export function PhotoContent({
  c,
  photoUrl,
}: {
  c: Pick<PosterEntry, "imageUrl" | "iconKey"> & { key?: string };
  photoUrl?: string | null;
}) {
  const ref = parseImageRef(c.imageUrl);
  const [broken, setBroken] = useState(false);
  // Mốc chưa có hình: tự chọn một cảnh minh hoạ trong thư viện (ổn định theo khoá mốc) thay vì chỉ một biểu tượng trơ.
  const icon = c.key ? (
    <TimelineScene id={pickScene(c.key, c.iconKey)} className="absolute inset-0 h-full w-full" />
  ) : (
    <TimelineIcon name={c.iconKey} className="h-14 w-14 opacity-80" />
  );
  if (ref?.kind === "lib") {
    return <TimelineScene id={ref.id} className="absolute inset-0 h-full w-full" />;
  }
  const src = ref?.kind === "url" && !broken ? ref.url : (photoUrl ?? null);
  if (!src) return icon;
  const isExternal = ref?.kind === "url" && !broken;
  // Ảnh tư liệu từ thư viện (CC BY / CC BY-SA bắt buộc ghi công): hiện dòng ghi nguồn nhỏ dưới ảnh.
  const credit = isExternal ? findLibraryPhotoByUrl(ref.url) : null;
  return (
    <>
    <img
      src={src}
      alt=""
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={isExternal ? () => setBroken(true) : undefined}
      className={`h-full w-full object-cover ${isExternal ? "" : "[filter:sepia(0.35)_contrast(1.02)]"}`}
    />
    {credit && (
      <span className="absolute inset-x-0 bottom-0 truncate bg-black/55 px-1.5 py-0.5 text-left text-[10px] leading-tight text-white">
        {creditText(credit)}
      </span>
    )}
    </>
  );
}

function Text({ c, align, tight }: { c: PosterEntry; align: Align; tight?: boolean }) {
  const th = useTheme();
  return (
    <div className={ALIGN_CLASS[align]}>
      <p className={`${tight ? "" : "mt-3 "}text-sm font-semibold leading-snug`} style={{ color: th.ink }}>
        {c.title}
      </p>
      <p className="mt-1 text-xs leading-relaxed">{c.body}</p>
    </div>
  );
}

/** Thẻ "giấy ghi chú" bối cảnh thời đại. */
function EraNote({ era, i }: { era?: MilestoneContext | null; i: number }) {
  const th = useTheme();
  if (!era) return null;
  return (
    <div
      className="h-full rounded-md p-2.5 text-xs shadow-sm"
      style={{ background: th.notes[i % th.notes.length], color: th.noteText }}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <TimelineIcon name={era.iconKey} className="h-5 w-5 shrink-0" />
        <p className="font-serif text-[13px] font-bold leading-tight" style={{ color: th.noteInk }}>
          {era.title}
        </p>
      </div>
      <ul className="list-disc space-y-0.5 pl-4">
        {era.bullets.slice(0, 3).map((b) => (
          <li key={b}>{b}</li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Con triện trên trục, NĂM nằm trong dấu — theo mẫu triện thật: khung chữ nhật ngang bo góc, viền đậm màu đỏ son, chữ
 * đỏ trên nền giấy, nét hơi lem như khắc tay (bộ lọc `seal-rough` trong poster) và nghiêng nhẹ xen kẽ như đóng tay.
 * Nền trùng màu giấy để che đường trục phía sau; màu mực theo mẫu nền (đỏ son trên nền sáng, vàng trên nền đỏ / tối).
 */
function Seal({ year, era, tilt = 0 }: { year: number; era?: string | null; tilt?: number }) {
  const th = useTheme();
  return (
    <span
      className={`relative flex w-[4.75rem] flex-col items-center justify-center rounded-[5px] border-[3px] font-serif font-bold leading-none ${era ? "h-11 py-0.5" : "h-9"}`}
      style={{
        color: th.seal,
        borderColor: th.seal,
        background: th.solid,
        boxShadow: `0 0 0 4px ${th.solid}`,
        transform: `rotate(${tilt}deg)`,
        filter: "url(#seal-rough)",
      }}
    >
      <span className="text-lg tracking-wide">{year}</span>
      {era && <span className="mt-0.5 whitespace-nowrap text-[11px] font-bold leading-none">{era}</span>}
    </span>
  );
}

/** Bộ lọc làm nét viền / chữ con triện hơi lem như khắc tay — đặt TRONG poster để xuất PNG/PDF mang theo. */
function SealFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
      <defs>
        <filter id="seal-rough" x="-5%" y="-5%" width="110%" height="110%">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="0.8" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}

// ─── Kiểu ngang: SO LE trên / dưới trục ────────────────────────────
// Mốc lẻ (1, 3, …): thẻ bối cảnh PHÍA TRÊN trục, ảnh + mô tả PHÍA DƯỚI; mốc chẵn đảo lại.

function Horizontal({
  items,
  onSelect,
  iconFrames,
}: {
  items: PosterMilestone[];
  onSelect?: (c: PosterEntry) => void;
  iconFrames?: boolean;
}) {
  const th = useTheme();
  // Không mốc nào có thẻ bối cảnh (dòng thời gian một người): so le trên / dưới chỉ để lại những khoảng trống lớn và
  // chữ trôi lơ lửng → xếp MỘT phía (dưới trục), mỗi mốc là một thẻ nối với dấu triện, cột cố định xếp từ trái.
  const oneSide = items.every((it) => !it.c.context);
  // Poster dòng họ: mỗi cột 11.5rem → 20rem, dải căn giữa (ít mốc không dồn về một bên); nhiều mốc thì cuộn ngang.
  const n = Math.max(items.length, 1);
  const cols = oneSide ? `repeat(${n}, 13rem)` : `repeat(${n}, minmax(11.5rem, 20rem))`;
  return (
    <div className="overflow-x-auto">
      <div className={`px-8 pb-6 ${oneSide ? "pt-6" : "pt-5"}`}>
        <div
          className={`grid gap-x-4 ${oneSide ? "" : "justify-center"}`}
          style={{
            gridTemplateColumns: cols,
            minWidth: oneSide ? undefined : `calc(${n} * 11.5rem + ${n - 1} * 1rem)`,
          }}
        >
          {/* Hàng 1 (trên trục): mốc lẻ = thẻ bối cảnh, mốc chẵn = ảnh + mô tả — chỉ khi xếp so le */}
          {!oneSide &&
            items.map(({ c, photoUrl }, i) => {
              const flip = i % 2 === 1; // flip: ảnh + mô tả ở TRÊN, bối cảnh ở DƯỚI
              return flip ? (
                <Clickable
                  key={`top-${c.key}`}
                  c={c}
                  onSelect={onSelect}
                  className="flex flex-col items-stretch self-end rounded-xl p-3"
                  style={{ gridRow: 1, gridColumn: i + 1 }}
                >
                  {(iconFrames || c.imageUrl || photoUrl) && (
                    <div className="w-full">
                      <Photo c={c} photoUrl={photoUrl} tilt={i % 2 ? 1.2 : -1.2} />
                    </div>
                  )}
                  <Text c={c} align="left" tight={!(iconFrames || c.imageUrl || photoUrl)} />
                </Clickable>
              ) : (
                <div
                  key={`top-${c.key}`}
                  className="self-end"
                  style={{ gridRow: 1, gridColumn: i + 1 }}
                >
                  <EraNote era={c.context} i={i} />
                </div>
              );
            })}

          {/* Hàng 2: trục thời gian + con triện năm */}
          <div className="relative my-4 h-11" style={{ gridColumn: "1 / -1", gridRow: 2 }}>
            <div
              className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full"
              style={{ background: th.line }}
            />
          </div>
          {items.map(({ c }, i) => (
            <div
              key={`d-${c.key}`}
              className={`relative z-10 my-4 flex h-11 items-center ${oneSide ? "justify-start" : "justify-center"}`}
              style={{ gridRow: 2, gridColumn: i + 1 }}
            >
              <Seal year={c.year} era={c.era} tilt={i % 2 ? 1.5 : -1.5} />
              {oneSide && (
                // nét nối con triện → thẻ nội dung bên dưới
                <span
                  className="absolute left-[2.375rem] top-full h-4 w-0.5 -translate-x-1/2"
                  style={{ background: th.line }}
                />
              )}
            </div>
          ))}

          {/* Hàng 3 (dưới trục): so le thì ngược với hàng 1; một phía thì mọi mốc đều ở đây, trong thẻ */}
          {items.map(({ c, photoUrl }, i) => {
            const flip = !oneSide && i % 2 === 1;
            return flip ? (
              <div
                key={`bot-${c.key}`}
                className="self-start"
                style={{ gridRow: 3, gridColumn: i + 1 }}
              >
                <EraNote era={c.context} i={i} />
              </div>
            ) : (
              <Clickable
                key={`bot-${c.key}`}
                c={c}
                onSelect={onSelect}
                className={`flex flex-col items-stretch self-start rounded-xl p-3 ${
                  oneSide ? "border" : ""
                }`}
                style={{
                  gridRow: 3,
                  gridColumn: i + 1,
                  ...(oneSide ? { borderColor: th.border, background: "rgba(255,255,255,.35)" } : {}),
                }}
              >
                {(iconFrames || c.imageUrl || photoUrl) && (
                  <div className="w-full">
                    <Photo c={c} photoUrl={photoUrl} tilt={i % 2 ? 1.2 : -1.2} />
                  </div>
                )}
                <Text c={c} align="left" tight={!(iconFrames || c.imageUrl || photoUrl)} />
              </Clickable>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Kiểu dọc: SO LE — thẻ bối cảnh và (ảnh + mô tả) đổi bên trái/phải xen kẽ quanh trục ─
// Mốc lẻ (1, 3, …): thẻ bối cảnh bên TRÁI, ảnh + mô tả bên PHẢI; mốc chẵn đảo lại.
// Điện thoại (màn hẹp): một cột, trục sát lề trái; ảnh + mô tả trước, thẻ bối cảnh ngay sau.

function Vertical({
  items,
  onSelect,
  iconFrames,
}: {
  items: PosterMilestone[];
  onSelect?: (c: PosterEntry) => void;
  iconFrames?: boolean;
}) {
  const th = useTheme();
  // Không mốc nào có thẻ bối cảnh → xếp MỘT bên ở mọi cỡ màn hình (so le sẽ chỉ để lại nửa trống).
  const oneSide = items.every((it) => !it.c.context);
  const wide = (cls: string) => (oneSide ? "" : cls); // lớp chỉ áp cho màn rộng khi xếp so le
  return (
    <ol className={`relative px-4 pb-4 pt-6 ${oneSide ? "" : "mx-auto max-w-4xl"}`}>
      {items.map(({ c, photoUrl }, i) => {
        // flip = true: ảnh + mô tả nằm bên TRÁI, thẻ bối cảnh bên PHẢI.
        const flip = i % 2 === 1;
        return (
          <li
            key={c.key}
            className={`relative mb-8 flex flex-col pl-[5.75rem] last:mb-2 ${wide("sm:grid sm:grid-cols-[1fr_4.75rem_1fr] sm:pl-0")}`}
          >
            {/* Đoạn trục (dày 4px) — vẽ trong từng mốc để luôn thẳng hàng với chấm. Mốc nào cũng có đoạn:
                giữa các mốc nối liền nhau (kéo qua khoảng cách mb-8 + 1px chống hở), mốc cuối kéo hết hàng. */}
            <span
              className={`absolute top-0 w-1 rounded-full left-[calc(2.375rem-2px)] ${wide("sm:left-[calc(50%-2px)]")}`}
              style={{
                bottom: i < items.length - 1 ? "calc(-2rem - 1px)" : "0",
                background: th.line,
              }}
            />
            <span className={`absolute left-0 top-0 z-10 flex w-[4.75rem] justify-center ${wide("sm:left-[calc(50%-2.375rem)] sm:top-1/2 sm:-translate-y-1/2")}`}>
              <Seal year={c.year} era={c.era} tilt={i % 2 ? 1.5 : -1.5} />
            </span>

            {/* Thẻ bối cảnh thời đại: sát trục, căn giữa hàng (không có thì không vẽ) */}
            {c.context && (
              <div
                className={`order-2 mt-3 ${wide(
                  `sm:mt-0 sm:flex sm:self-center ${
                    flip
                      ? "sm:order-3 sm:justify-start sm:pl-4"
                      : "sm:order-1 sm:justify-end sm:pr-4"
                  }`,
                )}`}
              >
                <div className="w-full sm:max-w-xs">
                  <EraNote era={c.context} i={i} />
                </div>
              </div>
            )}

            {!oneSide && <div className="hidden sm:order-2 sm:block" />}

            {/* Năm, ảnh, mô tả: bên đối diện; bên trái thì chữ căn phải, ảnh dính trục */}
            <div
              className={`order-1 ${wide(
                `sm:self-center ${flip ? "sm:order-1 sm:pr-4" : "sm:order-3 sm:pl-4"}`,
              )}`}
            >
              <Clickable c={c} onSelect={onSelect} className="rounded-xl p-4">
                {(iconFrames || c.imageUrl || photoUrl) && (
                  <div className="max-w-sm">
                    <Photo c={c} photoUrl={photoUrl} tilt={i % 2 ? 1 : -1} />
                  </div>
                )}
                <div className="text-left">
                  <Text c={c} align="inherit" />
                </div>
              </Clickable>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
