import { useEffect } from "react";

import { captchaEnabled, preloadRecaptcha } from "@/lib/recaptcha";

import { t } from "@lingui/core/macro";

/**
 * Dòng bắt buộc của Google khi ẩn huy hiệu reCAPTCHA (index.css ẩn `.grecaptcha-badge`) + nạp script khi biểu mẫu của khách mở.
 * Không có site key thì không vẽ gì.
 */
export function CaptchaNotice({ className }: { className?: string }) {
  const on = captchaEnabled();
  useEffect(() => {
    if (on) void preloadRecaptcha();
  }, [on]);
  if (!on) return null;
  return (
    <p className={className ?? "text-xs text-muted-foreground"}>
      {t`Trang này được bảo vệ bởi reCAPTCHA; áp dụng`}{" "}
      <a
        href="https://policies.google.com/privacy"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {t`Chính sách quyền riêng tư`}
      </a>{" "}
      {t`và`}{" "}
      <a
        href="https://policies.google.com/terms"
        target="_blank"
        rel="noopener noreferrer"
        className="underline"
      >
        {t`Điều khoản dịch vụ`}
      </a>{" "}
      {t`của Google.`}
    </p>
  );
}
