/**
 * reCAPTCHA v3 phía trình duyệt (docs/plan-recaptcha-public.md, mục 4). Chỉ dùng cho biểu mẫu của KHÁCH chưa đăng nhập.
 *
 * - Site key đặt ở VITE_RECAPTCHA_SITE_KEY (công khai). Không có key → mọi thứ im lặng bỏ qua (dev / CI).
 * - Script chỉ nạp khi một biểu mẫu có captcha được mở (`preloadRecaptcha`), không nạp toàn trang.
 * - `getCaptchaToken` lấy mã NGAY LÚC BẤM GỬI (mã sống ~2 phút, dùng một lần). KHÔNG BAO GIỜ ném lỗi / treo: Google lỗi, bị chặn
 *   bởi trình chặn quảng cáo hay quá chậm thì trả null — máy chủ tự quyết (chế độ log cho qua, enforce từ chối với thông báo rõ ràng).
 */

type Grecaptcha = {
  ready: (cb: () => void) => void;
  execute: (siteKey: string, opts: { action: string }) => Promise<string>;
};

const siteKey = (): string =>
  (
    (import.meta.env.VITE_RECAPTCHA_SITE_KEY as string | undefined) ?? ""
  ).trim();

export const captchaEnabled = (): boolean => siteKey() !== "";

/** Tên action khớp với máy chủ (supabase/functions/_shared/recaptcha.ts) — sai action là bị từ chối. */
export type CaptchaAction =
  "guest_memory" | "guest_answer" | "guest_face" | "guest_contribution" | "feedback";

let loading: Promise<boolean> | null = null;

/** Nạp script một lần. Trả true khi `grecaptcha` dùng được. */
export function preloadRecaptcha(): Promise<boolean> {
  const key = siteKey();
  if (!key || typeof document === "undefined") return Promise.resolve(false);
  if ((window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha?.execute)
    return Promise.resolve(true);
  if (loading) return loading;
  loading = new Promise<boolean>((resolve) => {
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(key)}`;
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      loading = null; // cho phép thử lại lần sau
      resolve(false);
    };
    document.head.appendChild(s);
  });
  return loading;
}

const withTimeout = <T>(p: Promise<T>, ms: number): Promise<T | null> =>
  new Promise((resolve) => {
    const t = setTimeout(() => resolve(null), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      () => {
        clearTimeout(t);
        resolve(null);
      },
    );
  });

export async function getCaptchaToken(
  action: CaptchaAction,
  timeoutMs = 5000,
): Promise<string | null> {
  const key = siteKey();
  if (!key) return null;
  const run = async (): Promise<string | null> => {
    if (!(await preloadRecaptcha())) return null;
    const g = (window as unknown as { grecaptcha?: Grecaptcha }).grecaptcha;
    if (!g) return null;
    await new Promise<void>((r) => g.ready(r));
    return g.execute(key, { action });
  };
  return withTimeout(run(), timeoutMs);
}
