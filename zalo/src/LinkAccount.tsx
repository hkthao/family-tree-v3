import { useState } from "react";

import { confirmAccountLink, requestAccountLink } from "./auth";

/**
 * Liên kết Zalo với tài khoản đã có trên web (bước 3 của kế hoạch).
 *
 * Người đăng ký bằng email trên web mà mở Mini App sẽ vào một tài khoản
 * mới tinh, không thấy dòng họ của mình. Nhập email → nhận mã qua thư →
 * nhập mã là Zalo này dùng chung tài khoản cũ.
 */
export function LinkAccount({ onLinked }: { onLinked: () => void }) {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    fn()
      .catch((e: Error) => setError(e.message))
      .finally(() => setBusy(false));
  };

  return (
    <section className="card link" style={{ marginTop: 0, marginBottom: 12 }}>
      <h2>Đã có tài khoản trên web?</h2>
      <p className="muted" style={{ margin: 0 }}>
        Liên kết để thấy các dòng họ bạn đã lập ở giapha.thaohk.com.
      </p>

      {step === "email" ? (
        <>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email đã đăng ký"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="field"
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            className="btn block"
            onClick={() =>
              run(async () => {
                await requestAccountLink(email.trim());
                setStep("code");
              })
            }
          >
            {busy ? "Đang gửi…" : "Gửi mã xác nhận"}
          </button>
        </>
      ) : (
        <>
          <p style={{ fontSize: 13, margin: "12px 0 0" }}>
            Nếu <b>{email}</b> có tài khoản, mã 6 số đã được gửi tới đó (hiệu
            lực 10 phút).
          </p>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="Mã 6 số"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="field"
            style={{ letterSpacing: 6, textAlign: "center", fontWeight: 600 }}
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            className="btn block"
            onClick={() =>
              run(async () => {
                await confirmAccountLink(code);
                onLinked();
              })
            }
          >
            {busy ? "Đang kiểm tra…" : "Liên kết"}
          </button>
          <button
            type="button"
            disabled={busy}
            className="btn text block"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
            }}
          >
            Đổi email
          </button>
        </>
      )}

      {error && <p className="error" style={{ margin: "10px 0 0" }}>{error}</p>}
    </section>
  );
}
