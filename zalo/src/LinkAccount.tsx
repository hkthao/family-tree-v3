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

  const field = {
    width: "100%",
    padding: "10px 12px",
    fontSize: 16, // dưới 16px iOS tự phóng to khi bấm vào ô
    border: "1px solid #D8CFC2",
    borderRadius: 8,
    boxSizing: "border-box",
  } as const;
  const button = {
    marginTop: 8,
    padding: "10px 16px",
    fontSize: 15,
    border: 0,
    borderRadius: 8,
    background: "#7A2E2E",
    color: "#fff",
    opacity: busy ? 0.6 : 1,
  } as const;

  return (
    <section style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #E8E0D2" }}>
      <h2 style={{ fontSize: 16, margin: "0 0 4px" }}>Đã có tài khoản trên web?</h2>
      <p style={{ fontSize: 13, color: "#6F665F", margin: "0 0 12px" }}>
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
            style={field}
          />
          <button
            type="button"
            disabled={busy || !email.trim()}
            style={button}
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
          <p style={{ fontSize: 13, margin: "0 0 8px" }}>
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
            style={{ ...field, letterSpacing: 4 }}
          />
          <button
            type="button"
            disabled={busy || code.length !== 6}
            style={button}
            onClick={() =>
              run(async () => {
                await confirmAccountLink(code);
                onLinked();
              })
            }
          >
            {busy ? "Đang kiểm tra…" : "Liên kết"}
          </button>{" "}
          <button
            type="button"
            disabled={busy}
            style={{ ...button, background: "transparent", color: "#7A2E2E" }}
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

      {error && <p style={{ color: "#B3261E", fontSize: 13 }}>{error}</p>}
    </section>
  );
}
